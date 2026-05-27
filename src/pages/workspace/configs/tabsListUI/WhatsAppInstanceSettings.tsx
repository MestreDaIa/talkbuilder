import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../../components/ui/dialog";
import { Switch } from "../../../../components/ui/switch";
import { Label } from "../../../../components/ui/label";
import { ScrollArea } from "../../../../components/ui/scroll-area";
import { Separator } from "../../../../components/ui/separator";
import { evoApi } from "../../../../services/evolutionApi";
import { useToast } from "../../../../hooks/use-toast";
import { Loader2, Settings, Globe, Bell } from "lucide-react";

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
          reject_call: apiSettings.reject_call ?? false,
          groups_ignore: apiSettings.groups_ignore ?? false,
          always_online: apiSettings.always_online ?? false,
          read_messages: apiSettings.read_messages ?? false,
          sync_full_history: apiSettings.sync_full_history ?? false,
          read_status: apiSettings.read_status ?? false,
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações: {instanceName}
          </DialogTitle>
          <DialogDescription>
            Personalize o comportamento e os eventos do webhook para esta instância.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            <p className="text-sm text-muted-foreground">Carregando configurações...</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-8 py-6">
              {/* Webhook & Events Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  <Globe className="w-4 h-4" />
                  Secção de Eventos e Webhook
                </div>
                
                <div className="p-3 bg-muted/50 rounded-lg border">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">URL Webhook Fixada</Label>
                  <code className="text-xs break-all text-green-700 font-mono">{fixedWebhookUrl}</code>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Webhook by Events</Label>
                      <p className="text-xs text-muted-foreground">Create a route for each event by adding the event name to the end of the URL</p>
                    </div>
                    <Switch 
                      checked={webhookByEvents} 
                      onCheckedChange={setWebhookByEvents} 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Webhook Base64</Label>
                      <p className="text-xs text-muted-foreground">Send media base64 data in webhook</p>
                    </div>
                    <Switch 
                      checked={webhookBase64} 
                      onCheckedChange={setWebhookBase64} 
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <Label className="text-sm font-semibold">Events:</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {WHATSAPP_EVENTS.map(event => (
                      <div key={event} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/30 transition-colors border border-transparent hover:border-border">
                        <Switch 
                          id={`event-${event}`}
                          checked={selectedEvents.includes(event)}
                          onCheckedChange={() => toggleEvent(event)}
                        />
                        <Label htmlFor={`event-${event}`} className="text-[10px] font-mono cursor-pointer flex-1">
                          {event}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={onClose}>CANCELAR</Button>
                  <Button size="sm" onClick={handleSaveWebhook} disabled={savingWebhook}>
                    {savingWebhook && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                    SALVAR WEBHOOK
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Instance Settings Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  <Bell className="w-4 h-4" />
                  Sessão de Configs Instância
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Reject Calls</Label>
                      <p className="text-[10px] text-muted-foreground">Reject all incoming calls</p>
                    </div>
                    <Switch 
                      checked={settings.reject_call} 
                      onCheckedChange={(val) => setSettings(s => ({...s, reject_call: val}))} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Ignore Groups</Label>
                      <p className="text-[10px] text-muted-foreground">Ignore all messages from groups</p>
                    </div>
                    <Switch 
                      checked={settings.groups_ignore} 
                      onCheckedChange={(val) => setSettings(s => ({...s, groups_ignore: val}))} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Always Online</Label>
                      <p className="text-[10px] text-muted-foreground">Keep the whatsapp always online</p>
                    </div>
                    <Switch 
                      checked={settings.always_online} 
                      onCheckedChange={(val) => setSettings(s => ({...s, always_online: val}))} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Read Messages</Label>
                      <p className="text-[10px] text-muted-foreground">Mark all messages as read</p>
                    </div>
                    <Switch 
                      checked={settings.read_messages} 
                      onCheckedChange={(val) => setSettings(s => ({...s, read_messages: val}))} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Sync Full History</Label>
                      <p className="text-[10px] text-muted-foreground">Sync all complete chat history</p>
                    </div>
                    <Switch 
                      checked={settings.sync_full_history} 
                      onCheckedChange={(val) => setSettings(s => ({...s, sync_full_history: val}))} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Read Status</Label>
                      <p className="text-[10px] text-muted-foreground">Mark all statuses as read</p>
                    </div>
                    <Switch 
                      checked={settings.read_status} 
                      onCheckedChange={(val) => setSettings(s => ({...s, read_status: val}))} 
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={onClose}>CANCELAR</Button>
                  <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings}>
                    {savingSettings && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                    SALVAR CONFIGS
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="p-4 bg-muted/30 border-t">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">FECHAR</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
