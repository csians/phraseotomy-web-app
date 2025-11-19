-- Create license_codes table for managing 6-digit codes
CREATE TABLE public.license_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'active', 'expired', 'void')),
  redeemed_by text,
  redeemed_at timestamp with time zone,
  expires_at timestamp with time zone,
  packs_unlocked text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Enable RLS
ALTER TABLE public.license_codes ENABLE ROW LEVEL SECURITY;

-- Admins can view all codes
CREATE POLICY "Admins can view all codes"
ON public.license_codes
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert codes
CREATE POLICY "Admins can insert codes"
ON public.license_codes
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update codes
CREATE POLICY "Admins can update codes"
ON public.license_codes
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete codes
CREATE POLICY "Admins can delete codes"
ON public.license_codes
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_license_codes_updated_at
BEFORE UPDATE ON public.license_codes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();