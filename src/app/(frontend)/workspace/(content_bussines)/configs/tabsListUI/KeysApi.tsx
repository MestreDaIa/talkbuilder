import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Eye, KeyIcon, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import React from 'react'

export default function KeysApi() {

  const keysApis = {
    'production': {
      name: 'Production',
      id: 'kioa55e855LKJDU55991JIS',
      description: 'Chave de API para ambiente de produção',
      createdAt: '03/01/2026',
      lastUsed: '21/02/2023',
    },
    'development': {
      name: 'Development',
      id: 'kioa55e855LKJDU55991JIS',
      description: 'Chave de API para ambiente de desenvolvimento',
      createdAt: '02/01/2026',
      lastUsed: '21/02/2026',
    },
  }
  return (
    <Card>
      <CardHeader>
        <div className='flex w-full justify-between items-center'>
          <div>
            <CardTitle>Chave de API</CardTitle>
            <CardDescription>Gerencie suas chaves de acesso à API</CardDescription>
          </div>
          <Button variant="outline"><Plus/> nova chave</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className='flex flex-col gap-4'>
          <div className='flex justify-between items-center bg-gray-200/20 py-2 px-4 rounded-lg border'>
            <div className='flex items-center gap-2 w-full'>
              <div className='p-3 rounded-xl bg-gray-200/40'>
                <KeyIcon className='w-5 h-5'/>
              </div>
              <CardHeader className='flex flex-col w-full'>
                <CardTitle>{keysApis['production'].name}</CardTitle>
                <div className='flex items-center w-full justify-between gap-2'>
                  <div className='flex items-center gap-1'>
                    <CardDescription className='bg-gray-200/40 p-1 rounded-md'>sk_live_{keysApis['production'].id}</CardDescription>
                    <Eye className='w-5 h-5 text-gray-400 cursor-pointer' />
                  </div>
                  <div className='flex items-center gap-3'>
                    <RefreshCcw className='w-5 h-5 text-gray-400 cursor-pointer' />
                    <Trash2 className='w-5 h-5 text-gray-400 cursor-pointer' />
                  </div>
                </div>
                <CardDescription>Criada em {keysApis['production'].createdAt} - Último Uso:{keysApis['production'].lastUsed} </CardDescription>
              </CardHeader>
            </div>

          </div>

          <div className='flex justify-between items-center bg-gray-200/20 py-2 px-4 rounded-lg border'>
            <div className='flex items-center gap-2 w-full'>
              <div className='p-3 rounded-xl bg-gray-200/40'>
                <KeyIcon className='w-5 h-5'/>
              </div>
              <CardHeader className='flex flex-col w-full'>
                <CardTitle>{keysApis['development'].name}</CardTitle>
                <div className='flex items-center w-full justify-between gap-2'>
                  <div className='flex items-center gap-1'>
                    <CardDescription className='bg-gray-200/40 p-1 rounded-md'>sk_live_{keysApis['development'].id}</CardDescription>
                    <Eye className='w-5 h-5 text-gray-400 cursor-pointer' />
                  </div>
                  <div className='flex items-center gap-3'>
                    <RefreshCcw className='w-5 h-5 text-gray-400 cursor-pointer' />
                    <Trash2 className='w-5 h-5 text-gray-400 cursor-pointer' />
                  </div>
                </div>
                <CardDescription>Criada em {keysApis['development'].createdAt} - Último Uso:{keysApis['development'].lastUsed} </CardDescription>
              </CardHeader>
            </div>

          </div>
        </div>
      </CardContent>
    </Card>
  )
}
