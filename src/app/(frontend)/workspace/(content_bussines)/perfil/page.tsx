"use client"

import { Calendar, Camera, CheckCheck, Copy, Edit3, Mail, MapPin, Phone, User2,  } from 'lucide-react'
import React, { useEffect, useState } from 'react'

export default function UserProfile() {

  const [usrID, setUsrID ] = useState<string | null>(null);
  const [isCopyID, setIsCopyID] = useState(false);

  useEffect(() => {
    const id = crypto.randomUUID().slice(0, 18).replace(/-/g, '');
    setUsrID(id);
  }, [])

  if(!usrID) return null;

  // const userID_Workspace = crypto.randomUUID().slice(0, 18).replace(/-/g, '')

  const infoPessoal = {
    EmpresarioName: 'Luis Fernando',
    EmpresarioMail: 'luis.fernando@example.com',
    memberUser: 'Dezembro 2025',
    usrID: usrID,
  }

  const infoEmpresariais = {
    cargo: 'Product Manager',
    empresa: 'Empresa Exemplo',
    EmpresaPhone: '(11) 91234-5678',
    EmpresaLocation: 'Montes Claros, MG',
    EmpresaPlan: 'Plano Professional',
  }

  

  return (
    <div className='relative pt-16 box-border w-full overflow-hidden flex items-center justify-center '>
      
      <div className=' w-full  flex flex-col items-center justify-start box-border overflow-auto h-full '>
        <div className='relative flex w-full '>
          <div className='relative flex w-full h-32 flex-col items-center bg-gradient-to-b from-[#1f2937] to-[#06B6D4] p-4 shadow-lg'>
            <div className='absolute -bottom-11 border-4 border-white bg-[#06B6D4] rounded-full p-2 shadow-md'>
              <div className='relative'>
                <User2 className='w-24 h-24 text-xs text-white' />
                <Camera className='absolute -bottom-2.5 -right-2 w-8 h-8 text-white border-2 border-white bg-[#06B6D4] rounded-full p-1.5 cursor-pointer' />
              </div>
            </div>
          </div>
        </div>
        <div className='flex flex-col w-full  pb-4 px-6 items-center justify-center  bg-gray-200'>
          <div className='w-full flex flex-col items-center py-14  rounded-b-2xl shadow-md bg-white'>
            <div className='flex flex-col items-center justify-center gap-6 w-full h-full'>
              <div className='flex flex-col items-center gap-2'>
                <span className='text-gray-800'>{infoPessoal.EmpresarioName}</span>
                <span className='text-gray-500 text-sm'>{infoEmpresariais.cargo}</span>
                <div className='flex rounded-full h-6 bg-[#cdffd2] px-6 py-2 items-center justify-center'>
                  <span className='text-gray-700'>{infoEmpresariais.EmpresaPlan}</span>
                </div>
              </div>
              <div className='mt-4 py-2 w-[90%] border-t border-gray-300'></div>
              <div className='w-[90%] flex flex-col gap-2 items-start justify-start'>
                <div className='flex items-center gap-2'>
                  <div className='flex items-center p-2 rounded-md bg-gray-200/40'>
                    <Mail className='inline-block w-[24px] h-[24px] text-gray-500' />
                  </div>
                  <div className='flex flex-col -space-y-1'>
                    <span className='text-gray-800'>Email</span>
                    <span className='text-gray-500 text-sm underline underline-offset-4'>{infoPessoal.EmpresarioMail}</span>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='flex items-center p-2 rounded-md bg-gray-200/40'>
                    <Phone className='inline-block w-[24px] h-[24px] text-gray-500' />
                  </div>
                  <div className='flex flex-col -space-y-1'>
                    <span className='text-gray-800'>Telefone</span>
                    <span className='text-gray-500 text-sm underline underline-offset-4'>{infoEmpresariais.EmpresaPhone}</span>
                  </div>
                </div>

                <div className='flex items-center gap-2'>
                  <div className='flex items-center p-2 rounded-md bg-gray-200/40'>
                    <MapPin className='inline-block w-[24px] h-[24px] text-gray-500' />
                  </div>
                  <div className='flex flex-col -space-y-1'>
                    <span className='text-gray-800'>Localização</span>
                    <span className='text-gray-500 text-sm'>{infoEmpresariais.EmpresaLocation}</span>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='flex items-center p-2 rounded-md bg-gray-200/40'>
                    <Calendar className='inline-block w-[24px] h-[24px] text-gray-500' />
                  </div>
                  <div className='flex flex-col -space-y-1'>
                    <span className='text-gray-800'>Membro desde</span>
                    <span className='text-gray-500 text-sm'>{infoPessoal.memberUser}</span>
                  </div>
                </div>
                
              </div>
              <div className='mt-4 py-2 w-[90%] border-t border-gray-300'></div>
              <div className='w-[90%] flex flex-col gap-8 items-center justify-start'>
                <div className='w-full flex flex-col gap-1 items-start justify-start'>
                  <span className='text-gray-800 w-full text-center'>ID do Usuário</span>
                  <div className='w-full flex items-center rounded-2xl justify-between bg-gray-200/40 py-2 px-4'>
                    <p className='text-center  text-gray-500 w-full text-sm'>usr_{infoPessoal.usrID}</p>
                    <button onClick={() => {
                      navigator.clipboard.writeText(`${infoPessoal.usrID}`);
                      setIsCopyID(true);
                      setTimeout(() => setIsCopyID(false), 2000);
                    }} className='flex items-center justify-center p-1 rounded-md bg-none transition-colors duration-300'>
                      {isCopyID ? <CheckCheck className='w-5 h-5 text-[#59fc6a] cursor-pointer' /> : <Copy className='w-5 h-5 text-gray-500 cursor-pointer' />}
                    </button>
                  </div>
                </div>
                <button className='w-full items-center justify-center px-4 flex py-1 rounded-lg bg-[#06B6D4] text-white hover:bg-[#1f2937] transition-colors duration-300'><Edit3 className='w-4 h-4 mr-5' /> Editar Perfil</button>

              </div>
            </div>
          </div>
        </div> 
      </div>
    </div>
  )
}
