import React, { useState, useEffect } from 'react';
import { RefinedResumeResponse, ResumeOptimization } from '../types';
import { generateRefinedResume } from '../services/geminiService';
import { FileText, Download, ArrowRight, Sparkles, Loader2, Info, ArrowLeftRight, Check, XCircle } from 'lucide-react';
import * as docx from "docx";
import saveAs from "file-saver";
import { devError } from '../utils/logger';

function refinedResumeToPlainText(r: RefinedResumeResponse): string {
  const { optimizationLogic, resume } = r;
  const lines: string[] = [];
  if (optimizationLogic?.changesMade) lines.push(`【优化说明】\n${optimizationLogic.changesMade}`);
  if (optimizationLogic?.reasoning) lines.push(`【匹配思路】\n${optimizationLogic.reasoning}`);
  lines.push(
    `【基本信息】${resume.baseInfo.name} | ${resume.baseInfo.phone} | ${resume.baseInfo.email} | ${resume.baseInfo.objective}`,
    `【个人评价】${resume.summary}`,
  );
  for (const job of resume.workExperience) {
    lines.push(`【工作经历】${job.company} | ${job.role} | ${job.date}`, ...(job.points || []).map((p) => `• ${p}`));
  }
  for (const proj of resume.projectExperience || []) {
    lines.push(
      `【项目】${proj.role} | ${proj.name} | ${proj.date}`,
      `简介：${proj.brief}`,
      `难点：${proj.difficulty}`,
      `方案：${proj.solution}`,
      `成果：${proj.result}`,
    );
  }
  if (resume.education) {
    lines.push(`【教育】${resume.education.school} | ${resume.education.degree} | ${resume.education.major} | ${resume.education.date}`);
  }
  return lines.join('\n');
}

interface Props {
  jdContext: string;
  originalResumeText: string;
  improvements: ResumeOptimization['improvements'];
  onNext: (refinedResumePlainText: string) => void;
}

