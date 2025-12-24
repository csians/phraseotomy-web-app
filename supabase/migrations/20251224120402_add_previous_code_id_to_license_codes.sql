-- Add previous_code_id field to license_codes table for tracking code renewal chain
ALTER TABLE public.license_codes
ADD COLUMN previous_code_id uuid REFERENCES public.license_codes(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_license_codes_previous_code_id ON public.license_codes(previous_code_id);

-- Add comment explaining the field
COMMENT ON COLUMN public.license_codes.previous_code_id IS 'References the expired code that was replaced by this code';

