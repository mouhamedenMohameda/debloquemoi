import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Camera,
  Compass,
  ChartLine,
  GraduationCap,
  Lightbulb,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";

import { RevealOnScroll } from "./RevealOnScroll";

export const metadata: Metadata = {
  title: "Débloque-moi · Révise le bac, indice par indice",
  description:
    "Photographie un exercice. Reçois des indices ciblés, pas la solution. Progresse en maths, physique, SVT et philo.",
};

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-[#f7f8fc] text-slate-900 antialiased">
      <Nav />
      <main>
        <Hero />
        <TrustStrip />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

/* ───────────────────────── Nav ───────────────────────── */

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-[#f7f8fc]/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/landing"
          className="flex items-center gap-2 text-[15px] font-bold tracking-tight"
        >
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-600 text-white shadow-sm"
          >
            <GraduationCap size={16} weight="fill" />
          </span>
          Débloque-moi
        </Link>

        <div className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
          <a href="#features" className="hover:text-slate-900">
            Comment ça marche
          </a>
          <a href="#cta" className="hover:text-slate-900">
            Tarifs
          </a>
          <Link href="/login" className="hover:text-slate-900">
            Se connecter
          </Link>
        </div>

        <Link
          href="/register"
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-[transform,background-color] duration-150 ease-out hover:bg-slate-800 active:scale-[0.97]"
        >
          Créer un compte
          <ArrowRight size={14} weight="bold" />
        </Link>
      </nav>
    </header>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft brand wash, no neon */}
      <div
        aria-hidden
        className="absolute inset-x-0 -top-32 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_30%_30%,rgba(99,102,241,0.10),transparent_70%),radial-gradient(50%_50%_at_80%_20%,rgba(16,185,129,0.10),transparent_70%)]"
      />
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pt-16 pb-20 md:pt-24 md:pb-28 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* Left column: copy */}
        <div>
          <p className="fade-up text-xs font-semibold tracking-wider text-indigo-700 uppercase">
            Pour les lycéens en première et terminale
          </p>

          <h1
            className="fade-up mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-slate-950 md:text-5xl lg:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Débloque ton bac,
            <br />
            une question à la fois.
          </h1>

          <p
            className="fade-up mt-5 max-w-[52ch] text-[15px] leading-relaxed text-slate-600 md:text-base"
            style={{ animationDelay: "160ms" }}
          >
            Photographie un exercice de maths, physique ou SVT. Tu reçois des
            indices ciblés, pas la solution. Tu cherches d'abord, on guide
            ensuite.
          </p>

          <div
            className="fade-up mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-indigo-600 to-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-[transform,box-shadow] duration-200 ease-out hover:shadow-xl hover:shadow-indigo-200/80 active:scale-[0.97]"
            >
              Commencer gratuitement
              <ArrowRight
                size={16}
                weight="bold"
                className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 transition-[transform,background-color] duration-150 ease-out hover:bg-slate-50 active:scale-[0.97]"
            >
              Voir comment ça marche
            </Link>
          </div>

          <p
            className="fade-up mt-5 flex items-center gap-2 text-xs text-slate-500"
            style={{ animationDelay: "320ms" }}
          >
            <ShieldCheck size={14} weight="duotone" className="text-emerald-600" />
            10 indices offerts. Sans carte bancaire.
          </p>
        </div>

        {/* Right column: photo */}
        <div
          className="fade-up relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-100 shadow-2xl shadow-slate-300/40 lg:aspect-[5/6]"
          style={{ animationDelay: "200ms" }}
        >
          <img
            src="https://picsum.photos/seed/lycee-cahier-maths-paris/1100/1320"
            alt="Cahier d'exercices ouvert sur une équation manuscrite, lumière de fin d'après-midi"
            width={1100}
            height={1320}
            className="h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Trust strip ───────────────────────── */

