-- Create theme_codes table for managing theme unlock codes
CREATE TABLE public.theme_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'active', 'expired', 'void')),
  redeemed_by text,
  redeemed_at timestamp with time zone,
  expires_at timestamp with time zone,
  themes_unlocked uuid[] NOT NULL DEFAULT '{}', -- Array of theme IDs
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  previous_code_id uuid REFERENCES public.theme_codes(id),
  UNIQUE(tenant_id, code)
);

-- Enable RLS
ALTER TABLE public.theme_codes ENABLE ROW LEVEL SECURITY;

-- Admins can view all theme codes
CREATE POLICY "Admins can view all theme codes"
ON public.theme_codes
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert theme codes
CREATE POLICY "Admins can insert theme codes"
ON public.theme_codes
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update theme codes
CREATE POLICY "Admins can update theme codes"
ON public.theme_codes
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete theme codes
CREATE POLICY "Admins can delete theme codes"
ON public.theme_codes
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_theme_codes_updated_at
BEFORE UPDATE ON public.theme_codes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create customer_theme_codes table to track which customers have redeemed which theme codes
CREATE TABLE public.customer_theme_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id text NOT NULL,
  customer_email text,
  customer_name text,
  theme_code_id uuid NOT NULL REFERENCES public.theme_codes(id) ON DELETE CASCADE,
  shop_domain text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  activated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster customer lookups
CREATE INDEX idx_customer_theme_codes_customer_id ON public.customer_theme_codes(customer_id);
CREATE INDEX idx_customer_theme_codes_shop_domain ON public.customer_theme_codes(shop_domain);
CREATE INDEX idx_customer_theme_codes_theme_code_id ON public.customer_theme_codes(theme_code_id);

-- Enable RLS
ALTER TABLE public.customer_theme_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_theme_codes
CREATE POLICY "Customers can view their own theme codes"
ON public.customer_theme_codes
FOR SELECT
USING (true); -- Public read for now

CREATE POLICY "Admins can manage all theme codes"
ON public.customer_theme_codes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at on customer_theme_codes
CREATE TRIGGER update_customer_theme_codes_updated_at
BEFORE UPDATE ON public.customer_theme_codes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create junction table for theme codes and themes (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.theme_code_themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  theme_code_id UUID NOT NULL REFERENCES public.theme_codes(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(theme_code_id, theme_id)
);

-- Enable RLS on theme_code_themes
ALTER TABLE public.theme_code_themes ENABLE ROW LEVEL SECURITY;

-- RLS policies for theme_code_themes
CREATE POLICY "Admins can manage theme-code associations"
  ON public.theme_code_themes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
