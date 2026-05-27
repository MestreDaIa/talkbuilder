import {SiInstagram, SiTelegram, SiWhatsapp} from '@icons-pack/react-simple-icons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Label } from '../../../../components/ui/label'
import { CalendarCheck2, Database, Ellipsis, CheckCircle2, XCircle, RefreshCw, Trash2, Loader2, QrCode, Settings } from 'lucide-react'
import { useEmbed } from '../../../../context/EmbedContext'
import { useState, useEffect } from 'react'
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

export default function IntegrationsSettings() {
  const { flags } = useEmbed();
  const { toast } = useToast();
  const { currentWorkspace } = useAuth();
  
  // Supabase Config State
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [connected, setConnected] = useState(false);

  // WhatsApp State
  const [connections, setConnections] = useState<any[]>([]);
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [selectedInstanceForConfig, setSelectedInstanceForConfig] = useState<string | null>(null);

  useEffect(() => {
    const cfg = getSupabaseConfig();
    if (cfg) {
      setUrl(cfg.url);
      setAnonKey(cfg.anonKey);
      setConnected(true);
    }

    if (currentWorkspace?.id) {
      loadWhatsappConnections();
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentWorkspace?.id]);

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
  const loadWhatsappConnections = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("workspace_id", currentWorkspace?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setConnections(data || []);
    } catch (err) {
      console.error("Erro ao carregar conexões WhatsApp:", err);
    } finally {
      setLoadingWhatsapp(false);
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
      await evoApi.deleteInstance(name);
      const { error } = await supabase.from("whatsapp_connections").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Conexão removida" });
      loadWhatsappConnections();
    } catch (err) {
      toast({ title: "Erro ao remover", variant: "destructive" });
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
        <CardHeader>
          <div className="flex items-center gap-3">
             <div className='p-2.5 h-fit w-fit rounded-xl bg-green-50'>
                <SiWhatsapp className='w-5 h-5 text-green-600'/>
              </div>
              <div>
                <CardTitle>WhatsApp</CardTitle>
                <CardDescription>Conecte seu WhatsApp via Evolution API para enviar e receber mensagens.</CardDescription>
              </div>
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