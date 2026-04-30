import {
  JdAnalysis,
  ResumeOptimization,
  FileData,
  InterviewFeedback,
  RefinedResumeResponse,
  ChatMessage,
} from "../types";
import { computeJdHash, setCachedJdAnalysis, getCachedJdAnalysis, setLastAnalysisRecord } from "./cacheService";
import { devLog, devWarn, devError } from "../utils/logger";

const CHAT_PROXY_PATH = "/api/proxy";
const OCR_PROXY_PATH = "/api/ocr";
const MODEL_SMART = "deepseek-chat";

// ============================================================
// 类型定义
// ============================================================

/**
 * OCR 图片文字识别结果
 */
export interface OcrResult {
  success: boolean;
  text: string;
  length: number;
}

/**
 * 简历改进建议
 */
export interface ResumeImprovement {
  id: string;
  type: 'Format' | 'Content' | 'Impact';
  original: string;
  critique: string;
  suggestion: string;
  chatHistory: ChatMessage[];
}

/**
 * 简历优化结果
 */
export interface ResumeOptimizationResult {
  matchScore: number;
  executiveSummary: string;
  improvements: ResumeImprovement[];
}

/**
 * 优化的简历响应
 */
export interface RefinedResumeResult {
  optimizationLogic: {
    changesMade: string;
    reasoning: string;
  };
  resume: {
    baseInfo: {
      name: string;
      phone: string;
      email: string;
      objective: string;
    };
    summary: string;
    workExperience: {
      company: string;
      role: string;
      date: string;
      points: string[];
    }[];
    projectExperience: {
      role: string;
      name: string;
      date: string;
      brief: string;
      difficulty: string;
      solution: string;
      result: string;
    }[];
    education: {
      degree: string;
      school: string;
      major: string;
      date: string;
    };
  };
}

/**
 * 面试反馈请求
 */
export interface InterviewFeedbackRequest {
  summaryContext: string;
  previousFeedback?: InterviewFeedback | null;
}

/**
 * 面试反馈结果
 */
export interface InterviewFeedbackResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  improvementPlan: string;
  growthEvaluation?: string;
}

/**
 * 对话反馈请求
 */
export interface ChatFeedbackRequest {
  critiqueContext: string;
  originalText: string;
  suggestion: string;
  userQuery: string;
  history: ChatMessage[];
}

// ============================================================
// OCR 图片文字识别
// ============================================================

/**
 * 通过 SiliconFlow 深度扫描图片，识别文本
 */
export async function extractTextFromImage(file: FileData): Promise<OcrResult> {
  devLog('已调用 SiliconFlow 深度扫描图片');
  try {
    const response = await fetch(OCR_PROXY_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: file.data,
        mimeType: file.mimeType
      }),
    });
    const data = await response.json();

    const text = typeof data.text === 'string' ? data.text : '';
    return {
      success: !!text && response.ok,
      text,
      length: text.length
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : String(error);
    devError('[OCR] Error:', err);
    return {
      success: false,
      text: '',
      length: 0
    };
  }
}

// ============================================================
// 内部类型
// ============================================================

type ChatRole = "system" | "user" | "assistant";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

// ============================================================
// 内部工具函数
// ============================================================

async function createChatCompletion(params: {
  model: string;
  messages: { role: ChatRole; content: string }[];
  temperature?: number;
}): Promise<ChatCompletionResponse> {
  const res = await fetch(CHAT_PROXY_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error('网络连接异常，请检查网络后重试');
  }
  try {
    return JSON.parse(text) as ChatCompletionResponse;
  } catch {
    throw new Error("Invalid JSON from chat proxy");
  }
}

function firstChoiceContent(data: ChatCompletionResponse): string | undefined {
  const c = data.choices?.[0]?.message?.content;
  return c ?? undefined;
}

/**
 * 安全 JSON 解析工具
 */
function safeJsonParse<T>(text: string, defaultObj: T): T {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    return JSON.parse(jsonStr);
  } catch {
    if (typeof defaultObj === "object" && defaultObj !== null) {
      return {
        ...defaultObj,
        __parseError: "AI答复无法解析为有效JSON，请重试。",
      } as T;
    }
    return defaultObj;
  }
}

/**
 * 捕获大模型回答中被某些 LLM 包裹的 markdown block
 */
