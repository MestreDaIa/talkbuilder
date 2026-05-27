import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../../components/ui/dialog";
import { Switch } from "../../../../components/ui/switch";
import { Label } from "../../../../components/ui/label";
import { ScrollArea } from "../../../../components/ui/scroll-area";
import { Separator } from "../../../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { evoApi } from "../../../../services/evolutionApi";
import { useToast } from "../../../../hooks/use-toast";
import { Loader2, Settings, Globe, Bell, CheckCircle2 } from "lucide-react";

interface WhatsAppInstanceSettingsProps {
  instanceName: string;
  isOpen: boolean;
  onClose: () => void;
}

const WHATSAPP_EVENTS = [
  "APPLICATION_STARTUP",
  "CALL",
  "CHATS_DELETE",
  "CHATS_SET",
  "CHATS_UPDATE",
  "CHATS_UPSERT",
  "CONNECTION_UPDATE",
  "CONTACTS_SET",
  "CONTACTS_UPDATE",
  "CONTACTS_UPSERT",
  "GROUP_PARTICIPANTS_UPDATE",
  "GROUP_UPDATE",
  "GROUPS_UPSERT",
  "LABELS_ASSOCIATION",
  "LABELS_EDIT",
  "LOGOUT_INSTANCE",
  "MESSAGES_DELETE",
  "MESSAGES_SET",
  "MESSAGES_UPDATE",
  "MESSAGES_UPSERT",
  "PRESENCE_UPDATE",
  "QRCODE_UPDATED",
  "REMOVE_INSTANCE",
  "SEND_MESSAGE",
];

