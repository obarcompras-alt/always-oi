
-- Open access: no login required
DROP POLICY IF EXISTS "Anyone authenticated can view items" ON public.items;
DROP POLICY IF EXISTS "Authenticated can view items" ON public.items;
DROP POLICY IF EXISTS "Staff can update counts" ON public.items;
DROP POLICY IF EXISTS "Admins can insert items" ON public.items;
DROP POLICY IF EXISTS "Admins can update items" ON public.items;
DROP POLICY IF EXISTS "Admins can delete items" ON public.items;
DROP POLICY IF EXISTS "Admins manage items" ON public.items;
DROP POLICY IF EXISTS "Authenticated update items" ON public.items;

DROP POLICY IF EXISTS "Anyone authenticated can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can delete suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins manage suppliers" ON public.suppliers;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO anon, authenticated;

CREATE POLICY "Open read items" ON public.items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open write items" ON public.items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update items" ON public.items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open delete items" ON public.items FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Open read suppliers" ON public.suppliers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open write suppliers" ON public.suppliers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update suppliers" ON public.suppliers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open delete suppliers" ON public.suppliers FOR DELETE TO anon, authenticated USING (true);
