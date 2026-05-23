"use client";

import { useState } from "react";
import { SNIPPET_CATEGORIES, applySnippet } from "@/lib/latex-snippets";

type Props = {
  /** Ref vers le <textarea> contrôlé. */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Valeur courante du champ (utilisée pour construire le nouveau texte). */
  value: string;
  /** Rappelé avec la nouvelle valeur après insertion d'un snippet. */
  onChange: (v: string) => void;
};

/**
 * Barre de snippets LaTeX organisée par onglets (Bases, Vecteurs, Chimie…).
 *
 * Cliquer sur un bouton :
 *   1. Récupère la sélection dans le textarea.
 *   2. Applique le template (la sélection remplace `$|`).
 *   3. Appelle onChange() avec le texte mis à jour.
 *   4. Restaure le focus et positionne le curseur via requestAnimationFrame
 *      (après que React ait re-rendu le textarea avec la nouvelle valeur).
 */
export function LatexSnippetToolbar({ textareaRef, value, onChange }: Props) {
  const [activeCategoryId, setActiveCategoryId] = useState(
    SNIPPET_CATEGORIES[0].id,
  );

  const category =
    SNIPPET_CATEGORIES.find((c) => c.id === activeCategoryId) ??
    SNIPPET_CATEGORIES[0];

  function insert(template: string) {
    const ta = textareaRef.current;
    const selStart = ta?.selectionStart ?? 0;
    const selEnd = ta?.selectionEnd ?? selStart;

    const { text, cursorStart, cursorEnd } = applySnippet(
      template,
      value,
      selStart,
      selEnd,
    );

    onChange(text);

    // Restaurer focus + position curseur après que React ait re-rendu le textarea.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  return (
    <div className="rounded-t border border-b-0 border-slate-300 bg-slate-50">
      {/* ── Onglets de catégories ── */}
      <div className="flex overflow-x-auto border-b border-slate-200 text-[11px]">
        {SNIPPET_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategoryId(cat.id)}
            className={`whitespace-nowrap px-2 py-1.5 font-medium transition-colors ${
              cat.id === activeCategoryId
                ? "border-b-2 border-indigo-500 bg-white text-indigo-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
            title={cat.label}
          >
            <span className="mr-0.5">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Boutons de snippets ── */}
      <div className="flex flex-wrap gap-1 p-1.5">
        {category.snippets.map((s) => (
          <button
            key={s.label}
            type="button"
            title={s.description}
            onClick={() => insert(s.template)}
            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700 shadow-sm transition active:scale-95 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
