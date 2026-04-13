/**
 * MiniMax HTTP T2A v2（非流式 + hex 音频），供 api/tts 与 Vite 开发中间件共用。
 * 文档：https://platform.minimax.io/docs/api-reference/speech-t2a-http
 */

import {
  DEFAULT_MINIMAX_TTS_PAYLOAD,
  MINIMAX_T2A_DEFAULT_BASE,
  type MinimaxTtsClientOverrides,
} from "./minimaxTtsPreset";

export {
  DEFAULT_MINIMAX_TTS_PAYLOAD,
  DEFAULT_PM_VOICE_SETTING,
  MINIMAX_T2A_DEFAULT_BASE,
  type MinimaxTtsClientOverrides,
} from "./minimaxTtsPreset";

type MinimaxTtsResponse = {
  data?: { audio?: string; status?: number } | null;
  base_resp?: { status_code?: number; status_msg?: string };
};

export function resolveMinimaxSecrets(env: Record<string, string | undefined>): {
  apiKey: string;
  groupId?: string;
  baseUrl: string;
} | null {
  const apiKey = env.MINIMAX_API_KEY?.trim();
  if (!apiKey) return null;
  const groupId = env.MINIMAX_GROUP_ID?.trim() || undefined;
  const baseUrl = (env.MINIMAX_API_BASE || MINIMAX_T2A_DEFAULT_BASE).replace(/\/$/, "");
  return { apiKey, groupId, baseUrl };
}

export function buildMinimaxTtsPayload(
  text: string,
  overrides?: MinimaxTtsClientOverrides
): Record<string, unknown> {
  const t = text.trim();
  if (!t) throw new Error("text is empty");
  if (t.length > 10_000) throw new Error("text exceeds 10,000 characters");

  const payload: Record<string, unknown> = {
    ...DEFAULT_MINIMAX_TTS_PAYLOAD,
    text: t,
    voice_setting: {
      ...DEFAULT_MINIMAX_TTS_PAYLOAD.voice_setting,
      ...overrides?.voice_setting,
    },
    audio_setting: {
      ...DEFAULT_MINIMAX_TTS_PAYLOAD.audio_setting,
      ...overrides?.audio_setting,
    },
  };
  if (overrides?.model) payload.model = overrides.model;
  if (overrides?.language_boost) payload.language_boost = overrides.language_boost;
  return payload;
}

function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, "");
  if (clean.length % 2 !== 0) throw new Error("Invalid hex audio payload");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

/** 调用 MiniMax，返回 MP3 二进制（由 hex 解码） */
export async function fetchMinimaxTtsMp3(
  secrets: { apiKey: string; groupId?: string; baseUrl: string },
  text: string,
  overrides?: MinimaxTtsClientOverrides
): Promise<Uint8Array> {
  const url = `${secrets.baseUrl}/v1/t2a_v2`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secrets.apiKey}`,
  };
  if (secrets.groupId) {
    headers["Group-Id"] = secrets.groupId;
  }

  const body = buildMinimaxTtsPayload(text, overrides);
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const raw = await r.text();
  if (!r.ok) {
    throw new Error(raw || `MiniMax HTTP ${r.status}`);
  }

  let json: MinimaxTtsResponse;
  try {
    json = JSON.parse(raw) as MinimaxTtsResponse;
  } catch {
    throw new Error("MiniMax returned non-JSON body");
  }

  const code = json.base_resp?.status_code;
  if (code !== undefined && code !== 0) {
    throw new Error(json.base_resp?.status_msg || `MiniMax status_code ${code}`);
  }

  const hex = json.data?.audio;
  if (!hex || typeof hex !== "string") {
    throw new Error("MiniMax response missing data.audio (hex)");
  }

  return hexToUint8Array(hex);
}

export function parseTtsClientBody(raw: unknown): { text: string; overrides?: MinimaxTtsClientOverrides } {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid JSON body");
  }
  const o = raw as Record<string, unknown>;
  const text = o.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Missing required string field: text");
  }

  const overrides: MinimaxTtsClientOverrides = {};
  if (typeof o.model === "string") overrides.model = o.model;
  if (typeof o.language_boost === "string") overrides.language_boost = o.language_boost;
  if (o.voice_setting && typeof o.voice_setting === "object") {
    overrides.voice_setting = o.voice_setting as MinimaxTtsClientOverrides["voice_setting"];
  }
  if (o.audio_setting && typeof o.audio_setting === "object") {
    overrides.audio_setting = o.audio_setting as MinimaxTtsClientOverrides["audio_setting"];
  }

  const hasAny =
    overrides.model ||
    overrides.language_boost ||
    overrides.voice_setting ||
    overrides.audio_setting;
  return { text, overrides: hasAny ? overrides : undefined };
}
