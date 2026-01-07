-- Add core_element_type column to elements table
-- This column is only used for elements in core themes (themes where is_core = true)
-- Values: 'feelings', 'events', or NULL
ALTER TABLE public.elements
ADD COLUMN IF NOT EXISTS core_element_type text CHECK (core_element_type IN ('feelings', 'events') OR core_element_type IS NULL);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_elements_core_element_type ON public.elements(core_element_type) WHERE core_element_type IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.elements.core_element_type IS 'Type of core element: "feelings" or "events". Only set for elements in core themes (themes where is_core = true), NULL for others';

