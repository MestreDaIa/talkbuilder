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
        const pathParts = window.location.hash ? window.location.hash.split("/") : window.location.pathname.split("/");
        // O slug geralmente é o segundo elemento após o hash ou no início da rota
        const slugFromUrl = pathParts.find(p => p !== "" && p !== "#" && p !== "workspace" && p !== "configs");
        if (!slugFromUrl) {
          throw new Error("Workspace não carregado. Abra a página pelo slug do workspace e tente novamente.");
        }

        const { data: workspaceData, error: workspaceError } = await supabase
          .from("workspaces")
          .select("id")
          .eq("slug", slugFromUrl)
          .maybeSingle();
          
        if (workspaceError) {
          console.error("Erro ao buscar workspace pelo slug:", workspaceError);
          throw workspaceError;
        }
        if (!workspaceData?.id) throw new Error("Workspace não encontrado para gerar o convite.");
        workspaceId = workspaceData.id;
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
