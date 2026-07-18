import { useState, useEffect } from 'react'
import { Eye, EyeOff, KeyIcon, Plus, Trash2, Copy, Check, ShieldAlert, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Button } from '../../../../components/ui/button'
import { useAuth } from '../../../../context/AuthContext'
import { getSupabase } from '../../../../lib/supabaseClient'
import { toast } from 'sonner'
import { Input } from '../../../../components/ui/input'
import { Label } from '../../../../components/ui/label'
import { Checkbox } from '../../../../components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../../../components/ui/dialog'
import { Badge } from '../../../../components/ui/badge'

type FlowScope =
  | 'bots:read' | 'bots:run' | 'bots:write'
  | 'flows:read' | 'flows:write'
  | 'sessions:read' | 'sessions:write'

const ALL_SCOPES: { id: FlowScope; label: string; desc: string }[] = [
  { id: 'bots:read',      label: 'bots:read',      desc: 'Listar e inspecionar bots' },
  { id: 'bots:run',       label: 'bots:run',       desc: 'Executar bots via API' },
  { id: 'bots:write',     label: 'bots:write',     desc: 'Criar / editar / publicar bots' },
  { id: 'flows:read',     label: 'flows:read',     desc: 'Ler estrutura de fluxos' },
  { id: 'flows:write',    label: 'flows:write',    desc: 'Editar estrutura de fluxos' },
  { id: 'sessions:read',  label: 'sessions:read',  desc: 'Ler sessões de conversa' },
  { id: 'sessions:write', label: 'sessions:write', desc: 'Alterar / encerrar sessões' },
]

interface FlowKeyRow {
  id: string
  name: string
  key_prefix: string
  key_last_four: string
  scopes: FlowScope[]
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
}

