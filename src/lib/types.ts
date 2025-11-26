/**
 * Core type definitions for the Phraseotomy app
 */

export interface AccessStatus {
  hasActiveLicense: boolean;
  licenseExpiresAt: Date | null;
  unlockedPacks: string[];
  redemptionCode?: string;
}

export interface TenantConfig {
  id: string;
  name: string;
  tenant_key: string;
  shop_domain: string;
  environment: 'staging' | 'production';
  verified: boolean;
}

export interface ShopifyCustomer {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

export const APP_VERSION = 'v0.1.0-dev';
