import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Speaking() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Speaking</h1>
        <p className="text-slate-400 text-sm mt-1">Timed speaking with feedback — coming soon</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <div className="text-5xl mb-4">◉</div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Coming soon</h2>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
          Reliable speaking practice with timed prompts and self-assessment is on the roadmap. The previous prototype was removed because it gave noisy feedback that could distort your level estimate.
        </p>
        <p className="text-xs text-slate-400 mt-3">
          Productive-skill confidence in the dashboard will simply say "no evidence yet" until this module ships.
        </p>
        <button
          onClick={() => navigate('/writing')}
          className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          Practice writing instead
        </button>
      </div>
    </div>
  );
}
