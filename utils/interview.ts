export type InterviewMessage = { role: 'user' | 'assistant'; content: string };
export function formatTranscript(messages: InterviewMessage[]): string {
  return messages.map(m => `${m.role === 'user' ? '候选人' : '面试官'}: ${m.content}`).join('\n\n');
}
export function interviewContext(company: string, jd: string, resume: string): string {
  return `目标公司：${company}\n【岗位描述】\n${jd}\n【完整简历】\n${resume}`;
}
