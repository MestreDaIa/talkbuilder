import React, { useState, useEffect } from 'react';
import { Settings, Palette, Type, FileText } from 'lucide-react';
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
    textColor: settings.theme?.textColor || '#1f2937',
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
      textColor: settings.theme?.textColor || '#1f2937',
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-auto flex flex-col items-center p-4 gap-2 border-2 hover:border-primary transition-all"
                onClick={() => {
                  setTheme({
                    ...theme,
                    primaryColor: '#25D366',
                    backgroundColor: '#e5ddd5',
                    textColor: '#111b21',
                    fontFamily: 'Helvetica, Arial, sans-serif',
                  });
                  toast.success('Template WhatsApp aplicado!');
                }}
              >
                <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-white">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                </div>
                <span className="text-xs font-medium">WhatsApp</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto flex flex-col items-center p-4 gap-2 border-2 hover:border-primary transition-all"
                onClick={() => {
                  setTheme({
                    ...theme,
                    primaryColor: '#0084ff',
                    backgroundColor: '#ffffff',
                    textColor: '#1c1e21',
                    fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                  });
                  toast.success('Template Messenger aplicado!');
                }}
              >
                <div className="w-10 h-10 bg-[#0084ff] rounded-full flex items-center justify-center text-white">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.303 2.254.464 3.443.464 6.627 0 12-4.974 12-11.111C24 4.974 18.627 0 12 0zm1.2 14.7l-3.06-3.27-5.94 3.27 6.54-6.96 3.12 3.27 5.88-3.27-6.54 6.96z" />
                  </svg>
                </div>
                <span className="text-xs font-medium">Messenger</span>
              </Button>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Personalizado</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="primaryColor">Cor Primária</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={theme.primaryColor}
                  onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Cor de Fundo</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  id="backgroundColor"
                  value={theme.backgroundColor}
                  onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={theme.backgroundColor}
                  onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="textColor">Cor do Texto</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  id="textColor"
                  value={theme.textColor}
                  onChange={(e) => setTheme({ ...theme, textColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={theme.textColor}
                  onChange={(e) => setTheme({ ...theme, textColor: e.target.value })}
                  placeholder="#1f2937"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fontFamily">Fonte</Label>
              <Input
                id="fontFamily"
                value={theme.fontFamily}
                onChange={(e) => setTheme({ ...theme, fontFamily: e.target.value })}
                placeholder="Inter, sans-serif"
              />
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
