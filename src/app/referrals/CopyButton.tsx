"use client";

import { useState } from "react";
import { useTranslation } from "@/components/LanguageProvider";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  async function onClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97] cursor-pointer"
    >
      {copied ? `✅ ${t.common.copied}` : `📋 ${label || t.common.copy}`}
    </button>
  );
}

export function ShareWhatsAppButton({ text, label }: { text: string; label?: string }) {
  const { t } = useTranslation();
  const href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.97]"
    >
      <span>💬</span>
      <span>{label || t.referrals.whatsappShareBtn}</span>
    </a>
  );
}

