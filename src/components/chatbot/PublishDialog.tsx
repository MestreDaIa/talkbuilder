import React, { useState, useEffect } from 'react';
import { Globe, Copy, Check, Send, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabaseClient } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Container, Edge } from '@/types/chatbot';

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string;
  currentPublicId: string | null;
  isPublished: boolean;
  companyId: string;
  companySlug: string;
  containers: Container[];
  edges: Edge[];
  onPublishSuccess: (publicId: string, isPublished: boolean) => void;
}

export function PublishDialog({
  open,
  onOpenChange,
  flowId,
  currentPublicId,
  isPublished,
  companyId,
  companySlug,
  containers,
  edges,
  onPublishSuccess,
}: PublishDialogProps) {
  const [publicId, setPublicId] = useState(currentPublicId || '');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);

  useEffect(() => {
    if (currentPublicId) {
      setPublicId(currentPublicId);
    }
  }, [currentPublicId]);

  const getPublicUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/${companySlug}/flow/${publicId}`;
  };

  const validatePublicId = (value: string) => {
    if (!value) {
      setValidationError('O ID público é obrigatório');
      return false;
    }
    if (value.length < 3) {
      setValidationError('Mínimo 3 caracteres');
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      setValidationError('Apenas letras minúsculas, números e hífens');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handlePublicIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setPublicId(value);
    validatePublicId(value);
  };

  const handlePublish = async () => {
    if (!validatePublicId(publicId)) return;

    setIsPublishing(true);
    try {
      // Check if public_id is already in use by another flow within the same company
      const { data: existingFlow } = await supabaseClient
        .from('chatbot_flows')
        .select('id')
        .eq('company_id', companyId)
        .eq('public_id', publicId)
        .neq('id', flowId)
        .maybeSingle();

      if (existingFlow) {
        setValidationError('Este ID público já está em uso por outro chatbot da sua empresa');
        setIsPublishing(false);
        return;
      }

      // Publish the flow - use any to bypass type checking for new columns
      // Also activate the bot when publishing
      const updateData: any = {
        public_id: publicId,
        is_published: true,
        is_active: true, // Automatically activate when publishing
        published_at: new Date().toISOString(),
        published_containers: containers,
        published_edges: edges,
      };

      const { error } = await supabaseClient
        .from('chatbot_flows')
        .update(updateData)
        .eq('id', flowId);

      if (error) throw error;

      toast.success('Bot publicado e ativado com sucesso!');
      onPublishSuccess(publicId, true);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error publishing flow:', error);
      toast.error('Erro ao publicar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublishClick = () => {
    setShowUnpublishConfirm(true);
  };

  const handleUnpublishConfirm = async () => {
    setShowUnpublishConfirm(false);
    setIsUnpublishing(true);
    try {
      // Also deactivate the bot when unpublishing
      const updateData: any = { is_published: false, is_active: false };
      const { error } = await supabaseClient
        .from('chatbot_flows')
        .update(updateData)
        .eq('id', flowId);

      if (error) throw error;

      toast.success('Bot despublicado e desativado');
      onPublishSuccess(publicId, false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error unpublishing flow:', error);
      toast.error('Erro ao despublicar');
    } finally {
      setIsUnpublishing(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(getPublicUrl());
    setCopied(true);
    toast.success('URL copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  const openPreview = () => {
    window.open(getPublicUrl(), '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Publicar Chatbot
          </DialogTitle>
          <DialogDescription>
            {isPublished 
              ? 'Seu bot está publicado. Você pode atualizar ou despublicar.'
              : 'Configure o ID público para compartilhar seu chatbot.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="publicId">ID Público</Label>
            <Input
              id="publicId"
              value={publicId}
              onChange={handlePublicIdChange}
              placeholder="ex: atendimento-inicial"
              className={validationError ? 'border-destructive' : ''}
            />
            {validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Este ID aparecerá na URL pública do seu chatbot
            </p>
          </div>

          {publicId && !validationError && (
            <div className="space-y-2">
              <Label>URL Pública</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={getPublicUrl()}
                  readOnly
                  className="text-xs bg-muted"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={copyUrl}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                {isPublished && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={openPreview}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {isPublished && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                <Check className="h-4 w-4" />
                Seu chatbot está publicado e acessível
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isPublished && (
            <Button
              variant="outline"
              onClick={handleUnpublishClick}
              disabled={isUnpublishing}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {isUnpublishing ? 'Despublicando...' : 'Despublicar'}
            </Button>
          )}
          <Button
            onClick={handlePublish}
            disabled={isPublishing || !!validationError || !publicId}
          >
            <Send className="h-4 w-4 mr-2" />
            {isPublishing ? 'Publicando...' : isPublished ? 'Atualizar' : 'Publicar'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Unpublish Confirmation Dialog */}
      <AlertDialog open={showUnpublishConfirm} onOpenChange={setShowUnpublishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Despublicação
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja despublicar este chatbot? A URL pública deixará de funcionar imediatamente e o bot será desativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnpublishConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Despublicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
