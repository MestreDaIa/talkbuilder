import {SiInstagram, SiTelegram, SiWhatsapp} from '@icons-pack/react-simple-icons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Label } from '../../../../components/ui/label'
import { CalendarCheck2, Database, Ellipsis, CheckCircle2, XCircle, RefreshCw, Trash2, Loader2, QrCode, Settings } from 'lucide-react'
import { useEmbed } from '../../../../context/EmbedContext'
import { useEffect, useRef, useState } from 'react'
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  supabaseClient as supabase,
} from '../../../../lib/supabaseClient'
import { useToast } from '../../../../hooks/use-toast'
import { useAuth } from '../../../../context/AuthContext'
import { evoApi } from '../../../../services/evolutionApi'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog"

import WhatsAppInstanceSettings from './WhatsAppInstanceSettings'

function settingsObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function isLocallyRemovedConnection(conn: any) {
  const settings = settingsObject(conn?.settings);
  return conn?.status === "deleted" || settings.flow_hidden === true || Boolean(settings.flow_deleted_at);
}

export default function IntegrationsSettings() {
  const { flags } = useEmbed();
  const { toast } = useToast();
  const { currentWorkspace, profile } = useAuth();
  
  // Supabase Config State
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [connected, setConnected] = useState(false);

  // WhatsApp State
  const [connections, setConnections] = useState<any[]>([]);
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMinutes, setRefreshMinutes] = useState(2);

  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [selectedInstanceForConfig, setSelectedInstanceForConfig] = useState<string | null>(null);
  const autoSyncAttemptedRef = useRef<string | null>(null);
  const isBookingWorkspace = Boolean(profile?.embed_company_id || profile?.embed_source === "booking");

  useEffect(() => {
    const cfg = getSupabaseConfig();
    if (cfg) {
      setUrl(cfg.url);
      setAnonKey(cfg.anonKey);
      setConnected(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    void loadWhatsappConnections({ syncRemote: true, allowAutoProvision: true });
  }, [currentWorkspace?.id, profile?.embed_company_id, profile?.embed_source]);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    const minutes = Number.isFinite(refreshMinutes) && refreshMinutes > 0 ? refreshMinutes : 2;
    const interval = window.setInterval(() => {
      void loadWhatsappConnections({ syncRemote: true, silent: true });
    }, minutes * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [currentWorkspace?.id, refreshMinutes]);

  // --- Supabase Actions ---
  function handleSaveSupabase() {
    if (!url.trim() || !anonKey.trim()) {
      toast({ title: 'Preencha URL e Anon Key', variant: 'destructive' });
      return;
    }
    try {
      new URL(url.trim());
    } catch {
      toast({ title: 'URL inválida', description: 'Ex.: https://xxxx.supabase.co', variant: 'destructive' });
      return;
    }
    saveSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() });
    setConnected(true);
    toast({ title: 'Supabase conectado!', description: 'Recarregando para aplicar...' });
    setTimeout(() => window.location.reload(), 800);
  }

  function handleDisconnectSupabase() {
    clearSupabaseConfig();
    setUrl('');
    setAnonKey('');
    setConnected(false);
    toast({ title: 'Desconectado', description: 'Recarregando...' });
    setTimeout(() => window.location.reload(), 800);
  }

  // --- WhatsApp Actions ---
  const syncInstances = async () => {
    setSyncing(true);
    try {
      // Refaz o vínculo com o wa-service (tenant compartilhado com o Zailom Booking)
      await evoApi.reprovision();
      const remote = await evoApi.listInstancesStrict();
      await loadWhatsappConnections({ syncRemote: true, forceRemotePersist: true });
      if (!remote.length) {
        const diag = await evoApi.diagnose().catch(() => null);
        console.warn("[wa-service] diagnóstico:", diag);
        toast({
          title: "Nenhuma instância encontrada no wa-service",
          description: diag
            ? `tenant ${diag.product}/${diag.product_tenant_id}${diag.error ? ` — ${diag.error}` : ""}`
            : "Verifique se a conta está vinculada ao Zailom Booking.",
          variant: "destructive",
        });
      } else {
        toast({ title: `${remote.length} instância(s) sincronizada(s)` });
      }
    } catch (err: any) {
      toast({ title: "Falha ao sincronizar", description: err?.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };


  const loadWhatsappConnections = async (options: {
    syncRemote?: boolean;
    allowAutoProvision?: boolean;
    forceRemotePersist?: boolean;
    silent?: boolean;
  } = {}) => {
    const {
      syncRemote = true,
      allowAutoProvision = false,
      forceRemotePersist = false,
      silent = false,
    } = options;

    if (!currentWorkspace?.id) return;
    if (!silent) setLoadingWhatsapp(true);

    try {
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      let list = data || [];

      if (syncRemote) {
        if (allowAutoProvision && isBookingWorkspace && list.length === 0 && autoSyncAttemptedRef.current !== currentWorkspace.id) {
          autoSyncAttemptedRef.current = currentWorkspace.id;
          await evoApi.reprovision().catch((err) => {
            console.warn("[wa-service] auto reprovision falhou:", err);
          });
        }

        // Instâncias vivem no wa-service (compartilhado com o Zailom Booking).
        // Trazemos as que ainda não existem localmente.
        const remote = await evoApi.fetchInstances().catch((err) => {
          console.warn("[wa-service] fetch instances falhou:", err);
          return [];
        });
        // Inclui também linhas marcadas como removidas localmente. Assim uma
        // instância órfã que ainda vem do wa-service não reaparece a cada sync.
        const known = new Set(list.map((c: any) => c.instance_name));
        const missing = (remote || [])
          .map((r: any) => ({
            instance_name: r?.name || r?.instanceName || r?.instance?.instanceName,
            status: r?.status || r?.connectionStatus || r?.state || "disconnected",
            settings: r,
          }))
          .filter((r: any) => r.instance_name && !known.has(r.instance_name));

        if (missing.length || forceRemotePersist) {
          const rows = missing.map((m: any) => ({
            workspace_id: currentWorkspace.id,
            instance_name: m.instance_name,
            name: m.instance_name,
            status: m.status,
            settings: m.settings,
          }));
          if (rows.length) {
            await supabase.from("whatsapp_connections").insert(rows);
          }
          const { data: refreshed } = await supabase
            .from("whatsapp_connections")
            .select("*")
            .eq("workspace_id", currentWorkspace.id)
            .order("created_at", { ascending: false });
          list = refreshed || list;
        }
      }

      setConnections(list.filter((conn: any) => !isLocallyRemovedConnection(conn)));
    } catch (err) {
      console.error("Erro ao carregar conexões WhatsApp:", err);
      if (!silent) {
        toast({ title: "Erro ao carregar instâncias", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      }
    } finally {
      if (!silent) setLoadingWhatsapp(false);
    }
  };

  const refreshInstances = async () => {
    setRefreshing(true);
    try {
      await loadWhatsappConnections({ syncRemote: true, forceRemotePersist: true });
      toast({ title: "Lista de instâncias atualizada" });
    } finally {
      setRefreshing(false);
    }
  };


  const createWhatsappInstance = async () => {
    if (!instanceName.trim()) {
      toast({ title: "Dê um nome para a instância", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const result = await evoApi.createInstance(instanceName);
      
      // Tenta inserir no banco usando 'instance_name' para a coluna 'name' se necessário
      const { error } = await supabase.from("whatsapp_connections").insert({
        workspace_id: currentWorkspace?.id,
        instance_name: instanceName,
        name: instanceName, // Adicionado para evitar erro de NOT NULL na coluna 'name'
        status: "disconnected",
        settings: result.instance || result,
      });

      if (error) {
        // Se der erro de coluna, avisamos mas podemos prosseguir se a instância foi criada
        console.error("Erro ao salvar no Supabase:", error);
        if (error.message.includes("settings")) {
           toast({ 
             title: "Atenção: Tabela incompleta", 
             description: "A instância foi criada, mas a coluna 'settings' não existe no seu Supabase. Rode o SQL fornecido.",
             variant: "destructive" 
           });
        } else {
           throw error;
        }
      }

      toast({ title: "Instância criada com sucesso!" });
      setInstanceName("");
      loadWhatsappConnections();
      
      if (result.qrcode?.base64) {
        setQrCodeData(result.qrcode.base64);
        setShowQrModal(true);
        startPolling(instanceName);
      } else {
        // Se não veio QR code direto, tenta buscar
        handleConnectWhatsapp(instanceName);
      }
    } catch (err: any) {
      toast({ title: "Erro ao criar instância", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const startPolling = (name: string) => {
    if (pollInterval) clearInterval(pollInterval);
    const interval = setInterval(async () => {
      try {
        const status = await evoApi.getInstanceStatus(name);
        if (status?.instance?.state === "open") {
          toast({ title: "WhatsApp conectado!", variant: "default" });
          setShowQrModal(false);
          setQrCodeData(null);
          loadWhatsappConnections();
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Erro no polling:", err);
      }
    }, 5000);
    setPollInterval(interval);
  };

  const handleConnectWhatsapp = async (name: string) => {
    try {
      setQrCodeData(null);
      setShowQrModal(true);
      const result = await evoApi.getQrCode(name);
      if (result?.base64) {
        setQrCodeData(result.base64);
        startPolling(name);
      } else if (result?.code === "instance_already_connected") {
          toast({ title: "Instância já está conectada" });
          setShowQrModal(false);
          loadWhatsappConnections();
      }
    } catch (err) {
      toast({ title: "Erro ao buscar QR Code", variant: "destructive" });
      setShowQrModal(false);
    }
  };

  const handleDeleteWhatsapp = async (id: string, name: string) => {
    if (!confirm("Tem certeza que deseja remover esta conexão?")) return;
    try {
      const current = connections.find((conn) => conn.id === id);
      let remoteDeleteError: Error | null = null;

      try {
        const removed = await evoApi.deleteInstance(name);
        if (!removed) throw new Error("A instância não foi removida no serviço WhatsApp.");
      } catch (err: any) {
        remoteDeleteError = err instanceof Error ? err : new Error(String(err?.message || err));
      }

      await supabase.from("whatsapp_bindings").delete().eq("instance_name", name);

      if (remoteDeleteError) {
        const { error } = await supabase
          .from("whatsapp_connections")
          .update({
            status: "deleted",
            settings: {
              ...settingsObject(current?.settings),
              flow_hidden: true,
              flow_deleted_at: new Date().toISOString(),
              flow_delete_error: remoteDeleteError.message,
            },
          })
          .eq("id", id);
        if (error) throw error;
        setConnections((prev) => prev.filter((conn) => conn.id !== id));
        toast({
          title: "Conexão removida do Flow",
          description: "O serviço WhatsApp retornou erro ao apagar na origem; esta instância não será sincronizada novamente neste workspace.",
        });
      } else {
        const { error } = await supabase
          .from("whatsapp_connections")
          .update({
            status: "deleted",
            settings: {
              ...settingsObject(current?.settings),
              flow_hidden: true,
              flow_deleted_at: new Date().toISOString(),
              flow_delete_remote_ok: true,
            },
          })
          .eq("id", id);
        if (error) throw error;
        setConnections((prev) => prev.filter((conn) => conn.id !== id));
        toast({ title: "Conexão removida" });
      }

      void loadWhatsappConnections({ syncRemote: true, silent: true });
    } catch (err: any) {
      toast({
        title: "Erro ao remover",
        description: err?.message || "Não foi possível excluir a instância.",
        variant: "destructive",
      });
    }
  };

  const handleRefreshWhatsappStatus = async (name: string) => {
    try {
      const status = await evoApi.getInstanceStatus(name);
      const newState = status?.instance?.state === "open" ? "connected" : "disconnected";
      await supabase.from("whatsapp_connections").update({ status: newState }).eq("instance_name", name);
      loadWhatsappConnections();
      toast({ title: "Status atualizado" });
    } catch (err) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* WhatsApp Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">

          <div className="flex items-center gap-3">
             <div className='p-2.5 h-fit w-fit rounded-xl bg-green-50'>
                <SiWhatsapp className='w-5 h-5 text-green-600'/>
              </div>
              <div>
                <CardTitle>WhatsApp</CardTitle>
                <CardDescription>Conecte seu WhatsApp via Evolution API para enviar e receber mensagens.</CardDescription>
              </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Auto</span>
              <select
                value={refreshMinutes}
                onChange={(event) => setRefreshMinutes(Number(event.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                aria-label="Intervalo de atualização automática"
              >
                <option value={1}>1 min</option>
                <option value={2}>2 min</option>
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={refreshInstances} disabled={refreshing || syncing}>
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={syncInstances} disabled={syncing || refreshing}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sincronizar instâncias
            </Button>
          </div>

        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 p-4 border-2 border-dashed rounded-xl bg-gray-50/50">
            <Label className="text-sm font-medium">Nova Instância</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nome (ex: comercial-01)"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                className="bg-white"
              />
              <Button onClick={createWhatsappInstance} disabled={creating} className="bg-green-600 hover:bg-green-700">
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Criar
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {loadingWhatsapp ? (
              <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>
            ) : connections.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-4">Nenhuma instância conectada.</p>
            ) : (
              connections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                  <div className="flex items-center gap-3">
                    <SiWhatsapp className={`w-4 h-4 ${conn.status === 'connected' ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className="font-medium text-sm">{conn.instance_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold ${conn.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {conn.status === 'connected' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedInstanceForConfig(conn.instance_name)} className="h-8 w-8 text-gray-500 hover:text-green-600" title="Configurações">
                        <Settings className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRefreshWhatsappStatus(conn.instance_name)} className="h-8 w-8 text-gray-500">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                      {conn.status !== "connected" && (
                        <Button variant="outline" size="sm" onClick={() => handleConnectWhatsapp(conn.instance_name)} className="h-8 text-xs">
                          Conectar
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-destructive" onClick={() => handleDeleteWhatsapp(conn.id, conn.instance_name)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Integrations Card */}
      <Card>
        <CardHeader>
          <CardTitle>Outras Integrações</CardTitle>
          <CardDescription>Conecte seu chatbot a outras plataformas e bancos de dados</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>

          {/* Supabase connection */}
          <Card className='p-4 border-2 border-dashed'>
            <CardHeader className='p-0 pb-3 flex flex-row items-center gap-3 space-y-0'>
              <div className='p-3 h-fit w-fit rounded-xl bg-emerald-100'>
                <Database className='w-5 h-5 text-emerald-600'/>
              </div>
              <div className='flex-1'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  Banco de dados Supabase (opcional)
                  {connected && <CheckCircle2 className='w-3.5 h-3.5 text-emerald-600'/>}
                </CardTitle>
                <CardDescription className="text-xs">
                  Conecte seu próprio Supabase para guardar dados dos seus bots na sua infraestrutura.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className='p-0 flex flex-col gap-3'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <div className='flex flex-col gap-1.5'>
                  <Label htmlFor='sb-url' className="text-xs">Project URL</Label>
                  <Input
                    id='sb-url'
                    placeholder='https://xxxxxxxx.supabase.co'
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className='flex flex-col gap-1.5'>
                  <Label htmlFor='sb-key' className="text-xs">Anon Key</Label>
                  <Input
                    id='sb-key'
                    type='password'
                    placeholder='eyJhbGciOi...'
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className='flex gap-2'>
                <Button size="sm" onClick={handleSaveSupabase}>{connected ? 'Atualizar' : 'Conectar'}</Button>
                {connected && (
                  <Button size="sm" variant='outline' onClick={handleDisconnectSupabase}>Desconectar</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className='flex items-center p-4 justify-between relative opacity-60'>
              <div className='p-3 h-fit w-fit rounded-xl bg-gray-100'>
                <SiTelegram className='w-5 h-5 text-blue-500'/>
              </div>
              <div className="ml-3 flex-1">
                <CardTitle className="text-sm">Telegram</CardTitle>
                <CardDescription className="text-xs italic">Em breve</CardDescription>
              </div>
              <Ellipsis className="text-gray-400 w-4 h-4" />
            </Card>

            <Card className='flex items-center p-4 justify-between relative opacity-60'>
              <div className='p-3 h-fit w-fit rounded-xl bg-gray-100'>
                <SiInstagram className='w-5 h-5 text-fuchsia-500'/>
              </div>
              <div className="ml-3 flex-1">
                <CardTitle className="text-sm">Instagram</CardTitle>
                <CardDescription className="text-xs italic">Em breve</CardDescription>
              </div>
              <Ellipsis className="text-gray-400 w-4 h-4" />
            </Card>
          </div>

          {flags.showBookingfyIntegrationCard && (
            <Card className='flex items-center p-4 justify-between relative border-dashed'>
              <div className='p-3 h-fit w-fit rounded-xl bg-gray-100'>
                <CalendarCheck2 className='w-5 h-5 text-orange-500'/>
              </div>
              <div className="ml-3 flex-1">
                <CardTitle className="text-sm">BookingFy</CardTitle>
                <CardDescription className="text-xs">
                  Sincronize agendamentos e clientes.
                </CardDescription>
              </div>
              <Button variant='outline' size='sm'>Conectar</Button>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o código abaixo com o seu WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg border-2 border-dashed">
            {qrCodeData ? (
              <div className="bg-white p-2 rounded-lg shadow-sm border">
                <img src={qrCodeData} alt="WhatsApp QR Code" className="w-64 h-64" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 className="w-10 h-10 animate-spin text-green-600" />
                <p className="text-sm font-medium text-gray-500">Gerando QR Code...</p>
              </div>
            )}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 font-medium animate-pulse">
                Aguardando leitura...
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <WhatsAppInstanceSettings 
        instanceName={selectedInstanceForConfig || ""} 
        isOpen={!!selectedInstanceForConfig} 
        onClose={() => setSelectedInstanceForConfig(null)} 
      />
    </div>
  )
}