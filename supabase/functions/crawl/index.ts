import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Limpa o HTML para extrair apenas o texto relevante, preservando quebras de linha
 * e tentando manter alguma estrutura semântica (títulos, listas).
 */
function cleanHtml(html: string) {
  // Se detectarmos que é um arquivo CSS ou JS puro (caso o Content-Type falhe)
  if (html.trim().startsWith(':root') || html.trim().startsWith('body {') || html.trim().startsWith('import ')) {
    return "";
  }

  return html
    // Remover scripts, styles, head, nav, footer, header e comentários
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
    .replace(/<head\b[^>]*>([\s\S]*?)<\/head>/gim, "")
    .replace(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gim, "")
    .replace(/<footer\b[^>]*>([\s\S]*?)<\/footer>/gim, "")
    .replace(/<header\b[^>]*>([\s\S]*?)<\/header>/gim, "")
    .replace(/<svg\b[^>]*>([\s\S]*?)<\/svg>/gim, "") // Remover SVGs (lixo de imagem)
    .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // Converter tags de bloco em quebras de linha para manter legibilidade
    .replace(/<(h[1-6]|p|div|section|article|li|tr|header|footer|nav)\b[^>]*>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<td\b[^>]*>/gi, " | ") // Separador de colunas para tabelas
    // Remover todas as outras tags
    .replace(/<[^>]+>/g, " ")
    // Limpar entidades HTML básicas
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Colapsar espaços e múltiplas quebras de linha
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // No máximo duas quebras de linha
    .trim();
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
    const queue = [{ url, currentDepth: 0 }];

    // 0. Pré-popular a fila com rotas comuns conhecidas para garantir que não as perderemos
    const commonRoutes = ["/precos", "/planos", "/pricing", "/plans", "/sobre", "/about", "/recursos", "/features"];
    for (const route of commonRoutes) {
      try {
        const routeUrl = new URL(route, url).href;
        const cleanRoute = routeUrl.split('#')[0].replace(/\/$/, "");
        if (cleanRoute !== url.replace(/\/$/, "")) {
          queue.push({ url: routeUrl, currentDepth: 0 });
        }
      } catch { /* ignore */ }
    }

    // Aumentado para 10 páginas para garantir que pegamos sub-páginas de planos
    while (queue.length > 0 && results.length < 10) {
      const { url: currentUrl, currentDepth } = queue.shift()!;
      
      const normalizedUrl = currentUrl.split('#')[0].replace(/\/$/, "");
      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      try {
        console.log(`Fetching: ${currentUrl}`);
        const response = await fetch(currentUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
          }
        });

        if (!response.ok) {
          console.warn(`Failed to fetch ${currentUrl}: ${response.statusText}`);
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
          console.log(`Skipping non-HTML content: ${contentType}`);
          continue;
        }

        const html = await response.text();
        let cleaned = cleanHtml(html);
        
        // Detecção de SPA (Single Page Application) vazia
        if (cleaned.length < 150 && html.includes('id="root"') || html.includes('id="app"')) {
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
          while ((match = linkRegex.exec(html)) !== null && queue.length < 20) {
            try {
              const link = match[1];
              const absoluteUrl = new URL(link, currentUrl).href;
              const parsedLink = new URL(absoluteUrl);
              
              const cleanAbsolute = absoluteUrl.split('#')[0].replace(/\/$/, "");

              // Apenas mesmo domínio, ignorar extensões de arquivos comuns
              const isBinary = /\.(jpg|jpeg|png|gif|pdf|zip|mp4|mp3|css|js|svg|woff|woff2)$/i.test(cleanAbsolute);
              
              if (
                parsedLink.hostname === baseUrl.hostname && 
                !isBinary &&
                !visited.has(cleanAbsolute) &&
                !queue.some(q => q.url.split('#')[0].replace(/\/$/, "") === cleanAbsolute)
              ) {
                // Priorizar páginas de planos, preços, sobre, etc.
                const isImportant = /pricing|plans|precos|planos|sobre|about|features|recursos/i.test(absoluteUrl);
                if (isImportant) {
                  queue.unshift({ url: absoluteUrl, currentDepth: currentDepth + 1 });
                } else {
                  queue.push({ url: absoluteUrl, currentDepth: currentDepth + 1 });
                }
              }
            } catch { /* ignore invalid URLs */ }
          }
        }
      } catch (e) {
        console.error(`Error fetching ${currentUrl}:`, e);
      }
    }

    // Combinar conteúdo com limite de 100k caracteres
    // Ordenar resultados para que a página inicial ou páginas de planos fiquem no topo
    const sortedResults = results.sort((a, b) => {
      const aImp = /pricing|plans|precos|planos/i.test(a.url);
      const bImp = /pricing|plans|precos|planos/i.test(b.url);
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
