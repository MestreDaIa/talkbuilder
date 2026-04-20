import React, { useState, useRef } from 'react';
import { Upload, Download, FileJson, Link, Check, AlertCircle } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabaseClient } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface ImportExportDialogProps {
  mode: 'import' | 'export';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  flowId?: string;
  flowName?: string;
  onSuccess?: () => void;
}

interface FlowExportData {
  version: string;
  exportedAt: string;
  flow: {
    name: string;
    description?: string | null;
    containers: any[];
    edges: any[];
    settings?: Record<string, any>;
  };
}

export function ImportExportDialog({
  mode,
  open,
  onOpenChange,
  companyId,
  flowId,
  flowName,
  onSuccess,
}: ImportExportDialogProps) {
  const [importUrl, setImportUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importData, setImportData] = useState<FlowExportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as FlowExportData;

      if (!data.flow || !Array.isArray(data.flow.containers)) {
        throw new Error('Formato inválido: arquivo não contém dados de fluxo válidos');
      }

      setImportData(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao ler arquivo');
      setImportData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUrlImport = async () => {
    if (!importUrl.trim()) return;

    setError(null);
    setIsProcessing(true);

    try {
      const response = await fetch(importUrl);
      if (!response.ok) {
        throw new Error('Não foi possível acessar a URL');
      }

      const data = await response.json() as FlowExportData;

      if (!data.flow || !Array.isArray(data.flow.containers)) {
        throw new Error('Formato inválido: URL não contém dados de fluxo válidos');
      }

      setImportData(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao importar da URL');
      setImportData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!importData) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabaseClient
        .from('chatbot_flows')
        .insert([{
          company_id: companyId,
          name: importData.flow.name,
          description: importData.flow.description || null,
          containers: importData.flow.containers,
          edges: importData.flow.edges || [],
          settings: importData.flow.settings || {},
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Fluxo importado com sucesso!');
      onSuccess?.();
      onOpenChange(false);
      resetState();
      // Reload the page to show the newly imported flow
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar fluxo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    if (!flowId) return;

    setIsProcessing(true);
    try {
      const { data: flow, error } = await supabaseClient
        .from('chatbot_flows')
        .select('name, description, containers, edges')
        .eq('id', flowId)
        .single();

      if (error || !flow) throw error || new Error('Fluxo não encontrado');

      const flowData = flow as any;
      const exportData: FlowExportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        flow: {
          name: flowData.name,
          description: flowData.description,
          containers: flowData.containers as any[] || [],
          edges: flowData.edges as any[] || [],
          settings: flowData.settings as Record<string, any> || {},
        }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${flow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Fluxo exportado!');
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao exportar');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setImportUrl('');
    setImportData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  if (mode === 'export') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exportar Fluxo
            </DialogTitle>
            <DialogDescription>
              Exporte "{flowName}" como arquivo JSON
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              O arquivo exportado pode ser importado em outra conta ou compartilhado com outras pessoas.
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={isProcessing}>
              <Download className="h-4 w-4 mr-2" />
              {isProcessing ? 'Exportando...' : 'Exportar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Fluxo
          </DialogTitle>
          <DialogDescription>
            Importe um fluxo de chatbot de um arquivo ou URL
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">
              <FileJson className="h-4 w-4 mr-2" />
              Arquivo
            </TabsTrigger>
            <TabsTrigger value="url">
              <Link className="h-4 w-4 mr-2" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selecione o arquivo JSON</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
              />
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="importUrl">URL do arquivo</Label>
              <div className="flex gap-2">
                <Input
                  id="importUrl"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://exemplo.com/fluxo.json"
                />
                <Button 
                  variant="outline" 
                  onClick={handleUrlImport}
                  disabled={!importUrl.trim() || isProcessing}
                >
                  Carregar
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {importData && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
              <Check className="h-4 w-4" />
              Fluxo encontrado: <strong>{importData.flow.name}</strong>
            </p>
            {importData.flow.description && (
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                {importData.flow.description}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!importData || isProcessing}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isProcessing ? 'Importando...' : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
