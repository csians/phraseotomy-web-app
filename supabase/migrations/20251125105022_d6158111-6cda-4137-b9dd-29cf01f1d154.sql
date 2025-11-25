-- Create customers table to store Shopify customer information
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id text NOT NULL UNIQUE,
  customer_email text,
  customer_name text,
  first_name text,
  last_name text,
  shop_domain text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Customers can view their own data
CREATE POLICY "Customers can view their own data"
ON public.customers
FOR SELECT
USING (customer_id = (auth.uid())::text);

-- Admins can view all customers
CREATE POLICY "Admins can view all customers"
ON public.customers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster lookups
CREATE INDEX idx_customers_customer_id ON public.customers(customer_id);
CREATE INDEX idx_customers_tenant_id ON public.customers(tenant_id);