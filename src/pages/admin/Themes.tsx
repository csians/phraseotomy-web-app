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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface Theme {
  id: string;
  name: string;
  icon: string;
  is_core: boolean;
  core_theme_type: 'feelings' | 'events' | null;
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
  core_element_type: 'feelings' | 'events' | null;
  theme_id: string | null;
  created_at: string;
}

interface Pack {
  id: string;
  name: string;
}

interface ThemePack {
  id: string;
  theme_id: string;
  pack_id: string;
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
  const [themePacks, setThemePacks] = useState<ThemePack[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddThemeOpen, setIsAddThemeOpen] = useState(false);
  const [isAddElementOpen, setIsAddElementOpen] = useState(false);
  const [newTheme, setNewTheme] = useState({ name: "", icon: "🎮", pack_ids: [] as string[], is_core: false, core_theme_type: null as 'feelings' | 'events' | null });
  const [newElement, setNewElement] = useState({ name: "", icon: "🔮", color: "#6366f1", is_whisp: false, core_element_type: null as 'feelings' | 'events' | null });
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
      const [themesRes, packsRes, themePacksRes] = await Promise.all([
        supabase.from("themes").select("*").order("name"),
        supabase.from("packs").select("id, name").eq("tenant_id", tenant.id),
        supabase.from("theme_packs").select("id, theme_id, pack_id")
      ]);
      
      if (themesRes.error) throw themesRes.error;
      if (packsRes.error) throw packsRes.error;
      if (themePacksRes.error) throw themePacksRes.error;
      
      setThemes(themesRes.data || []);
      setPacks(packsRes.data || []);
      setThemePacks(themePacksRes.data || []);
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
      // First create the theme
      const { data: themeData, error: themeError } = await supabase.functions.invoke('admin-create-theme', {
        body: {
          name: newTheme.name.trim(),
          icon: newTheme.icon,
          pack_id: null, // Don't use pack_id anymore, use theme_packs junction table
          is_core: newTheme.is_core,
          core_theme_type: newTheme.is_core ? newTheme.core_theme_type : null
        }
      });
      
      if (themeError) throw themeError;
      
      const themeId = themeData?.theme?.id;
      if (!themeId) {
        throw new Error("Theme created but no ID returned");
      }
      
      // Then create theme_packs relationships for selected packs
      if (newTheme.pack_ids.length > 0) {
        const packPromises = newTheme.pack_ids.map(packId =>
          supabase.functions.invoke('admin-manage-theme-packs', {
            body: {
              action: 'add',
              theme_id: themeId,
              pack_id: packId
            }
          })
        );
        
        const packResults = await Promise.all(packPromises);
        const packErrors = packResults.filter(r => r.error);
        if (packErrors.length > 0) {
          console.warn("Some pack associations failed:", packErrors);
        }
      }
      
      toast({ title: "Theme created successfully" });
      setIsAddThemeOpen(false);
      setNewTheme({ name: "", icon: "🎮", pack_ids: [], is_core: false, core_theme_type: null });
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
          theme_id: selectedTheme.id,
          core_element_type: selectedTheme.is_core ? newElement.core_element_type : null
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
      setNewElement({ name: "", icon: "🔮", color: "#6366f1", is_whisp: false, core_element_type: null });
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
          core_element_type: selectedTheme?.is_core ? editingElement.core_element_type : null
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
                
                <Dialog open={isAddThemeOpen} onOpenChange={(open) => {
                  setIsAddThemeOpen(open);
                  if (!open) {
                    setNewTheme({ name: "", icon: "🎮", pack_ids: [], is_core: false, core_theme_type: null });
                  }
                }}>
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
                        <Label>Packs (Optional - select multiple packs for this theme)</Label>
                        <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                          {packs.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No packs available. Create packs first.</p>
                          ) : (
                            packs.map((pack) => (
                              <div key={pack.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`pack-${pack.id}`}
                                  checked={newTheme.pack_ids.includes(pack.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setNewTheme({
                                        ...newTheme,
                                        pack_ids: [...newTheme.pack_ids, pack.id]
                                      });
                                    } else {
                                      setNewTheme({
                                        ...newTheme,
                                        pack_ids: newTheme.pack_ids.filter(id => id !== pack.id)
                                      });
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`pack-${pack.id}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {pack.name}
                                </Label>
                              </div>
                            ))
                          )}
                        </div>
                        {newTheme.pack_ids.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {newTheme.pack_ids.length} pack{newTheme.pack_ids.length > 1 ? 's' : ''} selected
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_core"
                          checked={newTheme.is_core}
                          onChange={(e) => setNewTheme({ ...newTheme, is_core: e.target.checked, core_theme_type: e.target.checked ? newTheme.core_theme_type : null })}
                          className="rounded border-border"
                        />
                        <Label htmlFor="is_core">Core Theme (base game)</Label>
                      </div>
                      {newTheme.is_core && (
                        <div className="space-y-2">
                          <Label>Core Theme Type *</Label>
                          <Select
                            value={newTheme.core_theme_type || ""}
                            onValueChange={(value) => setNewTheme({ ...newTheme, core_theme_type: value === "" ? null : value as 'feelings' | 'events' })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="feelings">Feelings</SelectItem>
                              <SelectItem value="events">Events</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Select whether this core theme contains feelings or events elements
                          </p>
                        </div>
                      )}
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
                            <div className="flex flex-wrap gap-1">
                              {theme.is_core ? (
                                <Badge variant="default" className="text-xs">Core</Badge>
                              ) : null}
                              {themePacks
                                .filter(tp => tp.theme_id === theme.id)
                                .map(tp => {
                                  const pack = packs.find(p => p.id === tp.pack_id);
                                  return pack ? (
                                    <Badge key={tp.id} variant="secondary" className="text-xs">
                                      {pack.name}
                                    </Badge>
                                  ) : null;
                                })
                                .filter(item => item !== null)}
                              {!theme.is_core && themePacks.filter(tp => tp.theme_id === theme.id).length === 0 && (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
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
                          {selectedTheme.is_core && (
                            <div className="space-y-2">
                              <Label>Core Element Type</Label>
                              <Select
                                value={newElement.core_element_type || ""}
                                onValueChange={(value) => setNewElement({ ...newElement, core_element_type: value === "" ? null : value as 'feelings' | 'events' })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="feelings">Feelings</SelectItem>
                                  <SelectItem value="events">Events</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Classify this element as feelings or events (for core themes only)
                              </p>
                            </div>
                          )}
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
                            {selectedTheme?.is_core && (
                              <div className="space-y-2">
                                <Label>Core Element Type</Label>
                                <Select
                                  value={editingElement.core_element_type || ""}
                                  onValueChange={(value) => setEditingElement({ ...editingElement, core_element_type: value === "" ? null : value as 'feelings' | 'events' })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type (optional)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="feelings">Feelings</SelectItem>
                                    <SelectItem value="events">Events</SelectItem>
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                  Classify this element as feelings or events (for core themes only)
                                </p>
                              </div>
                            )}
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
                            {selectedTheme.is_core && <TableHead>Type</TableHead>}
                            <TableHead className="w-32">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {elements.filter(e => !e.is_whisp).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={selectedTheme.is_core ? 5 : 4} className="text-center text-muted-foreground">
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
                                {selectedTheme.is_core && (
                                  <TableCell>
                                    {element.core_element_type ? (
                                      <Badge variant="secondary" className="text-xs">
                                        {element.core_element_type === 'feelings' ? 'Feelings' : 'Events'}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>
                                )}
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