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
