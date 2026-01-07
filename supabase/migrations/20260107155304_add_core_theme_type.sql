-- Add core_theme_type column to themes table
-- This column is only used for core themes (is_core = true)
-- Values: 'feelings', 'events', or NULL
ALTER TABLE public.themes
ADD COLUMN IF NOT EXISTS core_theme_type text CHECK (core_theme_type IN ('feelings', 'events') OR core_theme_type IS NULL);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_themes_core_theme_type ON public.themes(core_theme_type) WHERE core_theme_type IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.themes.core_theme_type IS 'Type of core theme: "feelings" or "events". Only set for themes where is_core = true, NULL for others';

