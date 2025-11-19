import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const AVAILABLE_PACKS = [
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

  // Get customer and shop info from location state or window
  const customer = location.state?.customer || window.__PHRASEOTOMY_CUSTOMER__;
  const shopDomain = location.state?.shopDomain || window.__PHRASEOTOMY_SHOP__;
  const tenant = location.state?.tenant || window.__PHRASEOTOMY_CONFIG__;

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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
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
              <div className="space-y-3">
                {AVAILABLE_PACKS.map((pack) => (
                  <div key={pack.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={pack.id}
                      checked={selectedPacks.includes(pack.id)}
                      onCheckedChange={() => handlePackToggle(pack.id)}
                    />
                    <div className="space-y-1 leading-none">
                      <Label
                        htmlFor={pack.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {pack.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {pack.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
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
                className="flex-1"
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
