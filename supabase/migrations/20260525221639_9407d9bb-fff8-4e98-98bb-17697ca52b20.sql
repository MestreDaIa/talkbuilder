CREATE POLICY "auth read bindings" ON public.whatsapp_bindings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert bindings" ON public.whatsapp_bindings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update bindings" ON public.whatsapp_bindings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete bindings" ON public.whatsapp_bindings FOR DELETE TO authenticated USING (true);