function TrustStrip() {
  const items = [
    "Maths spécialité",
    "Physique-chimie",
    "SVT",
    "Philosophie",
    "Maths complémentaires",
  ];
  return (
    <section
      aria-label="Matières couvertes"
      className="border-y border-slate-200/70 bg-white"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between md:gap-10">
        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Programmes couverts
        </p>
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-700">
          {items.map((item) => (
            <li key={item} className="whitespace-nowrap">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────────────────────── Features (zig-zag) ───────────────────────── */

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  Icon: React.ComponentType<{ size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"; className?: string }>;
  image: string;
  alt: string;
};

const FEATURES: Feature[] = [
  {
    eyebrow: "L'approche",
    title: "Des indices, jamais la réponse",
    body:
      "Pour chaque exercice, trois niveaux d'indices progressifs. Tu cherches d'abord, on guide ensuite. Tu apprends à raisonner, pas à recopier.",
    bullets: [
      "Indice n°1 : on pose le cadre",
      "Indice n°2 : on oriente la méthode",
      "Indice n°3 : on déverrouille le blocage",
    ],
    Icon: Lightbulb,
    image:
      "https://picsum.photos/seed/equations-manuscrites-cahier-bac/1200/900",
    alt: "Équations manuscrites annotées au stylo sur un cahier d'élève",
  },
  {
    eyebrow: "Le format",
    title: "Photo, texte ou les deux",
    body:
      "Prends ton exercice en photo, ou tape-le. L'OCR maths gère les fractions, les intégrales et les schémas. Tu restes dans ton flow.",
    bullets: [
      "Reconnaissance des formules LaTeX",
      "Schémas, tableaux, énoncés longs",
      "Disponible sur mobile et ordinateur",
    ],
    Icon: Camera,
    image:
      "https://picsum.photos/seed/smartphone-photo-cahier-lyceen/1200/900",
    alt: "Un smartphone photographie un cahier de maths sur un bureau d'étudiant",
  },
  {
    eyebrow: "Le suivi",
    title: "Reviens là où tu as bloqué",
    body:
      "Chaque exercice résolu reste dans ton historique. Pas de mur de stats culpabilisant. Juste ce qu'il faut pour reprendre le fil.",
    bullets: [
      "Historique consultable hors ligne",
      "Retour sur les notions à revoir",
      "Aucun classement, aucun ranking public",
    ],
    Icon: ChartLine,
    image:
      "https://picsum.photos/seed/agenda-revisions-bac-bureau/1200/900",
    alt: "Agenda de révisions ouvert avec post-it colorés et stylo posé",
  },
];

function Features() {
  return (
    <section id="features" className="bg-[#f7f8fc] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <RevealOnScroll>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wider text-indigo-700 uppercase">
              Comment ça marche
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl lg:text-5xl">
              Un outil construit autour de ta progression, pas de ton temps
              d'écran.
            </h2>
          </div>
        </RevealOnScroll>

        <div className="mt-16 flex flex-col gap-20 md:gap-28">
          {FEATURES.map((feature, i) => (
            <FeatureRow key={feature.title} feature={feature} reverse={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ feature, reverse }: { feature: Feature; reverse: boolean }) {
  const { Icon } = feature;
  return (
    <RevealOnScroll>
      <div
        className={`grid grid-cols-1 items-center gap-10 md:gap-14 lg:grid-cols-2 ${
          reverse ? "lg:[&>div:first-child]:order-2" : ""
        }`}
      >
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-semibold tracking-wider text-indigo-700 uppercase">
            <Icon size={14} weight="duotone" />
            {feature.eyebrow}
          </div>
          <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
            {feature.title}
          </h3>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-slate-600">
            {feature.body}
          </p>
          <ul className="mt-6 space-y-3">
            {feature.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm text-slate-700">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-indigo-100 text-indigo-700"
                >
                  <Compass size={12} weight="bold" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-100 shadow-xl shadow-slate-300/30">
          <img
            src={feature.image}
            alt={feature.alt}
            width={1200}
            height={900}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </RevealOnScroll>
  );
}

/* ───────────────────────── CTA ───────────────────────── */

function CTA() {
  return (
    <section id="cta" className="px-6 pb-24 md:pb-32">
      <RevealOnScroll>
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-emerald-600 px-8 py-16 text-center shadow-2xl shadow-indigo-300/40 md:px-16 md:py-20">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
            Prêt à attaquer ta révision ?
          </h2>
          <p className="mx-auto mt-4 max-w-[48ch] text-[15px] leading-relaxed text-white/85 md:text-base">
            Commence avec 10 indices offerts. Tu décides ensuite si tu
            continues.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-indigo-700 shadow-lg shadow-indigo-900/20 transition-[transform,background-color] duration-200 ease-out hover:bg-slate-50 active:scale-[0.97]"
            >
              Créer mon compte
              <ArrowRight size={16} weight="bold" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/35 bg-transparent px-6 py-3.5 text-sm font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-white/10 active:scale-[0.97]"
            >
              J'ai déjà un compte
            </Link>
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-indigo-600 to-emerald-600 text-white"
          >
            <GraduationCap size={13} weight="fill" />
          </span>
          Débloque-moi
        </div>
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <li>
            <Link href="/login" className="hover:text-slate-800">
              Se connecter
            </Link>
          </li>
          <li>
            <Link href="/register" className="hover:text-slate-800">
              S'inscrire
            </Link>
          </li>
          <li>
            <a href="#features" className="hover:text-slate-800">
              Fonctionnalités
            </a>
          </li>
          <li>
            <span>© {new Date().getFullYear()} Débloque-moi</span>
          </li>
        </ul>
      </div>
    </footer>
  );
}

