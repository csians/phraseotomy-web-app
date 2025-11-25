/// <reference types="vite/client" />

interface Window {
  __PHRASEOTOMY_CONFIG__?: any;
  __PHRASEOTOMY_SHOP__?: string;
  __PHRASEOTOMY_CUSTOMER__?: {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
  };
}
