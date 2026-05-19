import { useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { getSupabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../hooks/use-toast";
import { Copy, Loader2 } from "lucide-react";

export function InviteMemberDialog() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const { currentWorkspace, user } = useAuth();
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!email || !user) {
      toast({
        title: "Atenção",
        description: "Certifique-se de que o e-mail está preenchido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase não configurado");

      // LOG PARA DEBUG: Verificar a URL do Supabase e o usuário atual
      console.log("Supabase Client URL:", (supabase as any).supabaseUrl);
      console.log("Current User:", user?.id);

      let workspaceId = currentWorkspace?.id;
      
      if (!workspaceId) {
        // Tenta pegar o slug da URL ignorando o hash (#)
        const hash = window.location.hash || "";
        // Remove o caractere # e divide por barras
        const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
        const parts = cleanHash.split('/').filter(p => p && p !== 'workspace' && p !== 'configs');
        const slugFromUrl = parts[0];

        console.log("Slug from URL (cleaned):", slugFromUrl);

        if (!slugFromUrl) {
          throw new Error("Não foi possível identificar o workspace na URL. Acesse pelo menu lateral.");
        }

        // TENTATIVA 1: Buscar diretamente o workspace pelo slug
        const { data: ws, error: wsError } = await supabase
          .from("workspaces")
          .select("id, slug")
          .eq("slug", slugFromUrl)
          .maybeSingle();

        if (ws) {
          workspaceId = ws.id;
          console.log("Found workspace by slug:", ws.id);
        } else {
          // TENTATIVA 2: Buscar workspaces onde o usuário é membro (via RPC ou Tabela)
          const { data: memberWorkspaces } = await supabase
            .from("workspace_members")
            .select("workspace_id, workspaces(id, slug)")
            .eq("user_id", user.id);

          console.log("Member workspaces found:", memberWorkspaces);

          const found = memberWorkspaces?.find((m: any) => m.workspaces?.slug === slugFromUrl);
          if (found) {
            workspaceId = found.workspace_id;
            console.log("Found via members match:", workspaceId);
          } else if (memberWorkspaces && memberWorkspaces.length > 0) {
            // Se o slug não bate mas o cara só tem UM workspace, assume que é esse (facilitador)
            workspaceId = memberWorkspaces[0].workspace_id;
            console.log("Fallback to first member workspace:", workspaceId);
          }
        }
      }

      if (!workspaceId) {
        throw new Error(`Workspace "${window.location.hash}" não encontrado. Verifique se você está no banco de dados correto ou se o workspace existe.`);
      }

      const { data, error } = await supabase
        .from("workspace_invitations")
        .insert({
          workspace_id: workspaceId,
          email: email.toLowerCase().trim(),
          role,
          invited_by: user.id,
        })
        .select("token")
        .single();

      if (error) {
        console.error("Erro ao inserir convite:", error);
        throw error;
      }

      const link = `${window.location.origin}/#/invite/${data.token}`;
      setInviteLink(link);
      
      toast({
        title: "Convite gerado!",
        description: `O convite para ${email} foi criado com sucesso.`,
      });
    } catch (error: any) {
      console.error("Catch error handleInvite:", error);
      toast({
        title: "Erro ao convidar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast({
        title: "Link copiado!",
        description: "O link do convite foi copiado para a área de transferência.",
      });
    }
  };

  const resetForm = () => {
    setEmail("");
    setRole("editor");
    setInviteLink(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary text-primary hover:bg-primary/5">
          Convidar Membro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Convidar para a Equipe</DialogTitle>
          <DialogDescription>
            Envie um convite para que novos membros se juntem ao seu workspace.
          </DialogDescription>
        </DialogHeader>
        
        {!inviteLink ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Cargo</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
              Convite criado! Envie o link abaixo para o novo membro:
            </div>
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="bg-gray-50" />
              <Button size="icon" variant="outline" onClick={copyToClipboard}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {!inviteLink ? (
            <Button onClick={handleInvite} disabled={loading || !email}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar Convite
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
