import React, { useRef, useEffect } from 'react';
import { SPANISH_CHARS, insertCharAtCursor, handleAltShortcut } from '../lib/keyboard';
import { saveDraft } from '../lib/storage';
import { getActiveLanguageId } from '../lib/activeLanguage';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Persist text under this draft slot on every change. */
  draftSlot?: string;
}

/**
 * Drop-in replacement for SpanishInput: text input that conditionally renders
 * the Spanish accent toolbar based on the active language pack.
 */
export default function LanguageInput({
  value, onChange, placeholder, multiline = false, rows = 3,
  className = '', disabled = false, autoFocus = false, draftSlot,
}: Props) {
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpanish = getActiveLanguageId() === 'spanish';

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!draftSlot) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft(draftSlot, value);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draftSlot, value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!inputRef.current || !isSpanish) return;
    handleAltShortcut(e.nativeEvent, inputRef.current);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onChange(e.target.value);
  }

  function insertChar(char: string) {
    if (!inputRef.current) return;
    insertCharAtCursor(inputRef.current, char);
    onChange(inputRef.current.value);
    inputRef.current.focus();
  }

  const baseClass = `w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all text-base bg-white disabled:opacity-50 ${className}`;

  return (
    <div className="space-y-2">
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={`${baseClass} resize-none`}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={baseClass}
        />
      )}

      {isSpanish && (
        <div className="flex flex-wrap gap-1" data-testid="accent-toolbar">
          {SPANISH_CHARS.map(({ char, label }) => (
            <button
              key={char}
              type="button"
              onClick={() => insertChar(char)}
              disabled={disabled}
              className="px-2 py-1 text-sm rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 font-medium transition-colors disabled:opacity-40 select-none"
              title={char}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
