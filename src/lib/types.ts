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
  imageUrl?: string | null;
}

export const APP_VERSION = 'v0.1.0-dev';

// Extend the global Window interface to include Phraseotomy config
declare global {
  interface Window {
    __PHRASEOTOMY_CONFIG__?: TenantConfig;
    __PHRASEOTOMY_SHOP__?: string;
    __PHRASEOTOMY_CUSTOMER__?: ShopifyCustomer | null;
  }
}
