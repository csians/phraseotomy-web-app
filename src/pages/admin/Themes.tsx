import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Plus, Trash2, ArrowLeft, Upload, Image, Palette, Type, Pencil } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { getAllUrlParams } from "@/lib/urlUtils";

interface Theme {
  id: string;
  name: string;
  icon: string;
  is_core: boolean;
  pack_id: string | null;
  created_at: string;
}

interface Element {
  id: string;
  name: string;
  icon: string;
  image_url: string | null;
  color: string | null;
  is_whisp: boolean;
  theme_id: string | null;
  created_at: string;
}

interface Pack {
  id: string;
  name: string;
}

const extractShopFromHost = (host: string | null): string | null => {
  if (!host) return null;
  try {
    const decoded = atob(host);
    const shopMatch = decoded.match(/([a-zA-Z0-9-]+\.myshopify\.com)/);
    return shopMatch ? shopMatch[1] : null;
  } catch {
    return null;
  }
};

export default function Themes() {
  const [searchParams] = useSearchParams();
  
  const shopDomain = useMemo(() => {
    const shopParam = searchParams.get('shop');
    if (shopParam) return shopParam;
    
    const allParams = getAllUrlParams();
    const shopFromAll = allParams.get('shop');
    if (shopFromAll) return shopFromAll;
    
    const hostParam = allParams.get('host');
    const shopFromHost = extractShopFromHost(hostParam);
    if (shopFromHost) return shopFromHost;
    
    return 'phraseotomy.com';
  }, [searchParams]);
  
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant(shopDomain);
  
  const [themes, setThemes] = useState<Theme[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddThemeOpen, setIsAddThemeOpen] = useState(false);
  const [isAddElementOpen, setIsAddElementOpen] = useState(false);
  const [newTheme, setNewTheme] = useState({ name: "", icon: "🎮", pack_id: "", is_core: false });
  const [newElement, setNewElement] = useState({ name: "", icon: "🔮", color: "#6366f1", is_whisp: false });
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (tenant?.id) {
      loadData();
    }
  }, [tenant?.id]);

  const loadData = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const [themesRes, packsRes] = await Promise.all([
        supabase.from("themes").select("*").order("name"),
        supabase.from("packs").select("id, name").eq("tenant_id", tenant.id)
      ]);
      
      if (themesRes.error) throw themesRes.error;
      if (packsRes.error) throw packsRes.error;
      
      setThemes(themesRes.data || []);
      setPacks(packsRes.data || []);
    } catch (error) {
      toast({
        title: "Error loading data",
        description: error instanceof Error ? error.message : "Failed to load",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadElements = async (themeId: string) => {
    try {
      const { data, error } = await supabase
        .from("elements")
        .select("*")
        .eq("theme_id", themeId)
        .order("name");
      
      if (error) throw error;
      setElements(data || []);
    } catch (error) {
      toast({
        title: "Error loading elements",
        description: error instanceof Error ? error.message : "Failed to load elements",
        variant: "destructive",
      });
    }
  };

  const handleSelectTheme = (theme: Theme) => {
    setSelectedTheme(theme);
    loadElements(theme.id);
  };

  const handleAddTheme = async () => {
    if (!newTheme.name.trim()) {
      toast({ title: "Theme name is required", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('admin-create-theme', {
        body: {
          name: newTheme.name.trim(),
          icon: newTheme.icon,
          pack_id: newTheme.pack_id || null,
          is_core: newTheme.is_core
        }
      });
      
      if (error) throw error;
      
      toast({ title: "Theme created successfully" });
      setIsAddThemeOpen(false);
      setNewTheme({ name: "", icon: "🎮", pack_id: "", is_core: false });
      loadData();
    } catch (error) {
      toast({
        title: "Error creating theme",
        description: error instanceof Error ? error.message : "Failed to create",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTheme = async (themeId: string, themeName: string) => {
    if (!confirm(`Delete theme "${themeName}" and all its elements?`)) return;

    try {
      const { error } = await supabase.functions.invoke('admin-delete-theme', {
        body: { theme_id: themeId }
      });
      
      if (error) throw error;
      
      toast({ title: "Theme deleted" });
      if (selectedTheme?.id === themeId) {
        setSelectedTheme(null);
        setElements([]);
      }
      loadData();
    } catch (error) {
      toast({
        title: "Error deleting theme",
        description: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      });
    }
  };

  const handleAddElement = async () => {
    if (!selectedTheme) return;
    if (!newElement.name.trim()) {
      toast({ title: "Element name is required", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('admin-create-element', {
        body: {
          name: newElement.name.trim(),
          icon: newElement.icon,
          color: newElement.is_whisp ? null : newElement.color,
          is_whisp: newElement.is_whisp,
          theme_id: selectedTheme.id
        }
      });
      
      if (error) throw error;
      
      toast({ title: "Element created" });
      setIsAddElementOpen(false);
      setNewElement({ name: "", icon: "🔮", color: "#6366f1", is_whisp: false });
      loadElements(selectedTheme.id);
    } catch (error) {
      toast({
        title: "Error creating element",
        description: error instanceof Error ? error.message : "Failed to create",
        variant: "destructive",
      });
    }
  };

  const handleDeleteElement = async (elementId: string, elementName: string) => {
    if (!confirm(`Delete element "${elementName}"?`)) return;

    try {
      const { error } = await supabase.functions.invoke('admin-delete-element', {
        body: { element_id: elementId }
      });
      
      if (error) throw error;
      
      toast({ title: "Element deleted" });
      if (selectedTheme) loadElements(selectedTheme.id);
    } catch (error) {
      toast({
        title: "Error deleting element",
        description: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = async (elementId: string, file: File) => {
    setUploadingImage(elementId);
    
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `elements/${elementId}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('element_images')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('element_images')
        .getPublicUrl(filePath);
      
      const { error: updateError } = await supabase.functions.invoke('admin-update-element', {
        body: { element_id: elementId, image_url: publicUrl }
      });
      
      if (updateError) throw updateError;
      
      toast({ title: "Image uploaded" });
      if (selectedTheme) loadElements(selectedTheme.id);
    } catch (error) {
      toast({
        title: "Error uploading image",
        description: error instanceof Error ? error.message : "Failed to upload",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(null);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{tenantError || "Shop not found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to={`/admin?shop=${shopDomain}`}>
            <Button variant="ghost" size="icon" className="hover:bg-accent hover:text-accent-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Themes & Elements</h1>
            <p className="text-muted-foreground mt-1">
              {tenant.name} - Manage themes and whisp elements with images
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Themes List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Themes
              </CardTitle>
              <CardDescription>Select a theme to manage its elements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={loadData} variant="outline" disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                
                <Dialog open={isAddThemeOpen} onOpenChange={setIsAddThemeOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Theme
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Theme</DialogTitle>
                      <DialogDescription>Create a new theme for elements</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Theme Name *</Label>
                        <Input
                          value={newTheme.name}
                          onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
                          placeholder="e.g., At Home, Travel"
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
                      <div className="space-y-2">
                        <Label>Pack (Optional - for expansion themes)</Label>
                        <Select
                          value={newTheme.pack_id}
                          onValueChange={(v) => setNewTheme({ ...newTheme, pack_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select pack (or leave empty for base)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No Pack (Base Game)</SelectItem>
                            {packs.map(pack => (
                              <SelectItem key={pack.id} value={pack.id}>{pack.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_core"
                          checked={newTheme.is_core}
                          onChange={(e) => setNewTheme({ ...newTheme, is_core: e.target.checked })}
                          className="rounded border-border"
                        />
                        <Label htmlFor="is_core">Core Theme (base game)</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddThemeOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddTheme}>Create Theme</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="border rounded-md max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Theme</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : themes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No themes yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      themes.map(theme => (
                        <TableRow 
                          key={theme.id}
                          className={`cursor-pointer hover:bg-accent/50 hover:text-accent-foreground ${selectedTheme?.id === theme.id ? 'bg-accent text-accent-foreground' : ''}`}
                          onClick={() => handleSelectTheme(theme)}
                        >
                          <TableCell className="font-medium">
                            <span className="mr-2">{theme.icon}</span>
                            {theme.name}
                          </TableCell>
                          <TableCell>
                            {theme.is_core ? (
                              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">Core</span>
                            ) : theme.pack_id ? (
                              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                                {packs.find(p => p.id === theme.pack_id)?.name || 'Pack'}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTheme(theme.id, theme.name);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Elements for Selected Theme - Split into Visual and Whisp */}
          <div className="space-y-6">
            {/* Visual Elements Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Visual Elements {selectedTheme && `- ${selectedTheme.name}`}
                </CardTitle>
                <CardDescription>
                  {selectedTheme ? `Visual icons with SVG/images for ${selectedTheme.name}` : 'Select a theme first'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTheme ? (
                  <>
                    <Dialog open={isAddElementOpen && !newElement.is_whisp} onOpenChange={(open) => {
                      setIsAddElementOpen(open);
                      if (open) setNewElement({ ...newElement, is_whisp: false });
                    }}>
                      <DialogTrigger asChild>
                        <Button onClick={() => setNewElement({ ...newElement, is_whisp: false })}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Visual Element
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Visual Element</DialogTitle>
                          <DialogDescription>Add a visual icon element to {selectedTheme.name}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Element Name *</Label>
                            <Input
                              value={newElement.name}
                              onChange={(e) => setNewElement({ ...newElement, name: e.target.value })}
                              placeholder="e.g., Sun, Moon, Star"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Icon (Emoji)</Label>
                            <Input
                              value={newElement.icon}
                              onChange={(e) => setNewElement({ ...newElement, icon: e.target.value })}
                              placeholder="☀️"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex gap-2 items-center">
                              <input
                                type="color"
                                value={newElement.color}
                                onChange={(e) => setNewElement({ ...newElement, color: e.target.value })}
                                className="w-10 h-10 rounded cursor-pointer border border-border"
                              />
                              <Input
                                value={newElement.color}
                                onChange={(e) => setNewElement({ ...newElement, color: e.target.value })}
                                placeholder="#6366f1"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddElementOpen(false)}>Cancel</Button>
                          <Button onClick={handleAddElement}>Create Element</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*,.svg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        const elementId = fileInputRef.current?.dataset.elementId;
                        if (file && elementId) {
                          handleImageUpload(elementId, file);
                        }
                        e.target.value = '';
                      }}
                    />

                    <div className="border rounded-md max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Element</TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead>Image/SVG</TableHead>
                            <TableHead className="w-32">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {elements.filter(e => !e.is_whisp).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                No visual elements yet
                              </TableCell>
                            </TableRow>
                          ) : (
                            elements.filter(e => !e.is_whisp).map(element => (
                              <TableRow key={element.id}>
                                <TableCell className="font-medium">
                                  <span className="mr-2">{element.icon}</span>
                                  {element.name}
                                </TableCell>
                                <TableCell>
                                  {element.color ? (
                                    <div className="flex items-center gap-2">
                                      <div 
                                        className="w-6 h-6 rounded border border-border"
                                        style={{ backgroundColor: element.color }}
                                      />
                                      <span className="text-xs text-muted-foreground">{element.color}</span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {element.image_url ? (
                                    <img 
                                      src={element.image_url} 
                                      alt={element.name}
                                      className="w-10 h-10 object-cover rounded"
                                    />
                                  ) : (
                                    <span className="text-muted-foreground text-xs">No image</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={uploadingImage === element.id}
                                      onClick={() => {
                                        if (fileInputRef.current) {
                                          fileInputRef.current.dataset.elementId = element.id;
                                          fileInputRef.current.click();
                                        }
                                      }}
                                    >
                                      <Upload className={`h-4 w-4 ${uploadingImage === element.id ? 'animate-pulse' : ''}`} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteElement(element.id, element.name)}
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
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Select a theme from the left to manage its elements
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Whisp Elements Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Whisp Elements {selectedTheme && `- ${selectedTheme.name}`}
                </CardTitle>
                <CardDescription>
                  {selectedTheme ? `Text-based whisp words for ${selectedTheme.name}` : 'Select a theme first'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTheme ? (
                  <>
                    <Dialog open={isAddElementOpen && newElement.is_whisp} onOpenChange={(open) => {
                      setIsAddElementOpen(open);
                      if (open) setNewElement({ ...newElement, is_whisp: true });
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="secondary" onClick={() => setNewElement({ ...newElement, is_whisp: true })}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Whisp
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Whisp Element</DialogTitle>
                          <DialogDescription>Add a text-based whisp word to {selectedTheme.name}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Whisp Word *</Label>
                            <Input
                              value={newElement.name}
                              onChange={(e) => setNewElement({ ...newElement, name: e.target.value })}
                              placeholder="e.g., Coffee, Lamp, Sofa"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Icon (Emoji)</Label>
                            <Input
                              value={newElement.icon}
                              onChange={(e) => setNewElement({ ...newElement, icon: e.target.value })}
                              placeholder="☕"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddElementOpen(false)}>Cancel</Button>
                          <Button onClick={handleAddElement}>Create Whisp</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <div className="border rounded-md max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Whisp Word</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {elements.filter(e => e.is_whisp).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground">
                                No whisp elements yet
                              </TableCell>
                            </TableRow>
                          ) : (
                            elements.filter(e => e.is_whisp).map(element => (
                              <TableRow key={element.id}>
                                <TableCell className="font-medium">
                                  <span className="mr-2">{element.icon}</span>
                                  {element.name}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteElement(element.id, element.name)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Select a theme from the left to manage its whisp words
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}