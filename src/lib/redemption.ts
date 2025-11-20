/**
 * Redemption Code System
 * 
 * Handles redeeming license codes to unlock game packs for customers
 */

import { supabase } from '@/integrations/supabase/client';
import { redemptionCodeSchema, validateInput } from './validation';

export interface RedemptionResult {
  success: boolean;
  message: string;
  packsUnlocked?: string[];
  error?: string;
}

/**
 * Verify code against Shopify customer metafields
 */
async function verifyCodeInMetafields(
  code: string,
  customerId: string,
  shopDomain: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('get-customer-metafields', {
      body: { customerId, shopDomain },
    });

    if (error || !data?.metafields) {
      console.error('Error fetching customer metafields:', error);
      return false;
    }

    // Check if any metafield contains the redemption code
    const metafields = data.metafields as Array<{
      namespace: string;
      key: string;
      value: string;
    }>;

    return metafields.some((mf) => 
      mf.key.toLowerCase().includes('redeem') && 
      mf.value.toUpperCase() === code.toUpperCase()
    );
  } catch (error) {
    console.error('Error verifying metafields:', error);
    return false;
  }
}

/**
 * Redeem a license code for a customer
 */
export async function redeemCode(
  code: string,
  customerId: string,
  shopDomain: string
): Promise<RedemptionResult> {
  try {
    // Validate and normalize the code
    let normalizedCode: string;
    try {
      normalizedCode = validateInput(redemptionCodeSchema, code);
    } catch (validationError) {
      return {
        success: false,
        message: validationError instanceof Error ? validationError.message : 'Invalid code format',
        error: 'INVALID_FORMAT',
      };
    }

    // First, verify the code exists in Shopify customer metafields
    const isValidInShopify = await verifyCodeInMetafields(normalizedCode, customerId, shopDomain);
    
    if (!isValidInShopify) {
      return {
        success: false,
        message: 'Code not found in your account. Please contact support.',
        error: 'CODE_NOT_IN_METAFIELDS',
      };
    }

    // Look up tenant_id server-side based on shop_domain for security
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('shop_domain', shopDomain)
      .eq('is_active', true)
      .single();

    if (tenantError || !tenant) {
      console.error('Failed to fetch tenant:', tenantError);
      return {
        success: false,
        message: 'Invalid shop domain',
        error: 'INVALID_SHOP',
      };
    }

    const tenantId = tenant.id;

    // Find the license code
    const { data: licenseCode, error: codeError } = await supabase
      .from('license_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (codeError) {
      console.error('Error fetching license code:', codeError);
      return {
        success: false,
        message: 'Error checking code. Please try again.',
        error: 'DATABASE_ERROR',
      };
    }

    if (!licenseCode) {
      return {
        success: false,
        message: 'Invalid code. Please check and try again.',
        error: 'CODE_NOT_FOUND',
      };
    }

    // Check if code is already used
    if (licenseCode.status !== 'unused' && licenseCode.status !== 'active') {
      return {
        success: false,
        message: 'This code has already been used or is expired.',
        error: 'CODE_USED',
      };
    }

    // Check if code is expired
    if (licenseCode.expires_at) {
      const expiresAt = new Date(licenseCode.expires_at);
      if (expiresAt < new Date()) {
        return {
          success: false,
          message: 'This code has expired.',
          error: 'CODE_EXPIRED',
        };
      }
    }

    // Check if customer already redeemed this code
    const { data: existingLicense } = await supabase
      .from('customer_licenses')
      .select('*')
      .eq('customer_id', customerId)
      .eq('license_code_id', licenseCode.id)
      .eq('shop_domain', shopDomain)
      .maybeSingle();

    if (existingLicense) {
      return {
        success: false,
        message: 'You have already redeemed this code.',
        error: 'ALREADY_REDEEMED',
      };
    }

    // Create customer license record
    const { data: customerLicense, error: licenseError } = await supabase
      .from('customer_licenses')
      .insert({
        customer_id: customerId,
        license_code_id: licenseCode.id,
        shop_domain: shopDomain,
        tenant_id: tenantId,
        status: 'active',
        activated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (licenseError) {
      console.error('Error creating customer license:', licenseError);
      return {
        success: false,
        message: 'Error redeeming code. Please try again.',
        error: 'REDEMPTION_ERROR',
      };
    }

    // Update license code status to active and mark as redeemed
    const { error: updateError } = await supabase
      .from('license_codes')
      .update({
        status: 'active',
        redeemed_by: customerId,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', licenseCode.id);

    if (updateError) {
      console.error('Error updating license code:', updateError);
      // Don't fail the redemption, but log the error
    }

    return {
      success: true,
      message: `Code redeemed! Unlocked packs: ${licenseCode.packs_unlocked.join(', ')}`,
      packsUnlocked: licenseCode.packs_unlocked || [],
    };
  } catch (error) {
    console.error('Unexpected error redeeming code:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
      error: 'UNEXPECTED_ERROR',
    };
  }
}

