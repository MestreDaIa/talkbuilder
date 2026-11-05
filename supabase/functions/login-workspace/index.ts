import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST") return reply({success:false,error:"Método não permitido."},405);
  const url=Deno.env.get("SUPABASE_URL")||"", key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key) return reply({success:false,error:"Configuração do servidor ausente."},500);
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await req.json().catch(()=>({}));
  const identifier=String(body.identifier||"").trim().toLowerCase();
  const email=String(body.email||"").trim().toLowerCase();
  const password=String(body.password||"");
  if(!identifier||!email||!password) return reply({success:false,error:"Empresa, e-mail e senha são obrigatórios."},400);
  const {data:resolved,error:resolveError}=await admin.rpc("resolve_flow_workspace",{p_identifier:identifier});
  const tenant=Array.isArray(resolved)?resolved[0]:resolved;
  if(resolveError||!tenant?.workspace_id) return reply({success:false,error:"Empresa não encontrada."},404);
  const {data:valid,error:validError}=await admin.rpc("validate_flow_workspace_credential",{
    p_workspace_id:tenant.workspace_id,p_email:email,p_password:password
  });
  if(validError||!valid?.success) return reply({success:false,error:valid?.error||"E-mail ou senha incorretos."},401);
  const origin=String(body.origin||"").trim();
  let redirectOrigin="https://flow-builder.zailom.com";
  if(origin){
    try{
      const parsed=new URL(origin);
      const allowed=parsed.protocol==="https:"&&parsed.hostname.toLowerCase()===String(tenant.hostname||"").toLowerCase()&&parsed.hostname.toLowerCase().endsWith(".zailom.com");
      if(allowed) redirectOrigin=parsed.origin;
    }catch{/* use canonical Flow origin */}
  }
  const redirectTo=redirectOrigin+"/"+tenant.workspace_slug+"/workspace";
  const {data:link,error:linkError}=await admin.auth.admin.generateLink({
    type:"magiclink",email,options:{redirectTo}
  });
  if(linkError||!link?.properties?.action_link) return reply({success:false,error:"Não foi possível iniciar a sessão segura.",details:linkError?.message},500);
  return reply({success:true,action_link:link.properties.action_link,workspace_id:tenant.workspace_id,workspace_slug:tenant.workspace_slug});
});
