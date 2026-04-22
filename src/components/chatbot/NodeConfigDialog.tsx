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
  const dialogSize = isComplexNode
    ? 'sm:max-w-2xl w-[95vw] max-h-[85vh]'
    : 'sm:max-w-md w-[95vw] max-h-[85vh]';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${dialogSize} overflow-hidden bg-background/95 backdrop-blur border border-border rounded-lg gap-0 flex flex-col p-0`}>
        <DialogHeader className="w-full pt-5 px-5 flex items-center justify-center pb-3 uppercase underline underline-offset-8 shrink-0">
          <DialogTitle className='w-full text-center text-foreground'>{node.type}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0">
          {ConfigComponent ? <ConfigComponent config={config} setConfig={setConfig} containers={containers} /> : (
            <div className="p-4 text-center text-muted-foreground">
              Configuração não disponível para este tipo de node.
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 flex w-full py-4 gap-1 border-t border-border">
          <div className="w-full flex gap-2 px-5">
            <Button variant="outline" onClick={onClose} className="w-full">Cancelar</Button>
            <Button onClick={handleSave} className="w-full">Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
