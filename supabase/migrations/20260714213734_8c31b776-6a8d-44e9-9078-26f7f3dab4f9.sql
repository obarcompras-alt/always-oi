
DROP POLICY IF EXISTS "items_update_auth" ON public.items;
CREATE POLICY "items_update_auth" ON public.items FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
