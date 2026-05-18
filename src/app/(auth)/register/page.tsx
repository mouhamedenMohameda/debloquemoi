import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export const metadata = {
  title: "Créer un compte — Débloque-moi",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/40 to-emerald-50/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-2xl text-white shadow-lg">
            🎓
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900">
            Créer un compte
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            🎁 <strong>10 corrections gratuites</strong> pendant 24h à l&apos;inscription
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
          <RegisterForm />
        </div>

        <p className="mt-4 text-center text-sm text-slate-600">
          Déjà inscrit ?{" "}
          <Link
            href="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
