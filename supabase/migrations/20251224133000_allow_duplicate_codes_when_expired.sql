-- Allow duplicate codes when one entry is expired
-- This enables creating new entries with the same code value when old entry expires

-- Drop the existing unique constraint
ALTER TABLE public.license_codes
DROP CONSTRAINT IF EXISTS license_codes_tenant_id_code_key;

-- Drop the index if it already exists (in case migration was run before)
DROP INDEX IF EXISTS license_codes_tenant_id_code_unique_active;

-- Create a partial unique index that only enforces uniqueness for non-expired codes
-- This allows multiple entries with the same code if one is expired
CREATE UNIQUE INDEX license_codes_tenant_id_code_unique_active
ON public.license_codes(tenant_id, code)
WHERE status != 'expired';

-- Comment explaining the constraint
COMMENT ON INDEX license_codes_tenant_id_code_unique_active IS 
  'Ensures code uniqueness per tenant for active/unused codes, but allows duplicates when one entry is expired';