function cleanLLMJson(text: string): string {
  if (!text) return text;
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

/**
 * 用于让 OpenAI 返回严格 JSON 格式
 */
function buildJsonSchemaInstruction(schema: Record<string, unknown>): string {
  return `\n\nJSON OUTPUT FORMAT\n请严格按照如下 JSON Schema 输出结果（不要包含多余说明，不要 markdown，不要文字描述）：\n${JSON.stringify(schema, null, 2)}\n\n`;
}

/**
 * 清理 Markdown 格式和引号
 */
function recursiveCleanMarkdown(obj: unknown): unknown {
  if (typeof obj === "string") {
    let s = obj.replace(/\*\*/g, "");
    s = s.replace(/["""]/g, "「").replace(/"/g, "「").replace(/'/g, "「");
    s = s.replace(/「+/g, "「");
    return s;
  }
  if (Array.isArray(obj)) {
    return obj.map(recursiveCleanMarkdown);
  }
  if (obj !== null && typeof obj === "object") {
    const res: Record<string, unknown> = {};
    for (const key in obj) {
      res[key] = recursiveCleanMarkdown((obj as Record<string, unknown>)[key]);
    }
    return res;
  }
  return obj;
}

// ============================================================
// 简历面试对话
// ============================================================

/**
 * 模拟面试多轮对话：系统人设 + 历史消息，返回面试官下一句中文回复
 */
export async function generateInterviewReply(params: {
  systemPrompt: string;
  conversation: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const chatMessages: { role: ChatRole; content: string }[] = [
    { role: "system", content: params.systemPrompt },
  ];
  for (const m of params.conversation) {
    if (!m.content.trim()) continue;
    chatMessages.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    });
  }
  if (chatMessages.length === 1) {
    chatMessages.push({
      role: "user",
      content: "（面试刚刚开始，请你先按照系统指令向候选人问好并提问。）",
    });
  }
  const completion = await createChatCompletion({
    model: MODEL_SMART,
    messages: chatMessages,
    temperature: 0.35,
  });
  const out = firstChoiceContent(completion)?.trim();
  if (!out) throw new Error("面试官回复为空");
  return out;
}

// ============================================================
// JD 分析
// ============================================================

function combinePromptWithImage(prompt: string, _file?: FileData): string {
  return prompt;
}

/**
 * JD 分析：强调业务困境背景 + 中国互联网高级 PM 视角
 */
export const analyzeJobDescription = async (
  companyName?: string,
  jdText?: string,
  jdFile?: FileData
): Promise<JdAnalysis> => {
  const jdHash = await computeJdHash(jdText || "");

  // 缓存读取
  try {
    const cachedEntry = await getCachedJdAnalysis(jdHash);
    if (cachedEntry) {
      const parsed = cachedEntry.data;
      if (parsed && parsed.skills && Array.isArray(parsed.skills) && parsed.skills.length > 0) {
        await setLastAnalysisRecord({
          hash: jdHash,
          company: parsed.companyName,
          position: "",
          textLength: 0,
          timestamp: Date.now(),
        });
        return parsed;
      }
    }
  } catch (e) {
    devWarn("[CacheService] 读取缓存失败:", e);
  }

  // Schema 用于约束输出
  const schema = {
    type: "object",
    properties: {
      companyName: { type: "string" },
      industry: { type: "string" },
      companyProducts: { type: "array", items: { type: "string" } },
      level: { type: "string", enum: ["Entry", "Mid-Level", "Senior", "Executive"] },
      persona: { type: "string" },
      skills: {
        type: "array",
        minItems: 5,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string", enum: ["Hard", "Soft"] },
            priority: { type: "string", enum: ["High", "Medium", "Low"] },
            description: { type: "string" },
            applicationScenario: { type: "string" }
          },
          required: ["name", "type", "priority", "description", "applicationScenario"]
        }
      }
    },
    required: ["companyName", "industry", "companyProducts", "level", "persona", "skills"]
  };

  const companyNameRule = companyName
    ? `- 若提供公司名称，请直接将"${companyName}"用作 companyName 字段，禁止任何自行推测或更改。`
    : `- 若未提供公司名称，请智能推断：仔细阅读 JD 前两行和上下文，从产品描述、业务领域、用词风格推断。如实在无法推断，使用行业惯例如『某互联网公司』『知名科技企业』等。`;

  const prompt = `
你现在是互联网大厂10年资深项目经理"亚历克斯"，请以极其简明，专业的中文分析如下JD（职位描述）。
【定量要求】：skills 数组必须提取 5-8 个核心技能，不能少于 5 个，不能多于 8 个。
【公司名称处理说明】：
${companyNameRule}
【其他推断规则】：
- 提取 level 时，结合职位描述中的职责范围、任职资格、工作经验要求等综合判断。
- 严禁直接输出"未提及"。如果无法准确推断，用符合行业惯例的友好表述替代：如『核心业务岗』『资深专家岗』等。
【格式锚定】：输出 JSON 时，键名顺序须为 companyName → industry → companyProducts → level → persona → skills，不允许打乱顺序。
【重点要求】：
1. 输出内容为结构化专业中文，风格等同"职场闭环复盘文"。
2. 精准分析JD可能的"核心业务困境"——分析聘用此岗位的实际目的（救火/扩张等），用PM视角深度复盘，严禁只复述JD原文。
3. "applicationScenario"须紧密结合公司实际业务/产品场景，颗粒度要到"典型项目实例"或"关键抓手动作"。
4. Persona、skills等表达应为高级PM行业惯用表达，杜绝低级套路。
5. 强制禁止输出英文或中英文夹杂，所有内容精炼、有高级感。
6. 【硬性排版要求】禁止在JSON值出现 Markdown ** 加粗符，如需突出关键词请使用中文双引号『""』。

JD内容:
${jdText || ""}
${buildJsonSchemaInstruction(schema)}
`;

  try {
    const completion = await createChatCompletion({
      model: MODEL_SMART,
      messages: [
        {
          role: "system",
          content: `你现在是互联网大厂10年资深项目经理。若收到公司名参数请直接使用，否则自行推断且输出为地道中文。所有输出必须高度专业、精炼、无废话，只输出JSON。`
        },
        { role: "user", content: combinePromptWithImage(prompt, jdFile) }
      ],
      temperature: 0.1,
    });

    let text = firstChoiceContent(completion);
    if (!text) throw new Error("AI分析结果为空，请重试");
    text = cleanLLMJson(text);

    let parsed: JdAnalysis = safeJsonParse<JdAnalysis>(
      text,
      {
        companyName: "",
        industry: "",
        companyProducts: [],
        level: "Senior",
        persona: "",
        skills: [],
      }
    );

    parsed = recursiveCleanMarkdown(parsed) as JdAnalysis;

    // 写入缓存
    try {
      await setCachedJdAnalysis(
        jdHash,
        parsed,
        parsed.companyName || companyName || "",
        jdText || ""
      );
    } catch (e) {
      devWarn("[CacheService] 写入缓存失败:", e);
    }

    // 保存分析记录
    await setLastAnalysisRecord({
      hash: jdHash,
      company: parsed.companyName || companyName || "",
      position: "",
      textLength: (jdText || "").length,
      timestamp: Date.now(),
    });

    return parsed;
  } catch (error) {
    devError("Analysis failed", error);
    return {
      companyName: "",
      industry: "",
      companyProducts: [],
      level: "Senior",
      persona: "",
      skills: [],
    } as JdAnalysis;
  }
};

// ============================================================
// 简历优化
// ============================================================

const RESUME_OPTIMIZATION_SCHEMA = {
  type: "object",
  properties: {
    matchScore: { type: "number", minimum: 0, maximum: 100 },
    executiveSummary: { type: "string" },
    improvements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["Format", "Content", "Impact"] },
          original: { type: "string" },
          critique: { type: "string" },
          suggestion: { type: "string" },
          chatHistory: { type: "array", items: { type: "object" } }
        },
        required: ["id", "type", "original", "critique", "suggestion", "chatHistory"]
      }
    }
  },
  required: ["matchScore", "executiveSummary", "improvements"]
};

/**
 * 简历优化分析
 */
export async function optimizeResume(
  jdContext: string,
  resumeText: string,
  resumeFile?: FileData
): Promise<ResumeOptimizationResult> {
  const prompt = `
你现在是互联网大厂资深HR，请分析简历与JD的匹配度，并给出具体的优化建议。

【JD背景】
${jdContext}

【简历内容】
${resumeText || "（详见上传的简历附件）"}

请严格按照以下 JSON Schema 输出分析结果：
${JSON.stringify(RESUME_OPTIMIZATION_SCHEMA, null, 2)}

要求：
1. matchScore 是 0-100 的分数，反映简历与JD的整体匹配度
2. executiveSummary 是一段简洁有力的总结（2-3句话），指出最大优势和最大问题
3. improvements 数组包含 3-6 条具体改进建议，每条包含：
   - id: 唯一标识
   - type: Format（格式/排版）、Content（内容/经历）、Impact（影响力/成果）
   - original: 原文摘录
   - critique: 客观批评（直接指出问题）
   - suggestion: 具体改进建议（可操作）
   - chatHistory: 空数组占位
`;

  try {
    const completion = await createChatCompletion({
      model: MODEL_SMART,
      messages: [
        {
          role: "system",
          content: "你是一个专业的简历优化顾问。请严格按照JSON格式输出分析结果。"
        },
        { role: "user", content: combinePromptWithImage(prompt, resumeFile) }
      ],
      temperature: 0.3,
    });

    let text = firstChoiceContent(completion);
    if (!text) throw new Error("简历优化结果为空，请重试");
    text = cleanLLMJson(text);

    const result = safeJsonParse<ResumeOptimizationResult>(text, {
      matchScore: 0,
      executiveSummary: "简历分析失败",
      improvements: [],
    });

    return recursiveCleanMarkdown(result) as ResumeOptimizationResult;
  } catch (error) {
    devError("Resume optimization failed", error);
    return {
      matchScore: 0,
      executiveSummary: "简历优化失败，请稍后重试",
      improvements: [],
    };
  }
}

// ============================================================
// 简历改写
// ============================================================

const RESUME_REWRITE_SCHEMA = {
  type: "object",
  properties: {
    optimizationLogic: {
      type: "object",
      properties: {
        changesMade: { type: "string" },
        reasoning: { type: "string" }
      },
      required: ["changesMade", "reasoning"]
    },
    resume: {
      type: "object",
      properties: {
        baseInfo: {
          type: "object",
          properties: {
            name: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            objective: { type: "string" }
          },
          required: ["name", "phone", "email", "objective"]
        },
        summary: { type: "string" },
        workExperience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              company: { type: "string" },
              role: { type: "string" },
              date: { type: "string" },
              points: { type: "array", items: { type: "string" } }
            },
            required: ["company", "role", "date", "points"]
          }
        },
        projectExperience: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string" },
              name: { type: "string" },
              date: { type: "string" },
              brief: { type: "string" },
              difficulty: { type: "string" },
              solution: { type: "string" },
              result: { type: "string" }
            },
            required: ["role", "name", "date", "brief", "difficulty", "solution", "result"]
          }
        },
        education: {
          type: "object",
          properties: {
            degree: { type: "string" },
            school: { type: "string" },
            major: { type: "string" },
            date: { type: "string" }
          },
          required: ["degree", "school", "major", "date"]
        }
      },
      required: ["baseInfo", "summary", "workExperience", "projectExperience", "education"]
    }
  },
  required: ["optimizationLogic", "resume"]
};

/**
 * 生成精修简历
 */
export async function generateRefinedResume(
  jdContext: string,
  originalResume: string,
  improvements: string
): Promise<RefinedResumeResult> {
  const prompt = `
你现在是互联网大厂资深HR兼项目经理，请根据以下信息重写一份专业的简历。

【JD背景】
${jdContext}

【原始简历】
${originalResume || "（详见上传的简历附件）"}

【改进建议】
${improvements}

请严格按照以下 JSON Schema 输出精修后的简历：
${JSON.stringify(RESUME_REWRITE_SCHEMA, null, 2)}

要求：
1. optimizationLogic 说明做了哪些改动以及为什么这样改
2. baseInfo 包含基本信息
3. summary 是一句核心竞争标语（强调与JD的匹配度）
4. workExperience 每条经历用 3-5 个 bullet points 描述
5. projectExperience 使用 STAR 法则（Situation-Task-Action-Result）描述
6. 教育背景保持简洁
`;

  try {
    const completion = await createChatCompletion({
      model: MODEL_SMART,
      messages: [
        {
          role: "system",
          content: "你是一个专业的简历优化顾问。请严格按照JSON格式输出精修后的简历。"
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
    });

    let text = firstChoiceContent(completion);
    if (!text) throw new Error("简历生成结果为空，请重试");
    text = cleanLLMJson(text);

    const result = safeJsonParse<RefinedResumeResult>(text, {
      optimizationLogic: { changesMade: '', reasoning: '' },
      resume: {
        baseInfo: { name: '', phone: '', email: '', objective: '' },
        summary: '',
        workExperience: [],
        projectExperience: [],
        education: { degree: '', school: '', major: '', date: '' }
      }
    });

    return recursiveCleanMarkdown(result) as RefinedResumeResult;
  } catch (error) {
    devError("Resume generation failed", error);
    return {
      optimizationLogic: { changesMade: '生成失败', reasoning: '请稍后重试' },
      resume: {
        baseInfo: { name: '', phone: '', email: '', objective: '' },
        summary: '',
        workExperience: [],
        projectExperience: [],
        education: { degree: '', school: '', major: '', date: '' }
      }
    };
  }
}

// ============================================================
// 对话反馈
// ============================================================

/**
 * 获取单条改进建议的对话反馈
 */
export async function chatWithFeedback(
  critiqueContext: string,
  originalText: string,
  suggestion: string,
  userQuery: string,
  history: ChatMessage[]
): Promise<string> {
  const prompt = `
【简历改进背景】
原文：${originalText}
建议：${suggestion}

【对话历史】
${history.map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.text}`).join('\n')}

【用户提问】
${userQuery}

请针对用户的提问给出专业、有帮助的回答，帮助用户理解如何改进简历。
`;

  try {
    const messages: { role: ChatRole; content: string }[] = [
      { role: "system", content: "你是一个专业的简历优化顾问，请针对用户的问题给出有帮助的回答。" }
    ];

    for (const m of history) {
      messages.push({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.text
      });
    }

    messages.push({ role: "user", content: prompt });

    const completion = await createChatCompletion({
      model: MODEL_SMART,
      messages,
      temperature: 0.5,
    });

    const text = firstChoiceContent(completion);
    if (!text) throw new Error("对话回复为空，请重试");
    return text.trim();
  } catch (error) {
    devError("Chat feedback failed", error);
    return "抱歉，出了点小问题，请重试。";
  }
}

// ============================================================
// 面试反馈
// ============================================================

const INTERVIEW_FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number", minimum: 0, maximum: 100 },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    improvementPlan: { type: "string" },
    growthEvaluation: { type: "string" }
  },
  required: ["score", "strengths", "weaknesses", "improvementPlan"]
};

/**
 * 生成面试反馈
 */
export async function generateInterviewFeedback(
  interviewTranscript: string,
  previousFeedback?: InterviewFeedback | null
): Promise<InterviewFeedbackResult> {
  const previousContext = previousFeedback
    ? `【上次面试表现】
分数：${previousFeedback.score}
优势：${previousFeedback.strengths.join('、')}
劣势：${previousFeedback.weaknesses.join('、')}
改进计划：${previousFeedback.improvementPlan}`
    : '（首次面试）';

  const prompt = `
${previousContext}

【本次面试转录】
${interviewTranscript}

请严格按照以下 JSON Schema 输出面试反馈：
${JSON.stringify(INTERVIEW_FEEDBACK_SCHEMA, null, 2)}

要求：
1. score 是 0-100 的综合评分
2. strengths 列出 2-4 个突出优点
3. weaknesses 列出 2-4 个需要改进的地方
4. improvementPlan 是具体的改进计划（3-5句话）
5. growthEvaluation 是与上次相比的成长评价（如果是首次面试则为空字符串）
`;

  try {
    const completion = await createChatCompletion({
      model: MODEL_SMART,
      messages: [
        {
          role: "system",
          content: "你是一个专业的面试评估专家。请严格按照JSON格式输出面试反馈。"
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
    });

    let text = firstChoiceContent(completion);
    if (!text) throw new Error("面试反馈生成失败，请重试");
    text = cleanLLMJson(text);

    const result = safeJsonParse<InterviewFeedbackResult>(text, {
      score: 0,
      strengths: [],
      weaknesses: [],
      improvementPlan: "面试反馈生成失败",
      growthEvaluation: ""
    });

    return recursiveCleanMarkdown(result) as InterviewFeedbackResult;
  } catch (error) {
    devError("Interview feedback failed", error);
    return {
      score: 0,
      strengths: [],
      weaknesses: [],
      improvementPlan: "面试反馈生成失败，请稍后重试",
      growthEvaluation: ""
    };
  }
}

// ============================================================
// 统一导出类型
// ============================================================

export type { ResumeOptimizationResult as ResumeOptimization };
export type { RefinedResumeResult as RefinedResumeResponse };
export type { InterviewFeedbackResult as InterviewFeedback };
