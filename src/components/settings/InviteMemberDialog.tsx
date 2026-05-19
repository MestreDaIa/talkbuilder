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

      // 1. Identificar o slug da URL de forma robusta
      const hash = window.location.hash || "";
      const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
      const pathParts = cleanHash.split("/").filter(p => p && p !== "workspace" && p !== "configs");
      
      // Se estiver em #/teste03/workspace/configs, o pathParts será ["teste03"]
      // Mas se o usuário estiver em uma URL diferente, precisamos garantir que pegamos o slug certo
      const pathSlug = pathParts[0];

      if (!pathSlug || pathSlug.includes('.')) { 
        // Fallback: tentar pegar do contexto se a URL falhar ou for ambígua
        if (currentWorkspace?.slug) {
          console.log("Usando slug do contexto:", currentWorkspace.slug);
        } else {
          throw new Error("Não foi possível identificar o workspace. Certifique-se de que está na página de configurações do workspace.");
        }
      }
      
      const finalSlug = currentWorkspace?.slug || pathSlug;

      console.log("Detectando workspace para convite:", pathSlug);
      console.log("URL Atual:", window.location.href);
      console.log("Hash Atual:", window.location.hash);

      // 2. Buscar o workspace e validar se o usuário é admin/owner nele diretamente no banco
      const { data: wsData, error: wsError } = await supabase
        .from("workspaces")
        .select(`
          id,
          slug,
          workspace_members (
            role,
            user_id
          )
        `)
        .eq("slug", finalSlug)
        .maybeSingle();

      if (wsError || !wsData) {
        console.error("Erro ao localizar workspace:", wsError);
        throw new Error(`Workspace "${finalSlug}" não encontrado. Se você acabou de criar o workspace, tente atualizar a página.`);
      }

      // Filtrar manualmente as permissões do usuário logado
      const members = wsData.workspace_members as any[];
      const myMembership = members?.find(m => m.user_id === user.id);
      const userRole = myMembership?.role;
      
      console.log("Minha relação com o workspace:", { myMembership, userRole });

      if (!userRole || (userRole !== 'owner' && userRole !== 'admin')) {
        throw new Error(`Permissões insuficientes. Para convidar membros, você precisa ser Owner ou Admin. Seu cargo atual: ${userRole || 'Visitante'}.`);
      }

      // 3. Gerar o convite no banco de dados
      const { data, error } = await supabase
        .from("workspace_invites")
        .insert({
          workspace_id: wsData.id,
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
