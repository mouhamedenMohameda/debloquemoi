import Groq from "groq-sdk";

// Lazy : on n'instancie le client qu'au premier appel, pour éviter
// que l'app crashe au chargement si la clé n'est pas (encore) fournie.
let _client: Groq | null = null;
function client(): Groq {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.startsWith("gsk_xxx") || apiKey.length < 20) {
      throw new Error(
        "GROQ_API_KEY manquante ou invalide. Édite app/.env.local et relance `npm run dev`.",
      );
    }
    _client = new Groq({ apiKey });
  }
  return _client;
}

// Modèle de raisonnement : GPT-OSS-120B d'OpenAI (open weights, servi par Groq).
// MoE 120B paramètres — très solide en maths et raisonnement.
export const DEFAULT_MODEL = "openai/gpt-oss-120b";
export const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// Retire les blocs <think>...</think> émis par les modèles de raisonnement.
function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    .trim();
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type Usage = {
  prompt: number;
  completion: number;
  total: number;
  model: string;
};

function toUsage(
  raw: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  model: string,
): Usage {
  return {
    prompt: raw?.prompt_tokens ?? 0,
    completion: raw?.completion_tokens ?? 0,
    total: raw?.total_tokens ?? 0,
    model,
  };
}

// Plafond généreux par défaut (16k tokens) : sans ça, Groq applique un plafond
// par défaut (souvent 8k) qui tronque les réponses longues (exercices à plusieurs
// questions, démonstrations détaillées, etc.).
const DEFAULT_MAX_TOKENS = 16384;

export async function chat(
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number } = {},
): Promise<{ content: string; usage: Usage; finishReason?: string }> {
  const model = opts.model ?? DEFAULT_MODEL;
  const completion = await client().chat.completions.create({
    model,
    messages,
    temperature: 0.4,
    max_completion_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
  });
  const finishReason = completion.choices[0]?.finish_reason;
  if (finishReason === "length" && process.env.NODE_ENV !== "production") {
    console.warn(
      `[groq] Response truncated at ${completion.usage?.completion_tokens} tokens. Consider increasing max.`,
    );
  }
  const raw = completion.choices[0]?.message?.content ?? "";
  return {
    content: stripThinking(raw),
    usage: toUsage(completion.usage, model),
    finishReason,
  };
}

export async function extractTextFromImage(
  imageDataUrl: string,
): Promise<{ text: string; usage: Usage }> {
  const completion = await client().chat.completions.create({
    model: VISION_MODEL,
    temperature: 0,
    max_completion_tokens: 800,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Tu es un OCR spécialisé en mathématiques.
Transcris fidèlement le texte de l'image ci-dessous (énoncé d'un exercice de Bac).
- Utilise LaTeX entre $...$ pour les formules.
- Ne réponds PAS à l'exercice, transcris seulement.
- Si l'image ne contient pas un énoncé lisible, réponds exactement: "IMAGE_INVALIDE".`,
          },
          {
            type: "image_url",
            image_url: { url: imageDataUrl },
          },
        ],
      },
    ],
  });
  return {
    text: completion.choices[0]?.message?.content?.trim() ?? "",
    usage: toUsage(completion.usage, VISION_MODEL),
  };
}
