import { NodeConfig } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Upload, Link as LinkIcon, Loader2, RefreshCw, CheckCircle2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";


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

interface KBFile { id: string; name: string; content?: string; size?: number; truncated?: boolean; }
interface KBLink { id: string; url: string; content?: string; pagesCount?: number; }


const MAX_FILE_CHARS = 100_000; // ~100KB de texto por arquivo
const TEXT_EXT_REGEX = /\.(txt|md|markdown|csv|tsv|json|xml|yaml|yml|html|htm|log|rtf)$/i;

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      console.log(`[KB] File "${file.name}" read success, length: ${result.length}, first 50 chars: "${result.substring(0, 50)}"`);
      resolve(result);
    };
    reader.onerror = () => {
      console.error(`[KB] File "${file.name}" read error:`, reader.error);
      reject(reader.error);
    };
    reader.readAsText(file);
  });

export const KnowledgeBaseSection = ({ config, setConfig }: { config: NodeConfig; setConfig: (c: NodeConfig) => void }) => {
  const { toast } = useToast();
  const [fetchingLinks, setFetchingLinks] = useState<Record<string, boolean>>({});
  const [recentlyFetched, setRecentlyFetched] = useState<Record<string, boolean>>({});
  const [previewContent, setPreviewContent] = useState<{ title: string; content: string } | null>(null);
  const kbName: string = config.kbName || "";
  const filesEnabled: boolean = config.kbFilesEnabled ?? false;
  const linksEnabled: boolean = config.kbLinksEnabled ?? false;
  const files: KBFile[] = config.kbFiles || [];
  const links: KBLink[] = config.kbLinks || [];


  const addFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".txt,.md,.markdown,.csv,.tsv,.json,.xml,.yaml,.yml,.html,.htm,.log,.rtf,text/*";
    input.onchange = async () => {
      const picked = Array.from(input.files || []);
      const newFiles: KBFile[] = [];
      for (const f of picked) {
        const isText = TEXT_EXT_REGEX.test(f.name) || f.type.startsWith("text/") || f.type === "application/json" || f.type === "";
        let content = "";
        let truncated = false;
        
        console.log(`[KB] Processing file: ${f.name}, type: ${f.type}, size: ${f.size}`);

        if (isText || f.size < 1024 * 500) { // Se for texto OU arquivo pequeno (tentar ler como texto mesmo sem tipo)
          try {
            const raw = await readFileAsText(f);
            if (raw.trim().length === 0 && f.size > 0) {
              console.warn(`[KB] File ${f.name} read as empty string but has size ${f.size} bytes. Checking for encoding issues?`);
            }
            truncated = raw.length > MAX_FILE_CHARS;
            content = truncated ? raw.slice(0, MAX_FILE_CHARS) : raw;
          } catch (e) {
            console.error("[KB] failed reading file", f.name, e);
            content = `[Erro ao ler arquivo: ${f.name}]`;
          }
        } else {
          content = `[Arquivo binário "${f.name}" não suportado para leitura direta no navegador. Use TXT, MD, CSV, JSON, etc.]`;
        }
        
        newFiles.push({
          id: crypto.randomUUID(),
          name: f.name,
          size: f.size,
          content: content || "[arquivo sem conteúdo legível]",
          truncated,
        });
      }
      console.log("[KB] Updating config with new files:", newFiles);
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

  const fetchLinkContent = async (id: string, url: string) => {
    if (!url || !url.startsWith("http")) {
      toast({ title: "URL inválida", description: "Por favor, insira uma URL válida começando com http ou https.", variant: "destructive" });
      return;
    }

    setFetchingLinks(prev => ({ ...prev, [id]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('crawl', {
        body: { url }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const content = data?.content || "";
      const pagesCount = data?.pages_crawled || 1;
      
      if (!content) throw new Error("Não foi possível extrair conteúdo desta URL.");

      setConfig({
        ...config,
        kbLinks: links.map((l) => (l.id === id ? { ...l, content, pagesCount } : l))
      });
      
      setRecentlyFetched(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setRecentlyFetched(prev => ({ ...prev, [id]: false }));
      }, 3000);

      toast({ title: "Sucesso!", description: "Conteúdo da URL extraído com sucesso." });
    } catch (err: any) {
      console.error("[KB] fetch link failed", err);
      toast({ title: "Erro ao buscar conteúdo", description: err.message || "Ocorreu um erro ao tentar ler o link.", variant: "destructive" });
    } finally {
      setFetchingLinks(prev => ({ ...prev, [id]: false }));
    }
  };

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
              <div key={l.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="https://..."
                      value={l.url}
                      onChange={(e) => updateLink(l.id, e.target.value)}
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fetchingLinks[l.id]}
                    onClick={() => fetchLinkContent(l.id, l.url)}
                    className="h-8 w-8 shrink-0 hover:bg-primary/10"
                    title="Extrair conteúdo do link"
                  >
                    {fetchingLinks[l.id] ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : recentlyFetched[l.id] ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  {l.content && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPreviewContent({ title: l.url, content: l.content || "" })}
                      className="h-8 w-8 shrink-0"
                      title="Ver conteúdo extraído"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeLink(l.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {l.content && (
                  <p className="text-[10px] text-green-600 px-1 flex items-center gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" /> 
                    Conteúdo extraído {l.pagesCount && l.pagesCount > 1 ? `(${l.pagesCount} páginas, ` : "("}
                    {l.content.length} caracteres)
                  </p>
                )}
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

      <Dialog open={!!previewContent} onOpenChange={() => setPreviewContent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-sm truncate">Conteúdo extraído de: {previewContent?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-full max-h-[60vh] mt-4 p-4 rounded-md border bg-muted/50">
            <pre className="text-xs whitespace-pre-wrap font-mono">
              {previewContent?.content || "Nenhum conteúdo extraído."}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
