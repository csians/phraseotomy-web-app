-- Add total_points column to customers table
ALTER TABLE public.customers 
ADD COLUMN total_points integer NOT NULL DEFAULT 0;

-- Create function to increment customer total points
CREATE OR REPLACE FUNCTION public.increment_customer_total_points(p_customer_id text, p_points integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE customers
  SET total_points = total_points + p_points
  WHERE customer_id = p_customer_id;
END;
$$;