export default function WhatsAppInstanceSettings({ instanceName, isOpen, onClose }: WhatsAppInstanceSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Webhook State
  const [webhookByEvents, setWebhookByEvents] = useState(true);
  const [webhookBase64, setWebhookBase64] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["MESSAGES_UPSERT"]);
  const fixedWebhookUrl = "https://api-flowbuilder.zailom.com/webhook/whatsapp";

  // Instance Settings State
  const [settings, setSettings] = useState({
    reject_call: false,
    groups_ignore: false,
    always_online: false,
    read_messages: false,
    sync_full_history: false,
    read_status: false,
  });

  useEffect(() => {
    if (isOpen && instanceName) {
      loadInstanceData();
    }
  }, [isOpen, instanceName]);

  const loadInstanceData = async () => {
    setLoading(true);
    try {
      const data = await evoApi.fetchInstance(instanceName);
      if (data) {
        // Load Webhook info
        const webhook = data.webhook;
        if (webhook) {
          setWebhookByEvents(webhook.byEvents ?? true);
          setWebhookBase64(webhook.base64 ?? false);
          setSelectedEvents(webhook.events || ["MESSAGES_UPSERT"]);
        }

        // Load Settings info
        // Note: The structure might vary depending on the API response
        const apiSettings = data.settings || {};
        setSettings({
          reject_call: apiSettings.rejectCall ?? apiSettings.reject_call ?? false,
          groups_ignore: apiSettings.groupsIgnore ?? apiSettings.groups_ignore ?? false,
          always_online: apiSettings.alwaysOnline ?? apiSettings.always_online ?? false,
          read_messages: apiSettings.readMessages ?? apiSettings.read_messages ?? false,
          sync_full_history: apiSettings.syncFullHistory ?? apiSettings.sync_full_history ?? false,
          read_status: apiSettings.readStatus ?? apiSettings.read_status ?? false,
        });
      }
    } catch (err) {
      console.error("Erro ao carregar dados da instância:", err);
      toast({ title: "Erro ao carregar configurações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWebhook = async () => {
    setSavingWebhook(true);
    try {
      await evoApi.setWebhook(instanceName, {
        enabled: true,
        url: fixedWebhookUrl,
        byEvents: webhookByEvents,
        base64: webhookBase64,
        events: selectedEvents,
      });
      toast({ title: "Webhook atualizado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar webhook", description: err.message, variant: "destructive" });
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await evoApi.setSettings(instanceName, settings);
      toast({ title: "Configurações da instância atualizadas!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar configurações", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev => 
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings className="w-5 h-5 text-green-600" />
            Configurações da Instância
          </DialogTitle>
          <DialogDescription>
            Gerencie a instância <span className="font-bold text-foreground">{instanceName}</span> da Evolution API.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            <p className="text-sm text-muted-foreground">Carregando configurações...</p>
          </div>
        ) : (
          <Tabs defaultValue="events" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="events" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Eventos e Webhook
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Geral e Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 pt-4">
                <TabsContent value="events" className="mt-0 space-y-6 focus-visible:outline-none focus-visible:ring-0">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">
                      <Globe className="w-3.5 h-3.5" />
                      Configuração de Webhook
                    </div>
                    
                    <div className="p-4 bg-green-50/50 dark:bg-green-950/20 rounded-xl border border-green-100 dark:border-green-900/30 space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-green-800 dark:text-green-300 mb-1 block">URL Webhook Destino</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs break-all text-green-700 dark:text-green-400 font-mono bg-white dark:bg-background p-2 rounded border">
                          {fixedWebhookUrl}
                        </code>
                      </div>
                      <p className="text-[10px] text-green-600/80 dark:text-green-400/60 italic">
                        * Esta URL é configurada automaticamente para o seu servidor.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Webhook por Eventos</Label>
                          <p className="text-[10px] text-muted-foreground leading-tight">Cria uma rota específica para cada evento</p>
                        </div>
                        <Switch 
                          checked={webhookByEvents} 
                          onCheckedChange={setWebhookByEvents} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Webhook Base64</Label>
                          <p className="text-[10px] text-muted-foreground leading-tight">Envia arquivos de mídia em base64</p>
                        </div>
                        <Switch 
                          checked={webhookBase64} 
                          onCheckedChange={setWebhookBase64} 
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Eventos Disponíveis
                        </Label>
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-medium">
                          {selectedEvents.length} selecionados
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {WHATSAPP_EVENTS.map(event => (
                          <div 
                            key={event} 
                            className={`flex items-center space-x-2 p-2 rounded-lg transition-all border ${
                              selectedEvents.includes(event) 
                                ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800' 
                                : 'hover:bg-muted/50 border-transparent'
                            }`}
                          >
                            <Switch 
                              id={`event-${event}`}
                              checked={selectedEvents.includes(event)}
                              onCheckedChange={() => toggleEvent(event)}
                              className="scale-75"
                            />
                            <Label htmlFor={`event-${event}`} className="text-[10px] font-mono cursor-pointer flex-1 truncate py-1">
                              {event}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background/80 backdrop-blur-sm py-2 border-t mt-4">
                      <Button variant="ghost" size="sm" onClick={onClose}>CANCELAR</Button>
                      <Button size="sm" onClick={handleSaveWebhook} disabled={savingWebhook} className="bg-green-600 hover:bg-green-700">
                        {savingWebhook && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                        SALVAR WEBHOOK
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="mt-0 space-y-6 focus-visible:outline-none focus-visible:ring-0">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">
                      <Bell className="w-3.5 h-3.5" />
                      Configurações da Instância
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="flex items-center justify-between p-4 border rounded-xl bg-card shadow-sm hover:border-green-200 transition-colors">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-semibold">Recusar Chamadas</Label>
                          <p className="text-[10px] text-muted-foreground">Rejeitar todas as chamadas recebidas</p>
                        </div>
                        <Switch 
                          checked={settings.reject_call} 
                          onCheckedChange={(val) => setSettings(s => ({...s, reject_call: val}))} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-xl bg-card shadow-sm hover:border-green-200 transition-colors">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-semibold">Ignorar Grupos</Label>
                          <p className="text-[10px] text-muted-foreground">Ignorar mensagens vindas de grupos</p>
                        </div>
                        <Switch 
                          checked={settings.groups_ignore} 
                          onCheckedChange={(val) => setSettings(s => ({...s, groups_ignore: val}))} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-xl bg-card shadow-sm hover:border-green-200 transition-colors">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-semibold">Sempre Online</Label>
                          <p className="text-[10px] text-muted-foreground">Manter o WhatsApp sempre online</p>
                        </div>
                        <Switch 
                          checked={settings.always_online} 
                          onCheckedChange={(val) => setSettings(s => ({...s, always_online: val}))} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-xl bg-card shadow-sm hover:border-green-200 transition-colors">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-semibold">Ler Mensagens</Label>
                          <p className="text-[10px] text-muted-foreground">Marcar mensagens como lidas</p>
                        </div>
                        <Switch 
                          checked={settings.read_messages} 
                          onCheckedChange={(val) => setSettings(s => ({...s, read_messages: val}))} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-xl bg-card shadow-sm hover:border-green-200 transition-colors">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-semibold">Sincronizar Histórico</Label>
                          <p className="text-[10px] text-muted-foreground">Sincronizar todo o histórico completo no scan do QR Code</p>
                        </div>
                        <Switch 
                          checked={settings.sync_full_history} 
                          onCheckedChange={(val) => setSettings(s => ({...s, sync_full_history: val}))} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-xl bg-card shadow-sm hover:border-green-200 transition-colors">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-semibold">Ler Status</Label>
                          <p className="text-[10px] text-muted-foreground">Marcar todos os status como lidos</p>
                        </div>
                        <Switch 
                          checked={settings.read_status} 
                          onCheckedChange={(val) => setSettings(s => ({...s, read_status: val}))} 
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-background/80 backdrop-blur-sm py-2 border-t mt-4">
                      <Button variant="ghost" size="sm" onClick={onClose}>CANCELAR</Button>
                      <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings} className="bg-green-600 hover:bg-green-700">
                        {savingSettings && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                        SALVAR CONFIGS
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        )}

        <DialogFooter className="p-4 bg-muted/30 border-t shrink-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">FECHAR PAINEL</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
