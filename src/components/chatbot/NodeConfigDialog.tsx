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
  const dialogSize = isComplexNode ? 'max-w-2xl h-[80vh]' : 'max-w-72 h-96';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${dialogSize} overflow-hidden bg-background/95 backdrop-blur border border-border rounded-lg gap-5 flex flex-col justify-between px-0`}>
        <DialogHeader className="w-full pt-5 flex items-center justify-center pb-0 uppercase underline underline-offset-8">
          <DialogTitle className='w-full text-center text-foreground'>{node.type}</DialogTitle>
        </DialogHeader>
        <div className="h-full w-full justify-between overflow-y-auto flex flex-col gap-0 p-0">
          <div className="w-full h-full overflow-auto">
            {ConfigComponent ? <ConfigComponent config={config} setConfig={setConfig} containers={containers} /> : (
              <div className="p-4 text-center text-muted-foreground">
                Configuração não disponível para este tipo de node.
              </div>
            )}
          </div>
          <DialogFooter className="flex w-full py-4 gap-1">
            <div className="w-full flex gap-2 px-5">
              <Button variant="outline" onClick={onClose} className="w-full">Cancelar</Button>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
