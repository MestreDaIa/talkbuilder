import React from "react";

const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const isHtml = (value: string) => /<[a-z][\s\S]*>/i.test(value);

/**
 * Normalize a stored bubble-text value into HTML.
 * - HTML values (Tiptap output) are passed through.
 * - Legacy plain-text values get {{var}} and [text](url) tokens converted,
 *   plus newlines turned into <br>.
 */
export const normalizeStoredValue = (value: string): string => {
  if (!value) return "";
  if (isHtml(value)) return value;

  let html = escapeHtml(value);
  html = html.replace(
    /\{\{([^}]+)\}\}/g,
    (_, name) =>
      `<span data-variable="${String(name).trim()}">{{${String(name).trim()}}}</span>`
  );
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  html = html.replace(/\n/g, "<br>");
  return html;
};

export interface RichRenderOptions {
  variables?: Record<string, any>;
  variableClassName?: string;
  linkClassName?: string;
}

const DEFAULT_VAR_CLASS = "bg-orange-400 px-1 py-0.5 text-white rounded mx-0.5";
const DEFAULT_LINK_CLASS = "text-blue-600 underline hover:text-blue-800";

/**
 * Convert a stored value into render-ready HTML, resolving variables and
 * applying chip/link styles. Safe to feed into dangerouslySetInnerHTML.
 */
export const richHtmlFor = (
  value: string,
  opts: RichRenderOptions = {}
): string => {
  let html = normalizeStoredValue(value);
  const varClass = opts.variableClassName || DEFAULT_VAR_CLASS;
  const linkClass = opts.linkClassName || DEFAULT_LINK_CLASS;

  // Resolve <span data-variable="x">…</span> tags (Tiptap variable nodes)
  html = html.replace(
    /<span[^>]*data-variable="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi,
    (_, name) => {
      const trimmed = String(name).trim();
      if (opts.variables && trimmed in opts.variables) {
        return escapeHtml(String(opts.variables[trimmed] ?? ""));
      }
      return `<span class="${varClass}">${escapeHtml(trimmed)}</span>`;
    }
  );

  // Resolve any remaining bare {{var}} tokens
  html = html.replace(/\{\{([^}]+)\}\}/g, (_, name) => {
    const trimmed = String(name).trim();
    if (opts.variables && trimmed in opts.variables) {
      return escapeHtml(String(opts.variables[trimmed] ?? ""));
    }
    return `<span class="${varClass}">${escapeHtml(trimmed)}</span>`;
  });

  // Apply link styling to existing <a> tags that don't already have a class
  html = html.replace(/<a (?![^>]*class=)/gi, `<a class="${linkClass}" `);

  return html;
};

interface RichTextProps extends RichRenderOptions {
  value: string;
  className?: string;
  as?: "div" | "span" | "p";
}

export const RichText: React.FC<RichTextProps> = ({
  value,
  className,
  as = "div",
  ...opts
}) => {
  const html = richHtmlFor(value, opts);
  const Tag: any = as;
  return (
    <Tag
      className={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

/** Strip HTML to plain text (useful for storing variable values, etc.) */
export const richToPlainText = (value: string): string => {
  if (!value) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
};
