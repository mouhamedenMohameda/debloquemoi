import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { getTranslationsServer } from "@/lib/i18n";

export async function generateMetadata() {
  const { t } = await getTranslationsServer();
  return {
    title: `${t.auth.loginTitle} — Débloque-moi`,
  };
}

export default async function LoginPage() {
  const { t } = await getTranslationsServer();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/40 to-emerald-50/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-2xl text-white shadow-lg">
            🎓
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900">
            {t.auth.loginTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t.auth.loginSubtitle}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-sm text-slate-600">
          {t.auth.noAccount}{" "}
          <Link
            href="/register"
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            {t.auth.registerLink}
          </Link>
        </p>
      </div>
    </div>
  );
}

