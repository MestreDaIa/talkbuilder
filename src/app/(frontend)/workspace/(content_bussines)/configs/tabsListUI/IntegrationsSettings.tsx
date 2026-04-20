import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageCirclePlusIcon, Plug, Ellipsis } from 'lucide-react'

import {SiInstagram, SiTelegram, SiWhatsapp} from '@icons-pack/react-simple-icons'
import React, { useState } from 'react'

export default function IntegrationsSettings() {

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrações</CardTitle>
        <CardDescription>Conecte seu chatbot a diferentes plataformas</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-2'>
        
        <Card className='flex items-center p-4 justify-between relative'>
          <div className='p-3 h-fit w-fit rounded-xl bg-gray-200/90'>
            <SiWhatsapp className='w-5 h-5 text-green-600'/>
          </div>
          <CardHeader className='flex flex-col text-left items-start  w-full'>
            <CardTitle>Whatsapp</CardTitle>
            <CardDescription>Conect seu chatbot ao Whatsapp - Ativo</CardDescription>
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

    
      </CardContent>
    </Card>
  )
}
