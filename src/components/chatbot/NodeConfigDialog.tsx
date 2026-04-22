import { Node, NodeConfig, Container } from "@/types/chatbot";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { nodeConfigComponents } from "./nodesConfigs";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface NodeConfigDialogProps {
  node: Node | null;
  open: boolean;
  onClose: () => void;
  onSave: (config: NodeConfig) => void;
  containers?: Container[];
}

export const NodeConfigDialog = ({ node, open, onClose, onSave, containers = [] }: NodeConfigDialogProps) => {
  const [config, setConfig] = useState<NodeConfig>({});

  useEffect(() => {
    if (node) setConfig(node.config);
  }, [node]);

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  if (!node) return null;

  const ConfigComponent = nodeConfigComponents[node.type];

  // Complex nodes need larger dialog
  const isComplexNode = ['http-request', 'webhook', 'start'].includes(node.type);
  const maxWidth = isComplexNode ? 'sm:max-w-2xl' : 'sm:max-w-md';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className={`bot-editor-portal ${maxWidth} w-[95vw] p-0 gap-0 bg-card border border-border rounded-xl overflow-hidden shadow-2xl`}
        style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}
      >
        <DialogHeader className="w-full pt-5 px-5 pb-4 shrink-0 bg-gradient-to-br from-primary/20 via-card to-card border-b border-border">
          <DialogTitle className="w-full text-center text-foreground uppercase tracking-wider text-sm font-semibold">
            {node.type}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 bg-card text-foreground">
          {ConfigComponent ? (
            <ConfigComponent config={config} setConfig={setConfig} containers={containers} />
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Configuração não disponível para este tipo de node.
            </div>
          )}
        </div>
        <div className="shrink-0 w-full py-4 px-5 border-t border-border bg-muted/40">
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="outline" onClick={onClose} className="w-full min-w-0">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="w-full min-w-0">
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
