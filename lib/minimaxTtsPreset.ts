/**
 * MiniMax TTS 默认参数（前后端共用常量，不含网络逻辑）
 */

export const MINIMAX_T2A_DEFAULT_BASE = "https://api.minimax.io";

/** 资深男性项目经理：沉稳男声、略慢语速、中文场景；若平台提示无效可换文档中的系统音色 ID */
export const DEFAULT_PM_VOICE_SETTING = {
  voice_id: "male-qn-001",
  speed: 0.95,
  vol: 1,
  pitch: -1,
  emotion: "calm" as const,
};

export const DEFAULT_MINIMAX_TTS_PAYLOAD = {
  model: "speech-2.6-hd",
  stream: false,
  output_format: "hex" as const,
  language_boost: "Chinese" as const,
  voice_setting: { ...DEFAULT_PM_VOICE_SETTING },
  audio_setting: {
    sample_rate: 32000,
    bitrate: 128000,
    format: "mp3" as const,
    channel: 1 as const,
  },
};

export type MinimaxTtsClientOverrides = {
  model?: string;
  language_boost?: string;
  voice_setting?: Partial<typeof DEFAULT_PM_VOICE_SETTING>;
  audio_setting?: Partial<(typeof DEFAULT_MINIMAX_TTS_PAYLOAD)["audio_setting"]>;
};
