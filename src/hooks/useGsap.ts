import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
	gsap.registerPlugin(ScrollTrigger);
}

/**
 * Wraps a GSAP setup function inside a gsap.context tied to a scope ref.
 * Auto-cleans on unmount, safe for HMR and SPA navigation.
 */
export function useGsapContext<T extends HTMLElement = HTMLDivElement>(
	setup: (self: gsap.Context) => void,
	deps: React.DependencyList = [],
) {
	const ref = useRef<T | null>(null);

	useEffect(() => {
		if (!ref.current) return;
		const reduced =
			typeof window !== "undefined" &&
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

		const ctx = gsap.context((self) => {
			if (reduced) {
				// minimal fallback — just make everything visible
				gsap.set("[data-anim]", { opacity: 1, y: 0, x: 0, scale: 1 });
				return;
			}
			setup(self);
		}, ref);

		return () => ctx.revert();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);

	return ref;
}

export { gsap, ScrollTrigger };
