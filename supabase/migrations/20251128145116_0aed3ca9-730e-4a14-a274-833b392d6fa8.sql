-- Add environment-specific customer ID columns to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS staging_customer_id text,
ADD COLUMN IF NOT EXISTS prod_customer_id text;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(customer_email);

-- Add comments for clarity
COMMENT ON COLUMN public.customers.staging_customer_id IS 'Customer ID from staging environment';
COMMENT ON COLUMN public.customers.prod_customer_id IS 'Customer ID from production environment';