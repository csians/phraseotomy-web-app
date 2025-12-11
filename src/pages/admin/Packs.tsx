import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Plus, Trash2, ArrowLeft, Palette, Settings, Edit2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import type { Tables } from "@/integrations/supabase/types";
import { getAllUrlParams } from "@/lib/urlUtils";
import { Badge } from "@/components/ui/badge";

// Extract shop domain from Shopify's host parameter (base64 encoded)
const extractShopFromHost = (host: string | null): string | null => {
  if (!host) return null;
  try {
    const decoded = atob(host);
    const shopMatch = decoded.match(/([a-zA-Z0-9-]+\.myshopify\.com)/);
    return shopMatch ? shopMatch[1] : null;
  } catch (e) {
    console.error('Error decoding host parameter:', e);
    return null;
  }
};

type Pack = Tables<"packs">;

interface Theme {
  id: string;
  name: string;
  icon: string;
  is_core: boolean;
  pack_id: string | null;
}

export default function Packs() {
  const [searchParams] = useSearchParams();
  
  // Get shop from multiple sources
  const shopDomain = useMemo(() => {
    const shopParam = searchParams.get('shop');
    if (shopParam) return shopParam;
    
    const allParams = getAllUrlParams();
    const shopFromAll = allParams.get('shop');
    if (shopFromAll) return shopFromAll;
    
    const hostParam = allParams.get('host');
    const shopFromHost = extractShopFromHost(hostParam);
    if (shopFromHost) return shopFromHost;
    
    return 'testing-cs-store.myshopify.com';
  }, [searchParams]);
  
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant(shopDomain);
  
  const [packs, setPacks] = useState<Pack[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [coreThemes, setCoreThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPack, setNewPack] = useState({ name: "", description: "" });
  
  // Theme management modal state
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isAddThemeOpen, setIsAddThemeOpen] = useState(false);
  const [isEditThemeOpen, setIsEditThemeOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [newTheme, setNewTheme] = useState({ name: "", icon: "🎮" });
  
  const { toast } = useToast();

  useEffect(() => {
    if (tenant?.id) {
      loadPacks();
    }
  }, [tenant?.id]);

  const loadPacks = async () => {
    if (!tenant?.id) return;
    
    setLoading(true);
    try {
      const [packsRes, themesRes] = await Promise.all([
        supabase
          .from("packs")
          .select("*")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("themes")
          .select("id, name, icon, is_core, pack_id")
          .order("name")
      ]);

      if (packsRes.error) throw packsRes.error;
      if (themesRes.error) throw themesRes.error;
      
      setPacks(packsRes.data || []);
      setThemes(themesRes.data || []);
      setCoreThemes((themesRes.data || []).filter(t => t.is_core));
    } catch (error) {
      toast({
        title: "Error loading packs",
        description: error instanceof Error ? error.message : "Failed to load packs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getThemesForPack = (packId: string) => {
    return themes.filter(t => t.pack_id === packId);
  };

  const handleAddPack = async () => {
    if (!tenant?.id) return;
    if (!newPack.name.trim()) {
      toast({
        title: "Validation error",
        description: "Pack name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-pack', {
        body: {
          tenant_id: tenant.id,
          name: newPack.name.trim(),
          description: newPack.description.trim() || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Pack created",
        description: `Pack "${newPack.name}" has been created`,
      });

      setIsAddDialogOpen(false);
      setNewPack({ name: "", description: "" });
      loadPacks();
    } catch (error) {
      toast({
        title: "Error creating pack",
        description: error instanceof Error ? error.message : "Failed to create pack",
        variant: "destructive",
      });
    }
  };

  const handleDeletePack = async (packId: string, packName: string) => {
    if (!tenant?.id) return;
    if (!confirm(`Are you sure you want to delete pack "${packName}"? This will also remove it from all associated codes.`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-pack', {
        body: {
          pack_id: packId,
          tenant_id: tenant.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Pack deleted",
        description: `Pack "${packName}" has been deleted`,
      });

      loadPacks();
    } catch (error) {
      toast({
        title: "Error deleting pack",
        description: error instanceof Error ? error.message : "Failed to delete pack",
        variant: "destructive",
      });
    }
  };

  // Theme management functions
  const openThemeModal = (pack: Pack) => {
    setSelectedPack(pack);
    setIsThemeModalOpen(true);
  };

  const handleAddTheme = async () => {
    if (!selectedPack) return;
    if (!newTheme.name.trim()) {
      toast({ title: "Theme name is required", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('admin-create-theme', {
        body: {
          name: newTheme.name.trim(),
          icon: newTheme.icon,
          pack_id: selectedPack.id,
          is_core: false
        }
      });
      
      if (error) throw error;
      
      toast({ title: "Theme created successfully" });
      setIsAddThemeOpen(false);
      setNewTheme({ name: "", icon: "🎮" });
      loadPacks();
    } catch (error) {
      toast({
        title: "Error creating theme",
        description: error instanceof Error ? error.message : "Failed to create",
        variant: "destructive",
      });
    }
  };

  const handleEditTheme = async () => {
    if (!editingTheme) return;
    if (!editingTheme.name.trim()) {
      toast({ title: "Theme name is required", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('admin-create-theme', {
        body: {
          theme_id: editingTheme.id,
          name: editingTheme.name.trim(),
          icon: editingTheme.icon,
          pack_id: selectedPack?.id || null,
          is_core: editingTheme.is_core,
          update: true
        }
      });
      
      if (error) throw error;
      
      toast({ title: "Theme updated successfully" });
      setIsEditThemeOpen(false);
      setEditingTheme(null);
      loadPacks();
    } catch (error) {
      toast({
        title: "Error updating theme",
        description: error instanceof Error ? error.message : "Failed to update",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTheme = async (themeId: string, themeName: string) => {
    if (!confirm(`Delete theme "${themeName}"?`)) return;

    try {
      const { error } = await supabase.functions.invoke('admin-delete-theme', {
        body: { theme_id: themeId }
      });
      
      if (error) throw error;
      
      toast({ title: "Theme deleted" });
      loadPacks();
    } catch (error) {
      toast({
        title: "Error deleting theme",
        description: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      });
    }
  };

  if (tenantLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">Loading shop details...</CardContent>
        </Card>
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6 text-destructive">
            Error loading shop: {tenantError || "Shop not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const packThemes = selectedPack ? getThemesForPack(selectedPack.id) : [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/admin?shop=${shopDomain}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Game Packs</h1>
              <p className="text-muted-foreground mt-1">
                {tenant.name} - Manage game packs and content
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Packs</CardTitle>
            <CardDescription>
              Manage game packs for {tenant.shop_domain}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={loadPacks} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pack
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Pack</DialogTitle>
                  <DialogDescription>Create a new game pack</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Pack Name *</Label>
                    <Input
                      id="name"
                      value={newPack.name}
                      onChange={(e) => setNewPack({ ...newPack, name: e.target.value })}
                      placeholder="e.g., base, expansion1, premium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newPack.description}
                      onChange={(e) => setNewPack({ ...newPack, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddPack}>Create Pack</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Core/Base Themes Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Base Game Themes
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg border">
              {coreThemes.length === 0 ? (
                <p className="text-muted-foreground text-sm">No core themes configured yet</p>
              ) : (
                coreThemes.map(theme => (
                  <Badge key={theme.id} variant="secondary" className="text-sm py-1 px-3">
                    <span className="mr-1">{theme.icon}</span>
                    {theme.name}
                  </Badge>
                ))
              )}
            </div>
          </div>

          {/* Packs Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pack Name</TableHead>
                  <TableHead>Themes</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : packs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No packs found. Create your first pack above.
                    </TableCell>
                  </TableRow>
                ) : (
                  packs.map((pack) => {
                    const packThemesList = getThemesForPack(pack.id);
                    return (
                      <TableRow key={pack.id}>
                        <TableCell className="font-medium">{pack.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {packThemesList.length === 0 ? (
                              <span className="text-muted-foreground text-sm">No themes</span>
                            ) : (
                              packThemesList.map(theme => (
                                <Badge key={theme.id} variant="outline" className="text-xs">
                                  <span className="mr-1">{theme.icon}</span>
                                  {theme.name}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{pack.description || "-"}</TableCell>
                        <TableCell>{new Date(pack.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="Manage Themes"
                              onClick={() => openThemeModal(pack)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePack(pack.id, pack.name)}
                              title="Delete Pack"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Theme Management Modal */}
      <Dialog open={isThemeModalOpen} onOpenChange={setIsThemeModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Manage Themes - {selectedPack?.name}
            </DialogTitle>
            <DialogDescription>
              Add, edit or delete themes for this pack
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setIsAddThemeOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Theme
              </Button>
            </div>
            
            <div className="border rounded-md max-h-80 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Icon</TableHead>
                    <TableHead>Theme Name</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packThemes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No themes in this pack yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    packThemes.map(theme => (
                      <TableRow key={theme.id}>
                        <TableCell className="text-2xl">{theme.icon}</TableCell>
                        <TableCell className="font-medium">{theme.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTheme(theme);
                                setIsEditThemeOpen(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTheme(theme.id, theme.name)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsThemeModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Theme Dialog */}
      <Dialog open={isAddThemeOpen} onOpenChange={setIsAddThemeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Theme</DialogTitle>
            <DialogDescription>Create a new theme for {selectedPack?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Theme Name *</Label>
              <Input
                value={newTheme.name}
                onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
                placeholder="e.g., Horror, Fantasy"
              />
            </div>
            <div className="space-y-2">
              <Label>Icon (Emoji)</Label>
              <Input
                value={newTheme.icon}
                onChange={(e) => setNewTheme({ ...newTheme, icon: e.target.value })}
                placeholder="🎮"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddThemeOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTheme}>Create Theme</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Theme Dialog */}
      <Dialog open={isEditThemeOpen} onOpenChange={setIsEditThemeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Theme</DialogTitle>
            <DialogDescription>Update theme details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Theme Name *</Label>
              <Input
                value={editingTheme?.name || ""}
                onChange={(e) => setEditingTheme(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="e.g., Horror, Fantasy"
              />
            </div>
            <div className="space-y-2">
              <Label>Icon (Emoji)</Label>
              <Input
                value={editingTheme?.icon || ""}
                onChange={(e) => setEditingTheme(prev => prev ? { ...prev, icon: e.target.value } : null)}
                placeholder="🎮"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditThemeOpen(false)}>Cancel</Button>
            <Button onClick={handleEditTheme}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
