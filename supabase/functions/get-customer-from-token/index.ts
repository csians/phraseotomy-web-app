/**
 * Supabase Edge Function: Get Customer Data from Token
 * 
 * After verifying a login token, fetches customer data from Shopify
 * using the Customer Account API or Admin API
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_SECRET = Deno.env.get('APP_SIGNING_SECRET')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenPayload {
  shop: string;
  exp: number;
}

async function verifySignedToken(token: string): Promise<false | TokenPayload> {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) {
      console.error('Invalid token format');
      return false;
    }

    // Create expected signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(APP_SECRET);
    const msgData = encoder.encode(payloadB64);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const expectedSig = await crypto.subtle.sign('HMAC', key, msgData);
    const expectedSigB64 = btoa(String.fromCharCode(...new Uint8Array(expectedSig)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Constant-time comparison
    if (sig !== expectedSigB64) {
      console.error('Signature mismatch');
      return false;
    }

    // Decode and parse payload
    const payloadStr = atob(
      payloadB64
        .replace(/-/g, '+')
        .replace(/_/g, '/')
    );
    const payload = JSON.parse(payloadStr);

    // Check expiration
    if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) {
      console.error('Token expired');
      return false;
    }

    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}

/**
 * Fetch customer data from Shopify Admin API
 * Note: This requires the customer ID, which we don't have from the token alone.
 * This function is a placeholder - in production, you'd need to get customer ID
 * from Shopify Customer Account API or store it in the token.
 */
async function fetchShopifyCustomer(
  customerId: string,
  shopDomain: string,
  accessToken: string
): Promise<{
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
} | null> {
  const shop = shopDomain.replace('.myshopify.com', '');
  const url = `https://${shop}.myshopify.com/admin/api/2024-01/customers/${customerId}.json`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', errorText);
      return null;
    }

    const data = await response.json();
    const customer = data.customer;
    
    return {
      id: customer.id?.toString() || customerId,
      email: customer.email || null,
      first_name: customer.first_name || null,
      last_name: customer.last_name || null,
      image_url: customer.image_url || null,
    };
  } catch (error) {
    console.error('Error fetching customer from Shopify:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, customerId } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify token
    const payload = await verifySignedToken(token);
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const shopDomain = payload.shop;

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get tenant configuration to access Shopify credentials
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('shop_domain', shopDomain)
      .eq('is_active', true)
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If customerId is provided, fetch customer data from Shopify
    if (customerId) {
      const accessToken = tenant.shopify_admin_access_token || tenant.shopify_client_secret;

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Shopify access token not configured' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const customer = await fetchShopifyCustomer(customerId, shopDomain, accessToken);

      if (customer) {
        return new Response(
          JSON.stringify({
            valid: true,
            shop: shopDomain,
            customer: {
              id: customer.id,
              email: customer.email,
              firstName: customer.first_name,
              lastName: customer.last_name,
              name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email || null,
              imageUrl: customer.image_url,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // If no customerId provided or customer fetch failed, return token validation result
    return new Response(
      JSON.stringify({
        valid: true,
        shop: shopDomain,
        customer: null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-customer-from-token:', error);
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

