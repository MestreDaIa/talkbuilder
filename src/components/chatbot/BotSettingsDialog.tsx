import React, { useState, useEffect } from 'react';
import { SiWhatsapp } from '@icons-pack/react-simple-icons';
import { GradientPicker } from './GradientPicker';
import { Settings, Palette, Type, FileText, Upload, Download, Copy, Image as ImageIcon, MessageCircle, X, Loader2, Key } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabaseClient } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface BotSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string;
  flowName: string;
  flowDescription: string | null;
  settings: Record<string, any>;
  onUpdate: (settings: Record<string, any>) => void;
}

export function BotSettingsDialog({
  open,
  onOpenChange,
  flowId,
  flowName,
  flowDescription,
  settings,
  onUpdate,
}: BotSettingsDialogProps) {
  const [name, setName] = useState(flowName);
  const [description, setDescription] = useState(flowDescription || '');
  const [theme, setTheme] = useState({
    avatarUrl: settings.theme?.avatarUrl || '',
    primaryColor: settings.theme?.primaryColor || '#3b82f6',
    backgroundColor: settings.theme?.backgroundColor || '#ffffff',
    backgroundImage: settings.theme?.backgroundImage || '',
    headerBackgroundColor: settings.theme?.headerBackgroundColor || '',
    headerTextColor: settings.theme?.headerTextColor || '#ffffff',
    inputBackgroundColor: settings.theme?.inputBackgroundColor || '#ffffff',
    inputTextColor: settings.theme?.inputTextColor || '#1f2937',
    textColor: settings.theme?.textColor || '#1f2937',
    botBubbleColor: settings.theme?.botBubbleColor || '#f3f4f6',
    botTextColor: settings.theme?.botTextColor || '#1f2937',
    userBubbleColor: settings.theme?.userBubbleColor || '#3b82f6',
    userTextColor: settings.theme?.userTextColor || '#ffffff',
    fontFamily: settings.theme?.fontFamily || 'Inter',
  });
  const [metadata, setMetadata] = useState({
    title: settings.metadata?.title || '',
    description: settings.metadata?.description || '',
    favicon: settings.metadata?.favicon || '',
  });
  const [aiKeys, setAiKeys] = useState({
    openaiKey: settings.aiKeys?.openaiKey || '',
    anthropicKey: settings.aiKeys?.anthropicKey || '',
    googleKey: settings.aiKeys?.googleKey || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `bot-avatars/${fileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setTheme({ ...theme, avatarUrl: publicUrl });
      toast.success('Imagem carregada!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erro ao carregar imagem. Verifique se o bucket "avatars" existe.');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    setName(flowName);
    setDescription(flowDescription || '');
    setTheme({
      avatarUrl: settings.theme?.avatarUrl || '',
      primaryColor: settings.theme?.primaryColor || '#3b82f6',
      backgroundColor: settings.theme?.backgroundColor || '#ffffff',
      backgroundImage: settings.theme?.backgroundImage || '',
      headerBackgroundColor: settings.theme?.headerBackgroundColor || '',
      headerTextColor: settings.theme?.headerTextColor || '#ffffff',
      inputBackgroundColor: settings.theme?.inputBackgroundColor || '#ffffff',
      inputTextColor: settings.theme?.inputTextColor || '#1f2937',
      textColor: settings.theme?.textColor || '#1f2937',
      botBubbleColor: settings.theme?.botBubbleColor || '#f3f4f6',
      botTextColor: settings.theme?.botTextColor || '#1f2937',
      userBubbleColor: settings.theme?.userBubbleColor || '#3b82f6',
      userTextColor: settings.theme?.userTextColor || '#ffffff',
      fontFamily: settings.theme?.fontFamily || 'Inter',
    });
    setMetadata({
      title: settings.metadata?.title || '',
      description: settings.metadata?.description || '',
      favicon: settings.metadata?.favicon || '',
    });
    setAiKeys({
      openaiKey: settings.aiKeys?.openaiKey || '',
      anthropicKey: settings.aiKeys?.anthropicKey || '',
      googleKey: settings.aiKeys?.googleKey || '',
    });
  }, [flowName, flowDescription, settings, open]);


  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newSettings = {
        ...settings,
        theme,
        metadata,
        aiKeys,
      };


      const { error } = await supabaseClient
        .from('chatbot_flows')
        .update({
          name,
          description: description || null,
          settings: newSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', flowId);

      if (error) throw error;

      onUpdate(newSettings);
      toast.success('Configurações salvas!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações do Bot
          </DialogTitle>
          <DialogDescription>
            Personalize a aparência e metadados do seu chatbot
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">
              <FileText className="h-4 w-4 mr-2" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="theme">
              <Palette className="h-4 w-4 mr-2" />
              Tema
            </TabsTrigger>
            <TabsTrigger value="metadata">
              <Type className="h-4 w-4 mr-2" />
              SEO
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Key className="h-4 w-4 mr-2" />
              IA & Chaves
            </TabsTrigger>
            <TabsTrigger value="whatsapp">
              <SiWhatsapp className="h-4 w-4 mr-2" />
              WhatsApp
            </TabsTrigger>
          </TabsList>


          <TabsContent value="general" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Bot</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do chatbot"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo deste bot..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Imagem do Bot (Avatar)</Label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/20">
                  {theme.avatarUrl ? (
                    <img src={theme.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        disabled={isUploading}
                      />
                      <Button variant="outline" className="w-full" disabled={isUploading}>
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                        Upload
                      </Button>
                    </div>
                    <div className="flex-[2]">
                      <Input
                        placeholder="Ou cole a URL da imagem..."
                        value={theme.avatarUrl}
                        onChange={(e) => setTheme({ ...theme, avatarUrl: e.target.value })}
                      />
                    </div>
                    {theme.avatarUrl && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setTheme({ ...theme, avatarUrl: '' })}
                        className="text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Formatos suportados: JPG, PNG, SVG. Tamanho recomendado: 128x128px.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="theme" className="space-y-4 py-4">
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Cores e Estilos</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Geral
                </h4>
                
                <div className="space-y-2">
                  <GradientPicker 
                    label="Cor Primária (Botão/Ícone)"
                    value={theme.primaryColor}
                    onChange={(val) => setTheme({ ...theme, primaryColor: val })}
                  />
                </div>

                <div className="space-y-2">
                  <GradientPicker 
                    label="Cor de Fundo da Janela"
                    value={theme.backgroundColor}
                    onChange={(val) => setTheme({ ...theme, backgroundColor: val })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backgroundImage">Imagem de Fundo (URL)</Label>
                  <div className="flex gap-2">
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <Input
                      id="backgroundImage"
                      value={theme.backgroundImage}
                      onChange={(e) => setTheme({ ...theme, backgroundImage: e.target.value })}
                      placeholder="https://exemplo.com/bg.png"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Deixe em branco para usar apenas a cor de fundo.</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Cabeçalho e Rodapé
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <GradientPicker 
                      label="Cabeçalho (Fundo)"
                      value={theme.headerBackgroundColor || theme.primaryColor}
                      onChange={(val) => setTheme({ ...theme, headerBackgroundColor: val })}
                    />
                  </div>
                  <div className="space-y-2">
                    <GradientPicker 
                      label="Cabeçalho (Texto)"
                      value={theme.headerTextColor}
                      onChange={(val) => setTheme({ ...theme, headerTextColor: val })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <GradientPicker 
                      label="Campo Input (Fundo)"
                      value={theme.inputBackgroundColor}
                      onChange={(val) => setTheme({ ...theme, inputBackgroundColor: val })}
                    />
                  </div>
                  <div className="space-y-2">
                    <GradientPicker 
                      label="Campo Input (Texto)"
                      value={theme.inputTextColor}
                      onChange={(val) => setTheme({ ...theme, inputTextColor: val })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" /> Mensagens
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <GradientPicker 
                      label="Balão Bot"
                      value={theme.botBubbleColor}
                      onChange={(val) => setTheme({ ...theme, botBubbleColor: val })}
                    />
                  </div>
                  <div className="space-y-2">
                    <GradientPicker 
                      label="Texto Bot"
                      value={theme.botTextColor}
                      onChange={(val) => setTheme({ ...theme, botTextColor: val })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <GradientPicker 
                      label="Balão Usuário"
                      value={theme.userBubbleColor}
                      onChange={(val) => setTheme({ ...theme, userBubbleColor: val })}
                    />
                  </div>
                  <div className="space-y-2">
                    <GradientPicker 
                      label="Texto Usuário"
                      value={theme.userTextColor}
                      onChange={(val) => setTheme({ ...theme, userTextColor: val })}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label htmlFor="fontFamily" className="flex items-center gap-2">
                    <Type className="w-4 h-4" /> Fonte
                  </Label>
                  <Input
                    id="fontFamily"
                    value={theme.fontFamily}
                    onChange={(e) => setTheme({ ...theme, fontFamily: e.target.value })}
                    placeholder="Inter, sans-serif"
                  />
                  <p className="text-[10px] text-muted-foreground">Importe do Google Fonts ou use fontes do sistema.</p>
                </div>
              </div>
            </div>

          </TabsContent>

          <TabsContent value="metadata" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="metaTitle">Título da Página</Label>
              <Input
                id="metaTitle"
                value={metadata.title}
                onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                placeholder="Título exibido na aba do navegador"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaDescription">Descrição Meta</Label>
              <Textarea
                id="metaDescription"
                value={metadata.description}
                onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                placeholder="Descrição para SEO e compartilhamento"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="favicon">URL do Favicon</Label>
              <Input
                id="favicon"
                value={metadata.favicon}
                onChange={(e) => setMetadata({ ...metadata, favicon: e.target.value })}
                placeholder="https://exemplo.com/favicon.ico"
              />
            </div>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-4 py-4">
            <div className="p-4 border rounded-lg bg-emerald-50/50 border-emerald-100">
               <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <SiWhatsapp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-emerald-900">Configuração WhatsApp</h4>
                    <p className="text-xs text-emerald-700">Vincule este bot a uma instância da Evolution API</p>
                  </div>
               </div>
               
               <WhatsAppBindingSection botPublicId={settings.public_id || flowId} />
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Configure as chaves de API para habilitar os recursos de Inteligência Artificial e o Agente Autônomo. Suas chaves são armazenadas de forma segura.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="openaiKey">OpenAI API Key</Label>
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline">Obter chave</a>
                  </div>
                  <Input
                    id="openaiKey"
                    type="password"
                    value={aiKeys.openaiKey}
                    onChange={(e) => setAiKeys({ ...aiKeys, openaiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="anthropicKey">Anthropic API Key</Label>
                    <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline">Obter chave</a>
                  </div>
                  <Input
                    id="anthropicKey"
                    type="password"
                    value={aiKeys.anthropicKey}
                    onChange={(e) => setAiKeys({ ...aiKeys, anthropicKey: e.target.value })}
                    placeholder="sk-ant-..."
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="googleKey">Google Gemini API Key</Label>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline">Obter chave</a>
                  </div>
                  <Input
                    id="googleKey"
                    type="password"
                    value={aiKeys.googleKey}
                    onChange={(e) => setAiKeys({ ...aiKeys, googleKey: e.target.value })}
                    placeholder="AIza..."
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function WhatsAppBindingSection({ botPublicId }: { botPublicId: string }) {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [binding, setBinding] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [insts, { data: bind }] = await Promise.all([
          evoApi.fetchInstances(),
          supabaseClient.from("whatsapp_bindings").select("instance_name").eq("bot_public_id", botPublicId).maybeSingle()
        ]);
        setInstances(insts);
        if (bind) setBinding(bind.instance_name);
      } catch (err) {
        console.error("Erro ao carregar instâncias:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [botPublicId]);

  const handleBind = async (instanceName: string) => {
    try {
      // 1. Remove qualquer vínculo anterior deste bot
      await supabaseClient.from("whatsapp_bindings").delete().eq("bot_public_id", botPublicId);
      
      // 2. Cria novo vínculo
      const { error } = await supabaseClient.from("whatsapp_bindings").insert({
        bot_public_id: botPublicId,
        instance_name: instanceName
      });

      if (error) throw error;

      // 3. Configura o Webhook na Evolution API
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;
      await evoApi.setWebhook(instanceName, webhookUrl);

      setBinding(instanceName);
      toast.success(`Bot vinculado à instância ${instanceName}`);
    } catch (err) {
      toast.error("Erro ao vincular bot");
    }
  };

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>;

  return (
    <div className="space-y-3">
      {instances.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma instância encontrada na Evolution API. Crie uma nas configurações de integrações.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {instances.map((inst: any) => (
            <div key={inst.instanceName} className="flex items-center justify-between p-3 border rounded-lg bg-white">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{inst.instanceName}</span>
                {binding === inst.instanceName && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">VINCULADO</span>
                )}
              </div>
              <Button 
                size="sm" 
                variant={binding === inst.instanceName ? "outline" : "default"}
                onClick={() => handleBind(inst.instanceName)}
                disabled={binding === inst.instanceName}
                className={binding !== inst.instanceName ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                {binding === inst.instanceName ? "Vinculado" : "Vincular"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
