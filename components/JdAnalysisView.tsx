import React, { useState, useRef, useEffect, memo } from 'react';
import { JdAnalysis, FileData, SkillCard } from '../types';
import { Target, Upload, Image as ImageIcon, X, Building2, Search, ArrowRight, ChevronDown, ChevronUp, CheckCircle2, Cpu, BrainCircuit, Download, FileImage, FileText, Trash2, Clock, RotateCcw, Loader2 } from 'lucide-react';
import { ResultHeader, SkillMatrix } from './jd-analysis';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { extractTextFromImage } from '../services/geminiService';
import { getLastAnalysisRecord, LastAnalysisRecord } from '../services/cacheService';
import { devLog, devWarn, devError } from '../utils/logger';

interface Props {
  jdAnalysis: JdAnalysis | null;
  onAnalyze: (company: string, text: string, file?: FileData) => void;
  isLoading: boolean;
  onNext: () => void;
  onClearCache: () => void;
  onRestoreFromCache?: (hash: string, record: LastAnalysisRecord) => void;
}

// Progress Bar Component with Running Man
const SimulatedProgress = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    // Slower, more uniform progress that slows down near the end but doesn't hard stop
    const timer = setInterval(() => {
      setProgress(old => {
        if (old >= 99) return 99;
        // Decrease increment size as we get closer to 100
        const remaining = 100 - old;
        const increment = Math.max(0.2, remaining * 0.05); 
        return Math.min(old + increment, 99);
      });
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full mt-8 relative">
       {/* Running Man Container */}
      <div 
        className="absolute bottom-3 transition-all duration-100 ease-linear"
        style={{ left: `calc(${progress}% - 24px)` }}
      >
        <span className="text-2xl filter drop-shadow-sm animate-bounce">🏃</span>
      </div>

      <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
        <div 
           className="h-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-100 ease-linear" 
           style={{ width: `${progress}%` }} 
        />
      </div>
      <div className="flex justify-between items-center mt-3">
         <p className="text-slate-500 text-xs font-medium tracking-wide animate-pulse">
           {progress < 30 ? '正在连接大模型...' : progress < 60 ? '正在深度调研行业背景...' : '正在生成岗位能力模型...'}
         </p>
         <span className="text-violet-600 text-sm font-bold font-mono">{Math.floor(progress)}%</span>
      </div>
    </div>
  );
};

