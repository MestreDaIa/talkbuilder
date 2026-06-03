import { useState, useEffect } from 'react'
import { Eye, EyeOff, KeyIcon, Plus, Trash2, Copy, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Button } from '../../../../components/ui/button'
import { useAuth } from '../../../../context/AuthContext'
import { getSupabase } from '../../../../lib/supabaseClient'
import { toast } from 'sonner'
import { Input } from '../../../../components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../../../components/ui/dialog'

export default function KeysApi() {
  const { currentWorkspace, user } = useAuth()
  const [keys, setKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('Minha Chave API')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadKeys()
    }
  }, [currentWorkspace?.id])

  async function loadKeys() {
    setLoading(true)
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao carregar chaves:', error)
      toast.error('Não foi possível carregar as chaves de API')
    } else {
      setKeys(data || [])
    }
    setLoading(false)
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) {
      toast.error('Informe um nome para a chave')
      return
    }

    setIsCreating(true)
    const supabase = getSupabase()
    
    const { data: keyValue, error: rpcError } = await supabase.rpc('generate_api_key')
    
    if (rpcError) {
      console.error('Erro ao gerar chave:', rpcError)
      toast.error('Erro ao gerar chave de API')
      setIsCreating(false)
      return
    }

    const { error } = await supabase
      .from('api_keys')
      .insert({
        name: newKeyName,
        workspace_id: currentWorkspace.id,
        key_value: keyValue,
        created_by: user?.id
      })

    if (error) {
      console.error('Erro ao salvar chave:', error)
      toast.error('Erro ao salvar chave de API')
    } else {
      toast.success('Chave de API criada com sucesso')
      setIsDialogOpen(false)
      setNewKeyName('Minha Chave API')
      loadKeys()
    }
    setIsCreating(false)
  }

  async function handleDeleteKey(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta chave? Esta ação não pode ser desfeita.')) return

    const supabase = getSupabase()
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erro ao deletar chave:', error)
      toast.error('Erro ao excluir chave de API')
    } else {
      toast.success('Chave de API excluída')
      loadKeys()
    }
  }

  const toggleVisibility = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedKey(value)
    toast.success('Chave copiada para a área de transferência')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const maskKey = (key: string) => {
    return `tmk_••••••••••••••••••••••••••••••••`
  }

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-4">
        <div className='flex w-full justify-between items-center'>
          <div className="space-y-1 text-left">
            <CardTitle className='text-left text-2xl font-bold text-[#1A1C1E]'>Chave de API</CardTitle>
            <CardDescription className="text-[#64748B]">
              Gerencie suas chaves de acesso para integrar com sistemas externos como Flow-Appoint.
            </CardDescription>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-white font-medium rounded-xl px-6">
                <Plus className="w-4 h-4 mr-2" /> nova chave
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Gerar Nova Chave</DialogTitle>
                <DialogDescription>
                  Dê um nome para identificar onde esta chave será usada.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input 
                  value={newKeyName} 
                  onChange={(e) => setNewKeyName(e.target.value)} 
                  placeholder="Ex: Integração Flow-Appoint"
                  className="rounded-xl"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                <Button onClick={handleCreateKey} disabled={isCreating} className="rounded-xl">
                  {isCreating ? 'Gerando...' : 'Gerar Chave'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className='flex flex-col gap-4'>
          {loading ? (
            Array(2).fill(0).map((_, i) => (
              <div key={i} className="space-y-3 p-4 border rounded-xl bg-gray-50/50 animate-pulse">
                <div className="h-5 w-[150px] bg-gray-200 rounded" />
                <div className="h-10 w-full bg-gray-200 rounded" />
                <div className="h-4 w-[200px] bg-gray-200 rounded" />
              </div>
            ))
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
              <div className="p-4 rounded-full bg-gray-100 mb-4">
                <KeyIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Nenhuma chave encontrada</h3>
              <p className="text-gray-500 max-w-xs mt-1">
                Crie sua primeira chave de API para começar a integrar o Chatbot com seus outros sistemas.
              </p>
            </div>
          ) : (
            keys.map((key) => (
              <div key={key.id} className='group flex justify-between items-center bg-white hover:bg-[#F8F9FA] transition-colors py-4 px-6 rounded-2xl border border-[#E2E8F0] shadow-sm'>
                <div className='flex items-center gap-4 w-full'>
                  <div className='p-3.5 rounded-2xl bg-[#F1F5F9] text-[#475569] group-hover:bg-primary/10 group-hover:text-primary transition-colors'>
                    <KeyIcon className='w-6 h-6'/>
                  </div>
                  <div className='flex flex-col w-full gap-1.5'>
                    <div className="flex items-center justify-between">
                      <span className='text-lg font-bold text-[#1A1C1E]'>{key.name}</span>
                      <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-lg"
                          onClick={() => toggleVisibility(key.id)}
                        >
                          {visibleKeys[key.id] ? <EyeOff className='w-4.5 h-4.5' /> : <Eye className='w-4.5 h-4.5' />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-lg"
                          onClick={() => handleCopy(key.key_value)}
                        >
                          {copiedKey === key.key_value ? <Check className='w-4.5 h-4.5 text-green-500' /> : <Copy className='w-4.5 h-4.5' />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-gray-500 hover:text-destructive hover:bg-destructive/5 rounded-lg"
                          onClick={() => handleDeleteKey(key.id)}
                        >
                          <Trash2 className='w-4.5 h-4.5' />
                        </Button>
                      </div>
                    </div>
                    
                    <div className='flex items-center gap-2'>
                      <div className='flex-1 font-mono text-sm bg-[#F8FAFC] px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-[#334155] select-all text-left'>
                        {visibleKeys[key.id] ? key.key_value : maskKey(key.key_value)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs font-medium text-[#94A3B8]">
                      <span>Criada em: {new Date(key.created_at).toLocaleDateString('pt-BR')}</span>
                      {key.last_used_at && (
                        <span>• Último uso: {new Date(key.last_used_at).toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}