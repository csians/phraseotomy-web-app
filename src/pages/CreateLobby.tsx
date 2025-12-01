import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getCustomerAvailablePacks, type Pack } from '@/lib/customerAccess';
import { Skeleton } from '@/components/ui/skeleton';

export default function CreateLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [lobbyName, setLobbyName] = useState('');
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [availablePacks, setAvailablePacks] = useState<Pack[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Fetch customer data from Supabase using token
  useEffect(() => {
    const fetchCustomerData = async () => {
      const customerToken = localStorage.getItem('phraseotomy_customer_token');
      
      if (!customerToken) {
        console.warn('No customer token found');
        navigate('/play/host');
        return;
      }

      try {
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('validate-customer-token', {
          body: { token: customerToken },
        });

        if (tokenError || !tokenData?.valid) {
          console.warn('Invalid customer token');
          navigate('/play/host');
          return;
        }

        // Fetch tenant
        const { data: dbTenant } = await supabase
          .from('tenants')
          .select('id, name, tenant_key, shop_domain, environment')
          .eq('id', tokenData.tenantId)
          .eq('is_active', true)
          .maybeSingle();

        if (!dbTenant) {
          console.warn('Tenant not found');
          navigate('/play/host');
          return;
        }

        setTenant({
          id: dbTenant.id,
          name: dbTenant.name,
          tenant_key: dbTenant.tenant_key,
          shop_domain: dbTenant.shop_domain,
          environment: dbTenant.environment,
          verified: true,
        });
        setShopDomain(dbTenant.shop_domain);

        // Fetch customer from database
        const { data: dbCustomer } = await supabase
          .from('customers')
          .select('customer_id, customer_email, customer_name, first_name, last_name')
          .eq('customer_id', tokenData.customerId)
          .eq('shop_domain', tokenData.shopDomain)
          .eq('tenant_id', tokenData.tenantId)
          .maybeSingle();

        if (dbCustomer) {
          setCustomer({
            id: dbCustomer.customer_id,
            email: dbCustomer.customer_email,
            name: dbCustomer.customer_name,
            firstName: dbCustomer.first_name,
            lastName: dbCustomer.last_name,
          });
          console.log('✅ Customer loaded from Supabase:', dbCustomer);
        } else {
          console.warn('Customer not found in database');
          navigate('/play/host');
          return;
        }
      } catch (error) {
        console.error('Error fetching customer data:', error);
        navigate('/play/host');
      } finally {
        setLoadingAuth(false);
      }
    };

    fetchCustomerData();
  }, [navigate]);

  // Load customer's available packs from database
  useEffect(() => {
    const loadCustomerPacks = async () => {
      if (!customer || !shopDomain) {
        setLoadingPacks(false);
        return;
      }

      try {
        setLoadingPacks(true);
        
        // Get customer's available packs from backend (dynamically from database)
        const packs = await getCustomerAvailablePacks(customer.id, shopDomain);
        
        setAvailablePacks(packs);
        
        // Auto-select the first pack if available
        if (packs.length > 0 && selectedPacks.length === 0) {
          setSelectedPacks([packs[0].id]);
        }
      } catch (error) {
        console.error('Error loading customer packs:', error);
        setAvailablePacks([]);
      } finally {
        setLoadingPacks(false);
      }
    };

    loadCustomerPacks();
  }, [customer, shopDomain]);

  const handlePackToggle = (packId: string) => {
    setSelectedPacks(prev => 
      prev.includes(packId) 
        ? prev.filter(id => id !== packId)
        : [...prev, packId]
    );
  };

  const generateLobbyCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateLobby = async () => {
    if (!customer || !shopDomain || !tenant) {
      toast({
        title: 'Error',
        description: 'Missing authentication information',
        variant: 'destructive',
      });
      return;
    }

    if (selectedPacks.length === 0) {
      toast({
        title: 'Select Packs',
        description: 'Please select at least one pack',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      const lobbyCode = generateLobbyCode();
      
      // Use edge function to create session (bypasses RLS with service role)
      const { data, error } = await supabase.functions.invoke('create-game-session', {
        body: {
          lobbyCode,
          hostCustomerId: customer.id,
          hostCustomerName: customer.name || customer.email,
          shopDomain,
          tenantId: tenant.id,
          packsUsed: selectedPacks,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to create lobby');
      }

      const newSession = data.session;

      toast({
        title: 'Lobby Created!',
        description: `Lobby Code: ${lobbyCode}`,
      });

      // Redirect to lobby page (replace to avoid back navigation issues)
      navigate(`/lobby/${newSession.id}`, { replace: true });
    } catch (error) {
      console.error('Error creating lobby:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create lobby. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to create a lobby</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/play/host')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if customer has any redeemed codes (required to create lobby)
  if (!loadingPacks && availablePacks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Game Access</CardTitle>
            <CardDescription>
              You need to redeem a code to unlock game packs before creating a lobby.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Each Phraseotomy game comes with a redemption code. Enter your code to unlock game packs and start hosting games.
            </p>
            <Button 
              onClick={() => navigate('/play/host')} 
              className="w-full bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold"
            >
              Go to Redeem Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        {/* Customer Profile Header */}
        {customer && (
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
                  {customer.firstName?.[0] || customer.name?.[0] || customer.email?.[0] || '?'}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {customer.name || 
                     (customer.firstName && customer.lastName 
                       ? `${customer.firstName} ${customer.lastName}` 
                       : customer.firstName || customer.lastName || customer.email || 'Guest')}
                  </h2>
                  {customer.email && (
                    <p className="text-sm text-muted-foreground">{customer.email}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Create New Lobby</h1>
          <p className="text-muted-foreground">
            Set up your game and invite players
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lobby Settings</CardTitle>
            <CardDescription>Choose your game packs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="lobbyName">Lobby Name (Optional)</Label>
              <Input
                id="lobbyName"
                placeholder="My Awesome Game"
                value={lobbyName}
                onChange={(e) => setLobbyName(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <Label>Select Packs</Label>
              {loadingPacks ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : availablePacks.length > 0 ? (
                <div className="space-y-3">
                  {availablePacks.map((pack) => {
                    const isSelected = selectedPacks.includes(pack.id);
                    
                    return (
                      <div 
                        key={pack.id} 
                        className="flex items-start space-x-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          id={pack.id}
                          checked={isSelected}
                          onCheckedChange={() => handlePackToggle(pack.id)}
                        />
                        <div className="space-y-1 leading-none flex-1">
                          <Label
                            htmlFor={pack.id}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {pack.name}
                          </Label>
                          {pack.description && (
                            <p className="text-sm text-muted-foreground">
                              {pack.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No packs available. Please contact support to assign packs to your account.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/play/host')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateLobby}
                disabled={isCreating || selectedPacks.length === 0}
                className="flex-1 bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                size="lg"
              >
                {isCreating ? 'Creating...' : 'Create Lobby'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Host:</strong> {customer.name || 
                (customer.firstName && customer.lastName 
                  ? `${customer.firstName} ${customer.lastName}` 
                  : customer.firstName || customer.lastName || customer.email || 'Guest')}</p>
              <p><strong>Shop:</strong> {shopDomain}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
