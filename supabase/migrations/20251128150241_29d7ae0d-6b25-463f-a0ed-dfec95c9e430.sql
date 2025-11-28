-- Add RLS policies for admins to manage packs
CREATE POLICY "Admins can insert packs" 
ON public.packs 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update packs" 
ON public.packs 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete packs" 
ON public.packs 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));