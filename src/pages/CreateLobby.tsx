import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getCustomerLicenses } from '@/lib/customerAccess';
import { Skeleton } from '@/components/ui/skeleton';

const ALL_PACKS = [
  { id: 'base', name: 'Base Pack', description: 'Core game cards' },
  { id: 'expansion1', name: 'Expansion 1', description: 'Additional themed cards' },
  { id: 'expansion2', name: 'Expansion 2', description: 'More variety' },
  { id: 'premium', name: 'Premium Pack', description: 'Exclusive content' },
];

export default function CreateLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [lobbyName, setLobbyName] = useState('');
  const [selectedPacks, setSelectedPacks] = useState<string[]>(['base']);
  const [isCreating, setIsCreating] = useState(false);
  const [availablePacks, setAvailablePacks] = useState<string[]>(['base']); // Default to base pack
  const [loadingPacks, setLoadingPacks] = useState(true);

  // Get customer and shop info from location state or window
  const customer = location.state?.customer || window.__PHRASEOTOMY_CUSTOMER__;
  const shopDomain = location.state?.shopDomain || window.__PHRASEOTOMY_SHOP__;
  const tenant = location.state?.tenant || window.__PHRASEOTOMY_CONFIG__;

  // Load customer's available packs from redeemed codes
  useEffect(() => {
    const loadCustomerPacks = async () => {
      if (!customer || !shopDomain) {
        setLoadingPacks(false);
        return;
      }

      try {
        setLoadingPacks(true);
        
        // Get customer licenses (redeemed codes)
        const licenses = await getCustomerLicenses(customer.id, shopDomain);
        
        // Extract all unique packs from all licenses
        const allPacks = new Set<string>();
        licenses.forEach(license => {
          if (license.packs_unlocked && Array.isArray(license.packs_unlocked)) {
            license.packs_unlocked.forEach(pack => allPacks.add(pack));
          }
        });
        
        const packsArray = Array.from(allPacks);
        setAvailablePacks(packsArray.length > 0 ? packsArray : []);
        
        // Update selected packs to only include available ones
        setSelectedPacks(prev => {
          const filtered = prev.filter(packId => packsArray.includes(packId));
          
          // If no packs selected after filtering, select the first available pack
          if (filtered.length === 0 && packsArray.length > 0) {
            // Select base pack if available, otherwise first pack
            const packToSelect = packsArray.includes('base') ? 'base' : packsArray[0];
            return [packToSelect];
          }
          
          return filtered;
        });
      } catch (error) {
        console.error('Error loading customer packs:', error);
        // On error, no packs available
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
      
      const { data, error } = await supabase
        .from('game_sessions')
        .insert({
          lobby_code: lobbyCode,
          host_customer_id: customer.id,
          host_customer_name: customer.name || customer.email,
          shop_domain: shopDomain,
          tenant_id: tenant.id,
          packs_used: selectedPacks,
          status: 'waiting',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Lobby Created!',
        description: `Lobby Code: ${lobbyCode}`,
      });

      // Redirect back to play page with lobby info
      navigate('/play', { state: { newLobby: data } });
    } catch (error) {
      console.error('Error creating lobby:', error);
      toast({
        title: 'Error',
        description: 'Failed to create lobby. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to create a lobby</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/play')} className="w-full">
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
              onClick={() => navigate('/play')} 
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
                    {customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email}
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
              ) : (
                <div className="space-y-3">
                  {ALL_PACKS.map((pack) => {
                    const isAvailable = availablePacks.includes(pack.id);
                    const isSelected = selectedPacks.includes(pack.id);
                    
                    return (
                      <div 
                        key={pack.id} 
                        className={`flex items-start space-x-3 p-3 rounded-lg border ${
                          isAvailable 
                            ? 'border-border bg-card' 
                            : 'border-muted bg-muted/30 opacity-60'
                        }`}
                      >
                        <Checkbox
                          id={pack.id}
                          checked={isSelected}
                          disabled={!isAvailable}
                          onCheckedChange={() => isAvailable && handlePackToggle(pack.id)}
                        />
                        <div className="space-y-1 leading-none flex-1">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={pack.id}
                              className={`text-sm font-medium leading-none ${
                                !isAvailable ? 'cursor-not-allowed opacity-70' : ''
                              }`}
                            >
                              {pack.name}
                            </Label>
                            {!isAvailable && (
                              <span className="text-xs text-muted-foreground italic">
                                (Not available)
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {pack.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!loadingPacks && availablePacks.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No packs available. Please contact support to assign packs to your account.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/play')}
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
              <p><strong>Host:</strong> {customer.name || customer.email}</p>
              <p><strong>Shop:</strong> {shopDomain}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
