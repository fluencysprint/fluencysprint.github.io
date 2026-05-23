let counter = 0;

export function nanoid(): string {
  counter++;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeSpanish(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿¡]/g, '');
}

export function checkAnswer(
  userAnswer: string,
  correctAnswer: string,
  acceptableAnswers?: string[],
  accentMode: 'lenient' | 'strict' = 'lenient'
): { correct: boolean; accentMissing: boolean } {
  const user = userAnswer.trim();
  const correct = correctAnswer.trim();

  const all = [correct, ...(acceptableAnswers ?? [])];

  // Exact match
  if (all.some(a => user.toLowerCase() === a.toLowerCase())) {
    return { correct: true, accentMissing: false };
  }

  if (accentMode === 'lenient') {
    const userNorm = normalizeSpanish(user);
    const hasNormMatch = all.some(a => normalizeSpanish(a) === userNorm);
    if (hasNormMatch) {
      const exactMatch = all.some(a => user.toLowerCase() === a.toLowerCase());
      return { correct: true, accentMissing: !exactMatch };
    }
  }

  return { correct: false, accentMissing: false };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function percentOf(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}
