-- Fix search_path for cleanup_expired_sessions function
DROP FUNCTION IF EXISTS cleanup_expired_sessions();

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.customer_sessions
  WHERE expires_at < now();
END;
$$;