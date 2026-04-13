import React, { memo } from 'react';
import { JdAnalysis } from '../../types';
import { Building2, Briefcase } from 'lucide-react';

interface ResultHeaderProps {
  jdAnalysis: JdAnalysis;
  level: string;
}

const ResultHeader: React.FC<ResultHeaderProps> = memo(({ jdAnalysis, level }) => {
  return (
    <div className="flex flex-col md:flex-row gap-6 mb-8">
      <div className="bg-slate-900 text-white p-8 rounded-[2rem] flex-1 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
        <h2 className="text-3xl font-black mb-2 tracking-tight">{jdAnalysis.companyName}</h2>
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-6">
          <Building2 size={14} /> {jdAnalysis.industry}
        </div>
        <p className="text-slate-300 leading-relaxed text-sm mb-4">
          {jdAnalysis.persona}
        </p>
        <div className="flex flex-wrap gap-2">
          {jdAnalysis.companyProducts.slice(0, 3).map((prod, i) => (
            <span key={i} className="px-3 py-1 rounded-full bg-white/10 text-xs font-medium border border-white/5 backdrop-blur-sm">
              {prod}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] w-full md:w-80 shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col justify-center items-center text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
          <Briefcase size={32} />
        </div>
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">定级判断</span>
        <span className="text-xl font-black text-slate-800 mt-2">{level}</span>
      </div>
    </div>
  );
});

ResultHeader.displayName = 'ResultHeader';

export default ResultHeader;
