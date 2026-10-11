import { useState, useEffect } from 'react';
const PREFIX = 'aipm_draft_';
export function useSessionState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(PREFIX + key);
      return raw === null ? initial : JSON.parse(raw);
    } catch { return initial; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}
export function clearSessionDraft() {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
  } catch {}
}
