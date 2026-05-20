export const AI_PROVIDERS = [
  { id: "lovable", name: "Lovable AI", needsApiKey: false },
  { id: "openai", name: "OpenAI", needsApiKey: true },
  { id: "groq", name: "Groq", needsApiKey: true },
  { id: "gemini", name: "Google Gemini", needsApiKey: true },
  { id: "anthropic", name: "Anthropic Claude", needsApiKey: true },
  { id: "openrouter", name: "OpenRouter", needsApiKey: true },
  { id: "deepseek", name: "DeepSeek", needsApiKey: true },
  { id: "ollama", name: "Ollama", needsApiKey: false },
  { id: "mistral", name: "Mistral", needsApiKey: true },
];

export const MODELS_BY_PROVIDER: Record<string, string[]> = {
  lovable: ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "openai/gpt-5-mini"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  groq: ["llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768", "gemma-7b-it"],
  gemini: ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "google/gemini-2.5-pro"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
  openrouter: ["auto"],
  deepseek: ["deepseek-chat", "deepseek-coder"],
  ollama: ["llama3", "mistral", "phi3", "nomic-embed-text"],
  mistral: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
};

export const API_KEY_PLACEHOLDERS_BY_PROVIDER: Record<string, string> = {
  lovable: "Gerenciado automaticamente",
  openai: "sk-...",
  anthropic: "sk-ant-...",
  gemini: "AIza...",
  google: "AIza...",
  groq: "gsk_...",
  openrouter: "sk-or-...",
  deepseek: "sk-...",
  mistral: "...",
};
