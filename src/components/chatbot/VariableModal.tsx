import { useState, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useVariables } from '@/contexts/VariablesContext';

interface VariableModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (variableName: string) => void;
}

export const VariableModal = ({ open, onClose, onSelect }: VariableModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { getAllVariableNames, addVariable } = useVariables();

  const allVariables = getAllVariableNames();

  const filteredVariables = useMemo(() => {
    if (!searchTerm.trim()) return allVariables;
    return allVariables.filter(v => 
      v.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allVariables, searchTerm]);

  const canCreateNew = searchTerm.trim() && !allVariables.includes(searchTerm.trim());

  const handleSelect = (varName: string) => {
    onSelect(varName);
    setSearchTerm('');
    onClose();
  };

  const handleCreateAndSelect = () => {
    const newVarName = searchTerm.trim();
    addVariable(newVarName, '');
    handleSelect(newVarName);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Variável</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ou criar variável..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus
            />
            {canCreateNew && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={handleCreateAndSelect}
                title="Criar nova variável"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Variáveis Disponíveis
            </p>
            
            {filteredVariables.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {searchTerm ? 'Nenhuma variável encontrada' : 'Nenhuma variável criada'}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredVariables.map((varName) => (
                  <button
                    key={varName}
                    onClick={() => handleSelect(varName)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <span className="text-primary font-mono text-xs bg-primary/10 px-2 py-0.5 rounded">
                      {`{{${varName}}}`}
                    </span>
                    <span className="text-muted-foreground">{varName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {canCreateNew && (
            <div className="pt-2 border-t">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={handleCreateAndSelect}
              >
                <Plus className="h-4 w-4" />
                Criar "{searchTerm.trim()}"
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
