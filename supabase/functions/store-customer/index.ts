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

    // Get tenant info to determine environment
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('environment')
      .eq('id', tenant_id)
      .single();

    if (tenantError) {
      console.error('Error fetching tenant:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Invalid tenant' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const environment = tenant.environment; // 'staging' or 'production'
    const envCustomerIdColumn = environment === 'staging' ? 'staging_customer_id' : 'prod_customer_id';

    // Check if customer already exists by customer_id
    const { data: existingCustomer, error: checkError } = await supabase
      .from('customers')
      .select('id, customer_email, staging_customer_id, prod_customer_id')
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

    // If found by customer_id, customer already exists - update if email/name changed
    if (existingCustomer) {
      console.log('✅ Customer already exists:', customer_id);
      console.log('📋 Existing customer data:', existingCustomer);
      console.log('📝 New data to potentially update:', { customer_email, customer_name, first_name, last_name });
      
      // Update customer data if email or name is provided and different
      const updateData: any = {};
      if (customer_email && customer_email !== existingCustomer.customer_email) {
        updateData.customer_email = customer_email;
        console.log('📧 Will update email:', customer_email);
      }
      if (customer_name) {
        updateData.customer_name = customer_name;
        console.log('👤 Will update name:', customer_name);
      }
      if (first_name) {
        updateData.first_name = first_name;
      }
      if (last_name) {
        updateData.last_name = last_name;
      }
      
      // Update environment-specific customer_id if not already set
      if (!existingCustomer[envCustomerIdColumn]) {
        updateData[envCustomerIdColumn] = customer_id;
      }
      
      if (Object.keys(updateData).length > 0) {
        console.log('🔄 Updating customer with:', updateData);
        const { data: updatedCustomer, error: updateError } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', existingCustomer.id)
          .select()
          .single();
          
        if (updateError) {
          console.error('❌ Error updating existing customer:', updateError);
        } else {
          console.log('✅ Updated existing customer with new data:', updatedCustomer);
          return new Response(
            JSON.stringify({ success: true, customer: updatedCustomer, is_new: false, updated: true }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } else {
        console.log('ℹ️ No updates needed, customer data unchanged');
      }
      
      return new Response(
        JSON.stringify({ success: true, customer: existingCustomer, is_new: false }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if customer exists by email across all tenants
    if (customer_email) {
      const { data: existingByEmail, error: emailCheckError } = await supabase
        .from('customers')
        .select('id, customer_id, customer_name, staging_customer_id, prod_customer_id')
        .eq('customer_email', customer_email)
        .maybeSingle();

      if (emailCheckError) {
        console.error('Error checking customer by email:', emailCheckError);
      } else if (existingByEmail) {
        // Customer exists with same email - update environment-specific customer_id
        const updateData: any = {
          customer_name,
          first_name,
          last_name,
          [envCustomerIdColumn]: customer_id,
        };

        // If this customer doesn't have a primary customer_id for this tenant yet, set it
        if (existingByEmail.customer_id !== customer_id) {
          updateData.customer_id = customer_id;
          updateData.tenant_id = tenant_id;
          updateData.shop_domain = shop_domain;
        }

        const { data: updatedCustomer, error: updateError } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', existingByEmail.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating customer:', updateError);
        } else {
          console.log(`✅ Updated customer with ${environment} customer_id:`, customer_id);
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
      const insertData: any = {
        customer_id,
        customer_email,
        customer_name,
        first_name,
        last_name,
        shop_domain,
        tenant_id,
        [envCustomerIdColumn]: customer_id,
      };

      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert(insertData)
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
