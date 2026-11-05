import {createClient} from "https://esm.sh/@supabase/supabase-js@2.45.4";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const cleanSlug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"");
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({success:false,error:"Método não permitido."},405);
 const url=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",resend=Deno.env.get("RESEND_API_KEY")||"",from=Deno.env.get("FLOW_EMAIL_FROM")||"";
 if(!url||!key||!resend||!from)return reply({success:false,error:"Cadastro standalone indisponível: configure o serviço de e-mail do Flow."},503);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const body=await req.json().catch(()=>({}));
 const displayName=String(body.display_name||"").trim(),email=String(body.email||"").trim().toLowerCase(),password=String(body.password||""),slug=cleanSlug(String(body.slug||"")),plan=String(body.plan||"starter");
 if(!displayName||!email||!slug||password.length<8||new TextEncoder().encode(password).length>72)return reply({success:false,error:"Confira nome, e-mail, identificador e senha (mínimo 8 caracteres)."},400);
 if(!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/.test(slug))return reply({success:false,error:"Identificador inválido."},400);
 const {data:existingWorkspace,error:slugError}=await admin.from("workspaces").select("id").eq("slug",slug).maybeSingle();
 if(slugError)return reply({success:false,error:"Falha ao validar identificador."},500);
 if(existingWorkspace)return reply({success:false,error:"Este identificador já está em uso."},409);
 let userId:string|null=null;
 const {data:users,error:userError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
 if(userError)return reply({success:false,error:"Falha ao consultar identidade."},500);
 userId=users.users.find(u=>u.email?.toLowerCase()===email)?.id||null;
 if(!userId){
  const {data,error}=await admin.auth.admin.createUser({email,email_confirm:true,user_metadata:{display_name:displayName,slug,plan}});
  if(error||!data.user)return reply({success:false,error:error?.message||"Não foi possível criar perfil."},400);
  userId=data.user.id;
 }
 let workspaceId:string|null=null;
 const {data:triggerWorkspace,error:triggerWorkspaceError}=await admin.from("workspaces").select("id").eq("slug",slug).maybeSingle();
 if(triggerWorkspaceError)return reply({success:false,error:"Falha ao localizar workspace recém-criado."},500);
 if(triggerWorkspace?.id) workspaceId=triggerWorkspace.id;
 else {
  const {data:workspace,error:workspaceError}=await admin.from("workspaces").insert({name:displayName+" Workspace",slug}).select("id").single();
  if(workspaceError||!workspace)return reply({success:false,error:"Não foi possível criar workspace.",details:workspaceError?.message},500);
  workspaceId=workspace.id;
 }
 const {error:memberError}=await admin.from("workspace_members").upsert({workspace_id:workspaceId,user_id:userId,role:"owner"},{onConflict:"workspace_id,user_id"});
 if(memberError)return reply({success:false,error:"Não foi possível vincular o proprietário.",details:memberError.message},500);
 await admin.from("profiles").update({display_name:displayName,plan}).eq("id",userId);
 const {data:credential,error:credentialError}=await admin.rpc("set_flow_workspace_credential",{p_workspace_id:workspaceId,p_user_id:userId,p_email:email,p_password:password});
 if(credentialError||!credential?.success)return reply({success:false,error:credential?.error||"Não foi possível salvar a senha."},500);
 const site=(Deno.env.get("FLOW_APP_URL")||"https://flow-builder.zailom.com").replace(/\/$/,"");
 const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:"magiclink",email,options:{redirectTo:site+"/"+slug+"/workspace"}});
 if(linkError||!link?.properties?.action_link)return reply({success:false,error:"Conta criada, mas não foi possível gerar o e-mail de ativação.",details:linkError?.message},500);
 const mail=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+resend},body:JSON.stringify({from,to:[email],subject:"Bem-vindo ao Zailom Flow — confirme seu acesso",html:"<h2>Olá, "+displayName.replace(/[<>]/g,"")+"!</h2><p>Sua conta standalone do Zailom Flow foi criada.</p><p><a href=\""+link.properties.action_link+"\">Confirmar e acessar minha conta</a></p><p>Depois, entre com <strong>"+email+"</strong> e a senha que você cadastrou.</p>"})});
 if(!mail.ok){console.error("[signup-standalone]",await mail.text());return reply({success:false,error:"Conta criada, mas houve falha ao enviar o e-mail de ativação."},502);}
 return reply({success:true,message:"Conta criada. Enviamos um e-mail para confirmar e ativar seu acesso."});
});
