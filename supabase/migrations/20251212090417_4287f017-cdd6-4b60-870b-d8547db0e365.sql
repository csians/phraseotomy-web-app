-- Add color and is_whisp columns to elements table
ALTER TABLE public.elements 
ADD COLUMN IF NOT EXISTS color text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_whisp boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.elements.color IS 'Hex color code for visual elements (e.g., #FF5733)';
COMMENT ON COLUMN public.elements.is_whisp IS 'True if this is a text-only whisp word, false if visual element with SVG';