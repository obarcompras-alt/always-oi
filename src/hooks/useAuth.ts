import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function slugNome(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function fakeEmail(nome: string) {
  return `${slugNome(nome)}@bar.local`;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      const n = (u?.user_metadata as { nome?: string } | undefined)?.nome ?? null;
      setNome(n);
    });
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      const n = (u?.user_metadata as { nome?: string } | undefined)?.nome ?? null;
      setNome(n);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, nome, loading };
}

export async function signUp(nome: string, senha: string) {
  const email = fakeEmail(nome);
  return supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome: nome.trim() } },
  });
}

export async function signIn(nome: string, senha: string) {
  const email = fakeEmail(nome);
  return supabase.auth.signInWithPassword({ email, password: senha });
}

export async function signOut() {
  return supabase.auth.signOut();
}
