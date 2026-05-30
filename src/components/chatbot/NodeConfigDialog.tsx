import { Node, NodeConfig, Container } from "@/types/chatbot";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { nodeConfigComponents } from "./nodesConfigs";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const configRef = useRef<NodeConfig>({});

  useEffect(() => {
    if (open && node) {
      // Criamos uma cópia profunda para evitar mutação direta do estado do canvas
      // enquanto o usuário ainda está editando no diálogo.
      const nextConfig = JSON.parse(JSON.stringify(node.config || {}));
      configRef.current = nextConfig;
      setConfig(nextConfig);
    }
  }, [open, node?.id]);

  const updateConfig = useCallback((next: NodeConfig | ((prev: NodeConfig) => NodeConfig)) => {
    setConfig((prev) => {
      const resolved = typeof next === "function" ? (next as (prev: NodeConfig) => NodeConfig)(prev) : next;
      configRef.current = resolved;
      // Salvamento automático imediato para o canvas pai
      onSave(JSON.parse(JSON.stringify(resolved)));
      return resolved;
    });
  }, [onSave]);

  const handleSave = () => {
    onSave(JSON.parse(JSON.stringify(configRef.current)));
    onClose();
  };

  if (!node) return null;

  const normalizedNodeType = String(node.type).toLowerCase() === "await" ? "wait" : String(node.type).toLowerCase();
  const ConfigComponent = nodeConfigComponents[normalizedNodeType] || nodeConfigComponents[node.type];

  // Complex nodes need larger dialog
  const isExtraWide = normalizedNodeType === 'webhook';
  const isComplexNode = ['http-request', 'start'].includes(normalizedNodeType);
  const maxWidth = isExtraWide
    ? 'sm:max-w-6xl'
    : isComplexNode ? 'sm:max-w-2xl' : 'sm:max-w-md';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className={`bot-editor-portal ${maxWidth} w-[95vw] p-0 gap-0 bg-card border border-border rounded-xl overflow-hidden shadow-2xl`}
        style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}
      >
        <DialogHeader className="w-full pt-5 px-5 pb-4 shrink-0 bg-gradient-to-br from-primary/20 via-card to-card border-b border-border">
          <DialogTitle className="w-full text-center text-foreground uppercase tracking-wider text-sm font-semibold">
            {normalizedNodeType === "wait" || normalizedNodeType === "await" ? "Aguardar" : node.type}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 bg-card text-foreground">
          {ConfigComponent ? (
            <ConfigComponent config={config} setConfig={updateConfig} containers={containers} />
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
