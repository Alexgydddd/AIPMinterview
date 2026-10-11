import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi, authorizeBeta } from '../lib/apiRuntime';
import { sanitizeChatCompletionBody, resolveProxySecretsForServer } from '../lib/proxyChatCompletion';
import { parseAiResult, jdResultSchema, optimizationResultSchema, feedbackResultSchema } from '../services/resultValidation';
import { optimizeResume, generateRefinedResume, generateInterviewFeedback } from '../services/geminiService';
import { formatTranscript, interviewContext } from '../utils/interview';

const env = { NODE_ENV: 'production', BETA_ACCESS_CODE: 'test-invite', AI_API_KEY: 'test-only', AI_MODEL: 'allowed-model' };
const request = { model: 'untrusted-model', messages: [{ role: 'user', content: '测试资料' }] };
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

test('production fails closed without an invite, and every paid endpoint checks it', async () => {
  assert.equal(authorizeBeta(undefined, { NODE_ENV: 'production' })?.status, 503);
  assert.equal(authorizeBeta(undefined, { NODE_ENV: 'development' }), null);
  assert.equal(authorizeBeta(undefined, {})?.status, 503);
  assert.equal(authorizeBeta(undefined, { NODE_ENV: 'development', VERCEL: '1' })?.status, 503);
  for (const path of ['/api/proxy', '/api/ocr', '/api/tts', '/api/status']) {
    const method = path === '/api/status' ? 'GET' : 'POST';
    assert.equal((await handleApi(path, method, request, undefined, env)).status, 401);
    assert.equal((await handleApi(path, method, request, 'wrong', env)).status, 401);
  }
  assert.equal((await handleApi('/api/proxy', 'GET', request, 'test-invite', env)).status, 405);
  assert.equal((await handleApi('/api/status', 'GET', null, 'test-invite', env)).status, 200);
});
test('invalid input and oversized input never reach a provider', async () => {
  globalThis.fetch = async () => { throw new Error('unexpected upstream request'); };
  for (const value of [null, {}, { model: 'x', messages: [] }, { ...request, temperature: NaN },
    { model: 'x', messages: [{ role: 'tool', content: 'text' }] },
    { model: 'x', messages: [{ role: 'user', content: 'x'.repeat(60_001) }] }]) assert.equal(sanitizeChatCompletionBody(value), null);
  assert.equal((await handleApi('/api/proxy', 'POST', '{}', 'test-invite', env)).status, 400);
  assert.equal((await handleApi('/api/proxy', 'POST', '{', 'test-invite', env)).status, 400);
  assert.equal((await handleApi('/api/tts', 'POST', { text: 'x'.repeat(6001) }, 'test-invite', env)).status, 400);
  assert.equal((await handleApi('/api/ocr', 'POST', { imageBase64: 'QQ==', mimeType: 'application/pdf' }, 'test-invite', env)).status, 400);
});
test('server selects model and budget, strips arbitrary request and provider fields', async () => {
  let forwarded: any;
  globalThis.fetch = async (_url, init) => {
    forwarded = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ message: { content: '回答' } }], privateField: 'do-not-return' });
  };
  const result = await handleApi('/api/proxy', 'POST', { ...request, max_tokens: 999999, url: 'evil', response_format: { type: 'json_object' } }, 'test-invite', env);
  assert.equal(result.status, 200);
  assert.equal(forwarded.model, 'allowed-model');
  assert.equal(forwarded.max_tokens, 4096);
  assert.equal(forwarded.url, undefined);
  assert.equal(forwarded.response_format.type, 'json_object');
  assert.equal(String(result.body).includes('do-not-return'), false);
  assert.equal(resolveProxySecretsForServer({ VITE_AI_API_KEY: 'browser-secret' }), null);
});
test('provider errors and timeouts become safe, retryable failures', async () => {
  globalThis.fetch = async () => new Response('private-provider-error', { status: 401 });
  let result = await handleApi('/api/proxy', 'POST', request, 'test-invite', env);
  assert.equal(result.status, 502);
  assert.equal(String(result.body).includes('private-provider-error'), false);
  globalThis.fetch = async () => { throw new DOMException('timeout', 'TimeoutError'); };
  assert.equal((await handleApi('/api/proxy', 'POST', request, 'test-invite', env)).status, 504);
  globalThis.fetch = async () => Response.json({ choices: [] });
  assert.equal((await handleApi('/api/proxy', 'POST', request, 'test-invite', env)).status, 502);
});
test('OCR checks formats, handles missing setup, and extracts recognized text', async () => {
  const image = { imageBase64: 'QQ==', mimeType: 'image/png' };
  assert.equal((await handleApi('/api/ocr', 'POST', image, 'test-invite', env)).status, 503);
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '真实简历文本' } }] });
  const result = await handleApi('/api/ocr', 'POST', image, 'test-invite', { ...env, SILICONFLOW_API_KEY: 'test-only' });
  assert.equal(JSON.parse(String(result.body)).text, '真实简历文本');
});
test('malformed AI data never becomes an empty or zero-score success', () => {
  for (const value of ['not json', '{}', '{"score":101,"strengths":[],"weaknesses":[],"improvementPlan":""}']) {
    assert.throws(() => parseAiResult(value, feedbackResultSchema));
  }
  assert.throws(() => parseAiResult('{"skills":[]}', jdResultSchema));
  assert.throws(() => parseAiResult('{"matchScore":0,"executiveSummary":"失败","improvements":[]}', optimizationResultSchema));
  const report = parseAiResult('```json\n{"score":0,"strengths":["回答坦诚"],"weaknesses":["尚无完整案例"],"improvementPlan":"准备一个案例。"}\n```', feedbackResultSchema);
  assert.equal(report.score, 0); // Genuine zero with valid evidence remains a valid score.
});
test('resume and feedback services propagate errors instead of inventing successful fallbacks', async () => {
  globalThis.fetch = async () => new Response('unavailable', { status: 502 });
  await assert.rejects(() => optimizeResume('JD', '真实简历'));
  await assert.rejects(() => generateRefinedResume('JD', '真实简历', '建议'));
  await assert.rejects(() => generateInterviewFeedback('候选人: 实际回答'));
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '{}' } }] });
  await assert.rejects(() => optimizeResume('JD', '真实简历'));
  await assert.rejects(() => generateRefinedResume('JD', '真实简历', '建议'));
  await assert.rejects(() => generateInterviewFeedback('候选人: 实际回答'));
});
test('multiline answers and the end of long resumes stay in the interview context', () => {
  const content = '项目背景\n候选人: 这也是我的原始回答\n行动和结果';
  assert.equal(formatTranscript([{ role: 'user', content }]), '候选人: ' + content);
  const context = interviewContext('测试公司', 'JD', 'x'.repeat(2000) + '关键项目结尾');
  assert.ok(context.endsWith('关键项目结尾'));
});
