import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

// Type for embedded config from Shopify proxy entry
interface TenantConfig {
  id: string;
  name: string;
  tenant_key: string;
  shop_domain: string;
  environment: 'staging' | 'production';
  verified: boolean;
}

declare global {
  interface Window {
    __PHRASEOTOMY_CONFIG__?: TenantConfig;
    __PHRASEOTOMY_SHOP__?: string;
  }
}

const Play = () => {
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);

  useEffect(() => {
    // Check Supabase configuration
    setIsConfigured(isSupabaseConfigured());

    // Check for embedded tenant configuration from Shopify proxy
    if (window.__PHRASEOTOMY_CONFIG__) {
      console.log('=== SHOPIFY PROXY MODE ===');
      console.log('Embedded config:', window.__PHRASEOTOMY_CONFIG__);
      console.log('Shop:', window.__PHRASEOTOMY_SHOP__);
      setTenant(window.__PHRASEOTOMY_CONFIG__);
      setShopDomain(window.__PHRASEOTOMY_SHOP__ || null);
    } else {
      console.log('=== DIRECT ACCESS MODE ===');
      console.log('Full URL:', window.location.href);
      console.log('No embedded config found');
      setTenantError('App must be accessed through Shopify App Proxy');
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      {/* Logo Area */}
      <div className="mb-8 text-center">
        <div className="w-24 h-24 mx-auto mb-4 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="text-4xl font-bold text-primary-foreground">P</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2 tracking-tight">
          Phraseotomy
        </h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          Web App
        </p>
      </div>

      {/* Debug Info - Visible on page */}
      <div className="w-full max-w-md bg-yellow-50 dark:bg-yellow-950 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl p-4 mb-4 space-y-2">
        <h3 className="text-sm font-bold text-yellow-900 dark:text-yellow-100">🐛 Debug Info</h3>
        <div className="text-xs font-mono space-y-1 text-yellow-900 dark:text-yellow-100">
          <p><strong>URL:</strong> {window.location.href}</p>
          <p><strong>Path:</strong> {window.location.pathname}</p>
          <p><strong>Shop:</strong> {shopDomain || '(not detected)'}</p>
          <p><strong>Mode:</strong> {window.__PHRASEOTOMY_CONFIG__ ? 'Proxy ✓' : 'Direct'}</p>
          <p><strong>Tenant:</strong> {tenant ? tenant.name : 'None'}</p>
          <p><strong>Verified:</strong> {tenant?.verified ? '✓' : '✗'}</p>
        </div>
      </div>

      {/* Status Card */}
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-card-foreground mb-1">
            Development Build
          </h2>
          <div className="inline-block px-3 py-1 bg-accent/20 text-accent text-xs font-medium rounded-full">
            v0.1.0-dev
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Shop Info */}
        {shopDomain ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Shop Domain
              </p>
              <p className="text-sm text-card-foreground font-mono bg-secondary rounded px-3 py-2">
                {shopDomain}
              </p>
            </div>

            {tenantError ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive">
                  ⚠️ Error loading tenant: {tenantError}
                </p>
              </div>
            ) : tenant ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Tenant
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-3 py-1 bg-primary/20 text-primary text-sm font-medium rounded">
                        {tenant.tenant_key}
                      </span>
                      <span className="text-sm text-card-foreground">
                        {tenant.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                        tenant.environment === 'production' 
                          ? 'bg-green-500/20 text-green-500' 
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {tenant.environment}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive">
                  ⚠️ Unknown tenant for this shop domain
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">
              No shop parameter detected
            </p>
            <p className="text-xs text-muted-foreground">
              Add <code className="bg-secondary px-1 rounded">?shop=...</code> to URL
            </p>
          </div>
        )}

        <div className="h-px bg-border" />

        {/* Backend Status */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Backend Status
          </p>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-sm text-card-foreground">
              Supabase: {isConfigured ? 'Configured' : 'Not configured'}
            </span>
          </div>
          {!isConfigured && (
            <p className="text-xs text-muted-foreground">
              Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-muted-foreground">
        <p>Ready for game development</p>
      </div>
    </div>
  );
};

export default Play;
