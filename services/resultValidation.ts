import { z } from 'zod';
const text = z.string();
const nonempty = z.string().trim().min(1);
const score = z.number().min(0).max(100);
const strings = z.array(text);
export const jdResultSchema = z.object({
  companyName: nonempty, industry: nonempty, companyProducts: strings,
  level: z.enum(['Entry', 'Mid-Level', 'Senior', 'Executive']), persona: nonempty,
  skills: z.array(z.object({
    name: nonempty, type: z.enum(['Hard', 'Soft']), priority: z.enum(['High', 'Medium', 'Low']),
    description: nonempty, applicationScenario: nonempty,
  })).min(5).max(8),
});
export const optimizationResultSchema = z.object({
  matchScore: score, executiveSummary: nonempty,
  improvements: z.array(z.object({
    id: nonempty, type: z.enum(['Format', 'Content', 'Impact']),
    original: nonempty, critique: nonempty, suggestion: nonempty,
    chatHistory: z.array(z.object({ role: z.enum(['user', 'model']), text })).default([]),
  })).min(1).max(10),
});
export const refinedResultSchema = z.object({
  optimizationLogic: z.object({ changesMade: nonempty, reasoning: nonempty }),
  resume: z.object({
    baseInfo: z.object({ name: text, phone: text, email: text, objective: text }),
    summary: nonempty,
    workExperience: z.array(z.object({ company: text, role: text, date: text, points: strings })),
    projectExperience: z.array(z.object({ role: text, name: text, date: text, brief: text, difficulty: text, solution: text, result: text })),
    education: z.object({ degree: text, school: text, major: text, date: text }),
  }),
});
export const feedbackResultSchema = z.object({
  score, strengths: z.array(nonempty).min(1), weaknesses: z.array(nonempty).min(1),
  improvementPlan: nonempty, growthEvaluation: text.optional(),
});
export function parseAiResult<T>(raw: string, schema: z.ZodType<T>): T {
  let data: unknown;
  try { data = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()); }
  catch { throw new Error('AI 返回的格式不完整，请重新生成。'); }
  const result = schema.safeParse(data);
  if (!result.success) throw new Error('AI 返回的内容不完整，请重新生成。');
  return result.data;
}
