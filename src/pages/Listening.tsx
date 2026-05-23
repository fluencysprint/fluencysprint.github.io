import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Listening() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Listening</h1>
        <p className="text-slate-400 text-sm mt-1">Targeted listening practice — coming soon</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <div className="text-5xl mb-4">🎧</div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Coming soon</h2>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
          A focused listening module — natural-pace dialogues, gap-fill transcripts and skim/scan tasks — is on the roadmap. The current MVP focuses on placement, reading, grammar, vocabulary, writing and adaptive review.
        </p>
        <p className="text-xs text-slate-400 mt-3">
          Until then, your level estimate is based on the skills the app can measure honestly. Listening will not silently lower your readiness percentage.
        </p>
        <button
          onClick={() => navigate('/sprint')}
          className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          Start a sprint instead
        </button>
      </div>
    </div>
  );
}
