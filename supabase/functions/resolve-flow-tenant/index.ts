import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { ensureFlowDnsRecord } from "../_shared/cloudflare-flow.ts";
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
