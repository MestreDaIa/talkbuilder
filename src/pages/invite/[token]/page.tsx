import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getSupabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../components/ui/card";
import { Loader2, CheckCircle2, XCircle, LogIn, UserPlus } from "lucide-react";
import { useToast } from "../../../hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { browserHrefForRoute } from "../../../lib/workspaceRoutes";

// v1.0.6
export default function InvitePage() {
  console.log("[InvitePage] Renderizado v1.0.6");
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<any>(null);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Signup/Login states
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!token) return;

    const fetchInvite = async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) return;

        const { data, error } = await supabase
          .rpc("get_invitation_by_token", { invitation_token: token })
          .maybeSingle();
        const invite = data as any;

        if (error) throw error;
        if (!invite) {
          setError("Convite não encontrado.");
        } else if (invite.accepted_at || invite.status === "accepted") {
          setError("Este convite já foi utilizado.");
        } else if (new Date(invite.expires_at) < new Date()) {
          setError("Este convite expirou.");
        } else {
          setInviteData(invite);
          setEmail(invite.email);
        }
      } catch (err: any) {
        console.error("Erro ao carregar convite:", err);
        setError("Erro ao processar o convite.");
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!token) {
      console.error("handleAccept: Token não encontrado");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        toast({ title: "Erro", description: "Configuração do Supabase não encontrada.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        console.warn("handleAccept: Nenhum usuário autenticado encontrado");
        toast({ title: "Atenção", description: "Você precisa estar logado para aceitar o convite.", variant: "destructive" });
        setLoading(false);
        return;
      }

      console.log("Chamando RPC accept_invitation com token:", token);
      const { data, error } = await supabase.rpc("accept_invitation", {
        invitation_token: token
      });

      if (error) {
        console.error("Erro RPC accept_invitation:", error);
        // Se o erro for PGRST202, a função não existe no cache do schema
        if (error.code === 'PGRST202') {
           toast({ 
             title: "Erro de Configuração", 
             description: "A função de aceitar convite ainda não foi sincronizada no banco de dados. Por favor, tente novamente em alguns instantes ou contate o suporte.", 
             variant: "destructive" 
           });
           return;
        }
        throw error;
      }
      
      console.log("Resposta do RPC accept_invitation:", data);

      if (data && data.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }

      if (!data || !data.workspace_slug) {
        console.warn("RPC retornou sem workspace_slug, tentando redirecionar para home");
        setAccepted(true);
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      setAccepted(true);
      toast({ 
        title: "Sucesso!", 
        description: `Agora você é membro de ${data.workspace_name}` 
      });

      await refreshProfile();

      setTimeout(() => {
        navigate(`/${data.workspace_slug}/workspace`);
      }, 1500);

    } catch (err: any) {
      console.error("Erro completo no handleAccept:", err);
      toast({ 
        title: "Erro ao aceitar", 
        description: err.message || "Não foi possível processar o convite no servidor.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !inviteData) return;
    
    setSubmitting(true);
    try {
      const supabase = getSupabase();
      if (!supabase) return;

      // Prepare signup options
      const signupOptions: any = {
        data: {
          display_name: displayName,
          invite_token: token
        },
        emailRedirectTo: window.location.origin + `/invite/${token}`
      };

      // Create the account
      let { data, error } = await supabase.auth.signUp({
        email: inviteData.email,
        password,
        options: signupOptions
      });

      let currentSession = data.session;

      if (error) {
        if (error.message.includes("User already registered")) {
          toast({ title: "Conta já existe", description: "Tentando entrar na sua conta..." });
          // Se já existe, tenta fazer o login silenciosamente
          const loginRes = await supabase.auth.signInWithPassword({
            email: inviteData.email,
            password: password
          });
          if (loginRes.error) throw loginRes.error;
          currentSession = loginRes.data.session;
        } else {
          throw error;
        }
      }

      // Handle successful signup or login
      if (currentSession) {
        toast({ title: "Autenticado!", description: "Aceitando o convite..." });
        
        // Forçar um pequeno delay para garantir que a sessão esteja estabilizada
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Tenta processar o convite
        console.log("[InvitePage] Chamando RPC accept_invitation...");
        let rpcResult = await supabase.rpc("accept_invitation", {
          invitation_token: token
        });

        // Se falhar com PGRST202, tenta o nome alternativo que criamos
        if (rpcResult.error && rpcResult.error.code === 'PGRST202') {
          console.warn("[InvitePage] accept_invitation não encontrada, tentando process_invite_token...");
          rpcResult = await supabase.rpc("process_invite_token", {
            token_value: token
          });
        }

        const { data: rpcData, error: rpcError } = rpcResult;

        if (rpcError) throw rpcError;

        if (rpcData && rpcData.error) {
          toast({ title: "Erro", description: rpcData.error, variant: "destructive" });
          return;
        }

        setAccepted(true);
        toast({ 
          title: "Sucesso!", 
          description: `Agora você é membro de ${rpcData.workspace_name}` 
        });

        await refreshProfile();

        setTimeout(() => {
          navigate(`/${rpcData.workspace_slug}/workspace`);
        }, 1500);
      } else if (data && data.user) {
        // User created but needs email verification
        toast({ 
          title: "Confira seu email", 
          description: "Enviamos um link de confirmação. Após confirmar, volte a esta página.",
          duration: 10000
        });
      } else {
        throw new Error("Não foi possível criar a conta. Tente novamente.");
      }
    } catch (err: any) {
      console.error("Erro no signup:", err);
      toast({ title: "Erro no cadastro", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData || !token) return;

    setSubmitting(true);
    try {
      const supabase = getSupabase();
      if (!supabase) return;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: inviteData.email,
        password: loginPassword
      });

      if (error) throw error;
      
      if (data.session) {
        toast({ title: "Bem-vindo de volta!", description: "Acessando workspace..." });
        
        // Pequeno delay para estabilidade
        await new Promise(resolve => setTimeout(resolve, 500));

        // Tenta processar o convite
        let rpcResult = await supabase.rpc("accept_invitation", {
          invitation_token: token
        });

        // Fallback para o nome alternativo
        if (rpcResult.error && rpcResult.error.code === 'PGRST202') {
          rpcResult = await supabase.rpc("process_invite_token", {
            token_value: token
          });
        }

        const { data: rpcData, error: rpcError } = rpcResult;

        if (rpcError) throw rpcError;

        if (rpcData && rpcData.error) {
          toast({ title: "Erro", description: rpcData.error, variant: "destructive" });
          return;
        }

        setAccepted(true);
        toast({ 
          title: "Sucesso!", 
          description: `Agora você é membro de ${rpcData.workspace_name}` 
        });

        await refreshProfile();

        setTimeout(() => {
          navigate(`/${rpcData.workspace_slug}/workspace`);
        }, 1500);
      }
    } catch (err: any) {
      console.error("Erro no login:", err);
      toast({ title: "Erro no login", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || (loading && !inviteData)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-6">
      <Card className="max-w-md w-full shadow-2xl border-primary/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            {accepted ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : error ? (
              <XCircle className="h-8 w-8 text-red-600" />
            ) : (
              <UserPlus className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">Convite para Equipe</CardTitle>
          <CardDescription className="text-base mt-2">
            {accepted 
              ? "Convite aceito com sucesso!" 
              : error 
                ? "Não foi possível processar seu convite."
                : `Você foi convidado para participar do workspace ${inviteData?.workspace_name}`
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {accepted ? (
            <div className="text-center py-4 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Redirecionando você para o workspace...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm text-center">
              {error}
            </div>
          ) : !user ? (
            <Tabs defaultValue="signup" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signup">Criar Conta</TabsTrigger>
                <TabsTrigger value="login">Já tenho conta</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email (Convidado)</Label>
                    <Input id="signup-email" value={email} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display-name">Seu Nome</Label>
                    <Input 
                      id="display-name" 
                      placeholder="Ex: João Silva" 
                      value={displayName} 
                      onChange={e => setDisplayName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Criar Senha</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar conta e aceitar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" value={email} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input 
                      id="login-password" 
                      type="password" 
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar e aceitar
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Logado como:</p>
                <p className="font-semibold text-foreground">{user.email}</p>
              </div>
              <Button 
                onClick={handleAccept} 
                className="w-full h-12 text-lg font-semibold" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Aceitar e Entrar no Workspace
              </Button>
            </div>
          )}
        </CardContent>

        {(error || (user && !accepted)) && (
          <CardFooter>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/">Voltar para o Início</Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}