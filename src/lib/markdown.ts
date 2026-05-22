export const normalizeMarkdown = (value: string): string => {
  return String(value ?? "")
    .replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, "$1")
    .replace(/\r\n/g, "\n");
};