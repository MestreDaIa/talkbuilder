import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const API = "https://api.cloudflare.com/client/v4";

function normalizeHostname(value: string): string {
  const host = value.trim().toLowerCase().replace(/\.$/, "");
  if (!/^flow-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.zailom\.com$/.test(host)) {
    throw new Error("Hostname Flow inválido. Esperado: flow-<identificador>.zailom.com");
  }
  return host;
}

/**
 * Creates or reconciles the dedicated Flow DNS record.
 * Each tenant receives an individual CNAME; Booking's wildcard record is untouched.
 */
async function ensureFlowDnsRecord(input: string): Promise<{ hostname: string; record_id: string }> {
  const hostname = normalizeHostname(input);
  const token = Deno.env.get("FLOW_CLOUDFLARE_API_TOKEN") || "";
  const zoneId = Deno.env.get("FLOW_CLOUDFLARE_ZONE_ID") || "";
  const target = (Deno.env.get("FLOW_CLOUDFLARE_TARGET") || "flow-builder.zailom.com").trim().toLowerCase();

  if (!token || !zoneId) {
    throw new Error("Cloudflare do Flow não configurado: defina FLOW_CLOUDFLARE_API_TOKEN e FLOW_CLOUDFLARE_ZONE_ID nos secrets do projeto Supabase.");
  }
  if (!/^[a-z0-9.-]+$/.test(target) || target === hostname) {
    throw new Error("FLOW_CLOUDFLARE_TARGET inválido.");
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const query = new URLSearchParams({ name: hostname });
  const listResponse = await fetch(`${API}/zones/${encodeURIComponent(zoneId)}/dns_records?${query}`, { headers });
  const list = await listResponse.json().catch(() => null);
  if (!listResponse.ok || !list?.success) {
    throw new Error(`Cloudflare: não foi possível consultar o DNS (${list?.errors?.[0]?.message || listResponse.status}).`);
  }

  const records = Array.isArray(list.result) ? list.result : [];
  const existing = records.find((record: { type?: string }) => record.type === "CNAME") || null;
  if (records.some((record: { type?: string }) => record.type !== "CNAME")) {
    throw new Error(`Cloudflare: já existe um registro DNS que não é CNAME para ${hostname}; remova ou ajuste esse registro antes do provisionamento.`);
  }
  const payload = { type: "CNAME", name: hostname, content: target, ttl: 1, proxied: true };
  const url = existing
    ? `${API}/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(existing.id)}`
    : `${API}/zones/${encodeURIComponent(zoneId)}/dns_records`;
  const response = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success || !result?.result?.id) {
    throw new Error(`Cloudflare: falha ao ${existing ? "atualizar" : "criar"} o DNS de ${hostname} (${result?.errors?.[0]?.message || response.status}).`);
  }
  return { hostname, record_id: result.result.id };
}


const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST") return reply({success:false,error:"Método não permitido."},405);
  const url=Deno.env.get("SUPABASE_URL")||"", key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key) return reply({success:false,error:"Configuração do servidor ausente."},500);
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await req.json().catch(()=>({}));
  const hostHeader=(req.headers.get("x-forwarded-host")||req.headers.get("host")||"").split(",")[0].trim().toLowerCase().split(":")[0];
  const rawIdentifier=String(body.identifier||hostHeader||"").trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/$/,"");
  const identifier=/^flow-[a-z0-9-]+$/.test(rawIdentifier) ? `${rawIdentifier}.zailom.com` : rawIdentifier;
  if(!identifier) return reply({success:false,error:"Informe o identificador da empresa."},400);

  let {data,error}=await admin.rpc("resolve_flow_workspace",{p_identifier:identifier});
  if(error) return reply({success:false,error:"Falha ao localizar a empresa.",details:error.message},500);
  let row=Array.isArray(data)?data[0]:data;
  const hostnameMatch=identifier.match(/^(flow-[a-z0-9-]+)\.zailom\.com$/);
  const legacySlug=hostnameMatch ? hostnameMatch[1].slice(5) : null;

  // Compatibilidade: workspaces provisionados antes do hostname dedicado podem
  // ainda estar registrados apenas pelo slug antigo.
  if(!row?.workspace_id && legacySlug){
    const fallback=await admin.rpc("resolve_flow_workspace",{p_identifier:legacySlug});
    if(fallback.error) return reply({success:false,error:"Falha ao localizar o workspace legado.",details:fallback.error.message},500);
    row=Array.isArray(fallback.data)?fallback.data[0]:fallback.data;
  }
  if(!row?.workspace_id) return reply({success:false,error:"Empresa/ambiente não encontrado. Confira o endereço informado."},404);

  // Migra o domínio legado para o hostname Flow e cria o DNS individual uma
  // única vez, sem tocar no wildcard utilizado pelo Booking.
  if(hostnameMatch && String(row.hostname||"").toLowerCase()!==identifier){
    try { await ensureFlowDnsRecord(identifier); }
    catch(error) { return reply({success:false,error:"Não foi possível configurar o domínio dedicado do Flow.",details:error instanceof Error?error.message:String(error)},502); }

    const source=String(row.workspace_source||"standalone").toLowerCase();
    const domainRecord: Record<string, unknown>={workspace_id:row.workspace_id,source:source==="booking"?"booking":"standalone",external_company_id:null,hostname:identifier,domain_type:"subdomain",is_primary:true,is_verified:true,updated_at:new Date().toISOString()};
    if(source==="booking"){
      const {data:link,error:linkError}=await admin.from("booking_workspace_links").select("external_company_id").eq("workspace_id",row.workspace_id).eq("source","booking").maybeSingle();
      if(linkError||!link?.external_company_id) return reply({success:false,error:"Não foi possível localizar o vínculo Booking/Flow para atualizar o domínio.",details:linkError?.message},500);
      domainRecord.external_company_id=link.external_company_id;
      const {error:writeError}=await admin.from("flow_workspace_domains").upsert(domainRecord,{onConflict:"source,external_company_id"});
      if(writeError) return reply({success:false,error:"Não foi possível atualizar o domínio do workspace.",details:writeError.message},500);
    }else{
      const {error:writeError}=await admin.from("flow_workspace_domains").upsert(domainRecord,{onConflict:"hostname"});
      if(writeError) return reply({success:false,error:"Não foi possível atualizar o domínio do workspace.",details:writeError.message},500);
    }
    row.hostname=identifier;
  }

  return reply({success:true,workspace_id:row.workspace_id,workspace_slug:row.workspace_slug,workspace_name:row.workspace_name,hostname:row.hostname,workspace_source:row.workspace_source});
});
