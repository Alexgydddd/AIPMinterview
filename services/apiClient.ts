const ACCESS_KEY = 'aipm_beta_access';
let accessCode = '';
try { accessCode = sessionStorage.getItem(ACCESS_KEY) || ''; } catch {}
export function setAccessCode(code: string) {
  accessCode = code.trim();
  try { sessionStorage.setItem(ACCESS_KEY, accessCode); } catch {}
}
export async function apiFetch(path: string, init: RequestInit = {}, timeoutMs = 55_000): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessCode) headers.set('X-Beta-Access-Code', accessCode);
  let response: Response;
  try { response = await fetch(path, { ...init, headers, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) }); }
  catch (e) {
    if (e instanceof Error && ['TimeoutError', 'AbortError'].includes(e.name)) throw new Error('处理超时，请重试。');
    throw new Error('网络连接失败，请检查网络后重试。');
  }
  if (response.status === 401) window.dispatchEvent(new Event('aipm-access-expired'));
  if (!response.ok) {
    let message = '服务暂时不可用，请稍后重试。';
    try { const data = await response.json(); if (typeof data.error === 'string') message = data.error; } catch {}
    throw new Error(message);
  }
  return response;
}
