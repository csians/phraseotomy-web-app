import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { loadAccessStatus } from '@/lib/access';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { TenantConfig, AccessStatus } from '@/lib/types';
import { APP_VERSION } from '@/lib/types';

// Extend window to include embedded config
declare global {
  interface Window {
    __PHRASEOTOMY_CONFIG__?: TenantConfig;
    __PHRASEOTOMY_SHOP__?: string;
  }
}

const Play = () => {
  const { toast } = useToast();
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);

  useEffect(() => {
    // Check for embedded config from proxy (primary method)
    if (window.__PHRASEOTOMY_CONFIG__ && window.__PHRASEOTOMY_SHOP__) {
      setTenant(window.__PHRASEOTOMY_CONFIG__);
      setShopDomain(window.__PHRASEOTOMY_SHOP__);
      setLoading(false);
      return;
    }

    // Fallback: Try to fetch session from API
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/session');
        const data = await response.json();

        if (data.hasSession && data.tenant && data.shop) {
          setTenant(data.tenant);
          setShopDomain(data.shop);
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, []);

  // Load access status when shop domain is available
  useEffect(() => {
    if (!loading) {
      const fetchAccessStatus = async () => {
        setAccessLoading(true);
        try {
          const status = await loadAccessStatus(shopDomain);
          setAccessStatus(status);
        } catch (error) {
          console.error('Error loading access status:', error);
          setAccessStatus({
            hasActiveLicense: false,
            licenseExpiresAt: null,
            unlockedPacks: [],
          });
        } finally {
          setAccessLoading(false);
        }
      };

      fetchAccessStatus();
    }
  }, [loading, shopDomain]);

  const handleTableTopGame = () => {
    toast({
      title: 'Coming Soon',
      description: 'Table Top Game mode will be available in the next milestone.',
    });
  };

  const handleOnlineGame = () => {
    toast({
      title: 'Coming Soon',
      description: 'Online Game mode will be available in the next milestone.',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-game-black flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-game-yellow border-t-transparent mx-auto"></div>
          <p className="mt-4 text-game-yellow">Loading...</p>
        </div>
      </div>
    );
  }

  const appEnv = import.meta.env.VITE_APP_ENV || 'development';

  return (
    <div className="min-h-screen bg-game-black flex flex-col items-center justify-between px-4 py-8">
      {/* Logo and Branding */}
      <div className="w-full max-w-md text-center pt-8">
        <div className="w-20 h-20 mx-auto mb-4 bg-game-yellow rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-5xl font-black text-game-black">P</span>
        </div>
        <h1 className="text-4xl font-black text-white mb-2 tracking-wider">
          PHRASEOTOMY
        </h1>
        <p className="text-sm text-game-yellow uppercase tracking-widest font-semibold">
          The Party Game
        </p>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md space-y-4">
        {/* Auth/Shop Status Banner */}
        {shopDomain ? (
          <div className="bg-game-gray/30 border border-game-yellow/20 rounded-lg p-3 text-center">
            <p className="text-xs text-game-yellow">
              Logged in via Shopify store: <span className="font-semibold">{shopDomain}</span>
            </p>
          </div>
        ) : (
          <div className="bg-game-gray/30 border border-game-yellow/20 rounded-lg p-3 text-center">
            <p className="text-xs text-game-yellow">
              You are viewing demo mode. In production, this page will require a logged-in Phraseotomy account.
            </p>
          </div>
        )}

        {/* Development Build Card */}
        <Card className="bg-card border-game-gray">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Development Build</CardTitle>
              <Badge variant="secondary" className="bg-game-yellow/20 text-game-yellow border-game-yellow/30">
                {APP_VERSION}
              </Badge>
            </div>
            <CardDescription className="text-muted-foreground">
              Access Status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accessLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : accessStatus ? (
              <>
                {accessStatus.hasActiveLicense ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Access:</span>
                      <span className="text-game-yellow font-semibold">
                        Active until {accessStatus.licenseExpiresAt?.toLocaleDateString()}
                      </span>
                    </div>
                    {accessStatus.redemptionCode && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Code:</span>
                        <span className="text-card-foreground font-mono text-xs">
                          {accessStatus.redemptionCode}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">Unlocked Packs:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {accessStatus.unlockedPacks.map((pack) => (
                          <Badge 
                            key={pack} 
                            variant="outline" 
                            className="text-xs bg-game-yellow/10 text-game-yellow border-game-yellow/30"
                          >
                            {pack}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Access:</span>
                      <span className="text-destructive font-semibold">No active code yet</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                      This screen will show your active code and unlocked packs once the licensing backend is connected.
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Game Mode Buttons */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={handleTableTopGame}
            size="lg"
            className="w-full h-14 bg-game-yellow hover:bg-game-yellow-bright text-game-black font-black text-base tracking-wide uppercase"
          >
            Table Top Game
          </Button>
          <Button
            onClick={handleOnlineGame}
            size="lg"
            className="w-full h-14 bg-game-yellow hover:bg-game-yellow-bright text-game-black font-black text-base tracking-wide uppercase"
          >
            Online Game
          </Button>
        </div>
      </div>

      {/* Footer Debug Info */}
      <div className="w-full max-w-md text-center space-y-1 pb-4">
        <p className="text-xs text-game-gray font-mono">
          Tenant: {tenant?.tenant_key || 'none'} | Shop: {shopDomain || 'none'} | Env: {appEnv}
        </p>
        {isSupabaseConfigured() && (
          <p className="text-xs text-game-gray/60">
            Backend: Connected
          </p>
        )}
      </div>
    </div>
  );
};

export default Play;
