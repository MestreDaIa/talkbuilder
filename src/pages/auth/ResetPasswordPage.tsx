"use client";
import {useState} from "react";
import {Link,useNavigate} from "react-router-dom";
import {Button} from "../../components/ui/button";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "../../components/ui/card";
import {Input} from "../../components/ui/input";
import {Label} from "../../components/ui/label";
import {useToast} from "../../hooks/use-toast";
import {getSupabase} from "../../lib/supabaseClient";
export default function ResetPasswordPage(){
 const navigate=useNavigate(),{toast}=useToast();
 const token=new URLSearchParams(window.location.search).get("token")||"";
 const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[submitting,setSubmitting]=useState(false);
 async function submit(e:React.FormEvent){
  e.preventDefault();
  if(!token){toast({title:"Link inválido",description:"Solicite uma nova redefinição.",variant:"destructive"});return;}
  if(password.length<8||password!==confirm){toast({title:"Confira a nova senha",description:password.length<8?"A senha deve ter ao menos 8 caracteres.":"As senhas não conferem.",variant:"destructive"});return;}
  setSubmitting(true);
  try{
   const supabase=getSupabase();if(!supabase)throw new Error("Supabase não configurado.");
   const {data,error}=await supabase.functions.invoke("reset-workspace-password",{body:{token,password}});
   if(error||!data?.success)throw new Error(data?.error||error?.message||"Não foi possível redefinir a senha.");
   toast({title:"Senha atualizada",description:"A senha deste workspace foi alterada sem modificar a senha do Booking."});
   navigate("/login",{replace:true});
  }catch(err:any){toast({title:"Falha ao redefinir senha",description:err?.message||"Link inválido ou expirado.",variant:"destructive"});}
  finally{setSubmitting(false);}
 }
 return <div className="min-h-svh flex items-center justify-center p-6 bg-gradient-to-br from-background to-muted"><Card className="max-w-md w-full">
  <CardHeader><CardTitle>Nova senha do Flow</CardTitle><CardDescription>Defina uma senha exclusiva para este workspace.</CardDescription></CardHeader>
  <CardContent>{!token?<div className="space-y-3 text-sm text-muted-foreground"><p>O link está ausente ou inválido.</p><Link to="/forgot-password" className="text-primary underline">Solicitar novo link</Link></div>:<form onSubmit={submit} className="space-y-4">
   <div><Label htmlFor="password">Nova senha</Label><Input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="new-password"/></div>
   <div><Label htmlFor="confirm">Confirmar senha</Label><Input id="confirm" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required autoComplete="new-password"/></div>
   <Button type="submit" className="w-full" disabled={submitting}>{submitting?"Salvando...":"Salvar nova senha"}</Button>
  </form>}</CardContent>
 </Card></div>;
}
