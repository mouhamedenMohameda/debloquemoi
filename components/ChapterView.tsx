/**
 * Vue élève d'un chapitre (mobile) : pour chaque notion, les années où elle est
 * tombée au bac, le cours validé et les exercices avec leur correction.
 * Équivalent mobile de app/src/components/ChapterView.tsx (sans infos admin).
 *
 * Les formules sont rendues par MathMarkdown (une WebView par bloc) : on ne
 * les monte qu'à l'ouverture d'un bloc pour garder l'écran léger.
 */
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { MathMarkdown } from "@/components/MathMarkdown";
import { useTranslation } from "@/lib/i18n";

export type Occurrence = {
  id: string;
  annee: number;
  session: string;
  exercice_numero: string | number;
  chapitre: string;
  enonce: string;
  correction: string | null;
};

export type ChapterNotion = {
  notion_id: string;
  label: string;
  lesson: string | null;
  years: number[];
  occurrences: Occurrence[];
};

export function sessionLabel(s: string, ar: boolean): string {
  const compl = /compl/i.test(s);
  if (ar) return compl ? "الدورة التكميلية" : "الدورة العادية";
  return compl ? "session complémentaire" : "session normale";
}

function Chip({ label, onPress, tone = "slate" }: { label: string; onPress: () => void; tone?: "slate" | "indigo" | "emerald" }) {
  const bg = tone === "indigo" ? "bg-indigo-50" : tone === "emerald" ? "bg-emerald-50" : "bg-slate-100";
  const fg = tone === "indigo" ? "text-indigo-700" : tone === "emerald" ? "text-emerald-700" : "text-slate-700";
  return (
    <Pressable onPress={onPress} className={`self-start rounded-full px-3 py-1.5 ${bg} active:opacity-70`}>
      <Text className={`text-xs font-semibold ${fg}`}>{label}</Text>
    </Pressable>
  );
}

function OccurrenceRow({ o }: { o: Occurrence }) {
  const { locale } = useTranslation();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);
  const [showCorr, setShowCorr] = useState(false);
  return (
    <View className="rounded-xl border border-slate-200 mb-2">
      <Pressable onPress={() => setOpen((v) => !v)} className="flex-row justify-between items-center px-3 py-2.5 active:bg-slate-50">
        <Text className="text-sm font-semibold text-slate-800 flex-1">
          {ar
            ? `باك ${o.annee} · ${sessionLabel(o.session, true)} · التمرين ${o.exercice_numero}`
            : `Bac ${o.annee} · ${sessionLabel(o.session, false)} · Exercice ${o.exercice_numero}`}
        </Text>
        <Text className="text-xs text-slate-500">{open ? (ar ? "إخفاء" : "Masquer") : ar ? "عرض" : "Voir"}</Text>
      </Pressable>
      {open && (
        <View className="border-t border-slate-100 px-2 py-2">
          <MathMarkdown markdown={o.enonce || (ar ? "_النص غير متوفر._" : "_Énoncé indisponible._")} />
          {o.correction ? (
            <View className="mt-2">
              <Chip
                tone="indigo"
                label={showCorr ? (ar ? "إخفاء التصحيح" : "Masquer la correction") : ar ? "عرض التصحيح" : "Voir la correction"}
                onPress={() => setShowCorr((v) => !v)}
              />
              {showCorr && (
                <View className="mt-2 rounded-lg bg-slate-50 p-1">
                  <MathMarkdown markdown={o.correction} />
                </View>
              )}
            </View>
          ) : (
            <Text className="mt-2 text-xs text-slate-500">{ar ? "التصحيح غير متوفر بعد." : "Correction pas encore disponible."}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function NotionCard({ n }: { n: ChapterNotion }) {
  const { locale } = useTranslation();
  const ar = locale === "ar";
  const [lesson, setLesson] = useState(false);
  const [list, setList] = useState(false);
  const count = n.occurrences.length;
  return (
    <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
      <Text className="text-base font-bold text-slate-900">{n.label}</Text>

      {n.years.length > 0 ? (
        <View className="flex-row flex-wrap items-center mt-2" style={{ gap: 6 }}>
          <Text className="text-xs text-slate-500">{ar ? "جاء في الباكالوريا سنة" : "Tombé au bac en"}</Text>
          {n.years.map((y) => (
            <View key={y} className="rounded-full bg-indigo-50 px-2 py-0.5">
              <Text className="text-xs font-semibold text-indigo-700">{y}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="mt-2 text-xs text-slate-500">
          {ar ? "لا يوجد تمرين باكالوريا متاح لهذا المفهوم." : "Aucun exercice de bac disponible pour cette notion."}
        </Text>
      )}

      <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
        {n.lesson && (
          <Chip
            tone="emerald"
            label={lesson ? (ar ? "إغلاق الدرس" : "Fermer le cours") : ar ? "📖 قراءة الدرس" : "📖 Lire le cours"}
            onPress={() => setLesson((v) => !v)}
          />
        )}
        {count > 0 && (
          <Chip
            label={
              list
                ? ar ? "إخفاء التمارين" : "Masquer les exercices"
                : ar
                  ? count > 1 ? `عرض التمارين (${count})` : "عرض التمرين"
                  : count > 1 ? `Voir les ${count} exercices` : "Voir l'exercice"
            }
            onPress={() => setList((v) => !v)}
          />
        )}
      </View>

      {lesson && n.lesson && (
        <View className="mt-2 rounded-lg bg-slate-50 p-1">
          <MathMarkdown markdown={n.lesson} />
        </View>
      )}
      {list && (
        <View className="mt-3">
          {n.occurrences.map((o) => (
            <OccurrenceRow key={o.id} o={o} />
          ))}
        </View>
      )}
    </View>
  );
}

export function ChapterView({ notions }: { notions: ChapterNotion[] }) {
  return (
    <View>
      {notions.map((n) => (
        <NotionCard key={n.notion_id} n={n} />
      ))}
    </View>
  );
}
