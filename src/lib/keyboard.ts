export const SPANISH_CHARS = [
  { char: 'á', key: 'Alt+a', label: 'á' },
  { char: 'é', key: 'Alt+e', label: 'é' },
  { char: 'í', key: 'Alt+i', label: 'í' },
  { char: 'ó', key: 'Alt+o', label: 'ó' },
  { char: 'ú', key: 'Alt+u', label: 'ú' },
  { char: 'ü', key: 'Alt+U', label: 'ü' },
  { char: 'ñ', key: 'Alt+n', label: 'ñ' },
  { char: '¿', key: 'Alt+?', label: '¿' },
  { char: '¡', key: 'Alt+!', label: '¡' },
] as const;

export function insertCharAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement,
  char: string
): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  el.value = before + char + after;

  const newPos = start + char.length;
  el.selectionStart = newPos;
  el.selectionEnd = newPos;

  // Trigger React synthetic event
  const event = new Event('input', { bubbles: true });
  el.dispatchEvent(event);
}

export function handleAltShortcut(
  e: KeyboardEvent,
  el: HTMLInputElement | HTMLTextAreaElement
): boolean {
  if (!e.altKey) return false;

  const map: Record<string, string> = {
    a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú',
    A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú',
    n: 'ñ', N: 'Ñ',
    '?': '¿', '!': '¡',
  };

  const char = map[e.key];
  if (!char) return false;

  e.preventDefault();
  insertCharAtCursor(el, char);
  return true;
}
