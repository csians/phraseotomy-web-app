/**
 * Supabase Edge Function: Store Customer
 * 
 * Stores or updates customer data on first/subsequent logins
 * Ensures customer_id is unique
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
      customer_id, 
      customer_email, 
      customer_name,
      first_name,
      last_name,
      shop_domain,
      tenant_id 
    } = await req.json();

    if (!customer_id || !shop_domain || !tenant_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id, shop_domain, and tenant_id are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if customer already exists by customer_id
    const { data: existingCustomer, error: checkError } = await supabase
      .from('customers')
      .select('id, customer_email')
      .eq('customer_id', customer_id)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing customer:', checkError);
      return new Response(
        JSON.stringify({ error: checkError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If found by customer_id, customer already exists
    if (existingCustomer) {
      console.log('✅ Customer already exists:', customer_id);
      return new Response(
        JSON.stringify({ success: true, customer: existingCustomer, is_new: false }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if customer exists by email in the same tenant (different environment)
    if (customer_email) {
      const { data: existingByEmail, error: emailCheckError } = await supabase
        .from('customers')
        .select('id, customer_id')
        .eq('customer_email', customer_email)
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (emailCheckError) {
        console.error('Error checking customer by email:', emailCheckError);
      } else if (existingByEmail) {
        // Customer exists with same email but different customer_id (different environment)
        // Update the customer_id to the new one from this environment
        const { data: updatedCustomer, error: updateError } = await supabase
          .from('customers')
          .update({
            customer_id,
            customer_name,
            first_name,
            last_name,
            shop_domain,
          })
          .eq('id', existingByEmail.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating customer_id:', updateError);
        } else {
          console.log('✅ Updated customer_id from', existingByEmail.customer_id, 'to', customer_id);
          return new Response(
            JSON.stringify({ success: true, customer: updatedCustomer, is_new: false, updated: true }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
    }

    // Customer doesn't exist at all, insert new record
      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert({
          customer_id,
          customer_email,
          customer_name,
          first_name,
          last_name,
          shop_domain,
          tenant_id,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting customer:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log('✅ New customer stored:', customer_id);
      return new Response(
        JSON.stringify({ success: true, customer: newCustomer, is_new: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
  } catch (error) {
    console.error('Error in store-customer:', error);
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
