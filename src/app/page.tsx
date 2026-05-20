import { redirect } from "next/navigation";

import { AuthApiError, creditsMe, walletInfo } from "@/lib/auth-api";
import { getJwt, getSession } from "@/lib/session";
import HomeClient from "./HomeClient";

export const metadata = {
  title: "Débloque-moi",
};

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Crédits courants : utilisés pour limiter le nombre de photos en attente
  // (chaque OCR estime 1 MRU pour la vérification du solde). Si une erreur survient, on
  // démarre prudemment à 0.
  const jwt = await getJwt();
  const [walletRes, creditsRes] = await Promise.all([
    walletInfo(session.user_id).catch((e) => {
      if (!(e instanceof AuthApiError)) console.error("page walletInfo error", e);
      return null;
    }),
    jwt
      ? creditsMe(jwt).catch((e) => {
          if (!(e instanceof AuthApiError)) console.error("page creditsMe error", e);
          return null;
        })
      : Promise.resolve(null),
  ]);

  return (
    <HomeClient
      userId={session.user_id}
      balanceMru={walletRes?.balance_mru ?? 0}
      freeHintsRemaining={creditsRes?.free_hints_remaining ?? 0}
    />
  );
}
