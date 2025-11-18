import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getShopFromParams } from '@/lib/tenants';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useTenant } from '@/hooks/useTenant';

const Play = () => {
  const [searchParams] = useSearchParams();
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant(shopDomain);

  useEffect(() => {
    // Check Supabase configuration
    setIsConfigured(isSupabaseConfigured());

    // Get shop parameter from URL
    const shop = getShopFromParams(searchParams);
    setShopDomain(shop);
  }, [searchParams]);

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

            {tenantLoading ? (
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Loading tenant configuration...
                </p>
              </div>
            ) : tenantError ? (
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
