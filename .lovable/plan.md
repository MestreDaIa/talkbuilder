## Objetivo

Reconstruir a landing page do TalkMap do zero com visual **bento/cards 3D estilo Apple/Arc**, animações GSAP cinematográficas e seções extras pra contar a história do produto. Sem mexer em nada do app autenticado — só no que o visitante deslogado vê.

## Direção visual

- **Paleta**: dark base (slate profundo `oklch(0.16 0.012 270)`) com acentos violeta vibrante (`oklch(0.62 0.21 295)`), rosa quente como secundário pra contraste, glow neon sutil em cards-chave.
- **Tipografia**: títulos gigantes (até 7xl/8xl no hero), peso bold, tracking apertado. Body em Inter. Adicionar uma fonte display de impacto via Google Fonts (Geist ou Space Grotesk) só pros headings.
- **Layout**: bento grid assimétrico (cards de tamanhos diferentes), bordas arredondadas grandes (rounded-3xl), bordas com gradient sutil, sombras coloridas (glow violeta).
- **Texturas de fundo**: noise/grain leve + grid pattern + blobs gradient blurrados parados no fundo (parallax leve).
- **Mockup do editor**: SVG/HTML estilizado representando o canvas do bot (nodes, conexões) — não vai ser screenshot real, vai ser uma "ilustração funcional" feita em divs pra animar pedaço por pedaço.

## Estrutura das seções (ordem)

1. **Nav fixa** com blur — logo TalkMap + links âncora + botão "Entrar" / "Começar grátis"
2. **Hero cinematográfico** — badge animado, título grande em duas linhas (entra palavra por palavra), subtítulo, dois CTAs, badge de "sem cartão de crédito"
3. **Faixa de canais suportados** — logos animados em fade horizontal (WhatsApp, Telegram, Instagram, Web Widget) com selo "Em breve" nos que ainda não rodam
4. **Bento de features (6 cards assimétricos)** — Editor visual, Multi-canal, Variáveis dinâmicas, Webhooks/HTTP, Templates prontos, Analytics. Card grande à esquerda com mockup animado do editor.
5. **Como funciona (3 passos)** — Conecte o canal → Monte o fluxo → Publique. Numerados, com micro-ilustrações em cada passo, pin opcional na seção.
6. **Reveal do mockup do editor** — seção dedicada com o canvas do bot crescendo no scroll, nodes "se desenhando" um por um conforme scrolla.
7. **Social proof** — 3 cards de depoimento (placeholders honestos: "Você pode ser o próximo" + 2 fictícios bem feitos), com avatares iniciais coloridas.
8. **Pricing** — repaginado em bento (3 cards, o do meio "Pro" maior e com glow), animação de hover em escala leve, badge "Mais escolhido".
9. **FAQ** — 6 perguntas em accordion (Radix), animação de abertura suave.
10. **CTA final** — bloco grande com gradient, título forte, dois CTAs.
11. **Footer** — links institucionais, redes, copyright.

## Animações (GSAP + ScrollTrigger)

- **Hero**: timeline na entrada — badge desce com bounce, título entra palavra por palavra (SplitText manual via spans), subtítulo fade-up, CTAs sobem em stagger, mockup hero faz scale-in + tilt 3D leve.
- **Reveal genérico**: cada seção tem `fade + translateY(40px)` quando entra na viewport, com stagger nos filhos.
- **Parallax**: blobs/grain de fundo se movem em `yPercent` diferente do scroll. Mockups dentro de cards têm parallax leve interno.
- **Mockup do editor**: ScrollTrigger com scrub — conforme scrolla, os nodes aparecem em sequência (opacity + scale), as linhas de conexão se "desenham" via stroke-dashoffset.
- **Cards bento**: tilt 3D no hover (rotateX/rotateY baseado no mouse), glow seguindo o cursor.
- **Pricing**: cards sobem em stagger ao entrar na view, o do meio com delay maior pra dar destaque.
- **Performance**: respeitar `prefers-reduced-motion` desabilitando scrubs e mantendo só fades simples.

## Detalhes técnicos

- **Dependência nova**: `gsap` (inclui ScrollTrigger no core gratuito). Instalar com `bun add gsap`.
- **Hook custom**: `src/hooks/useGsap.ts` — wrapper com `gsap.context()` pra cleanup automático em SPA, e helpers `useScrollReveal`, `useParallax`.
- **Componentização**: quebrar `LandingPage.tsx` em subcomponentes em `src/pages/landing/sections/` (Hero, Channels, FeaturesBento, HowItWorks, EditorReveal, SocialProof, Pricing, Faq, CtaFinal, LandingNav, LandingFooter). Mantém o arquivo principal limpo.
- **Mockup do editor**: componente `EditorMockup.tsx` em puro JSX/Tailwind representando 4-5 nodes conectados, com refs nomeadas pra animar.
- **Accordion FAQ**: usar `@radix-ui/react-accordion` (já vem com shadcn — checar se não precisa adicionar via shadcn add accordion).
- **Fontes**: importar Space Grotesk via `<link>` no `index.html` ou via CSS `@import` pra evitar custo de pacote.
- **Responsivo**: bento vira coluna única no mobile, animações de scroll continuam mas sem pin (pin com altura grande quebra UX em mobile).
- **Sem quebra de auth**: continua respeitando o `HomeRoute` em `App.tsx` que mostra a landing só pra deslogados.

## Cores específicas a adicionar

No `src/index.css`, adicionar variáveis usadas só na landing (escopadas em `.landing-page`):
- `--landing-bg`: oklch(0.14 0.014 270)
- `--landing-card`: oklch(0.20 0.016 270)
- `--landing-violet`: oklch(0.65 0.22 295)
- `--landing-pink`: oklch(0.68 0.20 350)
- `--landing-glow`: rgba(170, 100, 255, 0.4)

## Copys novas (direção)

- Headline: **"Construa chatbots que vendem enquanto você dorme."**
- Sub: "Conecte WhatsApp, Instagram e seu site. Monte fluxos arrastando blocos. Publique em minutos."
- Tom: direto, voltado a resultado, sem jargão técnico no topo. Detalhes técnicos aparecem nos cards de features.

## O que NÃO vai ser tocado

- Editor de bot, perfil, configs, autenticação, rotas protegidas.
- `App.tsx` só ganha import já existente — sem mudar lógica de routing.
- Nenhuma integração de canal real (WhatsApp/Telegram seguem congelados como combinado).

## Arquivos previstos

Criar:
- `src/hooks/useGsap.ts`
- `src/pages/landing/sections/LandingNav.tsx`
- `src/pages/landing/sections/Hero.tsx`
- `src/pages/landing/sections/Channels.tsx`
- `src/pages/landing/sections/FeaturesBento.tsx`
- `src/pages/landing/sections/HowItWorks.tsx`
- `src/pages/landing/sections/EditorReveal.tsx`
- `src/pages/landing/sections/EditorMockup.tsx`
- `src/pages/landing/sections/SocialProof.tsx`
- `src/pages/landing/sections/Pricing.tsx`
- `src/pages/landing/sections/Faq.tsx`
- `src/pages/landing/sections/CtaFinal.tsx`
- `src/pages/landing/sections/LandingFooter.tsx`

Editar:
- `src/pages/landing/LandingPage.tsx` (vira composição das seções + setup GSAP global)
- `src/index.css` (variáveis da landing + grain/grid utilitários)
- `index.html` (link Google Fonts pra Space Grotesk)
- `package.json` via `bun add gsap`

Quer que eu mande ver assim ou tem algum ajuste? Se aprovar, eu já começo.