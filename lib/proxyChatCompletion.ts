/**
 * OpenAI 兼容的 /v1/chat/completions 转发（服务端使用，密钥不出前端）
 */

export interface ProxySecrets {
  apiKey: string;
  baseURL: string;
}

export type ChatMessageInput = { role: string; content: string };

export function sanitizeChatCompletionBody(input: unknown): {
  model: string;
  messages: ChatMessageInput[];
  temperature?: number;
} | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (typeof o.model !== "string" || !Array.isArray(o.messages)) return null;
  const messages: ChatMessageInput[] = [];
  for (const m of o.messages) {
    if (!m || typeof m !== "object") return null;
    const row = m as Record<string, unknown>;
    if (typeof row.role !== "string" || typeof row.content !== "string") return null;
    messages.push({ role: row.role, content: row.content });
  }
  const temperature =
    typeof o.temperature === "number" && Number.isFinite(o.temperature)
      ? o.temperature
      : undefined;
  return { model: o.model, messages, temperature };
}

export async function proxyChatCompletion(
  body: { model: string; messages: ChatMessageInput[]; temperature?: number },
  secrets: ProxySecrets
): Promise<{ status: number; text: string }> {
  const base = secrets.baseURL.replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const payload: Record<string, unknown> = {
    model: body.model,
    messages: body.messages,
  };
  if (body.temperature !== undefined) payload.temperature = body.temperature;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secrets.apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { status: res.status, text };
}

/** Vercel / 纯 Node：只读服务端变量，勿使用 VITE_（避免误把会进前端的变量当密钥源） */
export function resolveProxySecretsForServer(env: Record<string, string | undefined>): ProxySecrets | null {
  const apiKey = env.AI_API_KEY || env.OPENAI_API_KEY;
  const baseURL =
    env.AI_BASE_URL || env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!apiKey?.trim()) return null;
  return { apiKey: apiKey.trim(), baseURL: baseURL.trim() || "https://api.openai.com/v1" };
}

/** Vite 开发中间件：可回退到现有 .env 里的 VITE_AI_*，便于本地一条配置沿用 */
export function resolveProxySecretsForViteDev(env: Record<string, string | undefined>): ProxySecrets | null {
  const apiKey =
    env.AI_API_KEY || env.OPENAI_API_KEY || env.VITE_AI_API_KEY;
  const baseURL =
    env.AI_BASE_URL ||
    env.OPENAI_BASE_URL ||
    env.VITE_AI_BASE_URL ||
    "https://api.openai.com/v1";
  if (!apiKey?.trim()) return null;
  return { apiKey: apiKey.trim(), baseURL: baseURL.trim() || "https://api.openai.com/v1" };
}
