import createApp from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';

let app: ReturnType<typeof createApp> | null = null;

export const getAppBridge = () => {
  if (app) return app;

  const hostParam = new URLSearchParams(window.location.search).get('host');
  if (!hostParam) return null; // not running inside Shopify

  app = createApp({
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY!,
    host: hostParam,
    forceRedirect: true,
  });

  return app;
};
