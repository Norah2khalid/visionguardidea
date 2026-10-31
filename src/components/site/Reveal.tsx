import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, light }: { eyebrow?: string; title: string; light?: boolean }) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center">
      {eyebrow && (
        <span className={cn("mb-3 inline-block rounded-full px-4 py-1 text-sm font-medium", light ? "glass text-glow" : "bg-secondary text-primary")}>
          {eyebrow}
        </span>
      )}
      <h2 className={cn("text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl", light ? "text-navy-foreground" : "text-foreground")}>
        {title}
      </h2>
      <div className="mx-auto mt-5 h-1 w-20 rounded-full bg-gradient-brand" />
    </div>
  );
}
