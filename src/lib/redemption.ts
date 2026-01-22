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
 * If in iframe, redirects parent window; otherwise redirects current window
 */
export function redirectToShopifyWithError(errorMessage: string): void {
  const errorResponse = encodeURIComponent(errorMessage);
  const redirectUrl = `https://phraseotomy.com/pages/redeem-code?status=failed&response=${errorResponse}`;
  console.log('🔄 Redirecting to Shopify with error:', { status: 'failed', response: errorMessage, url: redirectUrl });
  
  // If in iframe, redirect parent window; otherwise redirect current window
  if (window.self !== window.top) {
    window.top!.location.href = redirectUrl;
  } else {
    window.location.href = redirectUrl;
  }
}

/**
 * Get user-friendly error message based on error code
 */
function getErrorMessage(errorCode: string | undefined, defaultMessage: string): string {
  const errorMessages: Record<string, string> = {
    'CODE_NOT_FOUND': 'Invalid code. Please check and try again.',
    'CODE_USED': 'This code has already been used.',
    'CODE_EXPIRED': 'This code has expired.',
    'ALREADY_REDEEMED': 'You have already redeemed this code.',
    'INVALID_FORMAT': 'Invalid code format. Please enter a 6-character code.',
    'REDEMPTION_ERROR': 'Error redeeming code. Please try again.',
    'UNEXPECTED_ERROR': 'An unexpected error occurred. Please try again.',
  };

  return errorCode && errorMessages[errorCode] ? errorMessages[errorCode] : defaultMessage;
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
      const errorCode = 'INVALID_FORMAT';
      const errorMessage = validationError instanceof Error 
        ? validationError.message 
        : getErrorMessage(errorCode, 'Invalid code format. Please enter a 6-character code.');
      return {
        success: false,
        message: errorMessage,
        error: errorCode,
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
      const errorCode = 'REDEMPTION_ERROR';
      const errorMessage = getErrorMessage(errorCode, 'Error redeeming code. Please try again.');
      return {
        success: false,
        message: errorMessage,
        error: errorCode,
      };
    }

    if (!data.success) {
      const errorCode = data.error || 'REDEMPTION_ERROR';
      // Use the message from API if available, otherwise get user-friendly message based on error code
      const errorMessage = data.message || getErrorMessage(errorCode, 'Error redeeming code. Please try again.');
      return {
        success: false,
        message: errorMessage,
        error: errorCode,
      };
    }

    return {
      success: true,
      message: data.message,
      packsUnlocked: data.packsUnlocked || [],
    };
  } catch (error) {
    console.error('Unexpected error redeeming code:', error);
    const errorCode = 'UNEXPECTED_ERROR';
    const errorMessage = getErrorMessage(errorCode, 'An unexpected error occurred. Please try again.');
    return {
      success: false,
      message: errorMessage,
      error: errorCode,
    };
  }
}

