import { NextRequest, NextResponse } from "next/server";
import { extractTextFromImage } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = { imageDataUrl: string };

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY manquante." }, { status: 500 });
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const { imageDataUrl } = body;
  if (!imageDataUrl?.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Image attendue (data URL)." },
      { status: 400 },
    );
  }
  // Limite ~6 MB de payload après base64 (Groq accepte jusqu'à ~20 MB mais on évite les abus)
  if (imageDataUrl.length > 8_000_000) {
    return NextResponse.json(
      { error: "Image trop lourde (>6 MB). Réduis la résolution." },
      { status: 413 },
    );
  }
  try {
    const { text, usage } = await extractTextFromImage(imageDataUrl);
    if (text === "IMAGE_INVALIDE" || text.length < 5) {
      return NextResponse.json(
        { error: "Énoncé illisible. Reprends la photo, bien cadrée et nette.", usage },
        { status: 422 },
      );
    }
    return NextResponse.json({ text, usage });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: `Erreur Groq: ${message}` }, { status: 500 });
  }
}