const ResumeRewriteView: React.FC<Props> = ({ jdContext, originalResumeText, improvements, onNext }) => {
  const [refinedResumeResponse, setRefinedResumeResponse] = useState<RefinedResumeResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'compare' | 'preview'>('compare'); // 'compare' vs 'preview'

  useEffect(() => {
    const generate = async () => {
      try {
        setIsGenerating(true);
        const improvementsStr = improvements.map(i => `Original: ${i.original}\nImprovement: ${i.suggestion}`).join('\n');
        const result = await generateRefinedResume(jdContext, originalResumeText, improvementsStr);
        setRefinedResumeResponse(result);
      } catch (e) {
        devError(e);
        setError("生成优化简历失败，请稍后重试。");
      } finally {
        setIsGenerating(false);
      }
    };

    if (!refinedResumeResponse) {
        generate();
    }
  }, [jdContext, originalResumeText, improvements]);

  const downloadDocx = () => {
    if (!refinedResumeResponse) return;
    const { resume } = refinedResumeResponse;

    // Helpers for DOCX generation
    const createHeading = (text: string) => new docx.Paragraph({
        text: text,
        heading: docx.HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        border: { bottom: { color: "000000", space: 1, style: "single", size: 6 } }
    });

    const createEntryHeader = (left: string, right: string) => new docx.Paragraph({
        children: [
            new docx.TextRun({ text: left, bold: true, size: 24 }),
            new docx.TextRun({ text: `\t${right}`, bold: true, size: 24 }),
        ],
        tabStops: [
            { type: docx.TabStopType.RIGHT, position: 9000 },
        ],
        spacing: { before: 120, after: 60 },
    });

    const createBoldLabel = (label: string, content: string) => new docx.Paragraph({
        children: [
            new docx.TextRun({ text: `${label}：`, bold: true }),
            new docx.TextRun({ text: content })
        ],
        spacing: { after: 60 }
    });
    
    const doc = new docx.Document({
        sections: [{
            properties: {},
            children: [
                new docx.Paragraph({
                    text: resume.baseInfo.name,
                    heading: docx.HeadingLevel.HEADING_1,
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { after: 120 }
                }),
                new docx.Paragraph({
                    text: `电话: ${resume.baseInfo.phone} | 邮箱: ${resume.baseInfo.email} | 求职意向: ${resume.baseInfo.objective}`,
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { after: 240 }
                }),

                createHeading("个人评价"),
                new docx.Paragraph({
                    text: resume.summary,
                    spacing: { after: 240 }
                }),

                createHeading("工作经历"),
                ...resume.workExperience.flatMap(job => [
                    createEntryHeader(`${job.role} | ${job.company}`, job.date),
                    ...job.points.map(pt => 
                         new docx.Paragraph({
                            text: `• ${pt}`,
                            spacing: { after: 40 }
                         })
                    )
                ]),

                createHeading("项目经历"),
                ...resume.projectExperience.flatMap(proj => [
                     createEntryHeader(`${proj.role} | ${proj.name}`, proj.date),
                     createBoldLabel("项目简介", proj.brief),
                     createBoldLabel("项目难点", proj.difficulty),
                     createBoldLabel("解决方案", proj.solution),
                     createBoldLabel("项目成果", proj.result),
                     new docx.Paragraph({ text: "", spacing: { after: 120 }})
                ]),

                createHeading("教育背景"),
                createEntryHeader(`${resume.education.degree} | ${resume.education.school} | ${resume.education.major}`, resume.education.date)
            ],
        }],
    });

    docx.Packer.toBlob(doc).then(blob => {
        saveAs(blob, `${resume.baseInfo.name}_Optimized_Resume.docx`);
    });
  };

  if (isGenerating) {
      return (
          <div className="max-w-4xl mx-auto mt-24 text-center animate-fade-in flex flex-col items-center">
              <div className="relative mb-8">
                  <div className="absolute inset-0 bg-violet-500 rounded-full animate-ping opacity-20 duration-1000"></div>
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-violet-200 border border-violet-100 relative z-10">
                    <Sparkles className="text-violet-600 animate-pulse" size={48} />
                  </div>
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">正在重铸您的职业故事...</h2>
              <div className="flex flex-col gap-2 text-slate-500 max-w-md mx-auto text-sm font-medium">
                <p className="flex items-center gap-2 justify-center"><Check size={14} className="text-emerald-500"/> 正在植入 JD 核心关键词</p>
                <p className="flex items-center gap-2 justify-center"><Check size={14} className="text-emerald-500"/> 正在量化项目产出数据</p>
                <p className="flex items-center gap-2 justify-center"><Check size={14} className="text-emerald-500"/> 正在重构 STAR 叙事逻辑</p>
              </div>
          </div>
      );
  }

  if (error || !refinedResumeResponse) {
      return (
        <div className="max-w-2xl mx-auto mt-16 text-center p-8 bg-rose-50 rounded-2xl border border-rose-100 text-rose-800">
             <p>{error || "未知错误"}</p>
        </div>
      );
  }

  const { optimizationLogic, resume } = refinedResumeResponse;

  return (
    <div className="max-w-6xl mx-auto mt-8 px-6 pb-20 animate-fade-in">
        
        {/* Logic Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-[2rem] p-8 mb-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
             <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"><Sparkles size={20} className="text-yellow-300"/></div>
                    <h2 className="text-2xl font-black tracking-tight">简历升级完成</h2>
                 </div>
                 <p className="text-indigo-100 text-lg font-medium leading-relaxed max-w-3xl">
                    {optimizationLogic.changesMade}
                 </p>
                 <div className="mt-6 flex gap-4">
                    <button 
                      onClick={() => setViewMode('compare')}
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'compare' ? 'bg-white text-indigo-700 shadow-lg' : 'bg-indigo-800/50 text-indigo-200 hover:bg-indigo-800'}`}
                    >
                      <ArrowLeftRight size={16}/> 前后对比 (Compare)
                    </button>
                    <button 
                      onClick={() => setViewMode('preview')}
                      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'preview' ? 'bg-white text-indigo-700 shadow-lg' : 'bg-indigo-800/50 text-indigo-200 hover:bg-indigo-800'}`}
                    >
                      <FileText size={16}/> 全文预览 (Preview)
                    </button>
                 </div>
             </div>
        </div>

        {viewMode === 'compare' && (
           <div className="grid gap-6 animate-fade-in">
              <div className="flex items-center justify-between px-4 text-sm font-bold text-slate-400 uppercase tracking-wider">
                  <span>Before (原始描述)</span>
                  <span>After (AI 赋能)</span>
              </div>
              
              {/* Highlight 1: Experience Transformation */}
              {resume.workExperience.slice(0, 2).map((job, i) => (
                 <div key={i} className="grid md:grid-cols-2 gap-0 md:gap-8 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500 text-sm leading-relaxed opacity-80 relative group">
                        <div className="absolute top-4 right-4 text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">Old</div>
                        <h4 className="font-bold mb-2 text-slate-700">{job.role} @ {job.company}</h4>
                        <p className="whitespace-pre-line">{originalResumeText.slice(0, 300)}...</p>
                    </div>
                    
                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-slate-800 text-sm leading-relaxed relative">
                        <div className="absolute top-4 right-4 text-xs font-bold text-emerald-600 bg-white px-2 py-1 rounded border border-emerald-100 flex items-center gap-1">
                           <Sparkles size={10} /> Optimized
                        </div>
                        <h4 className="font-bold mb-3 text-indigo-900">{job.role}</h4>
                        <ul className="space-y-3">
                           {job.points.map((pt, j) => (
                              <li key={j} className="flex items-start gap-2">
                                <Check size={14} className="mt-1 text-emerald-500 shrink-0"/>
                                <span>{pt}</span>
                              </li>
                           ))}
                        </ul>
                    </div>
                 </div>
              ))}

              <div className="text-center py-6">
                 <p className="text-slate-400 text-sm mb-4">...更多项目经历与教育背景已同步优化</p>
                 <button onClick={() => setViewMode('preview')} className="text-indigo-600 font-bold hover:underline">查看完整简历 &rarr;</button>
              </div>
           </div>
        )}

        {viewMode === 'preview' && (
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden animate-fade-in">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><FileText size={20}/></div>
                        <h2 className="text-xl font-bold text-slate-800">简历预览模式</h2>
                    </div>
                    <button 
                        onClick={downloadDocx}
                        className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
                    >
                        <Download size={16}/> 导出 Word 文档
                    </button>
                </div>

                <div className="p-12 max-h-[800px] overflow-y-auto bg-white text-slate-800 font-serif leading-relaxed text-sm">
                     {/* 1. Header */}
                    <div className="text-center border-b-2 border-slate-800 pb-6 mb-8">
                        <h1 className="text-3xl font-bold mb-3 tracking-wide text-slate-900">{resume.baseInfo.name}</h1>
                        <p className="text-slate-600 font-medium tracking-wide">
                            {resume.baseInfo.phone} | {resume.baseInfo.email} | {resume.baseInfo.objective}
                        </p>
                    </div>

                    {/* 2. Summary */}
                    <div className="mb-8">
                        <h3 className="font-bold text-lg border-b border-slate-200 mb-4 pb-1 uppercase tracking-wider text-indigo-900">个人评价</h3>
                        <p className="text-justify text-slate-700 bg-slate-50 p-4 rounded-lg border-l-4 border-indigo-500">{resume.summary}</p>
                    </div>

                    {/* 3. Work Experience */}
                    <div className="mb-8">
                        <h3 className="font-bold text-lg border-b border-slate-200 mb-4 pb-1 uppercase tracking-wider text-indigo-900">工作经历</h3>
                        {resume.workExperience.map((job, i) => (
                            <div key={i} className="mb-6">
                                <div className="flex justify-between font-bold text-base mb-2 items-end">
                                    <span className="text-lg text-slate-800">{job.company} | {job.role}</span>
                                    <span className="text-slate-500 text-sm font-sans bg-slate-100 px-2 py-0.5 rounded">{job.date}</span>
                                </div>
                                <ul className="space-y-2 text-slate-700">
                                    {job.points.map((pt, j) => (
                                        <li key={j} className="flex items-start gap-2">
                                            <span className="mt-1.5 w-1.5 h-1.5 bg-slate-400 rounded-full shrink-0"></span>
                                            <span className="leading-6">{pt}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* 4. Project Experience */}
                    <div className="mb-8">
                        <h3 className="font-bold text-lg border-b border-slate-200 mb-4 pb-1 uppercase tracking-wider text-indigo-900">项目经历</h3>
                        {resume.projectExperience.map((proj, i) => (
                            <div key={i} className="mb-8 last:mb-0 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <div className="flex justify-between font-bold text-base mb-4 border-b border-slate-200 pb-2">
                                    <span className="text-indigo-900">{proj.role} | {proj.name}</span>
                                    <span className="text-slate-500 text-sm font-sans">{proj.date}</span>
                                </div>
                                <div className="space-y-3 pl-0 text-slate-700">
                                    <div className="grid grid-cols-[80px_1fr] gap-2">
                                        <span className="font-bold text-slate-400 text-xs uppercase tracking-wider pt-1">简介</span>
                                        <span>{proj.brief}</span>
                                    </div>
                                    <div className="grid grid-cols-[80px_1fr] gap-2">
                                        <span className="font-bold text-rose-400 text-xs uppercase tracking-wider pt-1">难点</span>
                                        <span>{proj.difficulty}</span>
                                    </div>
                                    <div className="grid grid-cols-[80px_1fr] gap-2">
                                        <span className="font-bold text-indigo-400 text-xs uppercase tracking-wider pt-1">方案</span>
                                        <span>{proj.solution}</span>
                                    </div>
                                    <div className="grid grid-cols-[80px_1fr] gap-2">
                                        <span className="font-bold text-emerald-500 text-xs uppercase tracking-wider pt-1">成果</span>
                                        <span className="font-bold text-emerald-800">{proj.result}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <div className="mt-10 flex justify-center">
             <button 
                onClick={() => refinedResumeResponse && onNext(refinedResumeToPlainText(refinedResumeResponse))}
                className="group px-10 py-5 bg-slate-900 text-white rounded-full font-bold shadow-2xl shadow-slate-400 hover:scale-105 hover:bg-slate-800 transition-all flex items-center gap-3 text-lg"
             >
                <div className="relative">
                    <span className="absolute -inset-1 rounded-full bg-white/20 animate-pulse"></span>
                    <Sparkles size={20} className="relative z-10 text-yellow-300"/> 
                </div>
                带着这份简历，开始模拟面试 <ArrowRight size={20} />
             </button>
        </div>
    </div>
  );
};

export default ResumeRewriteView;