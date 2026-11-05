import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({success:false,error:"Método não permitido."},405);
 const url=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const resend=Deno.env.get("RESEND_API_KEY")||"",from=Deno.env.get("FLOW_EMAIL_FROM")||"";
 if(!url||!key||!resend||!from)return reply({success:false,error:"Serviço de e-mail do Flow não configurado."},503);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const body=await req.json().catch(()=>({}));
 const identifier=String(body.identifier||"").trim().toLowerCase(),email=String(body.email||"").trim().toLowerCase();
 if(!identifier||!email)return reply({success:false,error:"Empresa e e-mail são obrigatórios."},400);
 const {data:resolved,error:resolveError}=await admin.rpc("resolve_flow_workspace",{p_identifier:identifier});
 const tenant=Array.isArray(resolved)?resolved[0]:resolved;
 if(resolveError||!tenant?.workspace_id)return reply({success:true,message:"Se o cadastro existir, enviaremos as instruções por e-mail."});
 const {data:reset,error}=await admin.rpc("create_flow_workspace_password_reset",{p_workspace_id:tenant.workspace_id,p_email:email});
 if(error)return reply({success:false,error:"Não foi possível iniciar a recuperação."},500);
 if(reset?.token){
   const base=tenant.hostname && String(tenant.hostname).includes(".") ? ("https://"+tenant.hostname) : "https://flow-builder.zailom.com";
   const resetUrl=base+"/reset-password?token="+encodeURIComponent(reset.token)+"&tenant="+encodeURIComponent(tenant.hostname||tenant.workspace_slug);
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+resend},body:JSON.stringify({
     from,to:[email],subject:"Zailom Flow — redefinição de senha",
     html:"<h2>Redefinir senha do Zailom Flow</h2><p>Recebemos uma solicitação para redefinir a senha do workspace <strong>"+String(tenant.workspace_name||"sua empresa").replace(/[<>]/g,"")+"</strong>.</p><p><a href=\""+resetUrl+"\">Criar nova senha</a></p><p>O link expira em 30 minutos. Se você não solicitou, ignore este e-mail.</p>"
   })});
   if(!response.ok){console.error("[request-workspace-password-reset]",await response.text());return reply({success:false,error:"Não foi possível enviar o e-mail de recuperação."},502);}
 }
 return reply({success:true,message:"Se o cadastro existir, enviaremos as instruções por e-mail."});
});
