import { LOGOS } from "@/lib/content";
import { cn } from "@/lib/utils";

export function Logos({ className }: { className?: string }) {
  return (
    <div className={cn("mx-auto grid w-full max-w-2xl grid-cols-3 items-center gap-3 bg-logo-surface sm:gap-10", className)}>
      {LOGOS.map((logo) => (
        <div key={logo.name} className="flex h-20 min-w-0 items-center justify-center bg-logo-surface p-1 sm:h-24 sm:p-2">
          <img src={logo.src} alt={logo.name} className="h-full w-full object-contain" />
        </div>
      ))}
    </div>
  );
}
