import React, { useState, useEffect } from 'react';
import { GradientPicker } from './GradientPicker';
import { Settings, Palette, Type, FileText, Upload, Download, Copy, Image as ImageIcon, MessageCircle, X } from 'lucide-react';
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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(flowName);
    setDescription(flowDescription || '');
    setTheme({
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
  }, [flowName, flowDescription, settings, open]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newSettings = {
        ...settings,
        theme,
        metadata,
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
          <TabsList className="grid w-full grid-cols-3">
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
