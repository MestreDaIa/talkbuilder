import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { useEffect, useState } from "react";
import logoMark from "../../../assets/logo-mark.svg";
import logoWordmark from "../../../assets/logo-wordmark.svg";

export default function LandingNav() {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 20);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<header
			className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
				scrolled
					? "bg-background/70 backdrop-blur-xl border-b border-border/60"
					: "bg-transparent"
			}`}
		>
			<div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
				<Link to="/" className="flex items-center gap-2">
					<img src={logoMark} alt="ZyloFlow" className="h-8 w-auto" />
					<img src={logoWordmark} alt="ZyloFlow" className="h-6 w-auto" />
				</Link>

				<nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
					<a href="#features" className="hover:text-foreground transition-colors">
						Recursos
					</a>
					<a href="#how" className="hover:text-foreground transition-colors">
						Como funciona
					</a>
					<a href="#pricing" className="hover:text-foreground transition-colors">
						Planos
					</a>
					<a href="#faq" className="hover:text-foreground transition-colors">
						FAQ
					</a>
				</nav>

				<div className="flex items-center gap-2">
					<Link to="/login" className="hidden sm:block">
						<Button variant="ghost" size="sm">
							Entrar
						</Button>
					</Link>
					<Link to="/signup">
						<Button
							size="sm"
							className="bg-gradient-to-r from-[#460863] to-[#920027] hover:opacity-90 text-white border-0 shadow-[0_4px_20px_-4px_rgba(146,0,39,0.6)]"
						>
							Começar grátis
						</Button>
					</Link>
				</div>
			</div>
		</header>
	);
}
