import { useSyncExternalStore } from "react";

export const AREAS = ["Estoque", "Bar Tanqueray", "Bar Blonde"] as const;
export type Area = (typeof AREAS)[number];
export type Tipo = "inicio" | "final";

export interface Sessao {
  nome: string;
  area: Area;
  tipo: Tipo;
}

const KEY = "contagem_bar_sessao";
const listeners = new Set<() => void>();

let cached: Sessao | null = null;
let cachedRaw: string | null = null;

function read(): Sessao | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cachedRaw) return cached;
    cachedRaw = raw;
    if (!raw) { cached = null; return null; }
    const parsed = JSON.parse(raw);
    if (!parsed?.nome || !parsed?.area || !parsed?.tipo) { cached = null; return null; }
    cached = parsed as Sessao;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function setSessao(s: Sessao | null) {
  if (typeof window === "undefined") return;
  if (s) { localStorage.setItem(KEY, JSON.stringify(s)); } else { localStorage.removeItem(KEY); }
  cachedRaw = null; // force re-read on next snapshot
  listeners.forEach(l => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

export function useSessao(): Sessao | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
