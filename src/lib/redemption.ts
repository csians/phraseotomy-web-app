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
 * Redeem a license code for a customer
 */
export async function redeemCode(
  code: string,
  customerId: string,
  shopDomain: string,
  tenantId: string
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

