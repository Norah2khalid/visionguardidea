import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Brain,
  Eye,
  Lightbulb,
  Megaphone,
  Menu,
  MousePointerClick,
  Radar,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  Users,
  X as XIcon,
  Zap,
  Info,
  Scale,
} from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import { Logos } from "@/components/site/Logos";
import { Reveal, SectionHeading } from "@/components/site/Reveal";
import { IdeaHelper } from "@/components/site/IdeaHelper";
import { Button } from "@/components/ui/button";

import {
  CHALLENGE_ONE,
  CHALLENGE_TWO,
  EVENT_NAME,
  GOALS,
  HERO,
  IMPACT,
  MECHANISM,
  NAV,
  TAGLINE,
  HELPERS,
  UI,
} from "@/lib/content";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ابتكار حلول رقمية لمواجهة التضليل الإعلامي" },
      {
        name: "description",
        content:
          "استكشف تحديات مواجهة التضليل الإعلامي وطوّر فكرتك الخاصة باستخدام مساعدات إرشادية مخصصة.",
      },
      { property: "og:title", content: "ابتكار حلول رقمية لمواجهة التضليل الإعلامي" },
      {
        property: "og:description",
        content:
          "فعالية ابتكار الحلول الرقمية لمواجهة التضليل الإعلامي — التحديات ومساعدات تطوير الأفكار.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const stepIcons = [MousePointerClick, Target, Lightbulb, Rocket, Send];
const problemIcons = [Eye, Activity, Megaphone, BadgeCheck];
const goalIcons = [ShieldCheck, Sparkles, Users, Zap, Lightbulb];
const impactIcons = [Search, TrendingDown, Brain, Info, Scale];

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b bg-card/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <Logos />
      </div>
      <nav className="border-t">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          <a href="#top" className="font-display text-sm font-bold text-foreground">
            {UI.brand}
          </a>
          <div className="hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {n.label}
              </a>
            ))}
            <Button asChild size="sm" className="bg-gradient-brand">
              <a href="#challenges">{UI.helpersLink}</a>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={UI.menu}
            onClick={() => setOpen(!open)}
          >
            {open ? <XIcon className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
        {open && (
          <div className="flex flex-col gap-1 border-t px-4 py-3 md:hidden">
            {[...NAV, { href: "#challenges", label: UI.helpersLink }].map((n) => (
              <a
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary"
              >
                {n.label}
              </a>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-navy-deep text-navy-foreground"
    >
      <img
        src={heroBg}
        alt=""
        width={1920}
        height={1088}
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-80"
      />
      <div className="absolute inset-0 -z-10 grid-pattern opacity-40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-deep/30 via-navy-deep/50 to-navy-deep" />
      <div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col items-center justify-center px-4 py-24 text-center">
        <span className="glass animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-glow">
          <span className="h-2 w-2 animate-pulse-glow rounded-full bg-glow" /> {EVENT_NAME}
        </span>
        <h1
          className="animate-fade-up text-4xl font-black leading-[1.25] sm:text-5xl md:text-7xl"
          style={{ animationDelay: "120ms" }}
        >
          ابتكار حلول رقمية <br className="hidden sm:block" />
          <span className="text-gradient">لمواجهة التضليل الإعلامي</span>
        </h1>
        <p
          className="animate-fade-up mt-6 max-w-3xl text-lg leading-loose text-navy-foreground/80 sm:text-xl"
          style={{ animationDelay: "240ms" }}
        >
          {HERO.description}
        </p>
        <div
          className="animate-fade-up mt-10 flex flex-col gap-4 sm:flex-row"
          style={{ animationDelay: "360ms" }}
        >
          <Button
            asChild
            size="lg"
            className="h-14 bg-gradient-brand px-8 text-base font-bold shadow-glow"
          >
            <a href="#challenges">
              {UI.explore} <ArrowLeft className="h-5 w-5" />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="glass h-14 px-8 text-base font-bold text-navy-foreground hover:bg-navy-foreground/15 hover:text-navy-foreground"
          >
            <a href="#mechanism">{UI.participate}</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Mechanism() {
  return (
    <section id="mechanism" className="scroll-mt-28 px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading eyebrow={UI.mechanismEyebrow} title={MECHANISM.title} />
        </Reveal>
        <Reveal>
          <blockquote className="mx-auto mb-16 max-w-4xl rounded-lg border-r-4 border-primary bg-card p-6 text-lg leading-loose shadow-soft sm:p-8 sm:text-xl">
            «{MECHANISM.text}»
          </blockquote>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {MECHANISM.steps.map((s, i) => {
            const Icon = stepIcons[i] ?? Sparkles;
            return (
              <Reveal key={s} delay={i * 90}>
                <div className="group relative h-full rounded-lg border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
                  <span className="absolute left-4 top-4 font-display text-4xl font-black text-secondary">
                    {i + 1}
                  </span>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-glow transition-transform group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="font-semibold leading-relaxed">{s}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Challenges() {
  return (
    <section
      id="challenges"
      className="relative scroll-mt-28 overflow-hidden bg-gradient-navy px-4 py-24 text-navy-foreground"
    >
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading eyebrow={UI.challengesEyebrow} title={UI.challengesTitle} light />
        </Reveal>

        <Reveal>
          <div className="glass rounded-lg p-6 sm:p-10">
            <div className="mb-8 flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-navy-foreground text-navy-deep">
                <span className="font-display text-2xl font-black">𝕏</span>
              </div>
              <div>
                <span className="text-sm font-semibold text-glow">{CHALLENGE_ONE.label}</span>
                <h3 className="text-2xl font-extrabold sm:text-3xl">{CHALLENGE_ONE.title}</h3>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {CHALLENGE_ONE.problems.map((p, i) => {
                const Icon = problemIcons[i] ?? Sparkles;
                const helper = HELPERS[i];
                return (
                  <div
                    key={p.title}
                    className="group rounded-lg border border-navy-foreground/10 bg-navy-deep/50 p-6 transition-all hover:border-glow/50 hover:shadow-glow"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <Icon className="h-8 w-8 text-glow" />
                      <span className="font-display text-sm font-bold text-navy-foreground/50">
                        {UI.problem} {i + 1}
                      </span>
                    </div>
                    <h4 className="mb-2 text-lg font-bold">{p.title}</h4>
                    <p className="leading-relaxed text-navy-foreground/70">{p.text}</p>
                    {helper && <IdeaHelper helper={helper} showTitle={false} />}
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-8">
          <div className="relative overflow-hidden rounded-lg bg-gradient-brand p-[1px]">
            <div className="rounded-lg bg-navy-deep p-6 sm:p-10">
              <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
                <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-brand shadow-glow">
                    <Radar className="h-12 w-12 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <span className="text-sm font-semibold text-glow">{CHALLENGE_TWO.label}</span>
                  <h3 className="mt-1 text-2xl font-extrabold leading-snug sm:text-3xl">
                    {CHALLENGE_TWO.title}
                  </h3>
                  <p className="mt-4 text-lg leading-relaxed text-navy-foreground/75">
                    {CHALLENGE_TWO.text}
                  </p>
                </div>
              </div>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                {HELPERS.slice(4).map((helper) => (
                  <div key={helper.id}>
                    <IdeaHelper helper={helper} flush />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Goals() {
  return (
    <section id="goals" className="scroll-mt-28 px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading eyebrow={UI.goalsEyebrow} title={UI.goalsTitle} />
        </Reveal>
        <div className="flex flex-wrap justify-center gap-5">
          {GOALS.map((g, i) => {
            const Icon = goalIcons[i] ?? Sparkles;
            return (
              <Reveal
                key={g}
                delay={i * 80}
                className="w-full sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
              >
                <div className="flex h-full items-start gap-4 rounded-lg border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:border-primary/40">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="pt-2 text-lg font-semibold leading-relaxed">{g}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Impact() {
  return (
    <section className="relative overflow-hidden bg-navy-deep px-4 py-24 text-navy-foreground">
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading eyebrow={UI.impactEyebrow} title={IMPACT.title} light />
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {IMPACT.items.map((t, i) => {
            const Icon = impactIcons[i] ?? Sparkles;
            return (
              <Reveal key={t} delay={i * 80}>
                <div className="glass flex h-full flex-col items-center rounded-lg p-6 text-center transition-all hover:shadow-glow">
                  <div
                    className="mb-4 flex h-14 w-14 animate-float items-center justify-center rounded-full bg-gradient-brand"
                    style={{ animationDelay: `${i * 400}ms` }}
                  >
                    <Icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <p className="font-semibold leading-relaxed">{t}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gradient-navy px-4 pb-8 pt-16 text-navy-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-lg bg-card p-5">
          <Logos />
        </div>
        <div className="mt-10 grid gap-8 text-center md:grid-cols-2 md:text-right">
          <div>
            <h3 className="text-xl font-extrabold">{EVENT_NAME}</h3>
            <p className="mt-2 text-lg text-gradient font-bold">{TAGLINE}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 md:justify-end">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-navy-foreground/75 hover:text-glow">
                {n.label}
              </a>
            ))}
            <a href="#challenges" className="font-semibold text-glow">
              {UI.helpersLink}
            </a>
          </div>
        </div>
        <div className="mt-10 border-t border-navy-foreground/10 pt-6 text-center text-sm text-navy-foreground/60">
          © {new Date().getFullYear()} {EVENT_NAME}. {UI.rights}
        </div>
      </div>
    </footer>
  );
}

function Index() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Mechanism />
        <Challenges />
        <Goals />
        <Impact />
      </main>
      <Footer />
    </div>
  );
}
