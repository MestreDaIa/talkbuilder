import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export function useSuperAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (authLoading) return;
      if (!user) { setIsSuperAdmin(false); return; }
      const { data, error } = await supabase
        .from("user_roles" as any)
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (cancelled) return;
      setIsSuperAdmin(!error && !!data);
    }
    check();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { isSuperAdmin, loading: isSuperAdmin === null };
}
