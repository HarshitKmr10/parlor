"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Stagger delay in ms, applied as a transition-delay. */
  delay?: number;
  /** Wrapper element tag. Defaults to a div. */
  as?: "div" | "li" | "section";
  className?: string;
};

const REVEAL_OFFSET = "24px";
const REVEAL_DURATION = "640ms";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isElementInViewport(node: Element): boolean {
  const rect = node.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  return rect.bottom >= 0 && rect.right >= 0 && rect.top <= viewportHeight && rect.left <= viewportWidth;
}

/**
 * Subtle fade + translate on first scroll into view.
 * Honors prefers-reduced-motion by rendering visible immediately
 * (and never registering the transform-based animation).
 *
 * The hidden pre-reveal state is a progressive enhancement only: content
 * defaults to visible, and only gets hidden-then-revealed once we've
 * confirmed IntersectionObserver is supported and the element isn't
 * already sitting in the viewport at mount (in which case there's no
 * future scroll event to trigger it). This guarantees content already in
 * view, or on a device/tool without a working observer (slow devices,
 * crawlers, screenshot/PDF tooling), is never left permanently invisible.
 */
export function Reveal({ children, delay = 0, as = "div", className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Reduced motion is resolved once at mount via a lazy initializer, so the
  // element renders in its final position from the first paint — no effect
  // needs to flip it, and no animated styles are ever attached.
  const [reducedMotion] = useState(prefersReducedMotion);
  const [isVisible, setIsVisible] = useState(true);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;

    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") return;

    if (isElementInViewport(node)) return;

    setIsVisible(false);
    setAnimate(true);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const Tag = as;
  const style = !animate
    ? undefined
    : {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translate3d(0,0,0)" : `translate3d(0,${REVEAL_OFFSET},0)`,
        transition: `opacity ${REVEAL_DURATION} var(--ease-out-soft) ${delay}ms, transform ${REVEAL_DURATION} var(--ease-out-soft) ${delay}ms`,
        willChange: isVisible ? "auto" : "opacity, transform",
      };

  return (
    <Tag ref={ref as never} className={className} style={style}>
      {children}
    </Tag>
  );
}
