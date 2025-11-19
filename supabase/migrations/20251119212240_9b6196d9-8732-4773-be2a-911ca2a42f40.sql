-- Create trigger function to auto-populate tenant_id based on shop_domain
CREATE OR REPLACE FUNCTION public.set_session_tenant_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Look up tenant_id from shop_domain
  SELECT id INTO NEW.tenant_id
  FROM tenants
  WHERE shop_domain = NEW.shop_domain
    AND is_active = true
  LIMIT 1;
  
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid shop_domain: no active tenant found';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set tenant_id on game session creation
CREATE TRIGGER game_sessions_set_tenant
BEFORE INSERT ON game_sessions
FOR EACH ROW
EXECUTE FUNCTION set_session_tenant_id();

-- Update RLS policy to validate tenant_id matches the license
DROP POLICY IF EXISTS "Users can create validated sessions" ON game_sessions;

CREATE POLICY "Users can create validated sessions"
  ON game_sessions
  FOR INSERT
  WITH CHECK (
    host_customer_id = (auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM customer_licenses
      WHERE customer_licenses.customer_id = (auth.uid())::text
        AND customer_licenses.status = 'active'
        AND customer_licenses.shop_domain = game_sessions.shop_domain
        AND customer_licenses.tenant_id = game_sessions.tenant_id
    )
  );