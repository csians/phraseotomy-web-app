-- Create junction table for theme-pack many-to-many relationship
CREATE TABLE public.theme_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  theme_id UUID NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(theme_id, pack_id)
);

-- Enable RLS
ALTER TABLE public.theme_packs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view theme_packs"
ON public.theme_packs
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert theme_packs"
ON public.theme_packs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete theme_packs"
ON public.theme_packs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for faster lookups
CREATE INDEX idx_theme_packs_theme_id ON public.theme_packs(theme_id);
CREATE INDEX idx_theme_packs_pack_id ON public.theme_packs(pack_id);