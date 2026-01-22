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
 * Redirect to Shopify redeem-code page with error message
 */
export function redirectToShopifyWithError(errorMessage: string): void {
  const errorResponse = encodeURIComponent(errorMessage);
  const redirectUrl = `https://phraseotomy.com/pages/redeem-code?status=failed&response=${errorResponse}`;
  console.log('🔄 Redirecting to Shopify with error:', { status: 'failed', response: errorMessage, url: redirectUrl });
  window.location.href = redirectUrl;
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

    // Look for the phraseotomy.license_codes metafield
    const metafields = data.metafields as Array<{
      namespace: string;
      key: string;
      value: string;
      type: string;
    }>;

    const licenseMetafield = metafields.find(
      (mf) => mf.namespace === 'phraseotomy' && mf.key === 'license_codes'
    );

    if (!licenseMetafield) {
      console.log('No license_codes metafield found for customer');
      return false;
    }

    // Parse the JSON array of license codes
    try {
      const codes = JSON.parse(licenseMetafield.value) as string[];
      const normalizedCode = code.toUpperCase().trim();
      
      // Check if the entered code exists in the customer's assigned codes
      return codes.some((c) => c.toUpperCase().trim() === normalizedCode);
    } catch (parseError) {
      console.error('Error parsing license codes metafield:', parseError);
      return false;
    }
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

    // Call edge function to redeem code (it validates code exists and is unused)
    const { data, error } = await supabase.functions.invoke('redeem-license-code', {
      body: {
        code: normalizedCode,
        customerId,
        shopDomain,
      },
    });

    if (error) {
      console.error('Error calling redeem edge function:', error);
      return {
        success: false,
        message: 'Error redeeming code. Please try again.',
        error: 'REDEMPTION_ERROR',
      };
    }

    if (!data.success) {
      return {
        success: false,
        message: data.message || 'Error redeeming code',
        error: data.error || 'REDEMPTION_ERROR',
      };
    }

    return {
      success: true,
      message: data.message,
      packsUnlocked: data.packsUnlocked || [],
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

