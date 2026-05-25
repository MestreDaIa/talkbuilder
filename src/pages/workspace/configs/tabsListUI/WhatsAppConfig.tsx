import { useState, useEffect } from "react";
import { SiWhatsapp } from "@icons-pack/react-simple-icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { CheckCircle2, XCircle, RefreshCw, Trash2, Loader2, QrCode } from "lucide-react";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../hooks/use-toast";
import { supabaseClient as supabase } from "../../../../lib/supabaseClient";
import { evoApi } from "../../../../services/evolutionApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../../components/ui/dialog";

export default function WhatsAppConfig() {
  const { currentWorkspace } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadConnections();
    }
  }, [currentWorkspace?.id]);

  const loadConnections = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("workspace_id", currentWorkspace?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setConnections(data || []);
    } catch (err) {
      console.error("Erro ao carregar conexões:", err);
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async () => {
    if (!instanceName.trim()) {
      toast({ title: "Dê um nome para a instância", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      // 1. Criar na Evolution API
      const result = await evoApi.createInstance(instanceName);
      
      // 2. Salvar no Supabase
      const { error } = await supabase.from("whatsapp_connections").insert({
        workspace_id: currentWorkspace?.id,
        instance_name: instanceName,
        status: "disconnected",
        settings: result.instance,
      });

      if (error) throw error;

      toast({ title: "Instância criada com sucesso!" });
      setInstanceName("");
      loadConnections();
      
      // 3. Mostrar QR Code
      if (result.qrcode?.base64) {
        setQrCodeData(result.qrcode.base64);
        setShowQrModal(true);
        startPolling(instanceName);
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
          loadConnections();
          if (interval) clearInterval(interval);
        }
      } catch (err) {
        console.error("Erro no polling:", err);
      }
    }, 5000);
    
    setPollInterval(interval);
  };

  const handleConnect = async (name: string) => {
    try {
      const result = await evoApi.getQrCode(name);
      if (result?.base64) {
        setQrCodeData(result.base64);
        setShowQrModal(true);
        startPolling(name);
      } else if (result?.code === "instance_already_connected") {
          toast({ title: "Instância já está conectada" });
          loadConnections();
      }
    } catch (err) {
      toast({ title: "Erro ao buscar QR Code", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm("Tem certeza que deseja remover esta conexão?")) return;

    try {
      await evoApi.deleteInstance(name);
      const { error } = await supabase.from("whatsapp_connections").delete().eq("id", id);
      if (error) throw error;
      
      toast({ title: "Conexão removida" });
      loadConnections();
    } catch (err) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const handleRefreshStatus = async (name: string) => {
    try {
      const status = await evoApi.getInstanceStatus(name);
      const newState = status?.instance?.state === "open" ? "connected" : "disconnected";
      
      await supabase
        .from("whatsapp_connections")
        .update({ status: newState })
        .eq("instance_name", name);
        
      loadConnections();
      toast({ title: "Status atualizado" });
    } catch (err) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <SiWhatsapp className="w-6 h-6 text-green-500" />
                Conexões WhatsApp
              </CardTitle>
              <CardDescription>
                Gerencie suas instâncias da Evolution API
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Nome da instância (ex: comercial-01)"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
            />
            <Button onClick={createInstance} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Nova Instância
            </Button>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center p-8 border-2 border-dashed rounded-xl text-muted-foreground">
                Nenhuma conexão configurada.
              </div>
            ) : (
              connections.map((conn) => (
                <Card key={conn.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${conn.status === 'connected' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        <SiWhatsapp className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{conn.instance_name}</h4>
                        <div className="flex items-center gap-2">
                          {conn.status === "connected" ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="w-3 h-3" /> Conectado
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <XCircle className="w-3 h-3" /> Desconectado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleRefreshStatus(conn.instance_name)} title="Atualizar status">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      
                      {conn.status !== "connected" && (
                        <Button variant="outline" size="sm" onClick={() => handleConnect(conn.instance_name)}>
                          <QrCode className="w-4 h-4 mr-2" />
                          Conectar
                        </Button>
                      )}
                      
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(conn.id, conn.instance_name)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o código abaixo com o seu WhatsApp para realizar a conexão.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg">
            {qrCodeData ? (
              <img src={qrCodeData} alt="WhatsApp QR Code" className="w-64 h-64" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}
            <p className="mt-4 text-xs text-center text-muted-foreground">
              O status será atualizado automaticamente após o escaneamento.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
