import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
export default function ProcessingStatus({ label = '正在分析岗位要求…' }: { label?: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return <div role="status" className="mt-8 flex flex-col items-center gap-3 py-5 text-sm text-slate-500">
    <Loader2 className="animate-spin text-violet-600" size={26} />
    <p>{label}</p><p className="text-xs text-slate-400">{seconds < 30 ? '通常需要几十秒，请稍候。' : '仍在处理中，请保持当前页面。'}</p>
  </div>;
}
