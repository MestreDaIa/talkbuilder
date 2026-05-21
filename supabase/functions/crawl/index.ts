import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Blacklist de rotas que devem ser evitadas por segurança ou irrelevância
const BLACKLIST = [
  /login/i, /signup/i, /register/i, /cadastrar/i, /cadastro/i, /entrar/i,
  /auth/i, /api/i, /v1\//i, /admin/i, /dashboard/i, /account/i, /perfil/i,
  /cart/i, /carrinho/i, /checkout/i, /pagamento/i, /payment/i,
  /reset-password/i, /forgot-password/i, /logout/i, /sair/i
];

// Palavras-chave para priorização por contexto
const IMPORTANT_KEYWORDS = /pricing|plans|precos|planos|sobre|about|features|recursos|servicos|services/i;

/**
 * Limpa o HTML para extrair apenas o texto relevante
 */
function cleanHtml(html: string) {
  if (html.trim().startsWith(':root') || html.trim().startsWith('body {') || html.trim().startsWith('import ')) {
    return "";
  }

  return html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
    .replace(/<head\b[^>]*>([\s\S]*?)<\/head>/gim, "")
    .replace(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gim, "")
    .replace(/<footer\b[^>]*>([\s\S]*?)<\/footer>/gim, "")
    .replace(/<header\b[^>]*>([\s\S]*?)<\/header>/gim, "")
    .replace(/<svg\b[^>]*>([\s\S]*?)<\/svg>/gim, "")
    .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(h[1-6]|p|div|section|article|li|tr|header|footer|nav)\b[^>]*>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<td\b[^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Verifica se uma URL está na blacklist
 */
function isBlacklisted(url: string) {
  return BLACKLIST.some(pattern => pattern.test(url));
}

/**
 * Tenta buscar e extrair links de um sitemap
 */
async function getLinksFromSitemap(baseUrl: string) {
  const sitemapUrls = [
    new URL("/sitemap.xml", baseUrl).href,
    new URL("/sitemap_index.xml", baseUrl).href,
  ];
  
  const foundLinks: string[] = [];
  
  for (const sitemapUrl of sitemapUrls) {
    try {
      const resp = await fetch(sitemapUrl);
      if (resp.ok) {
        const text = await resp.text();
        // Regex simples para extrair <loc>...</loc>
        const locMatches = text.match(/<loc>(.*?)<\/loc>/gi);
        if (locMatches) {
          locMatches.forEach(match => {
            const link = match.replace(/<\/?loc>/gi, "").trim();
            if (link.startsWith("http") && !isBlacklisted(link)) {
              foundLinks.push(link);
            }
          });
        }
      }
    } catch { /* ignore */ }
  }
  return foundLinks;
}

/**
 * Tenta buscar regras do robots.txt
 */
async function getRobotsRules(baseUrl: string) {
  try {
    const resp = await fetch(new URL("/robots.txt", baseUrl).href);
    if (resp.ok) {
      const text = await resp.text();
      const lines = text.split("\n");
      const disallowed: string[] = [];
      let appliesToMe = false;

      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.startsWith("user-agent:")) {
          appliesToMe = lowerLine.includes("*") || lowerLine.includes("googlebot");
        } else if (appliesToMe && lowerLine.startsWith("disallow:")) {
          const path = line.split(":")[1]?.trim();
          if (path && path !== "/") disallowed.push(path);
        }
      }
      return disallowed;
    }
  } catch { /* ignore */ }
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url, depth = 1 } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Crawling URL: ${url} with depth: ${depth}`);
    
    const baseUrl = new URL(url);
    const visited = new Set<string>();
    const results: { url: string; content: string }[] = [];
    const queue: { url: string; currentDepth: number }[] = [{ url, currentDepth: 0 }];

    // 1. Robots.txt
    const disallowedPaths = await getRobotsRules(url);
    
    // 2. Sitemap.xml
    const sitemapLinks = await getLinksFromSitemap(url);
    for (const link of sitemapLinks) {
      if (queue.length < 30) {
        queue.push({ url: link, currentDepth: 1 });
      }
    }

    // 3. Rotas comuns (Backup se sitemap falhar)
    const commonRoutes = ["/precos", "/planos", "/pricing", "/plans", "/sobre", "/about", "/recursos", "/features"];
    for (const route of commonRoutes) {
      try {
        const routeUrl = new URL(route, url).href;
        if (!isBlacklisted(routeUrl) && !queue.some(q => q.url === routeUrl)) {
          queue.push({ url: routeUrl, currentDepth: 0 });
        }
      } catch { /* ignore */ }
    }

    while (queue.length > 0 && results.length < 12) {
      const { url: currentUrl, currentDepth } = queue.shift()!;
      
      const normalizedUrl = currentUrl.split('#')[0].replace(/\/$/, "");
      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      // Checar robots.txt paths
      const currentPath = new URL(currentUrl).pathname;
      if (disallowedPaths.some(p => currentPath.startsWith(p))) {
        console.log(`Skipping disallowed by robots.txt: ${currentUrl}`);
        continue;
      }

      if (isBlacklisted(currentUrl)) {
        console.log(`Skipping blacklisted: ${currentUrl}`);
        continue;
      }

      try {
        console.log(`Fetching: ${currentUrl}`);
        const response = await fetch(currentUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
          }
        });

        if (!response.ok) continue;

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html") && !contentType.includes("text/plain")) continue;

        const html = await response.text();
        let cleaned = cleanHtml(html);
        
        if (cleaned.length < 150 && (html.includes('id="root"') || html.includes('id="app"'))) {
          cleaned = `[AVISO: Esta página parece ser um aplicativo (SPA) que requer JavaScript para carregar o conteúdo. O rastreador simples não conseguiu ler os textos dinâmicos. Sugestão: Use o Firecrawl ou habilite SSR no site de destino.]\n\nMetadados encontrados:\n` + 
                    (html.match(/<title>(.*?)<\/title>/i)?.[1] ? `Título: ${html.match(/<title>(.*?)<\/title>/i)?.[1]}\n` : "") +
                    (html.match(/<meta name="description" content="(.*?)"/i)?.[1] ? `Descrição: ${html.match(/<meta name="description" content="(.*?)"/i)?.[1]}` : "");
        }

        if (cleaned.length > 30) { 
          results.push({ url: currentUrl, content: cleaned });
        }

        // Descobrir links internos
        if (currentDepth < depth) {
          const linkRegex = /href=["']([^"']+)["']/gi;
          let match;
          while ((match = linkRegex.exec(html)) !== null && queue.length < 50) {
            try {
              const link = match[1];
              const absoluteUrl = new URL(link, currentUrl).href;
              const parsedLink = new URL(absoluteUrl);
              const cleanAbsolute = absoluteUrl.split('#')[0].replace(/\/$/, "");

              const isBinary = /\.(jpg|jpeg|png|gif|pdf|zip|mp4|mp3|css|js|svg|woff|woff2)$/i.test(cleanAbsolute);
              
              if (
                parsedLink.hostname === baseUrl.hostname && 
                !isBinary &&
                !visited.has(cleanAbsolute) &&
                !isBlacklisted(cleanAbsolute) &&
                !queue.some(q => q.url.split('#')[0].replace(/\/$/, "") === cleanAbsolute)
              ) {
                // 4. Priorização por Contexto
                if (IMPORTANT_KEYWORDS.test(absoluteUrl)) {
                  queue.unshift({ url: absoluteUrl, currentDepth: currentDepth + 1 });
                } else {
                  queue.push({ url: absoluteUrl, currentDepth: currentDepth + 1 });
                }
              }
            } catch { /* ignore */ }
          }
        }
      } catch (e) {
        console.error(`Error fetching ${currentUrl}:`, e);
      }
    }

    const sortedResults = results.sort((a, b) => {
      const aImp = IMPORTANT_KEYWORDS.test(a.url);
      const bImp = IMPORTANT_KEYWORDS.test(b.url);
      if (aImp && !bImp) return -1;
      if (!aImp && bImp) return 1;
      return 0;
    });

    const combinedContent = sortedResults
      .map(r => `[FONTE: ${r.url}]\n${r.content}`)
      .join("\n\n---\n\n")
      .slice(0, 100000);

    return new Response(JSON.stringify({ 
      content: combinedContent,
      pages_crawled: results.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});