-- Create customer_licenses table to track which customers have redeemed which codes
CREATE TABLE public.customer_licenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id text NOT NULL,
  customer_email text,
  customer_name text,
  license_code_id uuid NOT NULL REFERENCES public.license_codes(id) ON DELETE CASCADE,
  shop_domain text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  activated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster customer lookups
CREATE INDEX idx_customer_licenses_customer_id ON public.customer_licenses(customer_id);
CREATE INDEX idx_customer_licenses_shop_domain ON public.customer_licenses(shop_domain);

-- Enable RLS
ALTER TABLE public.customer_licenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_licenses
CREATE POLICY "Customers can view their own licenses"
ON public.customer_licenses
FOR SELECT
USING (true); -- Public read for now, will restrict based on customer auth later

CREATE POLICY "Admins can manage all licenses"
ON public.customer_licenses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create game_sessions table
CREATE TABLE public.game_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_customer_id text NOT NULL,
  host_customer_name text,
  lobby_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
  packs_used text[] NOT NULL DEFAULT '{}',
  shop_domain text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster lobby code lookups
CREATE INDEX idx_game_sessions_lobby_code ON public.game_sessions(lobby_code);
CREATE INDEX idx_game_sessions_host ON public.game_sessions(host_customer_id);
CREATE INDEX idx_game_sessions_shop_domain ON public.game_sessions(shop_domain);

-- Enable RLS
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_sessions
CREATE POLICY "Anyone can view active game sessions"
ON public.game_sessions
FOR SELECT
USING (true); -- Public read for lobby joining

CREATE POLICY "Hosts can create sessions"
ON public.game_sessions
FOR INSERT
WITH CHECK (true); -- Will restrict based on customer auth later

CREATE POLICY "Hosts can update their own sessions"
ON public.game_sessions
FOR UPDATE
USING (true); -- Will restrict based on customer auth later

CREATE POLICY "Admins can manage all sessions"
ON public.game_sessions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at on customer_licenses
CREATE TRIGGER update_customer_licenses_updated_at
BEFORE UPDATE ON public.customer_licenses
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add trigger for updated_at on game_sessions
CREATE TRIGGER update_game_sessions_updated_at
BEFORE UPDATE ON public.game_sessions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();