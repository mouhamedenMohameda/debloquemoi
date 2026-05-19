import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import HomeClient from "./HomeClient";

export const metadata = {
  title: "Débloque-moi",
};

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <HomeClient userId={session.user_id} />;
}
