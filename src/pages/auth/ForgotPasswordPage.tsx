"use client";
import {useState} from "react";
import {Link} from "react-router-dom";
import {Button} from "../../components/ui/button";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "../../components/ui/card";
import {Input} from "../../components/ui/input";
import {Label} from "../../components/ui/label";
import {useToast} from "../../hooks/use-toast";
import {getSupabase} from "../../lib/supabaseClient";
export default function ForgotPasswordPage(){
 const {toast}=useToast();
 const [identifier,setIdentifier]=useState(window.location.hostname==="flow-builder.zailom.com"?"":"");
 const [email,setEmail]=useState("");
 const [submitting,setSubmitting]=useState(false);
 async function submit(e:React.FormEvent){
  e.preventDefault();setSubmitting(true);
  try{
   const supabase=getSupabase();if(!supabase)throw new Error("Supabase não configurado.");
   const {data,error}=await supabase.functions.invoke("request-workspace-password-reset",{body:{identifier:identifier.trim(),email:email.trim()}});
   if(error||!data?.success)throw new Error(data?.error||error?.message||"Não foi possível solicitar a recuperação.");
   toast({title:"Confira seu e-mail",description:data.message||"Se o cadastro existir, enviaremos as instruções."});
  }catch(err:any){toast({title:"Falha na recuperação",description:err?.message||"Tente novamente.",variant:"destructive"});}
  finally{setSubmitting(false);}
 }
 return <div className="min-h-svh flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted"><Card className="max-w-md w-full">
  <CardHeader><CardTitle>Redefinir senha</CardTitle><CardDescription>Informe a empresa e o e-mail da conta. A redefinição altera somente a senha deste workspace.</CardDescription></CardHeader>
  <CardContent><form onSubmit={submit} className="space-y-4">
   <div><Label htmlFor="tenant">Domínio ou identificador da empresa</Label><Input id="tenant" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="flow-empresa.zailom.com" required/></div>
   <div><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@empresa.com" required autoComplete="email"/></div>
   <Button type="submit" className="w-full" disabled={submitting}>{submitting?"Enviando...":"Enviar link de redefinição"}</Button>
   <p className="text-center text-sm text-muted-foreground"><Link to="/login" className="text-primary underline underline-offset-4">Voltar para login</Link></p>
  </form></CardContent>
 </Card></div>;
}
