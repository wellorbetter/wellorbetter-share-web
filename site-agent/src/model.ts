import type { ZodType } from "zod";

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function hasModel(): boolean {
  return Boolean(process.env.AGENT_MODEL_API_KEY ?? process.env.OPENAI_API_KEY);
}

export async function askJson<T>(args: {
  system: string;
  prompt: string;
  schema: ZodType<T>;
  temperature?: number;
}): Promise<T> {
  const apiKey = process.env.AGENT_MODEL_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing AGENT_MODEL_API_KEY / OPENAI_API_KEY");

  const base = (process.env.AGENT_MODEL_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AGENT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5-mini";

  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: args.temperature ?? 0.2,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Model ${response.status}: ${await response.text()}`);
  }

  const body = await response.json() as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("Model returned empty content");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(content));
  } catch (error) {
    throw new Error(`Model returned invalid JSON: ${String(error)}`);
  }

  const result = args.schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Model JSON failed schema validation: ${result.error.message}`);
  }
  return result.data;
}
