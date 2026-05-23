import LandingNav from "./sections/LandingNav";
import Hero from "./sections/Hero";
import Channels from "./sections/Channels";
import FeaturesBento from "./sections/FeaturesBento";
import HowItWorks from "./sections/HowItWorks";
import EditorReveal from "./sections/EditorReveal";
import SocialProof from "./sections/SocialProof";
import Pricing from "./sections/Pricing";
import Faq from "./sections/Faq";
import CtaFinal from "./sections/CtaFinal";
import LandingFooter from "./sections/LandingFooter";

export default function LandingPage() {
	return (
		<div className="landing-page relative min-h-svh overflow-x-hidden">
			<LandingNav />
			<main>
				<section id="hero">
					<Hero />
				</section>
				<Channels />
				<section id="features">
					<FeaturesBento />
				</section>
				<section id="how">
					<HowItWorks />
				</section>
				<EditorReveal />
				<SocialProof />
				<section id="pricing">
					<Pricing />
				</section>
				<section id="faq">
					<Faq />
				</section>
				<CtaFinal />
			</main>
			<LandingFooter />
		</div>
	);
}
