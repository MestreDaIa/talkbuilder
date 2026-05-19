-- Migration: Fix Multi-tenant Architecture and Permissions
-- Description: Ensures workspaces, members and invitations are correctly handled.

-- 1. Tables
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    plan TEXT DEFAULT 'starter',
    embed_source TEXT,
    embed_company_id TEXT,
    embed_plan_tier TEXT,
    embed_plan_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor')),
    token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

-- 2. Functions & Triggers

-- Trigger function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS 7625
DECLARE
    new_workspace_id UUID;
    v_slug TEXT;
    v_display_name TEXT;
    v_plan TEXT;
BEGIN
    -- Extract metadata with fallbacks
    v_slug := COALESCE(new.raw_user_meta_data->>'slug', 'user-' || substr(new.id::text, 1, 8));
    v_display_name := COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));
    v_plan := COALESCE(new.raw_user_meta_data->>'plan', 'starter');

    -- Create Profile
    INSERT INTO public.profiles (id, slug, display_name, plan)
    VALUES (new.id, v_slug, v_display_name, v_plan)
    ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        display_name = EXCLUDED.display_name,
        plan = EXCLUDED.plan;

    -- Create Workspace for the owner
    INSERT INTO public.workspaces (name, slug)
    VALUES (v_display_name || ' Workspace', v_slug)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO new_workspace_id;

    -- Add User as Owner of the Workspace
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, new.id, 'owner')
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';

    RETURN new;
END;
7625 LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC for fetching workspaces for current user
CREATE OR REPLACE FUNCTION public.get_my_workspaces()
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    role TEXT
) AS 7625
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.name,
        w.slug,
        wm.role
    FROM public.workspaces w
    JOIN public.workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = auth.uid();
END;
7625 LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RLS (Row Level Security)

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Workspaces: access if member
CREATE POLICY "Users can view workspaces they are members of" ON public.workspaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members 
            WHERE workspace_id = public.workspaces.id AND user_id = auth.uid()
        )
    );

-- Workspace Members: access if member of the same workspace
CREATE POLICY "Members can view other members in same workspace" ON public.workspace_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members 
            WHERE workspace_id = public.workspace_members.workspace_id AND user_id = auth.uid()
        )
    );

-- Profiles: public or own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Invitations: access if owner/admin of workspace
CREATE POLICY "Admins can manage invitations" ON public.workspace_invites
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members 
            WHERE workspace_id = public.workspace_invites.workspace_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        )
    );
