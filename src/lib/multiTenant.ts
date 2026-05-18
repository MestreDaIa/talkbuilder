import { create } from 'zustand';
import { getSupabase } from './supabaseClient';

export type UserRole = 'owner' | 'admin' | 'editor';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: UserRole;
}

interface MultiTenantStore {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  fetchWorkspaces: () => Promise<void>;
}

export const useMultiTenantStore = create<MultiTenantStore>((set, get) => ({
  currentWorkspace: null,
  workspaces: [],
  isLoading: false,
  setWorkspaces: (workspaces) => set({ workspaces }),
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  fetchWorkspaces: async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    set({ isLoading: true });
    try {
      let { data, error } = await supabase.rpc('get_my_workspaces');

      if (error) {
        console.warn('RPC get_my_workspaces failed, trying fallback:', error);
        const fallback = await supabase
          .from('workspace_members')
          .select(`
            role,
            workspaces (
              id,
              name,
              slug
            )
          `);
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      const mappedWorkspaces = data.map((item: any) => ({
        ...(item.workspaces ?? { id: item.id, name: item.name, slug: item.slug }),
        role: item.role as UserRole,
      }));

      set({ workspaces: mappedWorkspaces });

      // Selecionar workspace atual baseado no slug da URL se possível
      const pathSlug = window.location.pathname.split('/')[1];
      const found = mappedWorkspaces.find(w => w.slug === pathSlug);
      if (found) {
        set({ currentWorkspace: found });
      } else if (mappedWorkspaces.length > 0 && !get().currentWorkspace) {
        set({ currentWorkspace: mappedWorkspaces[0] });
      }
    } catch (err) {
      console.error('Error fetching workspaces:', err);
    } finally {
      set({ isLoading: false });
    }
  },
}));

export const canManageMembers = (role?: UserRole) => role === 'owner' || role === 'admin';
export const canEditBots = (role?: UserRole) => role === 'owner' || role === 'admin' || role === 'editor';
