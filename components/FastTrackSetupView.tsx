import React, { useState } from 'react';
import { Target, Upload, Play, Building2, FileText, X } from 'lucide-react';

interface Props {
  onStart: (companyName: string, jdText: string, resumeText: string) => void;
  onBack: () => void;
}

const FastTrackSetupView: React.FC<Props> = ({ onStart, onBack }) => {
  const [companyName, setCompanyName] = useState('');
  const [jdText, setJdText] = useState('');
  const [resumeText, setResumeText] = useState('');
  
  const isReady = companyName.trim() && jdText.trim() && resumeText.trim();

  return (
    <div className="max-w-4xl mx-auto mt-8 animate-fade-in px-6 pb-20">
      <div className="mb-8">
        <button 
          onClick={onBack} 
          className="text-slate-400 text-sm hover:text-slate-600 font-medium mb-4"
        >
          ← 返回首页
        </button>
        <h2 className="text-3xl font-black text-slate-900">实战模拟配置</h2>
        <p className="text-slate-500 mt-2">AI 面试官需要了解你的简历和目标岗位，才能进行针对性提问。</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-8">
        {/* Left: Job Context */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                 <Building2 size={20} />
              </div>
              <h3 className="font-bold text-slate-800">目标岗位信息</h3>
           </div>
           
           <div className="space-y-4">
              <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase mb-2">公司名称</label>
                 <input 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="例如：腾讯 CSIG"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                 />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase mb-2">职位描述 (JD)</label>
                 <textarea 
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="粘贴 JD 核心内容..."
                    className="w-full h-48 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
                 />
              </div>
           </div>
        </div>

        {/* Right: Resume Context */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                 <FileText size={20} />
              </div>
              <h3 className="font-bold text-slate-800">你的简历</h3>
           </div>

           <div>
               <label className="block text-xs font-bold text-slate-400 uppercase mb-2">简历文本</label>
               <textarea 
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="为了确保准确性，请直接粘贴你的简历文本内容..."
                  className="w-full h-[18.5rem] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none font-mono leading-relaxed"
               />
               <p className="text-xs text-slate-400 mt-2 text-right">支持 Ctrl+V 粘贴</p>
           </div>
        </div>
      </div>

      <div className="mt-10 flex justify-center">
         <button 
            onClick={() => isReady && onStart(companyName, jdText, resumeText)}
            disabled={!isReady}
            className="group px-12 py-5 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-300 hover:bg-slate-800 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 transition-all flex items-center gap-3 text-lg"
         >
            <Play size={20} className="fill-current" />
            生成考题并开始面试
         </button>
      </div>
    </div>
  );
};

export default FastTrackSetupView;