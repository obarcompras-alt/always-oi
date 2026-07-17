
ALTER TABLE public.items RENAME COLUMN preco_fardo TO preco_unidade;
ALTER TABLE public.items DROP COLUMN IF EXISTS contagem_atual;

CREATE TABLE public.contagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('inicio','final')),
  area text NOT NULL CHECK (area IN ('Estoque','Bar Tanqueray','Bar Blonde')),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  unidades integer NOT NULL DEFAULT 0,
  fardos integer NOT NULL DEFAULT 0,
  contador_nome text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, area, item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contagens TO anon, authenticated;
GRANT ALL ON public.contagens TO service_role;

ALTER TABLE public.contagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open read contagens" ON public.contagens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open write contagens" ON public.contagens FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update contagens" ON public.contagens FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open delete contagens" ON public.contagens FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_contagens_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER contagens_touch BEFORE UPDATE ON public.contagens
FOR EACH ROW EXECUTE FUNCTION public.touch_contagens_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.contagens;
