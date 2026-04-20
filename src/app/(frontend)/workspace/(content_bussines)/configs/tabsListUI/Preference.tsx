import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { AlertCircle, Globe, LucideBell, Mail, MessageSquare, Pi } from 'lucide-react'
import React from 'react'

export default function Preference() {      
  return (
    <div>
      <Card className='p-4 flex flex-col '>
        <CardHeader>
          <CardTitle className='text-2xl'>Preferências de Notificações</CardTitle>
          <CardDescription>Escolha como você quer ser notificado</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          <div className='bg-gray-600/20 flex justify-between items-center p-4 rounded-lg'>
            <div className='flex gap-2 items-center'>
              <div className='flex-shrink-0 w-10 h-10 rounded-lg bg-gray-600/60 text-white flex items-center justify-center'>
                <Mail  />
              </div>
              <div className='flex flex-col'>
                <Label className='flex items-center space-x-2 cursor-pointer'>Notificações por Email</Label>
                <CardDescription>Receba notificações no seu email</CardDescription>
              </div>
            </div>
            <div className='flex relative w-10 h-5 rounded-full border bg-green-300 cursor-pointer'>
              <div className='absolute w-5 h-4 right-0 top-[50%] -translate-y-2/4 rounded-full bg-white transition-all duration-300 ease-in-out' />
            </div>
          </div>
          <div className='bg-gray-600/20 flex justify-between items-center p-4 rounded-lg'>
            <div className='flex gap-2 items-center'>
              <div className='flex-shrink-0 w-10 h-10 rounded-lg bg-gray-600/60 text-white flex items-center justify-center'>
                <LucideBell  />
              </div>
              <div className='flex flex-col'>
                <Label className='flex items-center space-x-2 cursor-pointer'>Notificações Push</Label>
                <CardDescription>Receba notificações no seu navegador</CardDescription>
              </div>
            </div>
            <div className='flex relative w-10 h-5 rounded-full border bg-green-300 cursor-pointer'>
              <div className='absolute w-5 h-4 right-0 top-[50%] -translate-y-2/4 rounded-full bg-white transition-all duration-300 ease-in-out' />
            </div>
          </div>
         
          <div className='bg-gray-600/20 flex justify-between items-center p-4 rounded-lg'>
            <div className='flex gap-2 items-center'>
              <div className='flex-shrink-0 w-10 h-10 rounded-lg bg-gray-600/60 text-white flex items-center justify-center'>
                <AlertCircle   />
              </div>
              <div className='flex flex-col'>
                <Label className='flex items-center space-x-2 cursor-pointer'>Alerta de Sistema</Label>
                <CardDescription>Erros, limites de usos e alertas criticos</CardDescription>
              </div>
            </div>
            <div className='flex relative w-10 h-5 rounded-full border bg-green-300 cursor-pointer'>
              <div className='absolute w-5 h-4 right-0 top-[50%] -translate-y-2/4 rounded-full bg-white transition-all duration-300 ease-in-out' />
            </div>
          </div>
          <div className='bg-gray-600/20 flex justify-between items-center p-4 rounded-lg'>
            <div className='flex gap-2 items-center'>
              <div className='flex-shrink-0 w-10 h-10 rounded-lg bg-gray-600/60 text-white flex items-center justify-center'>
                <MessageSquare  />
              </div>
              <div className='flex flex-col'>
                <Label className='flex items-center space-x-2 cursor-pointer'>Atualizações de Produto</Label>
                <CardDescription>Novos recursos e melhorias</CardDescription>
              </div>
            </div>
            <div className='flex relative w-10 h-5 rounded-full border bg-green-300 cursor-pointer'>
              <div className='absolute w-5 h-4 right-0 top-[50%] -translate-y-2/4 rounded-full bg-white transition-all duration-300 ease-in-out' />
            </div>
          </div>
          <div className='bg-gray-600/20 flex justify-between items-center p-4 rounded-lg'>
            <div className='flex gap-2 items-center'>
              <div className='flex-shrink-0 w-10 h-10 rounded-lg bg-gray-600/60 text-white flex items-center justify-center'>
                <Globe  />
              </div>
              <div className='flex flex-col'>
                <Label className='flex items-center space-x-2 cursor-pointer'>Email Marketing</Label>
                <CardDescription>Promoções e ofertas especiais</CardDescription>
              </div>
            </div>
            <div className='flex relative w-10 h-5 rounded-full border bg-green-300 cursor-pointer'>
              <div className='absolute w-5 h-4 right-0 top-[50%] -translate-y-2/4 rounded-full bg-white transition-all duration-300 ease-in-out' />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
