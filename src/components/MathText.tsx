"use client";

import { Component, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { sanitizeLatex, KATEX_MACROS } from "@/lib/latex-sanitize";

/**
 * Rendu Markdown + LaTeX avec stratégie de fallback à plusieurs couches :
 *
 *   1. **Sanitization du texte** (sanitizeLatex) — normalise les délimiteurs
 *      LaTeX, corrige les typos courants, enveloppe les commandes brutes.
 *
 *   2. **KaTeX permissif** — strict:false + throwOnError:false → quand une
 *      expression est cassée, KaTeX l'affiche en rouge plutôt que de planter.
 *
 *   3. **Macros KaTeX** — raccourcis pédagogiques courants (\R, \N, \implies…)
 *      pris en charge nativement.
 *
 *   4. **ErrorBoundary** — si malgré tout react-markdown crash (rarissime),
 *      on affiche le texte brut dans un `<pre>` pour ne JAMAIS perdre l'info.
 */
export function MathText({ text }: { text: string }) {
  const normalized = useMemo(() => sanitizeLatex(text), [text]);

  return (
    <MathErrorBoundary fallback={text}>
      <div className="prose-math text-[15px] leading-relaxed text-slate-800">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[
            [
              rehypeKatex,
              {
                strict: false,
                throwOnError: false,
                errorColor: "#dc2626",
                macros: KATEX_MACROS,
                // Trust mode pour autoriser plus de constructions
                trust: true,
              },
            ],
          ]}
          components={{
            h1: ({ children }) => (
              <h1 className="mb-3 mt-2 text-xl font-bold text-slate-900">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mb-2 mt-4 text-lg font-bold text-slate-900">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mb-2 mt-3 text-base font-semibold text-slate-900">
                {children}
              </h3>
            ),
            p: ({ children }) => <p className="my-2.5">{children}</p>,
            strong: ({ children }) => (
              <strong className="font-semibold text-slate-900">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-slate-700">{children}</em>
            ),
            ul: ({ children }) => (
              <ul className="my-2 ml-5 list-disc space-y-1.5">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="my-2 ml-5 list-decimal space-y-2">{children}</ol>
            ),
            li: ({ children }) => <li className="pl-1">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="my-3 border-l-4 border-indigo-300 bg-indigo-50/50 px-4 py-2 italic text-slate-700">
                {children}
              </blockquote>
            ),
            code: ({ className, children }) => {
              const inline = !className;
              if (inline) {
                return (
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800">
                    {children}
                  </code>
                );
              }
              return (
                <code className="block overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[13px] text-slate-100">
                  {children}
                </code>
              );
            },
            hr: () => <hr className="my-4 border-slate-200" />,
            table: ({ children }) => (
              <div className="my-3 overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border-b border-slate-300 bg-slate-50 px-3 py-2 text-left font-semibold">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-b border-slate-100 px-3 py-2">{children}</td>
            ),
          }}
        >
          {normalized}
        </ReactMarkdown>
      </div>
    </MathErrorBoundary>
  );
}

// ─── ErrorBoundary : dernier filet de sécurité ────────────────────────────
// Si KaTeX ou react-markdown crash, on affiche le texte brut + un message.
// L'élève ne perd JAMAIS l'information générée.

type EBState = { hasError: boolean };

class MathErrorBoundary extends Component<
  { children: ReactNode; fallback: string },
  EBState
> {
  state: EBState = { hasError: false };

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  componentDidCatch(err: Error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("MathText render error:", err);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
            ⚠️ Rendu LaTeX échoué — affichage brut
          </div>
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-slate-800">
            {this.props.fallback}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
