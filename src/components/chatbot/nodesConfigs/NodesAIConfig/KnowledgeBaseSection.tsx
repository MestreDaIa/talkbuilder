import { NodeConfig } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Upload, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ToggleRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export const ToggleRow = ({ id, title, description, checked, onChange }: ToggleRowProps) => (
  <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-muted/30">
    <div className="space-y-0.5">
      <Label htmlFor={id} className="text-sm">{title}</Label>
      <p className="text-[11px] text-muted-foreground">{description}</p>
    </div>
    <Switch id={id} checked={checked} onCheckedChange={onChange} />
  </div>
);

interface KBFile { id: string; name: string; }
interface KBLink { id: string; url: string; }

export const KnowledgeBaseSection = ({ config, setConfig }: { config: NodeConfig; setConfig: (c: NodeConfig) => void }) => {
  const kbName: string = config.kbName || "";
  const filesEnabled: boolean = config.kbFilesEnabled ?? false;
  const linksEnabled: boolean = config.kbLinksEnabled ?? false;
  const files: KBFile[] = config.kbFiles || [];
  const links: KBLink[] = config.kbLinks || [];

  const addFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => {
      const newFiles: KBFile[] = Array.from(input.files || []).map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
      }));
      setConfig({ ...config, kbFiles: [...files, ...newFiles] });
    };
    input.click();
  };

  const removeFile = (id: string) =>
    setConfig({ ...config, kbFiles: files.filter((f) => f.id !== id) });

  const addLink = () =>
    setConfig({ ...config, kbLinks: [...links, { id: crypto.randomUUID(), url: "" }] });

  const updateLink = (id: string, url: string) =>
    setConfig({ ...config, kbLinks: links.map((l) => (l.id === id ? { ...l, url } : l)) });

  const removeLink = (id: string) =>
    setConfig({ ...config, kbLinks: links.filter((l) => l.id !== id) });

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
      <Label className="text-sm font-semibold">Knowledge Base (Base de Conhecimento)</Label>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Nome da base</Label>
        <Input
          placeholder="Ex: Documentação do produto"
          value={kbName}
          onChange={(e) => setConfig({ ...config, kbName: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <ToggleRow
          id="kb-files-toggle"
          title="Upload de arquivos"
          description="Envie PDFs, TXT, DOCX, etc."
          checked={filesEnabled}
          onChange={(v) => setConfig({ ...config, kbFilesEnabled: v })}
        />
        {filesEnabled && (
          <div className="space-y-2 pl-1">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-2 border rounded-md px-2 py-1.5 bg-background">
                <Upload className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs truncate flex-1">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addFile}
              className="w-full h-8 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar arquivo
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <ToggleRow
          id="kb-links-toggle"
          title="Links externos"
          description="Use URLs como fonte de conhecimento"
          checked={linksEnabled}
          onChange={(v) => setConfig({ ...config, kbLinksEnabled: v })}
        />
        {linksEnabled && (
          <div className="space-y-2 pl-1">
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="https://..."
                    value={l.url}
                    onChange={(e) => updateLink(l.id, e.target.value)}
                    className="h-8 pl-7 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLink(l.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLink}
              className="w-full h-8 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar link
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
