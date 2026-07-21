
-- =========================================================================
-- FASE 1 — FUNDAÇÃO DE DADOS
-- =========================================================================

-- 1. UNIDADES DE MEDIDA -----------------------------------------------------
CREATE TABLE public.unidades_medida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  abreviacao TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.unidades_medida TO authenticated;
GRANT ALL ON public.unidades_medida TO service_role;
ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unidades leitura autenticados" ON public.unidades_medida FOR SELECT TO authenticated USING (true);
CREATE POLICY "unidades admin escreve" ON public.unidades_medida FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.unidades_medida (nome, abreviacao) VALUES
  ('Unidade', 'un'),
  ('Quilograma', 'kg'),
  ('Litro', 'L'),
  ('Mililitro', 'ml');

-- 2. CONFIG (singleton) -----------------------------------------------------
CREATE TABLE public.config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  frequencia_ciclo TEXT NOT NULL DEFAULT 'semanal' CHECK (frequencia_ciclo IN ('semanal','quinzenal','mensal')),
  dia_virada INT NOT NULL DEFAULT 1,  -- semanal/quinzenal: 0=dom..6=sáb; mensal: 1..28
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.config TO authenticated;
GRANT ALL ON public.config TO service_role;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config leitura autenticados" ON public.config FOR SELECT TO authenticated USING (true);
CREATE POLICY "config admin escreve" ON public.config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.config (id) VALUES (1);

-- 3. CICLOS -----------------------------------------------------------------
CREATE TABLE public.ciclos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('semanal','quinzenal','mensal')),
  inicio DATE NOT NULL,
  fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ciclos_unico_aberto ON public.ciclos (status) WHERE status = 'aberto';
GRANT SELECT ON public.ciclos TO authenticated;
GRANT ALL ON public.ciclos TO service_role;
ALTER TABLE public.ciclos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ciclos leitura autenticados" ON public.ciclos FOR SELECT TO authenticated USING (true);
CREATE POLICY "ciclos admin escreve" ON public.ciclos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ciclo inicial (semana atual, seg a dom)
INSERT INTO public.ciclos (tipo, inicio, fim, status)
VALUES (
  'semanal',
  (date_trunc('week', CURRENT_DATE)::date),
  (date_trunc('week', CURRENT_DATE)::date + 6),
  'aberto'
);

-- função: retorna o ciclo aberto, criando um se necessário
CREATE OR REPLACE FUNCTION public.ciclo_atual()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_cfg RECORD;
  v_inicio DATE;
  v_fim DATE;
BEGIN
  SELECT id INTO v_id FROM public.ciclos WHERE status='aberto' LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT frequencia_ciclo, dia_virada INTO v_cfg FROM public.config WHERE id=1;
  v_inicio := CURRENT_DATE;
  v_fim := CASE v_cfg.frequencia_ciclo
    WHEN 'semanal' THEN v_inicio + 6
    WHEN 'quinzenal' THEN v_inicio + 13
    ELSE (v_inicio + INTERVAL '1 month' - INTERVAL '1 day')::date
  END;
  INSERT INTO public.ciclos (tipo, inicio, fim, status)
  VALUES (v_cfg.frequencia_ciclo, v_inicio, v_fim, 'aberto')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 4. ITEMS: unidade_id + decimal --------------------------------------------
ALTER TABLE public.items ADD COLUMN unidade_id UUID REFERENCES public.unidades_medida(id);
UPDATE public.items SET unidade_id = (SELECT id FROM public.unidades_medida WHERE abreviacao='un');
ALTER TABLE public.items ALTER COLUMN unidade_id SET NOT NULL;
ALTER TABLE public.items ALTER COLUMN unidades_por_fardo TYPE NUMERIC(10,3) USING unidades_por_fardo::numeric;
ALTER TABLE public.items ALTER COLUMN estoque_minimo TYPE NUMERIC(10,3) USING estoque_minimo::numeric;

