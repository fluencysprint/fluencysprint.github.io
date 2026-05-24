import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CEFRLevel, LanguageId } from '../types';
import { createProfile, listProfiles, setActiveProfileId } from '../lib/profile';
import { refreshActiveProfileCache } from '../lib/storage';
import { getLanguagePack } from '../languages';

type Step = 0 | 1 | 2 | 3;

export default function Onboarding() {
  const navigate = useNavigate();
  const existing = listProfiles();
  const hasProfiles = existing.length > 0;

  const [step, setStep] = useState<Step>(0);
  const [language, setLanguage] = useState<LanguageId | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [selfLevel, setSelfLevel] = useState<CEFRLevel | 'beginner' | 'not_sure' | null>(null);
  const [targetLevel, setTargetLevel] = useState<CEFRLevel | null>(null);
  const [dailyTime, setDailyTime] = useState<5 | 10 | 20 | null>(null);
  const [error, setError] = useState('');

  function continueStep() {
    setError('');
    if (step === 0 && !language) { setError('Choose a language.'); return; }
    if (step === 1 && !selfLevel) { setError('Choose your current level.'); return; }
    if (step === 2 && !targetLevel) { setError('Choose your target level.'); return; }
    if (step === 3 && !dailyTime) { setError('Choose a daily time.'); return; }
    if (step < 3) setStep((step + 1) as Step);
    else finish();
  }

  function finish() {
    if (!language || !selfLevel || !targetLevel || !dailyTime) return;
    createProfile({
      displayName: displayName.trim() || undefined,
      targetLanguage: language,
      selfEstimatedLevel: selfLevel,
      targetLevel,
      dailyTime,
    });
    refreshActiveProfileCache();
    navigate('/diagnostic');
  }

  function switchProfile(id: string) {
    setActiveProfileId(id);
    refreshActiveProfileCache();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-white tracking-tight mb-2">Fluency Sprint</div>
          <div className="text-indigo-300 text-base">Diagnostic-first language coach · A1 → C1</div>
        </div>

        {hasProfiles && step === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 mb-4">
            <div className="text-xs text-indigo-500 font-semibold uppercase tracking-widest mb-2">
              Existing learners on this device
            </div>
            <div className="space-y-2">
              {existing.map(p => {
                const pack = getLanguagePack(p.targetLanguage);
                return (
                  <button
                    key={p.id}
                    onClick={() => switchProfile(p.id)}
                    className="w-full text-left flex items-center justify-between px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-all"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-white">
                        {p.displayName || 'Unnamed learner'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {pack.metadata.label} · target {p.targetLevel} · {p.dailyTime} min/day
                      </div>
                    </div>
                    <span className="text-xs text-indigo-500 font-medium">Switch →</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-center text-xs text-slate-400">or create a new profile below</div>
          </div>
        )}

        <div className="flex justify-center gap-2 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-indigo-400' : i < step ? 'w-4 bg-indigo-500' : 'w-4 bg-indigo-800'
              }`}
            />
          ))}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-7">
          <div className="text-xs text-indigo-500 font-semibold uppercase tracking-widest mb-2">
            Step {step + 1} of 4
          </div>

          {step === 0 && (
            <>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">What language do you want to learn?</h2>
              <p className="text-sm text-slate-400 mb-5">You can add more profiles later for other languages.</p>
              <div className="space-y-2.5">
                {([
                  { id: 'spanish' as const, label: 'Spanish', native: 'Español' },
                  { id: 'english' as const, label: 'English', native: 'English' },
                ]).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setLanguage(opt.id)}
                    className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all
                      ${language === opt.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40' : 'border-slate-100 dark:border-slate-600 hover:border-indigo-200 dark:hover:border-indigo-500'}`}
                  >
                    <div className={`text-sm font-semibold ${language === opt.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-slate-400">{opt.native}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label className="text-xs text-slate-500 font-medium block mb-1">Profile name (optional)</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g. Main profile or Beginner learner"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  Useful if you share this device with someone else.
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">What is your current level?</h2>
              <p className="text-sm text-slate-400 mb-5">Be honest — the diagnostic will calibrate from here.</p>
              <div className="space-y-2.5">
                {([
                  { v: 'beginner' as const, label: 'Just starting out', desc: 'I know almost nothing — full beginner' },
                  { v: 'A1' as const, label: 'A1', desc: 'I can greet, introduce myself, basic questions' },
                  { v: 'A2' as const, label: 'A2', desc: 'I can handle simple daily conversations' },
                  { v: 'B1' as const, label: 'B1', desc: 'I can discuss familiar topics with some effort' },
                  { v: 'B2' as const, label: 'B2', desc: 'I communicate well on most topics' },
                  { v: 'not_sure' as const, label: 'Not sure', desc: 'Let the diagnostic decide — starts at A1' },
                ]).map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setSelfLevel(opt.v)}
                    className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all
                      ${selfLevel === opt.v ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40' : 'border-slate-100 dark:border-slate-600 hover:border-indigo-200 dark:hover:border-indigo-500'}`}
                  >
                    <div className={`text-sm font-semibold ${selfLevel === opt.v ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-slate-400">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">What is your goal?</h2>
              <p className="text-sm text-slate-400 mb-5">This sets your readiness target and practice focus.</p>
              <div className="space-y-2.5">
                {(['A2', 'B1', 'B2', 'C1'] as const).map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setTargetLevel(lvl)}
                    className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all
                      ${targetLevel === lvl ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40' : 'border-slate-100 dark:border-slate-600 hover:border-indigo-200 dark:hover:border-indigo-500'}`}
                  >
                    <div className={`text-sm font-semibold ${targetLevel === lvl ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100'}`}>
                      Target {lvl}
                    </div>
                    <div className="text-xs text-slate-400">
                      {lvl === 'A2' && 'Functional everyday Spanish/English'}
                      {lvl === 'B1' && 'Independent — travel, work, opinions'}
                      {lvl === 'B2' && 'Confident — work meetings, longer texts'}
                      {lvl === 'C1' && 'Advanced — exam-ready, academic register'}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">How much time per day?</h2>
              <p className="text-sm text-slate-400 mb-5">Short, focused sessions beat long, unfocused ones.</p>
              <div className="space-y-2.5">
                {([
                  { v: 5 as const, label: '5 minutes', desc: 'Quick check-in — minimum effective dose' },
                  { v: 10 as const, label: '10 minutes', desc: 'Recommended for steady progress' },
                  { v: 20 as const, label: '20 minutes', desc: 'Accelerated improvement track' },
                ]).map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setDailyTime(opt.v)}
                    className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all
                      ${dailyTime === opt.v ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40' : 'border-slate-100 dark:border-slate-600 hover:border-indigo-200 dark:hover:border-indigo-500'}`}
                  >
                    <div className={`text-sm font-semibold ${dailyTime === opt.v ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-slate-400">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <div className="mt-3 text-xs text-red-500">{error}</div>}

          <button
            onClick={continueStep}
            className="w-full mt-6 py-3.5 rounded-2xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors"
          >
            {step < 3 ? 'Continue →' : 'Create profile & start diagnostic →'}
          </button>

          {step > 0 && (
            <button
              onClick={() => setStep((step - 1) as Step)}
              className="w-full mt-2 py-2 rounded-xl text-slate-400 text-xs hover:text-slate-600 dark:hover:text-slate-300"
            >
              Back
            </button>
          )}
        </div>

        <p className="text-center text-indigo-400 text-xs mt-5">
          Your data stays on this device — no account, no servers, no tracking.
        </p>
      </div>
    </div>
  );
}
