import { createHash, timingSafeEqual } from 'node:crypto';
import { proxyChatCompletion, resolveProxySecretsForServer, sanitizeChatCompletionBody } from './proxyChatCompletion.js';
import { fetchMinimaxTtsMp3, parseTtsClientBody, resolveMinimaxSecrets } from './minimaxTtsForward.js';
export type ServerEnv = Record<string, string | undefined>;
export type ApiResult = { status: number; body: string | Buffer; contentType?: string };
const json = (status: number, data: unknown): ApiResult => ({ status, body: JSON.stringify(data) });
export function authorizeBeta(code: string | undefined, env: ServerEnv): ApiResult | null {
  const expected = env.BETA_ACCESS_CODE?.trim();
  if (!expected) return env.NODE_ENV === 'development' && env.VERCEL !== '1'
    ? null : json(503, { error: '试用入口暂未开放，请联系产品负责人。', accessRequired: true });
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(code || ''), digest(expected))
    ? null : json(401, { error: '请输入有效的邀请码。', accessRequired: true });
}
export async function handleApi(path: string, method: string, raw: unknown, code: string | undefined, env: ServerEnv): Promise<ApiResult> {
  const expectedMethod = path === '/api/status' ? 'GET' : 'POST';
  if (method !== expectedMethod) return json(405, { error: '请求方式不支持。' });
  const denied = authorizeBeta(code, env);
  if (denied) return denied;
  if (path === '/api/status') return json(200, {
    ready: !!resolveProxySecretsForServer(env), speech: !!resolveMinimaxSecrets(env), ocr: !!env.SILICONFLOW_API_KEY?.trim(),
  });
  let body: unknown = raw;
  if (typeof raw === 'string') {
    try { body = JSON.parse(raw); } catch { return json(400, { error: '请求内容格式错误。' }); }
  }
  try {
    if (path === '/api/proxy') {
      const safe = sanitizeChatCompletionBody(body);
      if (!safe) return json(400, { error: '内容为空或过长，请缩短内容后重试。' });
      const secrets = resolveProxySecretsForServer(env);
      if (!secrets) return json(503, { error: 'AI 服务暂未接通，请联系产品负责人。' });
      const result = await proxyChatCompletion(safe, secrets);
      return { status: result.status, body: result.text };
    }
    if (path === '/api/tts') {
      let parsed: ReturnType<typeof parseTtsClientBody>;
      try {
        parsed = parseTtsClientBody(body);
        if (parsed.text.length > 6_000) throw new Error('语音内容过长。');
      } catch { return json(400, { error: '语音内容为空或过长。' }); }
      const secrets = resolveMinimaxSecrets(env);
      if (!secrets) return json(503, { error: '语音暂不可用，可以继续文字面试。' });
      const mp3 = await fetchMinimaxTtsMp3(secrets, parsed.text);
      return { status: 200, contentType: 'audio/mpeg', body: Buffer.from(mp3) };
    }
    if (path === '/api/ocr') {
      const o = body as Record<string, unknown> | null;
      const image = o?.imageBase64;
      const mime = o?.mimeType;
      if (typeof image !== 'string' || !image.length || image.length > 2_800_000 ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(image) ||
          !['image/png', 'image/jpeg', 'image/webp'].includes(mime as string)) {
        return json(400, { error: '请选择 2 MB 以内的 PNG、JPEG 或 WebP 图片。' });
      }
      if (!env.SILICONFLOW_API_KEY?.trim()) return json(503, { error: '图片识别暂不可用，请粘贴文字内容。' });
      const response = await fetch(`${(env.SILICONFLOW_API_BASE || 'https://api.siliconflow.cn/v1').replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.SILICONFLOW_API_KEY.trim()}` },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          model: env.OCR_MODEL_ID || 'Qwen/Qwen2.5-VL-72B-Instruct',
          messages: [{ role: 'user', content: [
            { type: 'text', text: '精准提取图片中的全部文字，保持段落顺序。只输出纯文本，不要补充或编造内容。' },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${image}` } },
          ] }], temperature: 0.1, max_tokens: 4096,
        }),
      });
      if (!response.ok) return json(response.status === 429 ? 429 : 502, { error: '图片识别暂时失败，请重试或粘贴文字。' });
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) return json(502, { error: '未识别到文字，请粘贴文字内容。' });
      return json(200, { text });
    }
    return json(404, { error: '接口不存在。' });
  } catch (error) {
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    console.error('[api]', path, timeout ? 'timeout' : 'upstream_failure');
    return json(timeout ? 504 : 502, { error: timeout ? '处理超时，请重试。' : '服务暂时不可用，请稍后重试。' });
  }
}
