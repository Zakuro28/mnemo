import { AskLoreResponse } from '../types/lore';

const CACHE_KEY = 'mnemo_ask_answer_cache_v1';
const inMemoryCache = new Map<string, AskLoreResponse>();

export function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

export function getCachedAnswer(query: string): AskLoreResponse | null {
  const key = normalizeQuestion(query);
  if (inMemoryCache.has(key)) {
    return inMemoryCache.get(key)!;
  }
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      inMemoryCache.set(key, parsed);
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to read Ask Mnemo cache:', e);
  }
  return null;
}

export function setCachedAnswer(query: string, data: AskLoreResponse): void {
  const key = normalizeQuestion(query);
  inMemoryCache.set(key, data);
  try {
    localStorage.setItem(`${CACHE_KEY}_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to persist Ask Mnemo cache:', e);
  }
}

export function clearAskCache(): void {
  inMemoryCache.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_KEY)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Failed to clear Ask Mnemo cache:', e);
  }
}
