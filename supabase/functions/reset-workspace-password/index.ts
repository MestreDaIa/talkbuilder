import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({success:false,error:"Método não permitido."},405);
 const url=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!key)return reply({success:false,error:"Configuração do servidor ausente."},500);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const body=await req.json().catch(()=>({}));
 const token=String(body.token||"").trim(),password=String(body.password||"");
 if(!token||password.length<8||new TextEncoder().encode(password).length>72)return reply({success:false,error:"Link ou senha inválidos."},400);
 const {data,error}=await admin.rpc("reset_flow_workspace_password",{p_token:token,p_password:password});
 if(error||!data?.success)return reply({success:false,error:data?.error||"Não foi possível redefinir a senha."},400);
 return reply({success:true});
});
