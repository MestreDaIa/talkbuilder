-- Repair workspace membership backfill and invitation flow.
-- Existing auth users must be linked to their workspace through workspace_members.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE,
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
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.workspace_invites ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
      AND wm.role IN ('owner', 'admin')
  );
$$;

DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON public.workspaces;
DROP POLICY IF EXISTS "Members can view other members in same workspace" ON public.workspace_members;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.workspace_invites;
DROP POLICY IF EXISTS "Users can view member workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view memberships in their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can insert own accepted memberships" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers can create invitations" ON public.workspace_invites;
DROP POLICY IF EXISTS "Managers can view invitations" ON public.workspace_invites;
DROP POLICY IF EXISTS "Managers can update invitations" ON public.workspace_invites;

CREATE POLICY "Users can view member workspaces"
ON public.workspaces
FOR SELECT
TO authenticated
USING (public.is_workspace_member(id, auth.uid()));

CREATE POLICY "Users can view memberships in their workspaces"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert own accepted memberships"
ON public.workspace_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Managers can create invitations"
ON public.workspace_invites
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_workspace(workspace_id, auth.uid()) AND invited_by = auth.uid());

CREATE POLICY "Managers can view invitations"
ON public.workspace_invites
FOR SELECT
TO authenticated
USING (
  public.can_manage_workspace(workspace_id, auth.uid())
  OR lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
);

CREATE POLICY "Managers can update invitations"
ON public.workspace_invites
FOR UPDATE
TO authenticated
USING (
  public.can_manage_workspace(workspace_id, auth.uid())
  OR lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
)
WITH CHECK (
  public.can_manage_workspace(workspace_id, auth.uid())
  OR lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
);

CREATE OR REPLACE FUNCTION public.normalize_workspace_slug(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(regexp_replace(COALESCE(NULLIF(trim(_value), ''), 'workspace'), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_workspace_id UUID;
  v_slug TEXT;
  v_display_name TEXT;
  v_plan TEXT;
BEGIN
  v_slug := public.normalize_workspace_slug(COALESCE(NEW.raw_user_meta_data->>'slug', split_part(NEW.email, '@', 1), 'user-' || substr(NEW.id::text, 1, 8)));
  v_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'Usuário');
  v_plan := COALESCE(NEW.raw_user_meta_data->>'plan', 'starter');

  INSERT INTO public.profiles (id, slug, display_name, plan)
  VALUES (NEW.id, v_slug, v_display_name, v_plan)
  ON CONFLICT (id) DO UPDATE SET
    slug = COALESCE(public.profiles.slug, EXCLUDED.slug),
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    plan = COALESCE(public.profiles.plan, EXCLUDED.plan);

  INSERT INTO public.workspaces (name, slug)
  VALUES (v_display_name || ' Workspace', v_slug)
  ON CONFLICT (slug) DO UPDATE SET updated_at = now()
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner', updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.get_my_workspaces()
RETURNS TABLE (id UUID, name TEXT, slug TEXT, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.name, w.slug, wm.role
  FROM public.workspace_members wm
  JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.user_id = auth.uid()
  ORDER BY wm.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_members(target_workspace_id uuid)
RETURNS TABLE (user_id UUID, display_name TEXT, email TEXT, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT wm.user_id, p.display_name, au.email, wm.role
  FROM public.workspace_members wm
  JOIN auth.users au ON au.id = wm.user_id
  LEFT JOIN public.profiles p ON p.id = wm.user_id
  WHERE wm.workspace_id = target_workspace_id
    AND public.is_workspace_member(target_workspace_id, auth.uid())
  ORDER BY wm.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.create_workspace_invite(target_workspace_slug text, invite_email text, invite_role text)
RETURNS TABLE (token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_token TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Você precisa estar logado para convidar membros.';
  END IF;

  IF invite_role NOT IN ('admin', 'editor') THEN
    RAISE EXCEPTION 'Cargo inválido para convite.';
  END IF;

  SELECT w.id INTO v_workspace_id
  FROM public.workspaces w
  JOIN public.workspace_members wm ON wm.workspace_id = w.id
  WHERE w.slug = target_workspace_slug
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace não encontrado ou você não tem permissão para convidar membros.';
  END IF;

  INSERT INTO public.workspace_invites (workspace_id, email, role, invited_by)
  VALUES (v_workspace_id, lower(trim(invite_email)), invite_role, auth.uid())
  RETURNING workspace_invites.token INTO v_token;

  RETURN QUERY SELECT v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.workspace_invites%ROWTYPE;
  v_workspace public.workspaces%ROWTYPE;
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Você precisa estar logado para aceitar este convite.');
  END IF;

  v_email := lower(COALESCE(auth.jwt() ->> 'email', ''));

  SELECT * INTO v_invite
  FROM public.workspace_invites
  WHERE token = invitation_token
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Convite não encontrado.');
  END IF;

  IF v_invite.status <> 'pending' OR v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Este convite já foi utilizado.');
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.workspace_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('error', 'Este convite expirou.');
  END IF;

  IF lower(v_invite.email) <> v_email THEN
    RETURN jsonb_build_object('error', 'Este convite foi enviado para outro e-mail.');
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, auth.uid(), v_invite.role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();

  UPDATE public.workspace_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invite.id;

  SELECT * INTO v_workspace FROM public.workspaces WHERE id = v_invite.workspace_id;

  RETURN jsonb_build_object(
    'workspace_name', v_workspace.name,
    'workspace_slug', v_workspace.slug,
    'role', v_invite.role
  );
END;
$$;

DO $$
BEGIN
  INSERT INTO public.profiles (id, slug, display_name)
  SELECT
    u.id,
    public.normalize_workspace_slug(COALESCE(u.raw_user_meta_data->>'slug', split_part(u.email, '@', 1), 'user-' || substr(u.id::text, 1, 8))),
    COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Usuário')
  FROM auth.users u
  ON CONFLICT (id) DO UPDATE SET
    slug = COALESCE(public.profiles.slug, EXCLUDED.slug),
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  INSERT INTO public.workspaces (name, slug)
  SELECT
    COALESCE(p.display_name, split_part(u.email, '@', 1), 'Usuário') || ' Workspace',
    public.normalize_workspace_slug(COALESCE(p.slug, u.raw_user_meta_data->>'slug', split_part(u.email, '@', 1), 'user-' || substr(u.id::text, 1, 8)))
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  ON CONFLICT (slug) DO UPDATE SET updated_at = now();

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT w.id, u.id, 'owner'
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  JOIN public.workspaces w ON w.slug = public.normalize_workspace_slug(COALESCE(p.slug, u.raw_user_meta_data->>'slug', split_part(u.email, '@', 1), 'user-' || substr(u.id::text, 1, 8)))
  WHERE NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = w.id AND wm.user_id = u.id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace_invite(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