// Text Formatter for Application Scenarios
const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  // Split by newlines
  const paragraphs = text.split('\n').filter(p => p.trim());
  
  return (
    <div className="space-y-3">
      {paragraphs.map((p, idx) => {
        // Parse **bold** syntax
        const parts = p.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={idx} className="leading-relaxed">
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <span key={i} className="font-bold text-violet-700 bg-violet-50 px-1 rounded">{part.slice(2, -2)}</span>;
              }
              return <span key={i}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
};

export const SkillCardItem: React.FC<{ skill: SkillCard }> = memo(({ skill }) => {
  const [isOpen, setIsOpen] = useState(false);

  const isHigh = skill.priority === 'High';
  const isHard = skill.type === 'Hard';

  const badgeColor = isHigh 
    ? 'bg-rose-50 text-rose-600 border-rose-100' 
    : 'bg-slate-100 text-slate-500 border-slate-200';

  const borderColor = isHigh ? 'border-rose-200' : 'border-slate-200';
  const shadowClass = isHigh ? 'shadow-lg shadow-rose-50' : 'shadow-sm';

  return (
    <div className={`bg-white rounded-2xl border ${borderColor} ${shadowClass} p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
       {/* Header */}
       <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
             <div className={`p-1.5 rounded-lg ${isHard ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
               {isHard ? <Cpu size={16} /> : <BrainCircuit size={16} />}
             </div>
             <span className="font-bold text-slate-800 text-base">{skill.name}</span>
          </div>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${badgeColor}`}>
            {isHigh ? 'P0 核心' : 'P1 进阶'}
          </span>
       </div>

       {/* Desc */}
       <p className="text-slate-500 text-sm mb-4 leading-relaxed line-clamp-2">
         {skill.description}
       </p>
       
       {/* Expand Button */}
       <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full py-2 flex items-center justify-center gap-1 text-xs font-bold rounded-lg transition-all no-export
            ${isOpen ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
       >
          {isOpen ? '收起应用场景' : '查看具体行业应用场景'}
          {isOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
       </button>

       {/* Content */}
       {isOpen && (
         <div className="mt-3 animate-fade-in border-t border-slate-100 pt-3">
            <div className="text-xs text-slate-600 bg-slate-50/80 p-3 rounded-lg border border-slate-100 text-justify">
               <FormattedText text={skill.applicationScenario} />
            </div>
         </div>
       )}
    </div>
  );
});

const JdAnalysisView: React.FC<Props> = ({ jdAnalysis, onAnalyze, isLoading, onNext, onClearCache, onRestoreFromCache }) => {
  const [company, setCompany] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<FileData | undefined>(undefined);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // OCR 状态
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // 上次分析记录
  const [lastRecord, setLastRecord] = useState<LastAnalysisRecord | null>(null);
  const [showLastRecordHint, setShowLastRecordHint] = useState(false);

  // 挂载时检查上次分析记录
  useEffect(() => {
    const record = getLastAnalysisRecord();
    if (record && record.company) {
      setLastRecord(record);
      setShowLastRecordHint(true);
    }
  }, []);

  // 从缓存恢复上次分析
  const handleRestoreFromCache = () => {
    if (lastRecord && onRestoreFromCache) {
      onRestoreFromCache(lastRecord.hash, lastRecord);
    }
  };

  // 重新开始分析（忽略上次记录）
  const handleRestart = () => {
    setShowLastRecordHint(false);
    setLastRecord(null);
  };

  const handleExport = async (type: 'image' | 'pdf') => {
    if (!exportRef.current || !jdAnalysis) return;
    setIsExporting(true);
    try {
      // Hide elements we don't want to export
      const elementsToHide = exportRef.current.querySelectorAll('.no-export');
      elementsToHide.forEach(el => ((el as HTMLElement).style.display = 'none'));

      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc', // match slate-50
      });

      // Restore elements
      elementsToHide.forEach(el => ((el as HTMLElement).style.display = ''));

      if (type === 'image') {
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = `${jdAnalysis.companyName}_JD_Analysis.png`;
        link.click();
      } else {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${jdAnalysis.companyName}_JD_Analysis.pdf`);
      }
    } catch (error) {
      devError('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setOcrResult(null);
    setOcrError(null);
    
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      devLog('[上传] 开始处理文件:', selectedFile.name, selectedFile.type);
      
      try {
        const reader = new FileReader();
        
        const fileData = await new Promise<FileData>((resolve, reject) => {
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve({
              mimeType: selectedFile.type,
              data: base64String
            });
          };
          reader.onerror = () => {
            reject(new Error("读取文件失败"));
          };
          reader.readAsDataURL(selectedFile);
        });
        
        setFile(fileData);
        devLog('[上传] 文件已读取，base64 长度:', fileData.data.length);
        
        // 自动触发 OCR 识别
        setIsOcrProcessing(true);
        devLog('[上传] 开始 OCR 识别...');
        
        const result = await extractTextFromImage(fileData);
        
        if (result.success && result.text.trim()) {
          devLog('[上传] OCR 识别成功，文字长度:', result.length);
          setOcrResult(result.text);
          setText(result.text); // 自动填充到输入框
        } else {
          devWarn('[上传] OCR 识别失败或无文字内容');
          setOcrError('未能从图片中识别出文字内容，请手动输入');
        }
      } catch (err) {
        devError('[上传] 处理文件出错:', err);
        setUploadError("Oops，上传失败，请重新上传～");
      } finally {
        setIsOcrProcessing(false);
      }
    }
  };

  const clearFile = () => {
    setFile(undefined);
    setUploadError(null);
    setOcrResult(null);
    setOcrError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getLevelLabel = (level: string) => {
      const map: Record<string, string> = {
          'Entry': '初级 (Entry)',
          'Mid-Level': '中级 (Mid-Level)',
          'Senior': '资深 (Senior)',
          'Executive': '专家/高管 (Executive)'
      };
      return map[level] || level;
  };

  // --- Input View ---
  if (!jdAnalysis) {
    return (
      <div className="max-w-xl mx-auto mt-8 animate-fade-in">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Target size={28} />
            </div>
            <h2 className="text-2xl font-black text-slate-800">目标岗位定位</h2>
            <p className="text-slate-500 mt-2 text-sm">我们会自动调研该公司的背景与行业要求</p>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">目标公司</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input
                  type="text"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all text-sm font-medium"
                  placeholder="例如：字节跳动, Tesla, ..."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">职位描述 (JD)</label>
              <textarea
                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all resize-none text-sm"
                placeholder="粘贴 JD 文本，或上传图片自动识别..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isLoading || isOcrProcessing}
              />
              <div className="mt-2 flex justify-between items-center">
                {/* OCR 状态提示 */}
                <div className="flex items-center gap-2">
                  {isOcrProcessing && (
                    <>
                      <Loader2 size={14} className="text-violet-600 animate-spin" />
                      <span className="text-xs text-violet-600">正在识别图片文字...</span>
                    </>
                  )}
                  {ocrResult && (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-xs text-emerald-600">已识别 {ocrResult.length} 字，可直接编辑确认</span>
                    </>
                  )}
                  {ocrError && (
                    <>
                      <X size={14} className="text-rose-500" />
                      <span className="text-xs text-rose-500">{ocrError}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={onClearCache}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                  title="清除缓存，强制重新分析"
                >
                  <Trash2 size={12} /> 清除缓存
                </button>
              </div>
            </div>

            {/* 上次分析记录提示 */}
            {showLastRecordHint && lastRecord && (
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 animate-fade-in">
                <div className="flex items-center gap-2 text-sm text-violet-700 mb-3">
                  <Clock size={16} />
                  <span>检测到您上次分析过 <strong>{lastRecord.company}</strong> {lastRecord.position ? `- ${lastRecord.position}岗` : ''}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRestoreFromCache}
                    className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={14} /> 查看上次结果
                  </button>
                  <button
                    onClick={handleRestart}
                    className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw size={14} /> 重新分析
                  </button>
                </div>
              </div>
            )}
            
            {/* Divider */}
            <div className="relative flex items-center justify-center">
                 <div className="absolute border-t border-slate-200 w-full"></div>
                 <span className="relative bg-white px-3 text-xs text-slate-400 font-medium uppercase">或者</span>
            </div>

            <div className="flex flex-col gap-2">
               <div className="flex items-center gap-3">
                   <input 
                     type="file" 
                     ref={fileInputRef}
                     onChange={handleFileChange}
                     className="hidden"
                     accept="image/*,application/pdf"
                   />
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="flex-1 py-3 border-2 border-dashed border-slate-200 rounded-xl hover:border-violet-300 hover:bg-violet-50 text-slate-500 text-sm font-medium flex items-center justify-center gap-2 transition-all"
                     disabled={isLoading}
                   >
                     <Upload size={16} /> 上传图片/附件
                   </button>
                   
{file && (
                     <div className="flex items-center gap-2 bg-violet-100 text-violet-700 px-4 py-3 rounded-xl text-sm font-bold">
                       <ImageIcon size={16} />
                       {isOcrProcessing && <Loader2 size={14} className="animate-spin" />}
                       <button onClick={clearFile} disabled={isLoading || isOcrProcessing} className="hover:text-violet-900"><X size={16}/></button>
                     </div>
                   )}
              </div>
              {uploadError && (
                 <p className="text-xs text-rose-500 font-medium text-center">{uploadError}</p>
              )}
            </div>
          </div>

          <div className="mt-8">
            {isLoading || isOcrProcessing ? (
               <div className="flex flex-col items-center justify-center py-4">
                 <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin mb-3" />
                 <p className="text-sm text-slate-500">
                   {isOcrProcessing ? '正在识别图片文字...' : '正在分析 JD...'}
                 </p>
               </div>
            ) : (
              <button
                onClick={() => text.trim() && onAnalyze(company, text, ocrResult ? undefined : file)}
                disabled={!text.trim() || !company.trim()}
                className="w-full py-4 bg-violet-600 text-white rounded-2xl font-bold shadow-lg shadow-violet-200 hover:bg-violet-700 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2"
              >
                  <Search size={20} /> 深度解析岗位
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Results View ---
  return (
    <div className="max-w-6xl mx-auto mt-6 px-4 pb-12 animate-fade-in">
      {/* Export Controls */}
      <div className="flex justify-end gap-3 mb-4 no-export">
        <button
          onClick={() => handleExport('image')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-violet-600 transition-all shadow-sm disabled:opacity-50"
        >
          <FileImage size={16} />
          {isExporting ? '导出中...' : '导出长图'}
        </button>
        <button
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-violet-600 transition-all shadow-sm disabled:opacity-50"
        >
          <FileText size={16} />
          {isExporting ? '导出中...' : '导出 PDF'}
        </button>
      </div>

      <div ref={exportRef} className="bg-slate-50 p-4 -mx-4 sm:mx-0 sm:p-6 rounded-3xl">
        <ResultHeader jdAnalysis={jdAnalysis} level={getLevelLabel(jdAnalysis.level)} />
        <SkillMatrix skills={jdAnalysis.skills} />
      </div>

      <div className="mt-16 flex justify-center no-export">
        <button
          onClick={onNext}
          className="group px-8 py-4 bg-slate-900 text-white rounded-full font-bold shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center gap-3"
        >
          下一步：智能简历诊断 <ArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
        </button>
      </div>
    </div>
  );
};

export default JdAnalysisView;