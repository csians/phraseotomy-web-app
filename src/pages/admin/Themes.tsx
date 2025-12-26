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
import * as XLSX from "xlsx";

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
  const [newElementImage, setNewElementImage] = useState<File | null>(null);
  const [newElementImagePreview, setNewElementImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [editingElement, setEditingElement] = useState<Element | null>(null);
  const [isEditElementOpen, setIsEditElementOpen] = useState(false);
  const [editElementImage, setEditElementImage] = useState<File | null>(null);
  const [editElementImagePreview, setEditElementImagePreview] = useState<string | null>(null);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [parsedWords, setParsedWords] = useState<string[]>([]);
  const [duplicateWords, setDuplicateWords] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newElementFileRef = useRef<HTMLInputElement>(null);
  const editElementFileRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);
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
      // First create the element
      const { data, error } = await supabase.functions.invoke('admin-create-element', {
        body: {
          name: newElement.name.trim(),
          icon: newElement.icon || "🔮",
          color: newElement.is_whisp ? null : newElement.color,
          is_whisp: newElement.is_whisp,
          theme_id: selectedTheme.id
        }
      });
      
      if (error) throw error;
      
      const elementId = data?.element?.id;
      
      // If there's an image to upload for visual element
      if (!newElement.is_whisp && newElementImage && elementId) {
        const fileExt = newElementImage.name.split('.').pop();
        const filePath = `elements/${elementId}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('element_images')
          .upload(filePath, newElementImage);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('element_images')
          .getPublicUrl(filePath);
        
        await supabase.functions.invoke('admin-update-element', {
          body: { element_id: elementId, image_url: publicUrl }
        });
      }
      
      toast({ title: "Element created" });
      setIsAddElementOpen(false);
      setNewElement({ name: "", icon: "🔮", color: "#6366f1", is_whisp: false });
      setNewElementImage(null);
      setNewElementImagePreview(null);
      loadElements(selectedTheme.id);
    } catch (error) {
      toast({
        title: "Error creating element",
        description: error instanceof Error ? error.message : "Failed to create",
        variant: "destructive",
      });
    }
  };

  const handleEditElement = async () => {
    if (!editingElement) return;
    if (!editingElement.name.trim()) {
      toast({ title: "Element name is required", variant: "destructive" });
      return;
    }

    try {
      // Update element details
      const { error } = await supabase.functions.invoke('admin-update-element', {
        body: {
          element_id: editingElement.id,
          name: editingElement.name.trim(),
          icon: editingElement.icon,
          color: editingElement.is_whisp ? null : editingElement.color,
        }
      });
      
      if (error) throw error;
      
      // If there's a new image to upload
      if (!editingElement.is_whisp && editElementImage) {
        const fileExt = editElementImage.name.split('.').pop();
        const filePath = `elements/${editingElement.id}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('element_images')
          .upload(filePath, editElementImage);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('element_images')
          .getPublicUrl(filePath);
        
        await supabase.functions.invoke('admin-update-element', {
          body: { element_id: editingElement.id, image_url: publicUrl }
        });
      }
      
      toast({ title: "Element updated" });
      setIsEditElementOpen(false);
      setEditingElement(null);
      setEditElementImage(null);
      setEditElementImagePreview(null);
      if (selectedTheme) loadElements(selectedTheme.id);
    } catch (error) {
      toast({
        title: "Error updating element",
        description: error instanceof Error ? error.message : "Failed to update",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (element: Element) => {
    setEditingElement({ ...element });
    setEditElementImagePreview(element.image_url);
    setEditElementImage(null);
    setIsEditElementOpen(true);
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

  const parseCsv = (csvText: string): string[] => {
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) return [];
    
    // First row, first column is theme name, skip it
    // Rest of rows, first column contains wisp words
    const wispWords: string[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Parse CSV line (handle quoted values)
      const columns = line.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
      const firstColumn = columns[0];
      
      if (firstColumn && firstColumn.length > 0) {
        wispWords.push(firstColumn);
      }
    }
    
    return wispWords;
  };

  const parseXlsx = (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get the first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert to JSON array
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];
          
          if (jsonData.length === 0) {
            resolve([]);
            return;
          }
          
          // First row, first column is theme name, skip it
          // Rest of rows, first column contains wisp words
          const wispWords: string[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            const firstColumn = row[0];
            
            if (firstColumn && typeof firstColumn === 'string' && firstColumn.trim().length > 0) {
              wispWords.push(firstColumn.trim());
            }
          }
          
          resolve(wispWords);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const parseFile = async (file: File): Promise<string[]> => {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return await parseXlsx(file);
    } else {
      const text = await file.text();
      return parseCsv(text);
    }
  };

  const checkDuplicates = async (words: string[]): Promise<Set<string>> => {
    if (!selectedTheme) return new Set();
    
    // Get existing wisp elements for this theme
    const { data: existingElements } = await supabase
      .from("elements")
      .select("name")
      .eq("theme_id", selectedTheme.id)
      .eq("is_whisp", true);
    
    const existingNames = new Set(
      (existingElements || []).map(e => e.name.toLowerCase().trim())
    );
    
    // Find duplicates
    const duplicates = new Set<string>();
    words.forEach(word => {
      if (existingNames.has(word.toLowerCase().trim())) {
        duplicates.add(word);
      }
    });
    
    return duplicates;
  };

  const handleFileSelect = async (file: File) => {
    if (!selectedTheme) return;
    
    try {
      const words = await parseFile(file);
      
      if (words.length === 0) {
        toast({
          title: "No wisp words found",
          description: "File appears to be empty or invalid",
          variant: "destructive",
        });
        return;
      }
      
      // Check for duplicates
      const duplicates = await checkDuplicates(words);
      
      setParsedWords(words);
      setDuplicateWords(duplicates);
      setCsvFile(file);
      setShowPreview(true);
    } catch (error) {
      toast({
        title: "Error parsing file",
        description: error instanceof Error ? error.message : "Failed to process file",
        variant: "destructive",
      });
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedTheme || parsedWords.length === 0) return;
    
    setUploadingCsv(true);
    try {
      // Filter out duplicates
      const wordsToUpload = parsedWords.filter(word => !duplicateWords.has(word));
      
      if (wordsToUpload.length === 0) {
        toast({
          title: "No new words to upload",
          description: "All words already exist",
          variant: "destructive",
        });
        setShowPreview(false);
        setCsvFile(null);
        setParsedWords([]);
        setDuplicateWords(new Set());
        return;
      }
      
      // Prepare elements for batch insert
      const elementsToInsert = wordsToUpload.map(word => ({
        name: word.trim(),
        icon: "🔮",
        color: null,
        is_whisp: true,
        theme_id: selectedTheme.id
      }));
      
      // Use batch API endpoint that bypasses RLS
      const { data, error } = await supabase.functions.invoke('admin-create-elements-batch', {
        body: { elements: elementsToInsert }
      });
      
      if (error) throw error;
      
      const successCount = data?.count || data?.elements?.length || 0;
      const duplicateCount = duplicateWords.size;
      
      toast({
        title: "Upload complete",
        description: `Successfully created ${successCount} wisp elements${duplicateCount > 0 ? `. ${duplicateCount} duplicates skipped.` : '.'}`,
      });
      
      setIsCsvUploadOpen(false);
      setShowPreview(false);
      setCsvFile(null);
      setParsedWords([]);
      setDuplicateWords(new Set());
      if (selectedTheme) loadElements(selectedTheme.id);
    } catch (error) {
      toast({
        title: "Error uploading elements",
        description: error instanceof Error ? error.message : "Failed to upload elements",
        variant: "destructive",
      });
    } finally {
      setUploadingCsv(false);
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
                        <Label>Pack (Optional - for expansion themes)</Label>
                        <Select
                          value={newTheme.pack_id || "_none"}
                          onValueChange={(v) =>
                            setNewTheme({ ...newTheme, pack_id: v === "_none" ? "" : v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select pack (or leave empty for base)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">No Pack (Base Game)</SelectItem>
                            {packs.map((pack) => (
                              <SelectItem key={pack.id} value={pack.id}>
                                {pack.name}
                              </SelectItem>
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
                      if (open) {
                        setNewElement({ ...newElement, is_whisp: false });
                      } else {
                        setNewElementImage(null);
                        setNewElementImagePreview(null);
                      }
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
                          <div className="space-y-2">
                            <Label>Image/SVG</Label>
                            <input
                              type="file"
                              ref={newElementFileRef}
                              className="hidden"
                              accept="image/*,.svg"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setNewElementImage(file);
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    setNewElementImagePreview(event.target?.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <div className="flex gap-2 items-center">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => newElementFileRef.current?.click()}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Image
                              </Button>
                              {newElementImagePreview && (
                                <div className="relative">
                                  <img
                                    src={newElementImagePreview}
                                    alt="Preview"
                                    className="w-12 h-12 object-contain rounded border border-border"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full bg-destructive text-destructive-foreground"
                                    onClick={() => {
                                      setNewElementImage(null);
                                      setNewElementImagePreview(null);
                                    }}
                                  >
                                    ×
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddElementOpen(false)}>Cancel</Button>
                          <Button onClick={handleAddElement}>Create Element</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Edit Visual Element Dialog */}
                    <Dialog open={isEditElementOpen && editingElement && !editingElement.is_whisp} onOpenChange={(open) => {
                      if (!open) {
                        setIsEditElementOpen(false);
                        setEditingElement(null);
                        setEditElementImage(null);
                        setEditElementImagePreview(null);
                      }
                    }}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Visual Element</DialogTitle>
                          <DialogDescription>Update element details</DialogDescription>
                        </DialogHeader>
                        {editingElement && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Element Name *</Label>
                              <Input
                                value={editingElement.name}
                                onChange={(e) => setEditingElement({ ...editingElement, name: e.target.value })}
                                placeholder="e.g., Sun, Moon, Star"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Color</Label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="color"
                                  value={editingElement.color || "#6366f1"}
                                  onChange={(e) => setEditingElement({ ...editingElement, color: e.target.value })}
                                  className="w-10 h-10 rounded cursor-pointer border border-border"
                                />
                                <Input
                                  value={editingElement.color || ""}
                                  onChange={(e) => setEditingElement({ ...editingElement, color: e.target.value })}
                                  placeholder="#6366f1"
                                  className="flex-1"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Image/SVG</Label>
                              <input
                                type="file"
                                ref={editElementFileRef}
                                className="hidden"
                                accept="image/*,.svg"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setEditElementImage(file);
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      setEditElementImagePreview(event.target?.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              <div className="flex gap-2 items-center">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => editElementFileRef.current?.click()}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  {editElementImagePreview ? 'Change Image' : 'Upload Image'}
                                </Button>
                                {editElementImagePreview && (
                                  <img
                                    src={editElementImagePreview}
                                    alt="Preview"
                                    className="w-12 h-12 object-contain rounded border border-border"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsEditElementOpen(false)}>Cancel</Button>
                          <Button onClick={handleEditElement}>Save Changes</Button>
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
                                  {element.name}
                                </TableCell>
                                <TableCell>
                                  {element.color ? (
                                    <div 
                                      className="w-6 h-6 rounded border border-border"
                                      style={{ backgroundColor: element.color }}
                                      title={element.color}
                                    />
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {element.image_url ? (
                                    <div 
                                      className="w-10 h-10 rounded flex items-center justify-center p-1"
                                      style={{ backgroundColor: element.color || 'transparent' }}
                                    >
                                      <img 
                                        src={element.image_url} 
                                        alt={element.name}
                                        className="w-full h-full object-contain"
                                        style={{ 
                                          filter: element.color ? 'brightness(0) invert(1)' : 'none'
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">No image</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditDialog(element)}
                                      title="Edit element"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteElement(element.id, element.name)}
                                      title="Delete element"
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
                  Wisp Elements {selectedTheme && `- ${selectedTheme.name}`}
                </CardTitle>
                <CardDescription>
                  {selectedTheme ? `Text-based wisp words for ${selectedTheme.name}` : 'Select a theme first'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTheme ? (
                  <>
                    <div className="flex gap-2">
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
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddElementOpen(false)}>Cancel</Button>
                          <Button onClick={handleAddElement}>Create Whisp</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isCsvUploadOpen} onOpenChange={(open) => {
                      setIsCsvUploadOpen(open);
                      if (!open) {
                        setShowPreview(false);
                        setCsvFile(null);
                        setParsedWords([]);
                        setDuplicateWords(new Set());
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" onClick={() => setIsCsvUploadOpen(true)}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload CSV/XLSX
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Upload Wisp Elements from CSV/XLSX</DialogTitle>
                          <DialogDescription>
                            Upload a CSV or XLSX file with wisp words. Format: First row contains theme name, subsequent rows contain wisp words in the first column.
                          </DialogDescription>
                        </DialogHeader>
                        {!showPreview ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>File (CSV or XLSX)</Label>
                              <input
                                type="file"
                                ref={csvFileRef}
                                className="hidden"
                                accept=".csv,.xlsx,.xls"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleFileSelect(file);
                                  }
                                }}
                              />
                              <div className="flex gap-2 items-center">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => csvFileRef.current?.click()}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Select File
                                </Button>
                                {csvFile && (
                                  <span className="text-sm text-muted-foreground">
                                    {csvFile.name}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Format: First row = theme name, subsequent rows = wisp words (first column). Supports CSV and XLSX files.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>Preview ({parsedWords.length} words found)</Label>
                                <div className="text-sm text-muted-foreground">
                                  {duplicateWords.size > 0 && (
                                    <span className="text-destructive">
                                      {duplicateWords.size} duplicate{duplicateWords.size > 1 ? 's' : ''} will be skipped
                                    </span>
                                  )}
                                  {duplicateWords.size === 0 && (
                                    <span className="text-green-600">All words are new</span>
                                  )}
                                </div>
                              </div>
                              <div className="border rounded-md max-h-64 overflow-auto p-4">
                                <div className="space-y-1">
                                  {parsedWords.map((word, index) => {
                                    const isDuplicate = duplicateWords.has(word);
                                    return (
                                      <div
                                        key={index}
                                        className={`text-sm p-2 rounded ${
                                          isDuplicate
                                            ? 'bg-destructive/10 text-destructive line-through'
                                            : 'bg-muted'
                                        }`}
                                      >
                                        {word}
                                        {isDuplicate && (
                                          <span className="ml-2 text-xs">(duplicate)</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {parsedWords.length - duplicateWords.size} new word{parsedWords.length - duplicateWords.size !== 1 ? 's' : ''} will be uploaded
                              </p>
                            </div>
                          </div>
                        )}
                        <DialogFooter>
                          <Button variant="outline" onClick={() => {
                            setIsCsvUploadOpen(false);
                            setShowPreview(false);
                            setCsvFile(null);
                            setParsedWords([]);
                            setDuplicateWords(new Set());
                          }}>
                            Cancel
                          </Button>
                          {showPreview && (
                            <Button variant="outline" onClick={() => {
                              setShowPreview(false);
                              setCsvFile(null);
                              setParsedWords([]);
                              setDuplicateWords(new Set());
                            }}>
                              Change File
                            </Button>
                          )}
                          {showPreview ? (
                            <Button onClick={handleConfirmUpload} disabled={uploadingCsv || parsedWords.length - duplicateWords.size === 0}>
                              {uploadingCsv ? "Uploading..." : `Upload ${parsedWords.length - duplicateWords.size} Words`}
                            </Button>
                          ) : (
                            <Button disabled={!csvFile}>
                              Next
                            </Button>
                          )}
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    </div>

                    {/* Edit Whisp Element Dialog */}
                    <Dialog open={isEditElementOpen && editingElement?.is_whisp === true} onOpenChange={(open) => {
                      if (!open) {
                        setIsEditElementOpen(false);
                        setEditingElement(null);
                      }
                    }}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Whisp Element</DialogTitle>
                          <DialogDescription>Update whisp details</DialogDescription>
                        </DialogHeader>
                        {editingElement && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Whisp Word *</Label>
                              <Input
                                value={editingElement.name}
                                onChange={(e) => setEditingElement({ ...editingElement, name: e.target.value })}
                                placeholder="e.g., Coffee, Lamp, Sofa"
                              />
                            </div>
                          </div>
                        )}
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsEditElementOpen(false)}>Cancel</Button>
                          <Button onClick={handleEditElement}>Save Changes</Button>
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
                                  {element.name}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditDialog(element)}
                                      title="Edit whisp"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteElement(element.id, element.name)}
                                      title="Delete whisp"
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