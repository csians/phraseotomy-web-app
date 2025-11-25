-- Create packs table
CREATE TABLE IF NOT EXISTS public.packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Enable RLS on packs table
ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;

-- RLS policies for packs
CREATE POLICY "Admins can view all packs"
  ON public.packs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert packs"
  ON public.packs
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update packs"
  ON public.packs
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete packs"
  ON public.packs
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_packs_updated_at
  BEFORE UPDATE ON public.packs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create junction table for license codes and packs (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.license_code_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_code_id UUID NOT NULL REFERENCES public.license_codes(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(license_code_id, pack_id)
);

-- Enable RLS on license_code_packs
ALTER TABLE public.license_code_packs ENABLE ROW LEVEL SECURITY;

-- RLS policies for license_code_packs
CREATE POLICY "Admins can manage code-pack associations"
  ON public.license_code_packs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));