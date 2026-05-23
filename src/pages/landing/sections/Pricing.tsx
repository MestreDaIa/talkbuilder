import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useGsapContext, gsap } from "../../../hooks/useGsap";
import { PLAN_LABELS, type PlanId } from "../../../context/PlanContext";

const plans: {
  id: PlanId;
  price: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: "starter",
    price: "R$ 49",
    tagline: "Pra começar e validar",
    features: [
      "1 chatbot",
      "1.000 mensagens/mês",
      "1 conexão para WhatsApp",
      "Editor visual completo",
      "Widget pro site",
    ],
  },
  {
    id: "pro",
    price: "R$ 97",
    tagline: "Pra times que escalam",
    features: [
      "3 chatbots",
      "10.000 mensagens/mês",
      "3 conexões para WhatsApp",
      "API de Integrações",
      "Fluxos avançados",
      "Suporte por email",
    ],
  },
  {
    id: "business",
    price: "R$ 149",
    tagline: "Pra operações sérias",
    highlight: true,
    features: [
      "Bots ilimitados",
      "50.000 mensagens/mês",
      "10 conexões para WhatsApp",
      "Múltiplos atendentes",
      "Templates premium",
      "API completa",
      "Onboarding 1:1",
      "Suporte prioritário",
    ],
  },
];

export default function Pricing() {
  const ref = useGsapContext<HTMLDivElement>(() => {
    gsap.from("[data-plan]", {
      y: 50,
      opacity: 0,
      stagger: 0.12,
      duration: 0.7,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ref.current,
        start: "top 75%",
      },
    });
  }, []);

  return (
    <section id="pricing" ref={ref} className="relative py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-[#920027] mb-4 font-medium">Planos</p>
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
            Impulsione seu negócio <br /> <span className="text-gradient-violet">com o ZailomFlow.</span>
          </h2>
          <p className="text-muted-foreground mt-4">Sem letras miúdas. Cancele a qualquer momento.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-stretch pt-6 overflow-visible">
          {plans.map((p) => (
            <div
              key={p.id}
              data-plan
              className={`bento-card p-7 flex flex-col relative ${
                p.highlight
                  ? "md:scale-105 md:-my-2 border-[#460863] shadow-[0_30px_80px_-20px_rgba(146,0,39,0.45)]"
                  : ""
              }`}
            >
              {p.highlight && (
                <div className="relative -top-4 left-1/2 -translate-x-1/2 z-10 inline-flex items-center justify-center text-center gap-1 text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full bg-gradient-to-r from-[#460863] to-[#920027] text-white font-semibold shadow-lg whitespace-nowrap">
                  <Sparkles className="w-3 h-3" /> Melhor custo-benefício
                </div>
              )}
              <div className="mb-6">
                <h3 className="font-display text-2xl font-semibold mb-1">{PLAN_LABELS[p.id]}</h3>
                <p className="text-sm text-muted-foreground">{p.tagline}</p>
              </div>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="font-display text-5xl font-bold">{p.price}</span>
                {p.price !== "Grátis" && <span className="text-sm text-muted-foreground">/mês</span>}
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-[#920027] mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>
              <Link to={`/signup?plan=${p.id}`}>
                <Button
                  className={`w-full h-11 ${
                    p.highlight
                      ? "bg-[#920027] hover:bg-[#b00030] text-white border-0"
                      : "bg-white/5 hover:bg-white/10 border border-white/10 text-foreground"
                  }`}
                >
                  Escolher {PLAN_LABELS[p.id]}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
