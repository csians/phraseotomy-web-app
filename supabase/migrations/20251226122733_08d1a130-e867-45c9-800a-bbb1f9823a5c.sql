-- Add is_default column to packs table
ALTER TABLE public.packs 
ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Create a function to ensure only one default pack per tenant
CREATE OR REPLACE FUNCTION public.ensure_single_default_pack()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If setting a pack as default, unset all other defaults for the same tenant
  IF NEW.is_default = true THEN
    UPDATE packs 
    SET is_default = false 
    WHERE tenant_id = NEW.tenant_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to enforce single default pack
CREATE TRIGGER ensure_single_default_pack_trigger
BEFORE INSERT OR UPDATE ON public.packs
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_pack();