import { useState } from 'react'
import {
  CheckCircle2,
  CreditCard,
  Crown,
  Download,
  Link2,
  Receipt,
  Sparkles,
  TrendingUp,
  Zap,
  Calendar,
  AlertCircle,
  FlaskConical,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card'
import { Button } from '../../../../components/ui/button'
import { Badge } from '../../../../components/ui/badge'
import { Separator } from '../../../../components/ui/separator'
import { Progress } from '../../../../components/ui/progress'
import { usePlan, PLAN_LIMITS, type PlanId } from '../../../../context/PlanContext'
import { useAuth } from '../../../../context/AuthContext'

type Plan = {
  id: PlanId
  name: string
  price: number
  description: string
  highlight?: boolean
  features: string[]
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    description: 'Para quem está começando a automatizar',
    features: [
      `Até ${PLAN_LIMITS.starter.bots} chatbot por workspace`,
      `${PLAN_LIMITS.starter.messages.toLocaleString('pt-BR')} mensagens/mês`,
      'Integrações básicas',
      'Suporte por e-mail',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 129,
    description: 'Para times que precisam de mais escala',
    highlight: true,
    features: [
      `Até ${PLAN_LIMITS.pro.bots} chatbots por workspace`,
      `${PLAN_LIMITS.pro.messages.toLocaleString('pt-BR')} mensagens/mês`,
      'Todas as integrações',
      'Webhooks e API',
      'Suporte prioritário',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 349,
    description: 'Volume ilimitado para operações maiores',
    features: [
      'Chatbots ilimitados por workspace',
      `${PLAN_LIMITS.business.messages.toLocaleString('pt-BR')} mensagens/mês`,
      'IA avançada incluída',
      'SLA dedicado',
      'Gerente de conta',
    ],
  },
]

const invoices = [
  { id: 'INV-0048', date: '15 Mar 2026', amount: 'R$ 129,00', status: 'paid' },
  { id: 'INV-0042', date: '15 Fev 2026', amount: 'R$ 129,00', status: 'paid' },
  { id: 'INV-0036', date: '15 Jan 2026', amount: 'R$ 129,00', status: 'paid' },
]

export default function PaymentPlan() {
  // Simula a detecção da integração com flow-appoint
  const [managedByAppoint] = useState(false)
  const { currentPlan, setCurrentPlan, botsUsed, limits } = usePlan()
  const { profile } = useAuth()

  // ===== Cenário: Usuário convidado (Guest) =====
  if (profile?.is_guest) {
    return (
      <Card className="p-4">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl text-left">Plano do Workspace</CardTitle>
              <CardDescription className="text-left">
                Você está acessando este workspace como convidado.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 text-left">
              A gestão de faturas e planos é restrita ao <strong>proprietário</strong> do workspace. 
              Os limites aplicados são baseados na assinatura ativa do dono.
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const usage = {
    botsUsed,
    botsLimit: limits.bots,
    messagesUsed: 0,
    messagesLimit: limits.messages,
  }

  const activePlan = plans.find((p) => p.id === currentPlan)!
  const botsLimitLabel = Number.isFinite(usage.botsLimit)
    ? usage.botsLimit
    : '∞'
  const botsProgress = Number.isFinite(usage.botsLimit)
    ? Math.min(100, (usage.botsUsed / usage.botsLimit) * 100)
    : 0

  // ===== Cenário: Gestão externa via flow-appoint =====
  if (managedByAppoint) {
    return (
      <Card className="p-4">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white">
              <Link2 className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl">Gerenciado pelo Flow Appoint</CardTitle>
              <CardDescription>
                Sua assinatura é controlada pelo sistema de agendamento
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-cyan-900 text-left">
              Como o <strong>Flow Appoint</strong> está conectado, os pagamentos
              do construtor de fluxos estão inclusos no plano principal. Acesse
              o painel de agendamento para gerenciar cobranças, planos e faturas.
            </div>
          </div>
          <Button className="w-fit bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
            Abrir Flow Appoint
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ===== Cenário: Gestão própria =====
  return (
    <div className="flex flex-col gap-4">
      {/* Plano Atual + Uso */}
      <Card className="p-4 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-blue-600/5 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white">
                <Crown className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">Plano {activePlan.name}</CardTitle>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    Ativo
                  </Badge>
                </div>
                <CardDescription>
                  R$ {activePlan.price.toFixed(2).replace('.', ',')}/mês
                  {activePlan.price > 0 && ' · Próxima cobrança em 15 Abr 2026'}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Cancelar plano
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-100 rounded-lg p-4 flex flex-col gap-2 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-600 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Chatbots ativos</span>
                </div>
                <span className="text-sm text-gray-600">
                  {usage.botsUsed}/{botsLimitLabel}
                </span>
              </div>
              <Progress
                value={botsProgress}
                className="h-2"
              />
            </div>
            <div className="bg-gray-100 rounded-lg p-4 flex flex-col gap-2 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Mensagens este mês</span>
                </div>
                <span className="text-sm text-gray-600">
                  {usage.messagesUsed.toLocaleString('pt-BR')}/
                  {usage.messagesLimit.toLocaleString('pt-BR')}
                </span>
              </div>
              <Progress
                value={(usage.messagesUsed / usage.messagesLimit) * 100}
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mudar de Plano */}
      <Card className="p-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-600" />
            <CardTitle className="text-xl">Mudar de plano</CardTitle>
          </div>
          <CardDescription>
            Escolha o plano ideal para o tamanho da sua operação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl p-5 flex flex-col gap-4 transition-all text-left ${
                    plan.highlight
                      ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white border-2 border-cyan-500'
                      : 'bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  {plan.highlight && (
                    <Badge className="absolute -top-2 right-4 bg-cyan-500 text-white hover:bg-cyan-500">
                      Mais popular
                    </Badge>
                  )}
                  <div>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p
                      className={`text-xs ${
                        plan.highlight ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      {plan.description}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      R$ {plan.price}
                    </span>
                    <span
                      className={`text-sm ${
                        plan.highlight ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      /mês
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2
                          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                            plan.highlight ? 'text-cyan-400' : 'text-emerald-600'
                          }`}
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    disabled={isCurrent}
                    onClick={() => setCurrentPlan(plan.id)}
                    className={
                      plan.highlight
                        ? 'bg-cyan-500 text-white hover:bg-cyan-400'
                        : ''
                    }
                    variant={plan.highlight ? 'default' : 'outline'}
                  >
                    {isCurrent ? 'Plano atual' : 'Selecionar'}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Forma de pagamento */}
      <Card className="p-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-cyan-600" />
            <CardTitle className="text-xl">Forma de pagamento</CardTitle>
          </div>
          <CardDescription>
            Cartão usado para a cobrança recorrente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-8 rounded bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center text-white text-[10px] font-bold">
                VISA
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">•••• •••• •••• 4242</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Expira em 09/2027
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Atualizar cartão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de faturas */}
      <Card className="p-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-cyan-600" />
            <CardTitle className="text-xl">Histórico de faturas</CardTitle>
          </div>
          <CardDescription>
            Baixe os comprovantes para a sua contabilidade
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="bg-gray-100 rounded-lg p-3 flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-white text-gray-600 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium truncate">{inv.id}</p>
                  <p className="text-xs text-gray-500">{inv.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{inv.amount}</span>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  Pago
                </Badge>
                <Button variant="ghost" size="icon">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
