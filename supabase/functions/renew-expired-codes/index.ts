/**
 * Supabase Edge Function: Renew Expired Codes
 * 
 * Finds expired license codes and creates new unused codes with the same pack details.
 * Links the new code to the expired code via previous_code_id.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Note: Code generation functions removed - we now reuse the same code value
// instead of generating new codes when renewing expired codes

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting expired code renewal process...');

    // Create service role client (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Option 1: Use PostgreSQL function (more efficient, runs in database)
    // Uncomment this section to use the PostgreSQL function instead
    /*
    const { data: pgResults, error: pgError } = await supabaseAdmin
      .rpc('renew_expired_license_codes');

    if (pgError) {
      console.error('❌ Error calling PostgreSQL function:', pgError);
      // Fall through to edge function implementation
    } else if (pgResults && pgResults.length > 0) {
      const successCount = pgResults.filter((r: any) => r.success).length;
      const errorCount = pgResults.filter((r: any) => !r.success).length;
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${pgResults.length} expired code(s) using PostgreSQL function`,
          renewed: successCount,
          failed: errorCount,
          results: pgResults
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    */

    // Option 2: Use edge function implementation (current implementation)

    // Find all expired codes that are still marked as 'active'
    // IMPORTANT: Only process 'active' codes that have expired
    // Do NOT process codes that are already 'expired' - they should stay expired
    const now = new Date().toISOString();
    const { data: expiredCodes, error: fetchError } = await supabaseAdmin
      .from('license_codes')
      .select('*')
      .eq('status', 'active') // Only 'active' status codes
      .lt('expires_at', now) // That have expired (expires_at < now)
      .not('expires_at', 'is', null); // And have an expiration time set

    if (fetchError) {
      console.error('❌ Error fetching expired codes:', fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch expired codes',
          details: fetchError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!expiredCodes || expiredCodes.length === 0) {
      console.log('✅ No expired codes found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expired codes found',
          renewed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${expiredCodes.length} expired code(s) to renew`);

    const renewalResults: Array<{
      expiredCodeId: string;
      expiredCode: string;
      newCodeId?: string;
      newCode?: string;
      success: boolean;
      error?: string;
      warning?: string;
    }> = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each expired code
    for (const expiredCode of expiredCodes) {
      try {
        // Double-check: Verify code is still 'active' before processing
        // This prevents processing codes that were already set to 'expired' by another process
        const { data: verifyCode } = await supabaseAdmin
          .from('license_codes')
          .select('status')
          .eq('id', expiredCode.id)
          .single();
        
        if (!verifyCode || verifyCode.status !== 'active') {
          console.log(`⏭️ Skipping code ${expiredCode.code} (ID: ${expiredCode.id}) - status is '${verifyCode?.status}', not 'active'`);
          continue; // Skip if already expired or not active
        }
        
        // IMPORTANT: Update old entry to 'expired' FIRST, then create new entry
        // This ensures the unique constraint allows the new entry (partial index only enforces uniqueness for non-expired codes)
        
        // Step 1: Update old entry status to 'expired' (keep it as historical record, unchanged otherwise)
        console.log(`🔄 Processing expired code: ${expiredCode.code} (ID: ${expiredCode.id})`);
        const { error: updateError } = await supabaseAdmin
          .from('license_codes')
          .update({ status: 'expired' })
          .eq('id', expiredCode.id)
          .eq('status', 'active'); // Extra safety: only update if still 'active'

        if (updateError) {
          console.error(`❌ Error updating expired code ${expiredCode.id}:`, updateError);
          renewalResults.push({
            expiredCodeId: expiredCode.id,
            expiredCode: expiredCode.code,
            success: false,
            error: `Failed to update old entry: ${updateError.message}`
          });
          errorCount++;
          continue;
        }

        // Step 2: Create NEW entry with same code value, same packs, but unused status
        // Old entry is now 'expired', so unique constraint allows this new entry
        console.log(`📝 Creating NEW entry for code ${expiredCode.code} (old ID: ${expiredCode.id})`);
        
        const { data: newCodeData, error: insertError } = await supabaseAdmin
          .from('license_codes')
          .insert({
            tenant_id: expiredCode.tenant_id,
            code: expiredCode.code, // Same code value
            packs_unlocked: expiredCode.packs_unlocked, // Same packs
            status: 'unused', // New entry is unused
            previous_code_id: expiredCode.id, // Link to old entry
            // Explicitly set these to null/empty for new entry
            redeemed_by: null,
            redeemed_at: null,
            expires_at: null,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Error creating new code entry for expired code ${expiredCode.id}:`, insertError);
          console.error(`❌ Insert error details:`, JSON.stringify(insertError, null, 2));
          // Rollback: try to set old entry back to 'active' if insert failed
          await supabaseAdmin
            .from('license_codes')
            .update({ status: 'active' })
            .eq('id', expiredCode.id);
          
          renewalResults.push({
            expiredCodeId: expiredCode.id,
            expiredCode: expiredCode.code,
            success: false,
            error: insertError.message
          });
          errorCount++;
          continue;
        }

        // Verify new entry was created (different ID)
        if (newCodeData.id === expiredCode.id) {
          console.error(`❌ ERROR: New entry has same ID as old entry! This should not happen.`);
          renewalResults.push({
            expiredCodeId: expiredCode.id,
            expiredCode: expiredCode.code,
            success: false,
            error: 'New entry has same ID as old entry - INSERT failed'
          });
          errorCount++;
          continue;
        }

        // Success: Old entry is 'expired', new entry created with same code (different ID)
        console.log(`✅ Created NEW entry: ID=${newCodeData.id}, Code=${newCodeData.code} (old entry ID=${expiredCode.id})`);
        
        renewalResults.push({
          expiredCodeId: expiredCode.id,
          expiredCode: expiredCode.code,
          newCodeId: newCodeData.id, // NEW ID (different from old)
          newCode: newCodeData.code, // Same code value
          success: true
        });
        successCount++;

      } catch (error) {
        console.error(`❌ Unexpected error processing expired code ${expiredCode.id}:`, error);
        renewalResults.push({
          expiredCodeId: expiredCode.id,
          expiredCode: expiredCode.code,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        errorCount++;
      }
    }

    console.log(`✅ Renewal process completed: ${successCount} succeeded, ${errorCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${expiredCodes.length} expired code(s)`,
        renewed: successCount,
        failed: errorCount,
        results: renewalResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error in renew-expired-codes:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

