// Deterministic local fixtures for browser acceptance. Never deployed as an API route.
import { createServer } from 'node:http';
let reportCalls = 0;
let failedAnswer = false;
const skills = ['风险管理', '项目计划', '跨部门协同', '需求管理', '项目复盘'].map(name => ({
  name, type: 'Hard', priority: 'High', description: '结合真实经历说明具体做法。', applicationScenario: '在项目交付中识别风险，协调负责人并跟踪闭环。',
}));
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const messages = body.messages ?? [];
  const prompt = messages.map((m: any) => m.content).join('\n');
  let content: string;
  if (prompt.includes('输出面试反馈')) {
    reportCalls++;
    content = reportCalls === 1 ? '{}' : JSON.stringify({
      score: 78, strengths: ['能够说明本人在项目中的职责。', '使用真实案例描述风险处理。'],
      weaknesses: ['成果还需要补充真实量化指标。', '可以更清楚地说明跨部门的决策机制。'],
      improvementPlan: '挑选一个代表性项目。用一分钟讲清背景和自己的角色。补充可核实的结果，再练习一次风险追问。',
      growthEvaluation: prompt.includes('上次面试表现') ? '本次案例结构更清晰。' : '',
    });
  } else if (prompt.includes('输出精修后的简历')) {
    content = JSON.stringify({
      optimizationLogic: { changesMade: '整理真实经历，突出交付与风险管理。', reasoning: '对应岗位对项目推进的要求。' },
      resume: {
        baseInfo: { name: '测试候选人', phone: '', email: '', objective: '项目经理' },
        summary: '具备跨部门项目交付经验。', workExperience: [{ company: '测试企业', role: '项目经理', date: '2023–2026', points: ['协调产品、研发与运营推进交付。'] }],
        projectExperience: [{ role: '项目负责人', name: '系统交付项目', date: '2025', brief: '推进跨部门系统交付。', difficulty: '资源冲突与延期风险。', solution: '建立风险登记与每周协调机制。', result: '按期交付，具体指标待补充。' }],
        education: { degree: '本科', school: '测试大学', major: '管理', date: '2019–2023' },
      },
    });
  } else if (prompt.includes('matchScore')) {
    content = JSON.stringify({ matchScore: 76, executiveSummary: '项目交付经验与岗位匹配，可以进一步说明个人贡献与可核实的成果。', improvements: [
      { id: '1', type: 'Impact', original: '推进系统交付', critique: '个人行动与成果需要更明确。', suggestion: '补充负责的范围、关键行动和真实成果。', chatHistory: [] },
    ] });
  } else if (prompt.includes('companyProducts')) {
    content = JSON.stringify({ companyName: '测试企业', industry: '软件服务', companyProducts: ['JD 未提供'], level: 'Senior', persona: '能够推进跨部门项目交付的项目经理。', skills });
  } else {
    const last = messages.at(-1)?.content || '';
    if (last.includes('测试重试') && !failedAnswer) {
      failedAnswer = true; res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{}'); return;
    }
    const answered = messages.filter((m: any) => m.role === 'user').length > 0 && !last.includes('面试刚刚开始');
    content = answered ? '请结合这个项目说明，你怎样发现延期风险，以及如何协调相关负责人做出取舍？' : '你好，我是模拟面试官。请用一分钟介绍一个最能体现你项目管理能力的真实项目，并说明你在其中的角色。';
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ choices: [{ message: { content } }] }));
});
server.listen(4319, '127.0.0.1', () => console.log('Local fixture provider ready on 4319 — synthetic responses only.'));
