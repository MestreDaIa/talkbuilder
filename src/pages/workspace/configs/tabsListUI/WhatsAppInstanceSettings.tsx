import { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../../components/ui/dialog";
import { Switch } from "../../../../components/ui/switch";
import { Label } from "../../../../components/ui/label";
import { Input } from "../../../../components/ui/input";
import { ScrollArea } from "../../../../components/ui/scroll-area";
import { Separator } from "../../../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { evoApi } from "../../../../services/evolutionApi";
import { supabaseClient as supabase } from "../../../../lib/supabaseClient";
import { useToast } from "../../../../hooks/use-toast";
import { Loader2, Settings, Globe, Bell, CheckCircle2, MessageSquare, Bot, Plus, Trash2 } from "lucide-react";

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
  const [savingBot, setSavingBot] = useState(false);
  
  // Bots list for linking
  const [availableBots, setAvailableBots] = useState<any[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");

  // Webhook State
  const [webhookByEvents, setWebhookByEvents] = useState(true);
  const [webhookBase64, setWebhookBase64] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["MESSAGES_UPSERT"]);
  // Detect current project URL for the webhook
  const getWebhookUrlWithBot = (botId?: string) => {
    const backend = import.meta.env.VITE_BACKEND_URL 
      ? `${import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '')}/webhook/whatsapp`
      : window.location.origin.includes("lovable.app") 
        ? `https://xllkibdddlmcdbrhzedu.supabase.co/functions/v1/whatsapp-webhook` 
        : `${window.location.origin}/webhook/whatsapp`;
    
    return botId ? `${backend}?bot_id=${botId}` : backend;
  };

  const [webhookUrl, setWebhookUrl] = useState(getWebhookUrlWithBot(selectedBotId));

  // Update webhookUrl when selectedBotId changes
  useEffect(() => {
    if (selectedBotId) {
      setWebhookUrl(getWebhookUrlWithBot(selectedBotId));
    }
  }, [selectedBotId]);

  // Instance Settings State
  const [settings, setSettings] = useState({
    reject_call: false,
    msg_call: "",
    groups_ignore: false,
    always_online: false,
    read_messages: false,
    sync_full_history: false,
    read_status: false,
  });

  // Evolution Bot State
  const [botSettings, setBotSettings] = useState({
    enabled: false,
    description: "Evolution Bot Settings",
    apiUrl: getWebhookUrlWithBot(selectedBotId),
    apiKey: "",
    triggerType: "Keyword",
    triggerKeyword: "",
    triggerOperator: "Contains",
    expire: 300,
    keywordFinish: "bye",
    delayMessage: 1000,
    unknownMessage: "Sorry, I dont understand",
    listeningFromMe: false,
    stopBotFromMe: false,
    keepOpen: false,
    debounceTime: 1,
    splitMessages: false,
    ignoreJids: "",
  });

  useEffect(() => {
    if (isOpen && instanceName) {
      loadInstanceData();
    }
  }, [isOpen, instanceName]);

  const loadInstanceData = async () => {
    setLoading(true);
    try {
      // Fetch all needed data in parallel
      const [instanceData, settingsData, webhookData, botData, { data: flows }, { data: bindings }] = await Promise.all([
        evoApi.fetchInstance(instanceName),
        evoApi.fetchSettings(instanceName),
        evoApi.fetchWebhook(instanceName),
        evoApi.fetchEvolutionBot(instanceName),
        supabase.from("chatbot_flows").select("id, name, public_id, is_published").eq("is_published", true),
        supabase.from("whatsapp_bindings").select("*").eq("instance_name", instanceName).limit(1)
      ]);

      setAvailableBots(flows || []);
      if (bindings && bindings.length > 0) {
        setSelectedBotId(bindings[0].bot_public_id);
      }

      console.log("Instance data:", instanceData);
      console.log("Settings data:", settingsData);
      console.log("Webhook data:", webhookData);
      console.log("Bot data:", botData);

      // Load Webhook info (Prioritize data from webhook/find)
      const webhook = webhookData?.webhook || webhookData || (instanceData && instanceData.webhook);
      
      if (webhook) {
        // Handle different possible structures from API
        const w = webhook.webhook || webhook;
        setWebhookByEvents(w.byEvents ?? true);
        setWebhookBase64(w.base64 ?? false);
        const events = w.events || [];
        setSelectedEvents(events.length > 0 ? events : ["MESSAGES_UPSERT"]);
        if (w.url) {
          setWebhookUrl(w.url);
        }
      }

      if (settingsData) {
        const s = settingsData.settings || settingsData;
        
        setSettings({
          reject_call: s.rejectCall ?? s.reject_call ?? false,
          msg_call: s.msgCall ?? s.msg_call ?? "",
          groups_ignore: s.groupsIgnore ?? s.groups_ignore ?? false,
          always_online: s.alwaysOnline ?? s.always_online ?? false,
          read_messages: s.readMessages ?? s.read_messages ?? false,
          sync_full_history: s.syncFullHistory ?? s.sync_full_history ?? false,
          read_status: s.readStatus ?? s.read_status ?? false,
        });
      }

      if (botData) {
        const b = botData.evolutionBot || botData;
        setBotSettings({
          enabled: b.enabled ?? false,
          description: b.description ?? "Evolution Bot Settings",
          apiUrl: b.apiUrl || getWebhookUrlWithBot(selectedBotId),
          apiKey: b.apiKey ?? "",
          triggerType: b.triggerType || "Keyword",
          triggerKeyword: b.triggerKeyword || b.triggerValue || "",
          triggerOperator: b.triggerOperator || "Contains",
          expire: b.expire ?? 300,
          keywordFinish: b.keywordFinish ?? "bye",
          delayMessage: b.delayMessage ?? 1000,
          unknownMessage: b.unknownMessage ?? "Sorry, I dont understand",
          listeningFromMe: !!b.listeningFromMe,
          stopBotFromMe: !!b.stopBotFromMe,
          keepOpen: !!b.keepOpen,
          debounceTime: b.debounceTime ?? 1,
          splitMessages: !!b.splitMessages,
          ignoreJids: b.ignoreJids ? (Array.isArray(b.ignoreJids) ? b.ignoreJids.join(", ") : b.ignoreJids) : "",
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
        url: webhookUrl,
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

  const handleSaveBot = async () => {
    if (!botSettings.apiUrl?.trim()) {
      toast({ title: "API URL é obrigatória", description: "Informe a API URL do Evolution Bot antes de salvar.", variant: "destructive" });
      return;
    }
    if ((botSettings.triggerType || '').toLowerCase() === 'keyword' && !botSettings.triggerKeyword?.trim()) {
      toast({ title: "Trigger obrigatório", description: "Informe a palavra-chave (Trigger) ou mude o Trigger Type.", variant: "destructive" });
      return;
    }
    if (!selectedBotId) {
      toast({ title: "Vínculo obrigatório", description: "Selecione um Bot do Flow Builder para vincular a esta instância.", variant: "destructive" });
      return;
    }

    setSavingBot(true);
    try {
      // 1. Salvar no Evolution API
      await evoApi.setEvolutionBot(instanceName, botSettings);

      // 2. Salvar Vínculo no Supabase
      const { error: bindError } = await supabase
        .from("whatsapp_bindings")
        .upsert({
          instance_name: instanceName,
          bot_public_id: selectedBotId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'instance_name' });

      if (bindError) throw bindError;

      toast({ title: "Evolution Bot e Vínculo atualizados com sucesso!" });
    } catch (err: any) {
      console.error("Erro ao salvar bot/vínculo:", err);
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingBot(false);
    }
  };

  const handleDeleteBot = async () => {
    if (!confirm("Tem certeza que deseja remover o Evolution Bot?")) return;
    setSavingBot(true);
    try {
      // 1. Remover do Evolution API
      await evoApi.deleteEvolutionBot(instanceName);
      
      // 2. Remover do Supabase
      await supabase.from("whatsapp_bindings").delete().eq("instance_name", instanceName);

      toast({ title: "Evolution Bot e Vínculo removidos com sucesso!" });
      setBotSettings(prev => ({ ...prev, enabled: false }));
      setSelectedBotId("");
    } catch (err: any) {
      toast({ title: "Erro ao remover Evolution Bot", description: err.message, variant: "destructive" });
    } finally {
      setSavingBot(false);
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="events" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Eventos e Webhook
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Geral e Settings
                </TabsTrigger>
                <TabsTrigger value="bot" className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Evolution Bot
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
                        <Input 
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          className="flex-1 text-xs break-all text-green-700 dark:text-green-400 font-mono bg-white dark:bg-background h-9"
                          placeholder="https://..."
                        />
                        <Button 
                          size="xs" 
                          variant="outline" 
                          className="h-9 px-3"
                          onClick={() => setWebhookUrl(getWebhookUrlWithBot(selectedBotId))}
                        >
                          Reset
                        </Button>
                      </div>
                      <p className="text-[10px] text-green-600/80 dark:text-green-400/60 italic">
                        * Use a URL do seu servidor de API para processar o bot e os eventos.
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
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="xs" 
                            className="text-[9px] h-6 px-2 font-bold border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => setSelectedEvents([...WHATSAPP_EVENTS])}
                          >
                            HABILITAR TODOS
                          </Button>
                          <Button 
                            variant="outline" 
                            size="xs" 
                            className="text-[9px] h-6 px-2 font-bold text-destructive hover:text-destructive hover:bg-destructive/5"
                            onClick={() => setSelectedEvents([])}
                          >
                            DESABILITAR TODOS
                          </Button>
                          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-medium ml-1">
                            {selectedEvents.length} selecionados
                          </span>
                        </div>
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
                      <div className="sm:col-span-2 space-y-3 p-4 border rounded-xl bg-card shadow-sm hover:border-green-200 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-semibold">Recusar Chamadas</Label>
                            <p className="text-[10px] text-muted-foreground">Rejeitar todas as chamadas recebidas</p>
                          </div>
                          <Switch 
                            checked={settings.reject_call} 
                            onCheckedChange={(val) => setSettings(s => ({...s, reject_call: val}))} 
                          />
                        </div>

                        {settings.reject_call && (
                          <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                              <MessageSquare className="w-3 h-3" />
                              Mensagem de Rejeição
                            </Label>
                            <Input 
                              placeholder="Ex: Não aceitamos ligações por este número..." 
                              value={settings.msg_call}
                              onChange={(e) => setSettings(s => ({...s, msg_call: e.target.value}))}
                              className="text-xs h-8"
                            />
                            <p className="text-[9px] text-muted-foreground italic">
                              * Esta mensagem será enviada automaticamente ao recusar uma chamada.
                            </p>
                          </div>
                        )}
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

                <TabsContent value="bot" className="mt-0 space-y-6 focus-visible:outline-none focus-visible:ring-0">
                  <div className="space-y-4 p-6">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <Bot className="w-3.5 h-3.5" />
                        Evolution Bot Settings
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={botSettings.enabled} 
                          onCheckedChange={(val) => setBotSettings(s => ({...s, enabled: val}))} 
                        />
                        <Label className="text-xs font-medium">Habilitar Bot</Label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-3">
                        <Label className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3" />
                          Vincular ao Flow Builder
                        </Label>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Escolha qual Bot este WhatsApp deve executar:</Label>
                          <select 
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={selectedBotId}
                            onChange={(e) => setSelectedBotId(e.target.value)}
                          >
                            <option value="">Selecione um Bot publicado...</option>
                            {availableBots.map(bot => (
                              <option key={bot.id} value={bot.public_id || bot.id}>
                                {bot.name} ({bot.public_id || "Sem ID"})
                              </option>
                            ))}
                          </select>
                          {availableBots.length === 0 && (
                            <p className="text-[10px] text-amber-600 font-medium">
                              * Nenhum bot publicado encontrado. Publique um bot no Flow Builder primeiro.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">Descrição</Label>
                          <Input 
                            value={botSettings.description}
                            onChange={(e) => setBotSettings(s => ({...s, description: e.target.value}))}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">API URL</Label>
                          <Input 
                            value={botSettings.apiUrl}
                            onChange={(e) => setBotSettings(s => ({...s, apiUrl: e.target.value}))}
                            placeholder="https://sua-api.com/bot"
                            className="text-xs"
                          />
                          <p className="text-[9px] text-muted-foreground">
                            Use esta URL para que o bot use seu Flow Builder.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">API Key (Bot/Externo)</Label>
                          <Input 
                            type="password"
                            value={botSettings.apiKey}
                            onChange={(e) => setBotSettings(s => ({...s, apiKey: e.target.value}))}
                            placeholder="Key do Typebot ou API externa"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">Trigger Type</Label>
                          <select 
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={botSettings.triggerType}
                            onChange={(e) => setBotSettings(s => ({...s, triggerType: e.target.value}))}
                          >
                            <option value="Keyword">Keyword</option>
                            <option value="All">All</option>
                          </select>
                        </div>
                        {botSettings.triggerType === "Keyword" && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">Trigger Operator</Label>
                              <select 
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={botSettings.triggerOperator}
                                onChange={(e) => setBotSettings(s => ({...s, triggerOperator: e.target.value}))}
                              >
                                <option value="Contains">Contains</option>
                                <option value="Equals">Equals</option>
                                <option value="Starts With">Starts With</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">Trigger Keyword</Label>
                              <Input 
                                value={botSettings.triggerKeyword}
                                onChange={(e) => setBotSettings(s => ({...s, triggerKeyword: e.target.value}))}
                                placeholder="Palavra-chave"
                                className="text-xs"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">Keyword Finish</Label>
                          <Input 
                            value={botSettings.keywordFinish}
                            onChange={(e) => setBotSettings(s => ({...s, keywordFinish: e.target.value}))}
                            placeholder="ex: sair"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">Expire (minutos)</Label>
                          <Input 
                            type="number"
                            value={botSettings.expire}
                            onChange={(e) => setBotSettings(s => ({...s, expire: parseInt(e.target.value) || 0}))}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">Delay (ms)</Label>
                          <Input 
                            type="number"
                            value={botSettings.delayMessage}
                            onChange={(e) => setBotSettings(s => ({...s, delayMessage: parseInt(e.target.value) || 0}))}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-muted-foreground">Debounce (s)</Label>
                          <Input 
                            type="number"
                            value={botSettings.debounceTime}
                            onChange={(e) => setBotSettings(s => ({...s, debounceTime: parseInt(e.target.value) || 0}))}
                            className="text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Mensagem Desconhecida</Label>
                        <Input 
                          value={botSettings.unknownMessage}
                          onChange={(e) => setBotSettings(s => ({...s, unknownMessage: e.target.value}))}
                          className="text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                          <Label className="text-xs font-medium">Ouvir minhas mensagens</Label>
                          <Switch 
                            checked={botSettings.listeningFromMe} 
                            onCheckedChange={(val) => setBotSettings(s => ({...s, listeningFromMe: val}))} 
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                          <Label className="text-xs font-medium">Parar bot de mim</Label>
                          <Switch 
                            checked={botSettings.stopBotFromMe} 
                            onCheckedChange={(val) => setBotSettings(s => ({...s, stopBotFromMe: val}))} 
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                          <Label className="text-xs font-medium">Manter Aberto</Label>
                          <Switch 
                            checked={botSettings.keepOpen} 
                            onCheckedChange={(val) => setBotSettings(s => ({...s, keepOpen: val}))} 
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                          <Label className="text-xs font-medium">Dividir Mensagens</Label>
                          <Switch 
                            checked={botSettings.splitMessages} 
                            onCheckedChange={(val) => setBotSettings(s => ({...s, splitMessages: val}))} 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Ignorar JIDs (separados por vírgula)</Label>
                        <Input 
                          value={botSettings.ignoreJids}
                          onChange={(e) => setBotSettings(s => ({...s, ignoreJids: e.target.value}))}
                          placeholder="ex: 123@s.whatsapp.net, 456@g.us"
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 sticky bottom-0 bg-background/80 backdrop-blur-sm py-2 border-t mt-4">
                      <Button variant="outline" size="sm" onClick={handleDeleteBot} className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4 mr-2" />
                        REMOVER BOT
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={onClose}>CANCELAR</Button>
                        <Button size="sm" onClick={handleSaveBot} disabled={savingBot} className="bg-green-600 hover:bg-green-700">
                          {savingBot && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                          SALVAR BOT
                        </Button>
                      </div>
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
