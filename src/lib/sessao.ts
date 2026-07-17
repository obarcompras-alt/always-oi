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

function read(): Sessao | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.nome || !parsed?.area || !parsed?.tipo) return null;
    return parsed as Sessao;
  } catch {
    return null;
  }
}

export function setSessao(s: Sessao | null) {
  if (typeof window === "undefined") return;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
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
