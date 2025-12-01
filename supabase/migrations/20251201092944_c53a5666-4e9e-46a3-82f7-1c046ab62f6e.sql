-- Create customer_sessions table for token-based authentication
CREATE TABLE IF NOT EXISTS public.customer_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT NOT NULL,
  shop_domain TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT
);

-- Create index for fast token lookup
CREATE INDEX idx_customer_sessions_token ON public.customer_sessions(session_token);
CREATE INDEX idx_customer_sessions_customer ON public.customer_sessions(customer_id, shop_domain);
CREATE INDEX idx_customer_sessions_expires ON public.customer_sessions(expires_at);

-- Enable RLS
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

-- Customers can view their own sessions
CREATE POLICY "Customers can view their own sessions"
  ON public.customer_sessions
  FOR SELECT
  USING (customer_id = auth.uid()::text);

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM customer_sessions
  WHERE expires_at < now();
END;
$$;