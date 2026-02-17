/**
 * Supabase Edge Function: Create License Code
 * 
 * Creates license codes with admin privileges using service role
 * Used by Shopify admin interface to bypass RLS
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      code,
      packs_unlocked,
      shop_domain,
      expires_at,
      assignCustomer,
      status,
    } = await req.json();

    if (!code || !shop_domain) {
      return new Response(
        JSON.stringify({ error: 'code and shop_domain are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get tenant ID from shop domain
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('shop_domain', shop_domain)
      .eq('is_active', true)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Tenant not found for shop domain' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Creating license code:', {
      code,
      tenant_id: tenant.id,
      packs_unlocked,
      expires_at,
      assignCustomer: assignCustomer ? { customerId: assignCustomer.customerId } : null,
      status,
    });

    // If a customer is provided, force the code to be active, otherwise default to provided status or "unused"
    const effectiveStatus = assignCustomer ? 'active' : (status ?? 'unused');

    // If assigning to a customer and no explicit expires_at was provided,
    // default to 30 days from now
    let effectiveExpiresAt: string | null = expires_at || null;
    if (assignCustomer && !effectiveExpiresAt) {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      effectiveExpiresAt = in30Days.toISOString();
    }

    // Insert license code using service role (bypasses RLS)
    const { data: newCode, error: insertError } = await supabase
      .from('license_codes')
      .insert({
        tenant_id: tenant.id,
        code: code,
        packs_unlocked: packs_unlocked || [],
        status: effectiveStatus,
        expires_at: effectiveExpiresAt,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating license code:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ License code created successfully:', newCode.id);

    let customerLicense: any = null;

    // When assignCustomer is provided, immediately:
    // 1) mark the code as redeemed_by + redeemed_at
    // 2) create a customer_licenses row
    if (assignCustomer?.customerId) {
      const { customerId, customerEmail, customerName } = assignCustomer;

      const redeemedAt = new Date().toISOString();

      const { error: updateCodeError } = await supabase
        .from('license_codes')
        .update({
          redeemed_by: customerId,
          redeemed_at: redeemedAt,
        })
        .eq('id', newCode.id);

      if (updateCodeError) {
        console.error('Error updating license_codes with redeemed_by during create-license-code:', updateCodeError);
      }

      const { data: newCustomerLicense, error: customerLicenseError } = await supabase
        .from('customer_licenses')
        .insert({
          customer_id: customerId,
          license_code_id: newCode.id,
          customer_email: customerEmail || '',
          customer_name: customerName || '',
          shop_domain,
          tenant_id: tenant.id,
          status: 'active',
          activated_at: redeemedAt,
        })
        .select()
        .single();

      if (customerLicenseError) {
        console.error('Error creating customer license during create-license-code:', customerLicenseError);
      } else {
        customerLicense = newCustomerLicense;
        console.log('✅ Customer license created during create-license-code:', customerLicense.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, code: newCode, customer_license: customerLicense }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in create-license-code:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
