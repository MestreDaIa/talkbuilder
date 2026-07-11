// =============================================================================
// CURL parser — usado pelo HTTP Request (Modo Dinâmico) para importar endpoints.
// Suporta os formatos mais comuns copiados de Postman / docs / navegador.
// Não depende de nenhuma lib externa.
// =============================================================================

export interface ParsedCurl {
  method: string;
  url: string;
  headers: { name: string; value: string }[];
  queryParams: { name: string; value: string }[];
  pathParams: string[];              // ex: ["id"] em /users/{id}
  body: string | null;
  bodyContentType: "json" | "form-urlencoded" | "raw" | null;
  auth: {
    type: "none" | "bearer" | "basic" | "apiKey";
    token?: string;
    username?: string;
    password?: string;
    headerName?: string;
  };
}

// tokenizer que respeita aspas simples/duplas e escapes
function tokenize(cmd: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  let i = 0;
  while (i < cmd.length) {
    const c = cmd[i];
    if (quote) {
      if (c === "\\" && cmd[i + 1] === quote) { cur += quote; i += 2; continue; }
      if (c === quote) { quote = null; i++; continue; }
      cur += c; i++; continue;
    }
    if (c === '"' || c === "'") { quote = c; i++; continue; }
    if (c === "\\" && (cmd[i + 1] === "\n" || cmd[i + 1] === "\r")) {
      // continuação de linha
      i += 2; while (cmd[i] === "\n" || cmd[i] === "\r") i++; continue;
    }
    if (/\s/.test(c)) {
      if (cur) { out.push(cur); cur = ""; }
      i++; continue;
    }
    cur += c; i++;
  }
  if (cur) out.push(cur);
  return out;
}

const looksLikeUrl = (s: string) => /^https?:\/\//i.test(s);

export function parseCurl(input: string): ParsedCurl {
  const cleaned = input.trim().replace(/^curl\s+/i, "");
  const tokens = tokenize(cleaned);

  const result: ParsedCurl = {
    method: "GET",
    url: "",
    headers: [],
    queryParams: [],
    pathParams: [],
    body: null,
    bodyContentType: null,
    auth: { type: "none" },
  };

  let bodyPieces: string[] = [];
  let bodyKind: "json" | "form" | "raw" | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = () => tokens[++i];

    if (t === "-X" || t === "--request") { result.method = (next() || "GET").toUpperCase(); continue; }
    if (t === "-H" || t === "--header") {
      const raw = next() || ""; const idx = raw.indexOf(":");
      if (idx > 0) {
        const name = raw.slice(0, idx).trim();
        const value = raw.slice(idx + 1).trim();
        result.headers.push({ name, value });
      }
      continue;
    }
    if (t === "-u" || t === "--user") {
      const raw = next() || ""; const [u, p = ""] = raw.split(":");
      result.auth = { type: "basic", username: u, password: p };
      continue;
    }
    if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary") {
      bodyPieces.push(next() || ""); bodyKind = bodyKind ?? "raw"; continue;
    }
    if (t === "--data-urlencode") {
      bodyPieces.push(next() || ""); bodyKind = "form"; continue;
    }
    if (t === "-F" || t === "--form") {
      bodyPieces.push(next() || ""); bodyKind = "form"; continue;
    }
    if (t === "--json") {
      bodyPieces.push(next() || ""); bodyKind = "json"; continue;
    }
    if (t === "-G" || t === "--get") { result.method = "GET"; continue; }
    if (t === "-k" || t === "--insecure" || t === "-L" || t === "--location" ||
        t === "-s" || t === "--silent" || t === "-v" || t === "--verbose") continue;

    if (looksLikeUrl(t) && !result.url) { result.url = t; continue; }
    if (!result.url && !t.startsWith("-")) { result.url = t; continue; }
  }

  // ------ Auth via header Authorization ------
  const authHeader = result.headers.find(h => /^authorization$/i.test(h.name));
  if (authHeader) {
    const v = authHeader.value.trim();
    if (/^bearer\s+/i.test(v)) {
      result.auth = { type: "bearer", token: v.replace(/^bearer\s+/i, "") };
    } else if (/^basic\s+/i.test(v)) {
      try {
        const decoded = atob(v.replace(/^basic\s+/i, ""));
        const [u, p = ""] = decoded.split(":");
        result.auth = { type: "basic", username: u, password: p };
      } catch { /* keep as header */ }
    }
  }
  const apiKeyHeader = result.headers.find(h => /^(x-api-key|api-key|apikey)$/i.test(h.name));
  if (apiKeyHeader && result.auth.type === "none") {
    result.auth = { type: "apiKey", headerName: apiKeyHeader.name, token: apiKeyHeader.value };
  }

  // ------ URL: separa query e detecta path params {x} ou :x ------
  if (result.url) {
    try {
      const u = new URL(result.url);
      u.searchParams.forEach((val, key) => result.queryParams.push({ name: key, value: val }));
      u.search = "";
      result.url = u.toString();
    } catch { /* url relativa */ }
    const paramMatches = [
      ...result.url.matchAll(/\{([a-zA-Z0-9_]+)\}/g),
      ...result.url.matchAll(/:([a-zA-Z0-9_]+)(?=\/|$)/g),
    ];
    result.pathParams = [...new Set(paramMatches.map(m => m[1]))];
  }

  // ------ Body ------
  if (bodyPieces.length) {
    if (bodyKind === "json" || bodyPieces.every(p => p.trim().startsWith("{") || p.trim().startsWith("["))) {
      result.bodyContentType = "json";
      result.body = bodyPieces.join("");
    } else if (bodyKind === "form") {
      result.bodyContentType = "form-urlencoded";
      result.body = bodyPieces.join("&");
    } else {
      result.bodyContentType = "raw";
      result.body = bodyPieces.join("");
    }
    if (result.method === "GET") result.method = "POST";
  }

  const ctHeader = result.headers.find(h => /^content-type$/i.test(h.name));
  if (ctHeader && result.body) {
    const ct = ctHeader.value.toLowerCase();
    if (ct.includes("json")) result.bodyContentType = "json";
    else if (ct.includes("urlencoded")) result.bodyContentType = "form-urlencoded";
  }

  return result;
}

// Extrai lista de endpoints a partir de um documento OpenAPI/Swagger (v2 ou v3).
export interface DiscoveredEndpoint {
  id: string;           // "GET /services"
  method: string;
  path: string;
  summary?: string;
  description?: string;
}

export function discoverEndpointsFromOpenApi(doc: any): DiscoveredEndpoint[] {
  if (!doc?.paths) return [];
  const out: DiscoveredEndpoint[] = [];
  const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
  for (const [path, pathItem] of Object.entries<any>(doc.paths)) {
    for (const m of methods) {
      const op = pathItem?.[m];
      if (!op) continue;
      out.push({
        id: `${m.toUpperCase()} ${path}`,
        method: m.toUpperCase(),
        path,
        summary: op.summary,
        description: op.description,
      });
    }
  }
  return out;
}
