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

      // LOG PARA DEBUG: Verificar as credenciais atuais do Supabase
      console.log("Supabase Client URL:", (supabase as any).supabaseUrl);

      // Garantir que temos um workspace_id sem consultar workspace_members.
      // Essa tabela é justamente a que está com política RLS recursiva no Supabase do usuário.
      let workspaceId = currentWorkspace?.id;
      
      if (!workspaceId) {
        const hash = window.location.hash;
        const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
        const pathParts = cleanHash.split("/").filter(Boolean);
        
        console.log("Debug Invite - Path Parts:", pathParts);

        // No talkbuilder.lovable.app/#/teste03/workspace/configs
        // teste03 é o primeiro elemento
        const slugFromUrl = pathParts[0];
        console.log("Debug Invite - Extracted Slug:", slugFromUrl);

        if (!slugFromUrl || slugFromUrl === 'workspace' || slugFromUrl === 'invite') {
          throw new Error("Slug do workspace não identificado na URL.");
        }

        // Tentar buscar por slug exato (usando eq() de forma sensível a maiúsculas/minúsculas)
        const { data: workspaceData, error: workspaceError } = await supabase
          .from("workspaces")
          .select("id, slug")
          .or(`slug.eq.${slugFromUrl},slug.ilike.${slugFromUrl}`)
          .maybeSingle();
          
        if (workspaceError) {
          console.error("Erro ao buscar workspace:", workspaceError);
          throw workspaceError;
        }

        if (workspaceData) {
          workspaceId = workspaceData.id;
        } else {
          // Fallback: listar tudo o que este usuário PODE ver na tabela workspaces
          // Se a RLS permitir select, isso deve funcionar.
          const { data: allWorkspaces } = await supabase
            .from("workspaces")
            .select("id, slug");
            
          console.log("Workspaces visíveis para este usuário:", allWorkspaces);
          
          const found = allWorkspaces?.find(w => w.slug.toLowerCase() === slugFromUrl.toLowerCase());
          if (found) {
            workspaceId = found.id;
          } else {
            throw new Error(`Workspace '${slugFromUrl}' não encontrado ou você não tem acesso a ele neste banco. (Visíveis: ${allWorkspaces?.map(w => w.slug).join(", ") || 'nenhum'})`);
          }
        }
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

      const link = `${window.location.origin}/invite/${data.token}`;
      setInviteLink(link);
      
      toast({
        title: "Convite gerado!",
        description: `O convite para ${email} foi criado com sucesso.`,
      });
    } catch (error: any) {
      console.error("Catch error handleInvite:", error);
      toast({
        title: "Erro ao convidar",
        description: error.message + " (verifique se você está usando o Supabase do sistema)",
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
