import {SiInstagram, SiTelegram, SiWhatsapp} from '@icons-pack/react-simple-icons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Label } from '../../../../components/ui/label'
import { CalendarCheck2, Database, Ellipsis, CheckCircle2, XCircle } from 'lucide-react'
import { useEmbed } from '../../../../context/EmbedContext'
import { useState, useEffect } from 'react'
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
} from '../../../../lib/supabaseClient'
import { useToast } from '../../../../hooks/use-toast'

export default function IntegrationsSettings() {
  const { flags } = useEmbed();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const cfg = getSupabaseConfig();
    if (cfg) {
      setUrl(cfg.url);
      setAnonKey(cfg.anonKey);
      setConnected(true);
    }
  }, []);

  function handleSave() {
    if (!url.trim() || !anonKey.trim()) {
      toast({ title: 'Preencha URL e Anon Key', variant: 'destructive' });
      return;
    }
    try {
      // valida URL
      new URL(url.trim());
    } catch {
      toast({ title: 'URL inválida', description: 'Ex.: https://xxxx.supabase.co', variant: 'destructive' });
      return;
    }
    saveSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() });
    setConnected(true);
    toast({ title: 'Supabase conectado!', description: 'Recarregando para aplicar...' });
    setTimeout(() => window.location.reload(), 800);
  }

  function handleDisconnect() {
    clearSupabaseConfig();
    setUrl('');
    setAnonKey('');
    setConnected(false);
    toast({ title: 'Desconectado', description: 'Recarregando...' });
    setTimeout(() => window.location.reload(), 800);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrações</CardTitle>
        <CardDescription>Conecte seu chatbot a diferentes plataformas</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-2'>

        {/* Supabase connection */}
        <Card className='p-4 border-2 border-dashed'>
          <CardHeader className='p-0 pb-3 flex flex-row items-center gap-3 space-y-0'>
            <div className='p-3 h-fit w-fit rounded-xl bg-emerald-100'>
              <Database className='w-5 h-5 text-emerald-600'/>
            </div>
            <div className='flex-1'>
              <CardTitle className='flex items-center gap-2'>
                Banco de dados do meu negócio (opcional)
                {connected ? (
                  <span className='inline-flex items-center gap-1 text-xs text-emerald-600 font-normal'>
                    <CheckCircle2 className='w-3.5 h-3.5'/> Conectado
                  </span>
                ) : (
                  <span className='inline-flex items-center gap-1 text-xs text-gray-400 font-normal'>
                    <XCircle className='w-3.5 h-3.5'/> Não conectado
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Avançado — conecte seu próprio Supabase para guardar dados dos seus bots (variáveis, leads, conversas) na sua infraestrutura. Sua conta ZailomFlow continua funcionando independente disso.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className='p-0 flex flex-col gap-3'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sb-url'>Project URL</Label>
              <Input
                id='sb-url'
                placeholder='https://xxxxxxxx.supabase.co'
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sb-key'>Anon / Public Key</Label>
              <Input
                id='sb-key'
                type='password'
                placeholder='eyJhbGciOi...'
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
              />
              <span className='text-xs text-gray-500'>
                Em Supabase → Project Settings → API. Use a chave <strong>anon/public</strong> (nunca a service_role).
              </span>
            </div>
            <div className='flex gap-2'>
              <Button onClick={handleSave}>{connected ? 'Atualizar conexão' : 'Conectar'}</Button>
              {connected && (
                <Button variant='outline' onClick={handleDisconnect}>Desconectar</Button>
              )}
            </div>
            <p className='text-xs text-gray-500'>
              Sua autenticação no ZailomFlow não depende disso — esse Supabase é só para você guardar os dados que seus bots coletam.
            </p>
          </CardContent>
        </Card>

        <Card className='flex items-center p-4 justify-between relative'>
          <div className='p-3 h-fit w-fit rounded-xl bg-gray-200/90'>
            <SiWhatsapp className='w-5 h-5 text-green-600'/>
          </div>
          <CardHeader className='flex flex-col text-left items-start  w-full'>
            <CardTitle>WhatsApp</CardTitle>
            <CardDescription>Conect seu chatbot ao WhatsApp - Ativo</CardDescription>
          </CardHeader>
          <CardContent className='flex absolute right-0 h-full'>
            <div className='pt-2 flex flex-col justify-between'>
              <div className='flex items-end justify-end '>
                <Ellipsis />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='flex items-center p-4 justify-between relative'>
          <div className='p-3 h-fit w-fit rounded-xl bg-gray-200/90'>
            <SiTelegram className='w-5 h-5 text-blue-500'/>
          </div>
          <CardHeader className='flex flex-col text-left items-start  w-full'>
            <CardTitle>Telegram</CardTitle>
            <CardDescription>Conect seu chatbot ao Telegram - Desativado</CardDescription>
          </CardHeader>
          <CardContent className='flex absolute right-0 h-full'>
            <div className='pt-2 flex flex-col justify-between'>
              <div className='flex items-end justify-end '>
                <Ellipsis />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='flex items-center p-4 justify-between relative'>
          <div className='p-3 h-fit w-fit rounded-xl bg-gray-200/90'>
            <SiInstagram className='w-5 h-5 text-fuchsia-500'/>
          </div>
          <CardHeader className='flex flex-col text-left items-start  w-full'>
            <CardTitle>Instagram</CardTitle>
            <CardDescription>Conect seu chatbot ao Instagram -  Desativado</CardDescription>
          </CardHeader>
          <CardContent className='flex absolute right-0 h-full'>
            <div className='pt-2 flex flex-col justify-between'>
              <div className='flex items-end justify-end '>
                <Ellipsis />
              </div>
            </div>
          </CardContent>
        </Card>

        {flags.showBookingfyIntegrationCard && (
          <Card className='flex items-center p-4 justify-between relative border-dashed'>
            <div className='p-3 h-fit w-fit rounded-xl bg-gray-200/90'>
              <CalendarCheck2 className='w-5 h-5 text-orange-500'/>
            </div>
            <CardHeader className='flex flex-col text-left items-start w-full'>
              <CardTitle>BookingFy</CardTitle>
              <CardDescription className='border w- max-w-md'>
                Conecte ao seu sistema de agendamento para que o chatbot leia e escreva dados de clientes, serviços e horários.
              </CardDescription>
            </CardHeader>
            <CardContent className='flex absolute right-0 h-full'>
              <div className='pt-2 flex flex-col justify-between'>
                <div className='flex items-end justify-end '>
                  <Button variant='outline' size='sm'>Conectar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  )
}
