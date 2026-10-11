import React, { useEffect, useState } from 'react';
import { apiFetch, setAccessCode } from '../services/apiClient';
export default function BetaGate({ children }: { children: React.ReactNode }) {
  const [opened, setOpened] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(true);
  async function check() {
    setChecking(true); setError('');
    try {
      const response = await apiFetch('/api/status', {}, 10_000);
      const status = await response.json();
      setReady(status.ready); setAllowed(true); setOpened(true);
    } catch (e) { setError(e instanceof Error ? e.message : '暂时无法连接。'); }
    finally { setChecking(false); }
  }
  useEffect(() => {
    void check();
    const lock = () => setAllowed(false);
    window.addEventListener('aipm-access-expired', lock);
    return () => window.removeEventListener('aipm-access-expired', lock);
  }, []);
  const app = <div hidden={!allowed}>{!ready && <div role="status" className="bg-amber-50 p-3 text-center text-sm text-amber-800">AI 服务暂未接通，目前可以浏览页面，分析功能暂不可用。</div>}{children}</div>;

  return (
    <>{opened && app}{!allowed && <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <form className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl border border-slate-100" onSubmit={e => {
        e.preventDefault(); setAccessCode(code); void check();
      }}>
        <p className="text-xs font-bold tracking-widest text-violet-600 mb-3">AIPM · 小范围试用</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">把项目经历，讲成面试实力</h1>
        <p className="text-sm text-slate-500 mb-6">输入收到的邀请码，开始岗位分析、简历优化和项目经理面试练习。</p>
        <label htmlFor="beta-code" className="block text-sm text-slate-700 mb-2">邀请码</label>
        <input id="beta-code" type="password" autoComplete="off" maxLength={200} value={code} onChange={e => setCode(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-violet-500" />
        {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
        <button disabled={checking} className="mt-5 w-full bg-violet-600 text-white rounded-xl py-3 font-bold disabled:opacity-50">{checking ? '正在连接…' : '进入试用'}</button>
        <p className="mt-5 text-xs text-slate-400">遇到问题可联系 <a href="mailto:alexgyd@163.com" className="text-violet-600">alexgyd@163.com</a></p>
      </form>
    </main>}</>
  );
}
