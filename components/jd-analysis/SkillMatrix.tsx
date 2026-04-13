import React, { memo } from 'react';
import { SkillCard } from '../../types';
import { SkillCardItem } from '../JdAnalysisView';
import { Cpu, BrainCircuit, Zap } from 'lucide-react';

interface SkillMatrixProps {
  skills: SkillCard[];
}

const SkillMatrix: React.FC<SkillMatrixProps> = memo(({ skills }) => {
  const hardSkills = skills
    .filter(s => s.type === 'Hard')
    .sort((a, b) => (a.priority === 'High' ? -1 : 1));

  const softSkills = skills
    .filter(s => s.type === 'Soft')
    .sort((a, b) => (a.priority === 'High' ? -1 : 1));

  return (
    <>
      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Zap className="text-violet-600" /> 核心能力雷达
      </h3>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Hard Skills Column */}
        <div>
          <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
            <Cpu className="text-blue-600" size={20}/>
            <h4 className="font-bold text-blue-900">专业硬技能</h4>
            <span className="ml-auto text-xs font-medium text-blue-400 px-2 bg-white rounded-full">{hardSkills.length}</span>
          </div>
          <div className="space-y-4">
            {hardSkills.map((skill, idx) => (
              <SkillCardItem key={idx} skill={skill} />
            ))}
            {hardSkills.length === 0 && <p className="text-sm text-slate-400 text-center py-4">未检测到硬技能要求</p>}
          </div>
        </div>

        {/* Soft Skills Column */}
        <div>
          <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <BrainCircuit className="text-emerald-600" size={20}/>
            <h4 className="font-bold text-emerald-900">通用软技能</h4>
            <span className="ml-auto text-xs font-medium text-emerald-400 px-2 bg-white rounded-full">{softSkills.length}</span>
          </div>
          <div className="space-y-4">
            {softSkills.map((skill, idx) => (
              <SkillCardItem key={idx} skill={skill} />
            ))}
            {softSkills.length === 0 && <p className="text-sm text-slate-400 text-center py-4">未检测到软技能要求</p>}
          </div>
        </div>
      </div>
    </>
  );
});

SkillMatrix.displayName = 'SkillMatrix';

export default SkillMatrix;