-- 5. CONTAGENS: ciclo_id + decimal + unique ---------------------------------
ALTER TABLE public.contagens ADD COLUMN ciclo_id UUID REFERENCES public.ciclos(id) ON DELETE CASCADE;
UPDATE public.contagens SET ciclo_id = (SELECT id FROM public.ciclos WHERE status='aberto' LIMIT 1);
ALTER TABLE public.contagens ALTER COLUMN ciclo_id SET NOT NULL;
ALTER TABLE public.contagens ALTER COLUMN unidades TYPE NUMERIC(10,3) USING unidades::numeric;
ALTER TABLE public.contagens ALTER COLUMN fardos TYPE NUMERIC(10,3) USING fardos::numeric;

-- Dedupe possíveis duplicatas antes da constraint (mantém a mais recente)
DELETE FROM public.contagens c USING public.contagens c2
WHERE c.ctid < c2.ctid
  AND c.ciclo_id = c2.ciclo_id
  AND c.item_id  = c2.item_id
  AND c.area     = c2.area
  AND c.tipo     = c2.tipo;

ALTER TABLE public.contagens ADD CONSTRAINT contagens_unico_por_ciclo
  UNIQUE (ciclo_id, item_id, area, tipo);

-- 6. HISTÓRICO DE COMPRAS ---------------------------------------------------
CREATE TABLE public.compras_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ciclo_id UUID REFERENCES public.ciclos(id) ON DELETE SET NULL,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantidade NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
CREATE INDEX compras_historico_item_data ON public.compras_historico (item_id, data DESC);
GRANT SELECT ON public.compras_historico TO authenticated;
GRANT ALL ON public.compras_historico TO service_role;
ALTER TABLE public.compras_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras hist leitura autenticados" ON public.compras_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "compras hist admin escreve" ON public.compras_historico FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- backfill: preço atual dos itens vira histórico inicial
INSERT INTO public.compras_historico (item_id, fornecedor_id, preco_unitario, quantidade, data)
SELECT i.id, i.supplier_id, i.preco_unidade, 0, now() - INTERVAL '1 day'
FROM public.items i
WHERE COALESCE(i.preco_unidade, 0) > 0;

-- função: último preço registrado do item
CREATE OR REPLACE FUNCTION public.preco_estimado(_item_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT preco_unitario FROM public.compras_historico
   WHERE item_id = _item_id
   ORDER BY data DESC LIMIT 1;
$$;

-- 7. LISTAS DE COMPRAS + ITENS ---------------------------------------------
CREATE TABLE public.listas_compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id UUID REFERENCES public.ciclos(id) ON DELETE SET NULL,
  titulo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listas_compras TO authenticated;
GRANT ALL ON public.listas_compras TO service_role;
ALTER TABLE public.listas_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listas leitura autenticados" ON public.listas_compras FOR SELECT TO authenticated USING (true);
CREATE POLICY "listas admin escreve" ON public.listas_compras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.listas_compras_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id UUID NOT NULL REFERENCES public.listas_compras(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quantidade NUMERIC(10,3) NOT NULL DEFAULT 0,
  preco_estimado NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'a_fazer' CHECK (status IN ('a_fazer','solicitado','em_andamento','concluida','nao_realizada')),
  responsavel_id UUID,
  ordem INT NOT NULL DEFAULT 0,
  observacao TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX listas_itens_lista ON public.listas_compras_itens (lista_id);
CREATE INDEX listas_itens_status ON public.listas_compras_itens (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listas_compras_itens TO authenticated;
GRANT ALL ON public.listas_compras_itens TO service_role;
ALTER TABLE public.listas_compras_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listas itens leitura autenticados" ON public.listas_compras_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "listas itens admin escreve" ON public.listas_compras_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER listas_itens_touch BEFORE UPDATE ON public.listas_compras_itens
FOR EACH ROW EXECUTE FUNCTION public.touch_contagens_updated_at();
