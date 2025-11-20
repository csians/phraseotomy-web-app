-- Create customer_audio table for customer-specific audio uploads
CREATE TABLE IF NOT EXISTS public.customer_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  shop_domain TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  audio_url TEXT NOT NULL,
  filename TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_audio ENABLE ROW LEVEL SECURITY;

-- Allow customers to view their own audio
CREATE POLICY "Customers can view their own audio"
  ON public.customer_audio
  FOR SELECT
  USING (customer_id = (auth.uid())::text);

-- Allow customers to insert their own audio
CREATE POLICY "Customers can upload their own audio"
  ON public.customer_audio
  FOR INSERT
  WITH CHECK (customer_id = (auth.uid())::text);

-- Allow customers to delete their own audio
CREATE POLICY "Customers can delete their own audio"
  ON public.customer_audio
  FOR DELETE
  USING (customer_id = (auth.uid())::text);

-- Add trigger for updated_at
CREATE TRIGGER update_customer_audio_updated_at
  BEFORE UPDATE ON public.customer_audio
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();