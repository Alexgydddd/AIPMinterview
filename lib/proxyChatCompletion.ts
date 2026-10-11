export interface ProxySecrets { apiKey: string; baseURL: string; model: string }
export type ChatMessageInput = { role: 'system' | 'user' | 'assistant'; content: string };
export interface ChatCompletionBody {
  model: string; messages: ChatMessageInput[]; temperature?: number;
  response_format?: { type: 'json_object' };
}
export function sanitizeChatCompletionBody(input: unknown): ChatCompletionBody | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (typeof o.model !== 'string' || !o.model.trim() || !Array.isArray(o.messages) ||
      !o.messages.length || o.messages.length > 80) return null;
  const messages: ChatMessageInput[] = [];
  let total = 0;
  for (const m of o.messages) {
    if (!m || typeof m !== 'object') return null;
    const row = m as Record<string, unknown>;
    if (!['system', 'user', 'assistant'].includes(row.role as string) ||
        typeof row.content !== 'string' || !row.content.trim() || row.content.length > 60_000) return null;
    total += row.content.length;
    messages.push({ role: row.role as ChatMessageInput['role'], content: row.content });
  }
  if (total > 120_000) return null;
  if (o.temperature !== undefined && (typeof o.temperature !== 'number' ||
      !Number.isFinite(o.temperature) || o.temperature < 0 || o.temperature > 2)) return null;
  const responseFormat = o.response_format as Record<string, unknown> | undefined;
  return {
    model: o.model, messages, temperature: o.temperature as number | undefined,
    ...(responseFormat?.type === 'json_object' ? { response_format: { type: 'json_object' as const } } : {}),
  };
}
export async function proxyChatCompletion(body: ChatCompletionBody, secrets: ProxySecrets) {
  const res = await fetch(`${secrets.baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secrets.apiKey}` },
    body: JSON.stringify({ ...body, model: secrets.model, max_tokens: 4096, stream: false }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const status = res.status === 429 ? 429 : 502;
    return { status, text: JSON.stringify({ error: status === 429 ? '服务繁忙，请稍后重试。' : 'AI 服务暂时不可用，请稍后重试。' }) };
  }
  const data = await res.json();
  if (typeof data.choices?.[0]?.message?.content !== 'string' || !data.choices[0].message.content.trim()) {
    return { status: 502, text: JSON.stringify({ error: 'AI 未返回有效内容，请重试。' }) };
  }
  return { status: 200, text: JSON.stringify({ choices: [{ message: { content: data.choices[0].message.content } }] }) };
}
export function resolveProxySecretsForServer(env: Record<string, string | undefined>): ProxySecrets | null {
  const apiKey = (env.AI_API_KEY || env.OPENAI_API_KEY)?.trim();
  if (!apiKey) return null;
  return {
    apiKey, baseURL: (env.AI_BASE_URL || env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1').trim(),
    model: env.AI_MODEL?.trim() || 'deepseek-chat',
  };
}
export const resolveProxySecretsForViteDev = resolveProxySecretsForServer;
