/**
 * Vercel Serverless：MiniMax 语音合成代理，返回 MP3 二进制（audio/mpeg）。
 *
 * 环境变量：
 * - MINIMAX_API_KEY（必填）
 * - MINIMAX_GROUP_ID（部分账号必填，按控制台说明配置）
 * - MINIMAX_API_BASE（可选，默认 https://api.minimax.io）
 *
 * POST JSON：{ "text": string, 可选 model / language_boost / voice_setting / audio_setting }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { devError } from "../utils/logger";
import {
  fetchMinimaxTtsMp3,
  parseTtsClientBody,
  resolveMinimaxSecrets,
} from "../lib/minimaxTtsForward";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).setHeader("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const secrets = resolveMinimaxSecrets(process.env as Record<string, string | undefined>);
  if (!secrets) {
    res.status(500).json({ error: "Missing MINIMAX_API_KEY on server" });
    return;
  }

  let raw: unknown = req.body;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
  }

  let text: string;
  let overrides: ReturnType<typeof parseTtsClientBody>["overrides"];
  try {
    const parsed = parseTtsClientBody(raw);
    text = parsed.text;
    overrides = parsed.overrides;
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Bad request" });
    return;
  }

  try {
    const mp3 = await fetchMinimaxTtsMp3(secrets, text, overrides);
    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(Buffer.from(mp3));
  } catch (e) {
    devError("[api/tts]", e);
    res.status(502).json({
      error: e instanceof Error ? e.message : "MiniMax TTS failed",
    });
  }
}
