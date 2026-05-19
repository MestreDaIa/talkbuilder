import { NodeConfig } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface GoogleSheetsConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const GoogleSheetsConfig = ({ config, setConfig }: GoogleSheetsConfigProps) => {
  const spreadsheetId = config.spreadsheetId || "";
  const tabName = config.tabName || "";
  const action = config.action || "insert";
  const mappings = config.mappings || [];

  const addMapping = () => {
    setConfig({
      ...config,
      mappings: [...mappings, { column: "", value: "" }]
    });
  };

  const removeMapping = (index: number) => {
    const newMappings = [...mappings];
    newMappings.splice(index, 1);
    setConfig({ ...config, mappings: newMappings });
  };

  const updateMapping = (index: number, field: string, value: string) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setConfig({ ...config, mappings: newMappings });
  };

  return (
    <div className="p-4 space-y-5">
      <div className="space-y-2">
        <Label>ID da Planilha (Spreadsheet ID)</Label>
        <Input 
          placeholder="Ex: 1a2b3c4d5e6f7g8h9i0j..."
          value={spreadsheetId}
          onChange={(e) => setConfig({ ...config, spreadsheetId: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome da Aba (Tab Name)</Label>
          <Input 
            placeholder="Página1"
            value={tabName}
            onChange={(e) => setConfig({ ...config, tabName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Ação</Label>
          <Select 
            value={action} 
            onValueChange={(v) => setConfig({ ...config, action: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="insert">Inserir Linha</SelectItem>
              <SelectItem value="update">Atualizar Linha</SelectItem>
              <SelectItem value="get">Obter Linha</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Mapeamento de Colunas</Label>
          <Button variant="outline" size="sm" onClick={addMapping} className="h-7 px-2">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
        
        <div className="space-y-2">
          {mappings.map((mapping: any, index: number) => (
            <div key={index} className="flex gap-2 items-center">
              <Input 
                placeholder="Coluna (ex: A ou Nome)"
                value={mapping.column}
                onChange={(e) => updateMapping(index, "column", e.target.value)}
                className="flex-1"
              />
              <Input 
                placeholder="Valor (ex: {{nome}})"
                value={mapping.value}
                onChange={(e) => updateMapping(index, "value", e.target.value)}
                className="flex-1"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => removeMapping(index)}
                className="h-8 w-8 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {mappings.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-2 border border-dashed rounded-md">
              Nenhum mapeamento definido.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