export default function FlowApiKeys() {
  const { currentWorkspace } = useAuth()
  const [keys, setKeys] = useState<FlowKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('Minha Chave do Flow')
  const [selectedScopes, setSelectedScopes] = useState<Set<FlowScope>>(new Set(['bots:read', 'bots:run']))
  const [isCreating, setIsCreating] = useState(false)
  const [revealed, setRevealed] = useState<{ id: string; plaintext: string } | null>(null)
  const [copiedRevealed, setCopiedRevealed] = useState(false)

  useEffect(() => {
    if (currentWorkspace?.id) loadKeys()
  }, [currentWorkspace?.id])

  async function loadKeys() {
    setLoading(true)
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('flow_api_keys')
      .select('id, name, key_prefix, key_last_four, scopes, expires_at, revoked_at, last_used_at, created_at')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('flow_api_keys load error:', error)
      toast.error('Não foi possível carregar as chaves do Flow')
    } else {
      setKeys((data || []) as FlowKeyRow[])
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!newKeyName.trim()) return toast.error('Informe um nome para a chave')
    if (selectedScopes.size === 0) return toast.error('Selecione pelo menos um escopo')

    setIsCreating(true)
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('create_flow_api_key', {
      _workspace_id: currentWorkspace.id,
      _name: newKeyName.trim(),
      _scopes: Array.from(selectedScopes),
      _expires_at: null,
    })
    setIsCreating(false)

    if (error) {
      console.error('create_flow_api_key error:', error)
      toast.error('Erro ao criar chave: ' + error.message)
      return
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row?.plaintext_key) {
      toast.error('A chave foi criada, mas o valor não foi retornado. Revogue e crie outra.')
      loadKeys(); setIsDialogOpen(false)
      return
    }

    setRevealed({ id: row.id, plaintext: row.plaintext_key })
    setIsDialogOpen(false)
    setNewKeyName('Minha Chave do Flow')
    setSelectedScopes(new Set(['bots:read', 'bots:run']))
    loadKeys()
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revogar esta chave? Isso invalida imediatamente todas as requisições que a usam.')) return
    const supabase = getSupabase()
    const { error } = await supabase.rpc('revoke_flow_api_key', { _key_id: id })
    if (error) {
      toast.error('Erro ao revogar: ' + error.message)
    } else {
      toast.success('Chave revogada')
      loadKeys()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir permanentemente esta chave? A ação não pode ser desfeita.')) return
    const supabase = getSupabase()
    const { error } = await supabase.from('flow_api_keys').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir: ' + error.message)
    else { toast.success('Chave excluída'); loadKeys() }
  }

  function toggleScope(s: FlowScope) {
    setSelectedScopes(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  function copyRevealed() {
    if (!revealed) return
    navigator.clipboard.writeText(revealed.plaintext)
    setCopiedRevealed(true)
    setTimeout(() => setCopiedRevealed(false), 2000)
  }

  return (
    <Card className="border-none shadow-sm bg-white">
      <CardHeader className="pb-4">
        <div className='flex w-full justify-between items-center'>
          <div className="space-y-1 text-left">
            <CardTitle className='text-2xl font-bold text-[#1A1C1E]'>Chaves de API — Zailom Flow</CardTitle>
            <CardDescription className="text-[#64748B]">
              Chaves de acesso para integrar sistemas externos ao <strong>Zailom Flow</strong>.
              São independentes das chaves do Zailom Booking.
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-white font-medium rounded-xl px-6">
                <Plus className="w-4 h-4 mr-2" /> Nova chave
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Gerar nova chave do Flow</DialogTitle>
                <DialogDescription>
                  A chave inteira será exibida <strong>uma única vez</strong> após a criação.
                  Guarde-a em local seguro — não conseguiremos mostrá-la novamente.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2 space-y-4">
                <div className="space-y-2">
                  <Label>Nome / uso pretendido</Label>
                  <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                    placeholder="Ex: Integração ERP interno" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Escopos</Label>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                    {ALL_SCOPES.map(s => (
                      <label key={s.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-[#E2E8F0] hover:bg-gray-50 cursor-pointer">
                        <Checkbox checked={selectedScopes.has(s.id)} onCheckedChange={() => toggleScope(s.id)} className="mt-0.5" />
                        <div className="flex-1">
                          <div className="font-mono text-xs font-semibold text-[#1A1C1E]">{s.label}</div>
                          <div className="text-xs text-[#64748B]">{s.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#94A3B8]">
                    Princípio do menor privilégio: dê apenas os escopos que a integração realmente precisa.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                <Button onClick={handleCreate} disabled={isCreating} className="rounded-xl">
                  {isCreating ? 'Gerando...' : 'Gerar chave'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {/* Modal de revelação única */}
        <Dialog open={!!revealed} onOpenChange={(open) => { if (!open) setRevealed(null) }}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" /> Copie sua chave agora
              </DialogTitle>
              <DialogDescription>
                Esta é a única vez que a chave completa será exibida. Depois de fechar esta janela, só será possível ver o prefixo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="p-4 bg-[#0F172A] text-[#E2E8F0] rounded-xl font-mono text-sm break-all">
                {revealed?.plaintext}
              </div>
              <Button onClick={copyRevealed} className="w-full rounded-xl">
                {copiedRevealed ? <><Check className="w-4 h-4 mr-2" /> Copiado!</> : <><Copy className="w-4 h-4 mr-2" /> Copiar chave</>}
              </Button>
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Não compartilhe por e-mail, chat público ou repositórios. Se comprometida, revogue e gere outra.</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevealed(null)} className="rounded-xl">Já guardei</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className='flex flex-col gap-3'>
          {loading ? (
            Array(2).fill(0).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
            ))
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
              <div className="p-4 rounded-full bg-gray-100 mb-4">
                <KeyIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Nenhuma chave criada</h3>
              <p className="text-gray-500 max-w-xs mt-1">
                Crie uma chave para autenticar chamadas à API do Zailom Flow.
              </p>
            </div>
          ) : (
            keys.map(k => {
              const isRevoked = !!k.revoked_at
              const isExpired = k.expires_at && new Date(k.expires_at) < new Date()
              return (
                <div key={k.id} className={`group flex flex-col gap-2 bg-white hover:bg-[#F8F9FA] transition-colors py-4 px-6 rounded-2xl border border-[#E2E8F0] shadow-sm ${isRevoked ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className='flex items-center gap-4'>
                      <div className='p-3 rounded-2xl bg-[#F1F5F9] text-[#475569]'>
                        <KeyIcon className='w-5 h-5'/>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className='text-base font-bold text-[#1A1C1E]'>{k.name}</span>
                          {isRevoked && <Badge variant="destructive">Revogada</Badge>}
                          {!isRevoked && isExpired && <Badge variant="secondary">Expirada</Badge>}
                        </div>
                        <div className="font-mono text-xs text-[#64748B] mt-0.5">
                          {k.key_prefix}<span className="text-[#CBD5E1]">…{k.key_last_four}</span>
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                      {!isRevoked && (
                        <Button variant="ghost" size="sm" onClick={() => handleRevoke(k.id)}
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg">
                          Revogar
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(k.id)}
                        className="h-9 w-9 text-gray-500 hover:text-destructive hover:bg-destructive/5 rounded-lg">
                        <Trash2 className='w-4 h-4' />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-16">
                    {k.scopes.map(s => (
                      <span key={s} className="text-[10px] font-mono px-2 py-0.5 bg-primary/5 text-primary rounded-md border border-primary/10">
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#94A3B8] pl-16">
                    <span>Criada em {new Date(k.created_at).toLocaleDateString('pt-BR')}</span>
                    {k.last_used_at && <span>• Último uso: {new Date(k.last_used_at).toLocaleString('pt-BR')}</span>}
                    {k.expires_at && <span>• Expira em {new Date(k.expires_at).toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
