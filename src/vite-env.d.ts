/// <reference types="vite/client" />

interface Window {
  __PHRASEOTOMY_CONFIG__?: {
    id: string;
    name: string;
    tenant_key: string;
    shop_domain: string;
    environment: 'staging' | 'production';
    verified: boolean;
  };
  __PHRASEOTOMY_SHOP__?: string;
  __PHRASEOTOMY_CUSTOMER__?: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  };
}
