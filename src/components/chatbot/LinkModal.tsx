import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface LinkModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string, url: string) => void;
}

export const LinkModal = ({ open, onClose, onSubmit }: LinkModalProps) => {
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const handleSubmit = () => {
    if (linkText.trim() && linkUrl.trim()) {
      onSubmit(linkText.trim(), linkUrl.trim());
      setLinkText('');
      setLinkUrl('');
      onClose();
    }
  };

  const handleClose = () => {
    setLinkText('');
    setLinkUrl('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Link</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkText">Nome do link</Label>
            <Input
              id="linkText"
              placeholder="Texto do link..."
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="linkUrl">Link (URL)</Label>
            <Input
              id="linkUrl"
              placeholder="https://exemplo.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!linkText.trim() || !linkUrl.trim()}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
