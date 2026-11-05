"use client";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { getSupabase } from "../../lib/supabaseClient";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { useToast } from "../../hooks/use-toast";

const schema=z.object({email:z.string().trim().email("Email inválido").max(255),password:z.string().min(8,"Senha deve ter ao menos 8 caracteres").max(72)});
type Tenant={workspace_id:string;workspace_slug:string;workspace_name:string;hostname:string|null;workspace_source:string};
const ROOT_HOST="flow-builder.zailom.com";

export default function LoginPage(){
 const location=useLocation(),navigate=useNavigate(),{toast}=useToast();
 const [identifier,setIdentifier]=useState("");
 const [tenant,setTenant]=useState<Tenant|null>(null);
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [resolving,setResolving]=useState(false);
 const [submitting,setSubmitting]=useState(false);
 const [stage,setStage]=useState<"tenant"|"credentials">("tenant");
 const [initialized,setInitialized]=useState(false);

 async function resolveTenant(value:string){
  const normalized=value.trim().toLowerCase();
  if(!normalized){toast({title:"Informe a empresa",description:"Digite o domínio ou identificador da empresa.",variant:"destructive"});return;}
  setResolving(true);
  try{
   const supabase=getSupabase(); if(!supabase) throw new Error("Supabase não configurado.");
   const {data,error}=await supabase.functions.invoke("resolve-flow-tenant",{body:{identifier:normalized}});
   if(error||!data?.success) throw new Error(data?.error||error?.message||"Empresa não encontrada.");
   setTenant(data as Tenant);setIdentifier(normalized);setStage("credentials");
  }catch(err:any){setTenant(null);toast({title:"Empresa não localizada",description:err?.message||"Confira o endereço informado.",variant:"destructive"});}
  finally{setResolving(false);}
 }

 useEffect(()=>{
  if(initialized)return;
  setInitialized(true);
  const host=window.location.hostname.toLowerCase();
  if(host!==ROOT_HOST){setIdentifier(host);void resolveTenant(host);}
 },[initialized]);

 async function handleSubmit(e:React.FormEvent){
  e.preventDefault();
  const parsed=schema.safeParse({email,password});
  if(!parsed.success){toast({title:"Confira os campos",description:parsed.error.issues[0].message,variant:"destructive"});return;}
  if(!tenant){toast({title:"Empresa não identificada",description:"Valide o domínio da empresa antes de entrar.",variant:"destructive"});return;}
  setSubmitting(true);
  try{
   const supabase=getSupabase();if(!supabase)throw new Error("Supabase não configurado.");
   const {data,error}=await supabase.functions.invoke("login-workspace",{body:{
    identifier:tenant.hostname||identifier,email:parsed.data.email,password:parsed.data.password,origin:window.location.origin
   }});
   if(error||!data?.success||!data?.action_link)throw new Error(data?.error||error?.message||"Não foi possível autenticar.");
   window.location.assign(data.action_link);
  }catch(err:any){toast({title:"Falha ao entrar",description:err?.message||"E-mail ou senha incorretos para esta empresa.",variant:"destructive"});setSubmitting(false);}
 }

 return <div className="min-h-svh flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted">
  <Card className="max-w-md w-full">
   <CardHeader>
    <CardTitle className="flex items-center gap-2">Entrar no <img src={(new URL("../../assets/logo-wordmark.svg",import.meta.url)).href} alt="ZailomFlow" className="h-5 w-auto inline-block"/></CardTitle>
    <CardDescription>{stage==="tenant"?"Identifique a empresa para abrir o ambiente correto.":"Acesse o ambiente selecionado com suas credenciais."}</CardDescription>
   </CardHeader>
   <CardContent>
    {stage==="tenant"?<form onSubmit={e=>{e.preventDefault();void resolveTenant(identifier);}} className="space-y-4">
      <div><Label htmlFor="tenant">Domínio ou identificador da empresa</Label><Input id="tenant" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="flow-empresa.zailom.com" required autoFocus/></div>
      <Button type="submit" className="w-full" disabled={resolving}>{resolving?"Validando...":"Continuar"}</Button>
     </form>:<form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md border p-3 text-sm"><div className="font-medium">{tenant?.workspace_name}</div><div className="text-muted-foreground">{tenant?.hostname||tenant?.workspace_slug}</div><button type="button" className="mt-2 text-primary underline text-xs" onClick={()=>{setTenant(null);setStage("tenant");}}>Trocar empresa</button></div>
      <div><Label htmlFor="email">E-mail</Label><Input id="email" type="email" placeholder="voce@empresa.com" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" autoFocus/></div>
      <div><div className="flex items-center justify-between gap-3"><Label htmlFor="password">Senha</Label><Link to={"/forgot-password"+location.search} className="text-xs text-primary underline underline-offset-4">Esqueceu a senha?</Link></div><Input id="password" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></div>
      <Button type="submit" className="w-full" disabled={submitting}>{submitting?"Entrando...":"Entrar"}</Button>
      {tenant?.workspace_source === "standalone" && <p className="text-sm text-muted-foreground text-center">Ainda não tem conta? <Link to={"/signup"+location.search} className="text-primary underline">Criar conta</Link></p>}
     </form>}
   </CardContent>
  </Card>
 </div>;
}
