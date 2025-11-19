-- Fix 1: Remove public access to tenants table
DROP POLICY IF EXISTS "Public can view active tenants by shop domain" ON public.tenants;

-- Create a secure function for HMAC verification that doesn't expose secrets
CREATE OR REPLACE FUNCTION public.verify_tenant_for_proxy(shop_domain_param text)
RETURNS TABLE(tenant_id uuid, tenant_name text, shop_domain text, environment tenant_environment)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, shop_domain, environment
  FROM public.tenants
  WHERE shop_domain = shop_domain_param
    AND is_active = true
  LIMIT 1;
$$;

-- Fix 2: Restrict customer_licenses to owner-only access
DROP POLICY IF EXISTS "Customers can view their own licenses" ON public.customer_licenses;

CREATE POLICY "Customers can view their own licenses" 
ON public.customer_licenses 
FOR SELECT 
USING (customer_id = auth.uid()::text);

-- Fix 3: Create the missing user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_roles table
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" 
ON public.user_roles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 4: Improve game session policies
DROP POLICY IF EXISTS "Anyone can view active game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Hosts can create sessions" ON public.game_sessions;

CREATE POLICY "Users can view their game sessions" 
ON public.game_sessions 
FOR SELECT 
USING (
  host_customer_id = auth.uid()::text 
  OR EXISTS (
    SELECT 1 FROM game_players 
    WHERE session_id = game_sessions.id 
    AND player_id = auth.uid()::text
  )
);

CREATE POLICY "Users can create validated sessions" 
ON public.game_sessions 
FOR INSERT 
WITH CHECK (
  host_customer_id = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM customer_licenses 
    WHERE customer_id = auth.uid()::text 
    AND status = 'active'
    AND shop_domain = game_sessions.shop_domain
  )
);