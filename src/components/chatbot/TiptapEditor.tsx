import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Link as LinkIcon, Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VariableExtension } from './tiptap/VariableExtension';
import { VariableModal } from './VariableModal';
import { LinkModal } from './LinkModal';

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Convert stored value to HTML for editor.
// New values are stored as HTML (Tiptap output). Legacy values may be plain
// text with {{var}} and [text](url) tokens — convert those for backward compat.
const parseValueToHTML = (value: string): string => {
  if (!value) return '';

  if (/<[a-z][\s\S]*>/i.test(value)) {
    return value;
  }

  // Legacy/plain-text path. Aceita variáveis simples e caminhos profundos,
  // ex: {{messageType}} e {{data.body.data.messageType}}.
  let html = value.replace(
    /\{\{\s*([^}]+?)\s*\}\}/g,
    (_, name) => {
      const variableName = String(name).trim();
      return `<span data-variable="${variableName}" class="variable-tag" style="background-color: hsl(var(--primary) / 0.2); color: hsl(var(--primary)); padding: 2px 6px; border-radius: 4px; font-size: 0.875em;">{{${variableName}}}</span>`;
    }
  );

  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  return html;
};

export const TiptapEditor = ({ value, onChange }: TiptapEditorProps) => {
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      VariableExtension,
    ],
    content: parseValueToHTML(value),
    editorProps: {
      attributes: {
        class: 'min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 prose prose-sm max-w-none',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Treat empty Tiptap document as empty string
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(parseValueToHTML(value));
    }
  }, [value, editor]);

  const handleInsertVariable = (varName: string) => {
    editor?.commands.insertVariable(varName);
  };

  const handleInsertLink = (text: string, url: string) => {
    editor?.chain().focus().insertContent(`<a href="${url}" target="_blank">${text}</a>`).run();
  };

  if (!editor) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 p-1 border border-input rounded-md bg-muted/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-accent' : ''}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-accent' : ''}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'bg-accent' : ''}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'bg-accent' : ''}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setVariableModalOpen(true)}
          title="Inserir variável"
        >
          <Braces className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setLinkModalOpen(true)}
          title="Inserir link"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </div>

      <EditorContent editor={editor} />

      <p className="text-xs text-muted-foreground">
        Use o botão {"{}"} para inserir variáveis e o botão de link para adicionar links.
      </p>

      <VariableModal
        open={variableModalOpen}
        onClose={() => setVariableModalOpen(false)}
        onSelect={handleInsertVariable}
      />

      <LinkModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onSubmit={handleInsertLink}
      />
    </div>
  );
};
