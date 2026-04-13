/**
 * MiniMax TTS 前端封装：请求同源 /api/tts，将返回的 MP3 转为可播放资源。
 * 结构与 geminiService 一致：常量路径 + fetch + 解析。
 */

import {
  DEFAULT_MINIMAX_TTS_PAYLOAD,
  DEFAULT_PM_VOICE_SETTING,
  type MinimaxTtsClientOverrides,
} from "../lib/minimaxTtsPreset";

export type { MinimaxTtsClientOverrides };

const TTS_PATH = "/api/tts";

export const MIME_MP3 = "audio/mpeg";

/** 资深男性项目经理默认音色与合成参数（可在单次请求中用 overrides 覆盖） */
export const PM_INTERVIEWER_VOICE_PRESET = {
  model: DEFAULT_MINIMAX_TTS_PAYLOAD.model,
  language_boost: DEFAULT_MINIMAX_TTS_PAYLOAD.language_boost,
  voice_setting: { ...DEFAULT_PM_VOICE_SETTING },
  audio_setting: { ...DEFAULT_MINIMAX_TTS_PAYLOAD.audio_setting },
} as const;

export type SynthesizeSpeechOptions = MinimaxTtsClientOverrides;

export type SynthesizeSpeechResult = {
  /** 原始 MP3 字节，可直接用于 Blob / decodeAudioData */
  arrayBuffer: ArrayBuffer;
  mimeType: string;
};

/**
 * 文本转语音：POST /api/tts，返回 MP3 ArrayBuffer。
 * @param text 待合成文本（≤10000 字，段落用换行）
 * @param overrides 可选覆盖 model / voice_setting / audio_setting 等
 */
export async function synthesizeSpeech(
  text: string,
  overrides?: SynthesizeSpeechOptions
): Promise<SynthesizeSpeechResult> {
  const res = await fetch(TTS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...overrides }),
  });

  const buf = await res.arrayBuffer();

  if (!res.ok) {
    let msg = `TTS HTTP ${res.status}`;
    try {
      const errJson = JSON.parse(new TextDecoder().decode(buf)) as { error?: string };
      if (errJson?.error) msg = errJson.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  return {
    arrayBuffer: buf,
    mimeType: res.headers.get("Content-Type")?.split(";")[0]?.trim() || MIME_MP3,
  };
}

/**
 * 使用 Web Audio API 解码 MP3 为 AudioBuffer（可用于自定义播放调度）。
 */
export async function decodeSpeechToAudioBuffer(
  result: SynthesizeSpeechResult,
  audioContext?: AudioContext
): Promise<AudioBuffer> {
  const ctx = audioContext ?? new AudioContext();
  const copy = result.arrayBuffer.slice(0);
  return ctx.decodeAudioData(copy);
}

/**
 * 基于 Blob URL 创建 {@link HTMLAudioElement}，调用 play() 即可播放。
 * 若在 ended 前销毁元素，请自行 `URL.revokeObjectURL(audio.src)`。
 */
export function createAudioElementFromSpeech(result: SynthesizeSpeechResult): HTMLAudioElement {
  const blob = new Blob([result.arrayBuffer], { type: result.mimeType || MIME_MP3 });
  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.src = url;
  audio.addEventListener(
    "ended",
    () => {
      URL.revokeObjectURL(url);
    },
    { once: true }
  );
  return audio;
}

/**
 * 一行播放：合成 → 解码 → 连接到 AudioContext.destination。
 * 返回 AudioBufferSourceNode（可 stop），适合短句提示音。
 */
export async function playSpeechThroughContext(
  text: string,
  overrides?: SynthesizeSpeechOptions,
  audioContext?: AudioContext
): Promise<{ context: AudioContext; source: AudioBufferSourceNode; buffer: AudioBuffer }> {
  const result = await synthesizeSpeech(text, overrides);
  const ctx = audioContext ?? new AudioContext();
  const buffer = await decodeSpeechToAudioBuffer(result, ctx);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  return { context: ctx, source, buffer };
}
