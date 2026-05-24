import React from 'react';
import { CEFR_ORDER } from '../types';
import type { CEFRLevel } from '../types';

interface Props {
  currentLevel: CEFRLevel;
  targetLevel?: CEFRLevel;
}

export default function LevelPath({ currentLevel, targetLevel }: Props) {
  const currentIndex = CEFR_ORDER.indexOf(currentLevel);
  const targetIndex = targetLevel ? CEFR_ORDER.indexOf(targetLevel) : currentIndex;

  return (
    <div className="flex items-center gap-1 w-full" data-testid="level-path">
      {CEFR_ORDER.map((level, i) => {
        const isActive = i === currentIndex;
        const isPast = i < currentIndex;
        const isFuture = i > currentIndex;
        const isTarget = i === targetIndex && i !== currentIndex;

        return (
          <React.Fragment key={level}>
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                  ${isActive
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : isPast
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500'
                  }`}
                aria-label={`Level ${level}${isActive ? ' (current)' : ''}${isTarget ? ' (target)' : ''}`}
              >
                {isPast ? '✓' : level}
              </div>
              {isTarget && (
                <span className="text-[10px] text-amber-500 font-medium mt-1">target</span>
              )}
              {isFuture && !isTarget && i === currentIndex + 1 && (
                <span className="text-[10px] text-indigo-500 font-medium mt-1">next</span>
              )}
            </div>
            {i < CEFR_ORDER.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < currentIndex ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
