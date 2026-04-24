import { Link } from "react-router-dom";

export default function LandingFooter() {
	return (
		<footer className="relative border-t border-white/5 py-12 mt-10">
			<div className="max-w-6xl mx-auto px-6">
				<div className="grid sm:grid-cols-4 gap-8 mb-10">
					<div className="sm:col-span-2">
						<Link to="/" className="flex items-center gap-2 mb-3">
							<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[oklch(0.65_0.22_295)] to-[oklch(0.68_0.20_350)] flex items-center justify-center font-bold text-white text-sm">
								T
							</div>
							<span className="font-display text-lg font-semibold tracking-tight">
								TalkMap
							</span>
						</Link>
						<p className="text-sm text-muted-foreground max-w-sm">
							O construtor visual de chatbots pra times que querem automatizar
							sem ficar refém de código.
						</p>
					</div>

					<div>
						<h4 className="text-sm font-semibold mb-3 text-foreground/90">
							Produto
						</h4>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								<a href="#features" className="hover:text-foreground transition-colors">
									Recursos
								</a>
							</li>
							<li>
								<a href="#pricing" className="hover:text-foreground transition-colors">
									Planos
								</a>
							</li>
							<li>
								<a href="#how" className="hover:text-foreground transition-colors">
									Como funciona
								</a>
							</li>
						</ul>
					</div>

					<div>
						<h4 className="text-sm font-semibold mb-3 text-foreground/90">
							Conta
						</h4>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li>
								<Link to="/login" className="hover:text-foreground transition-colors">
									Entrar
								</Link>
							</li>
							<li>
								<Link to="/signup" className="hover:text-foreground transition-colors">
									Criar conta
								</Link>
							</li>
							<li>
								<a href="#faq" className="hover:text-foreground transition-colors">
									FAQ
								</a>
							</li>
						</ul>
					</div>
				</div>

				<div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
					<p>© {new Date().getFullYear()} TalkMap. Todos os direitos reservados.</p>
					<p>Feito com ☕ no Brasil</p>
				</div>
			</div>
		</footer>
	);
}
