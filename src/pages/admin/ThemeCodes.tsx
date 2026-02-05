import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Trash2, RefreshCw, RotateCcw, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllUrlParams } from "@/lib/urlUtils";
import { ThemeCSVImport } from "@/components/admin/ThemeCSVImport";


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

type ThemeCode = {
  id: string;
  tenant_id: string;
  code: string;
  status: string;
  redeemed_by: string | null;
  redeemed_at: string | null;
  expires_at: string | null;
  themes_unlocked: string[];
  created_at: string;
  updated_at: string;
};

type Theme = {
  id: string;
  name: string;
  icon: string;
};

const ThemeCodes = () => {
  const [searchParams] = useSearchParams();
  
  // Get shop from multiple sources
  const shop = useMemo(() => {
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
  
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant(shop);
  
  const [codes, setCodes] = useState<ThemeCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCode, setEditingCode] = useState<ThemeCode | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Filter and search state
  const [statusFilter, setStatusFilter] = useState<"all" | "unused" | "active" | "expired">("all");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state for add/edit
  const [formData, setFormData] = useState<{
    code: string;
    themes: string[];
    status: "unused" | "active" | "expired";
    expires_at: string | null;
  }>({
    code: "",
    themes: [],
    status: "unused",
    expires_at: null,
  });

  // Themes loaded from database
  const [availableThemes, setAvailableThemes] = useState<Theme[]>([]);

  // Load codes and themes when tenant is available
  useEffect(() => {
    if (tenant?.id) {
      loadCodes();
      loadThemes();
    }
  }, [tenant?.id]);

  const loadCodes = async () => {
    if (!tenant?.shop_domain) {
      console.error('Cannot load theme codes: tenant or shop_domain missing');
      return;
    }

    console.log('Loading theme codes for shop:', tenant.shop_domain);
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('list-theme-codes', {
        body: { shop_domain: tenant.shop_domain },
      });

      console.log('List theme codes response:', { data, error });

      if (error || !data?.success) {
        console.error('Error loading theme codes:', error || data?.error);
        toast({
          title: "Error loading theme codes",
          description: error?.message || data?.error || 'Failed to load theme codes',
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log('Theme codes loaded successfully:', data.codes);
      setCodes(data.codes || []);
    } catch (error) {
      console.error('Exception loading theme codes:', error);
      toast({
        title: "Error loading theme codes",
        description: error instanceof Error ? error.message : 'Failed to load theme codes',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadThemes = async () => {
    try {
      const { data, error } = await supabase
        .from('themes')
        .select('id, name, icon')
        .order('name');

      if (error) {
        console.error('Error loading themes:', error);
        toast({
          title: "Error loading themes",
          description: 'Failed to load available themes',
          variant: "destructive",
        });
        return;
      }

      console.log('Themes loaded successfully:', data);
      setAvailableThemes(data || []);
    } catch (error) {
      console.error('Exception loading themes:', error);
      toast({
        title: "Error loading themes",
        description: error instanceof Error ? error.message : 'Failed to load themes',
        variant: "destructive",
      });
    }
  };

  const handleEditCode = async () => {
    if (!editingCode || !tenant) return;

    setLoading(true);

    try {
      const updateBody: any = {
        codeId: editingCode.id,
        status: formData.status,
        shopDomain: tenant.shop_domain,
      };

      // Update code value if provided and different (only for unused codes)
      if (editingCode.status === 'unused' && formData.code && formData.code.trim() !== editingCode.code) {
        updateBody.code = formData.code.trim().toUpperCase();
      }

      // Update themes_unlocked if provided (only for unused codes)
      if (editingCode.status === 'unused' && formData.themes) {
        updateBody.themes_unlocked = formData.themes;
      }

      // Handle expiration time for non-expired codes
      if (editingCode.status !== 'expired' && formData.status !== 'expired') {
        if (formData.expires_at) {
          const localDate = new Date(formData.expires_at);
          updateBody.expires_at = localDate.toISOString();
        } else {
          updateBody.expires_at = null;
        }
      }

      const { data: updateData, error: updateError } = await supabase.functions.invoke('update-theme-code', {
        body: updateBody,
      });

      if (updateError || !updateData?.success) {
        throw new Error(updateData?.error || 'Failed to update theme code');
      }

      toast({
        title: "Theme code updated",
        description: "Theme code updated successfully",
      });

      setEditingCode(null);
      setFormData({ code: "", themes: [], status: "unused", expires_at: null });
      await loadCodes();
    } catch (error) {
      console.error('Error updating theme code:', error);
      toast({
        title: "Error updating theme code",
        description: error instanceof Error ? error.message : "Failed to update theme code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (code: ThemeCode) => {
    setEditingCode(code);
    let formattedExpiresAt: string | null = null;
    if (code.expires_at) {
      const date = new Date(code.expires_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      formattedExpiresAt = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    setFormData({
      code: code.code,
      themes: code.themes_unlocked,
      status: code.status as "unused" | "active" | "expired",
      expires_at: formattedExpiresAt,
    });
  };

  const handleCreateCode = async () => {
    if (!tenant || !formData.code.trim()) {
      toast({
        title: "Error",
        description: "Code is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const createBody: any = {
        code: formData.code.trim().toUpperCase(),
        themes_unlocked: formData.themes,
        shop_domain: tenant.shop_domain,
      };

      if (formData.expires_at) {
        const localDate = new Date(formData.expires_at);
        createBody.expires_at = localDate.toISOString();
      }

      const { data, error } = await supabase.functions.invoke('create-theme-code', {
        body: createBody,
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to create theme code');
      }

      toast({
        title: "Theme code created",
        description: `Theme code "${formData.code.trim().toUpperCase()}" created successfully`,
      });

      setIsCreateDialogOpen(false);
      setFormData({ code: "", themes: [], status: "unused", expires_at: null });
      await loadCodes();
    } catch (error) {
      console.error('Error creating theme code:', error);
      toast({
        title: "Error creating theme code",
        description: error instanceof Error ? error.message : "Failed to create theme code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCode = async (code: ThemeCode) => {
    if (!tenant?.shop_domain) {
      toast({
        title: "Error",
        description: "Tenant not found",
        variant: "destructive",
      });
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to delete theme code "${code.code}"?\n\nThis will:\n- Delete the code permanently\n- Revoke access for any customers who redeemed it\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-theme-code', {
        body: {
          codeId: code.id,
          shopDomain: tenant.shop_domain,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to delete theme code');
      }

      toast({
        title: "Theme code deleted",
        description: data.message || "Theme code deleted and customer access revoked",
      });

      await loadCodes();
    } catch (error) {
      console.error('Error deleting theme code:', error);
      toast({
        title: "Error deleting theme code",
        description: error instanceof Error ? error.message : "Failed to delete theme code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetCode = async (code: ThemeCode) => {
    if (!tenant?.shop_domain) {
      toast({
        title: "Error",
        description: "Tenant not found",
        variant: "destructive",
      });
      return;
    }

    const confirmed = confirm(
      `Reset theme code "${code.code}"?\n\nThis will:\n- Mark code as unused\n- Remove customer assignment\n- Remove from customer's Shopify metafields\n\nThe code can be redeemed again.`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-theme-code-redemption', {
        body: {
          code_id: code.id,
          shop_domain: tenant.shop_domain,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to reset theme code');
      }

      toast({
        title: "Theme code reset",
        description: "Theme code has been reset and can be redeemed again",
      });

      await loadCodes();
    } catch (error) {
      console.error('Error resetting theme code:', error);
      toast({
        title: "Error resetting theme code",
        description: error instanceof Error ? error.message : "Failed to reset theme code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
  };

  const formatExpirationTime = (expiresAt: string | null, status: string) => {
    if (!expiresAt) {
      if (status === 'expired') return <span className="text-muted-foreground">Expired</span>;
      return "—";
    }
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const diffMs = expirationDate.getTime() - now.getTime();
    
    if (diffMs < 0) {
      return <span className="text-destructive">Expired</span>;
    }
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) {
      return <span className="text-green-600">{diffDays}d {diffHours}h</span>;
    } else if (diffHours > 0) {
      return <span className="text-yellow-600">{diffHours}h {diffMinutes}m</span>;
    } else if (diffMinutes > 0) {
      return <span className="text-orange-600">{diffMinutes}m</span>;
    } else {
      return <span className="text-red-600">Expiring soon</span>;
    }
  };

  // Get unique themes from codes for filter dropdown
  const uniqueThemes = useMemo(() => {
    const themeSet = new Set<string>();
    codes.forEach(code => {
      code.themes_unlocked.forEach(themeId => {
        const theme = availableThemes.find(t => t.id === themeId);
        if (theme) {
          themeSet.add(theme.name);
        }
      });
    });
    return Array.from(themeSet).sort();
  }, [codes, availableThemes]);

  // Filter codes based on status filter, theme filter, and search query
  const filteredCodes = useMemo(() => {
    let filtered = codes;

    if (statusFilter !== "all") {
      filtered = filtered.filter(code => code.status === statusFilter);
    }

    if (themeFilter !== "all") {
      filtered = filtered.filter(code => {
        return code.themes_unlocked.some(themeId => {
          const theme = availableThemes.find(t => t.id === themeId);
          return theme?.name === themeFilter;
        });
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(code => {
        const codeMatch = code.code.toLowerCase().includes(query);
        const customerIdMatch = code.redeemed_by?.toLowerCase().includes(query);
        const themesMatch = code.themes_unlocked.some(themeId => {
          const theme = availableThemes.find(t => t.id === themeId);
          return theme?.name.toLowerCase().includes(query);
        });
        return codeMatch || customerIdMatch || themesMatch;
      });
    }

    return filtered;
  }, [codes, statusFilter, themeFilter, searchQuery, availableThemes, uniqueThemes]);

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
            <CardTitle>Error Loading Shop</CardTitle>
            <CardDescription>
              {tenantError || "Could not find shop configuration. Make sure you're accessing this from within Shopify Admin."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/admin?shop=${shop}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Theme Codes</h1>
              <p className="text-muted-foreground mt-1">
                {tenant.name} - Manage codes for unlocking themes
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={loadCodes}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
            <ThemeCSVImport tenantId={tenant.id} onImportComplete={loadCodes} />
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) {
                setFormData({ code: "", themes: [], status: "unused", expires_at: null });
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Theme Code
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Theme Code</DialogTitle>
                  <DialogDescription>
                    Create a new theme code to unlock themes for customers
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-code">Code Value</Label>
                    <Input
                      id="create-code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., THEME-ABC-123"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the redemption code text
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Theme Association</Label>
                    <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                      {availableThemes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No themes available.</p>
                      ) : (
                        availableThemes.map((theme) => (
                          <div key={theme.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`create-theme-${theme.id}`}
                              checked={formData.themes.includes(theme.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({
                                    ...formData,
                                    themes: [...formData.themes, theme.id]
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    themes: formData.themes.filter(t => t !== theme.id)
                                  });
                                }
                              }}
                            />
                            <Label
                              htmlFor={`create-theme-${theme.id}`}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {/* <span className="mr-2">{theme.icon}</span> */}
                              {theme.name}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select themes that this code will unlock
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateCode}
                    disabled={loading || !formData.code.trim()}
                  >
                    {loading ? "Creating..." : "Create Theme Code"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Theme Codes</CardTitle>
            <CardDescription>
              {filteredCodes.length} of {codes.length} {codes.length === 1 ? "code" : "codes"} shown
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filter and Search Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  placeholder="Search by code, customer ID, or theme..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </Button>
                <Select value={themeFilter} onValueChange={setThemeFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Filter by theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Themes</SelectItem>
                    {uniqueThemes.map((themeName) => (
                      <SelectItem key={themeName} value={themeName}>
                        {themeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={statusFilter === "unused" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("unused")}
                  className={statusFilter === "unused" ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500" : ""}
                >
                  Unused
                </Button>
                <Button
                  variant={statusFilter === "active" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("active")}
                  className={statusFilter === "active" ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500" : ""}
                >
                  Active
                </Button>
                <Button
                  variant={statusFilter === "expired" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("expired")}
                  className={statusFilter === "expired" ? "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500" : ""}
                >
                  Expired
                </Button>
              </div>
            </div>

            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading theme codes...</p>
            ) : codes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No theme codes yet. Create your first code to get started.</p>
            ) : filteredCodes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No codes match your filters. 
                {searchQuery && <span className="block mt-2">Try adjusting your search query or filters.</span>}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Redeemed By</TableHead>
                    <TableHead>Redeemed At</TableHead>
                    <TableHead>Expires At</TableHead>
                    <TableHead>Themes Unlocked</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-semibold">{code.code}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            code.status === "active"
                              ? "bg-green-500/10 text-green-500"
                              : code.status === "unused"
                              ? "bg-blue-500/10 text-blue-500"
                              : code.status === "expired"
                              ? "bg-yellow-500/10 text-yellow-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {code.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {code.redeemed_by ? (
                          <a
                            href={`https://${tenant.shop_domain}/admin/customers/${code.redeemed_by}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {code.redeemed_by}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{formatDate(code.redeemed_at)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div>{formatExpirationTime(code.expires_at, code.status)}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(code.expires_at)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {code.themes_unlocked.length > 0
                          ? code.themes_unlocked.map(themeId => {
                              const theme = availableThemes.find(t => t.id === themeId);
                              return theme ? `${theme.name}` : themeId;
                            }).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {(code.status === "unused" || code.status === "active") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(code)}
                              title="Edit theme code"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {code.status === "active" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleResetCode(code)}
                              title="Reset redemption"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCode(code)}
                            className="text-destructive hover:text-destructive"
                            title="Delete theme code"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingCode} onOpenChange={() => setEditingCode(null)}>
          <DialogContent className={editingCode?.status === 'unused' ? "sm:max-w-[600px] max-h-[90vh] overflow-y-auto" : "sm:max-w-[500px]"}>
            <DialogHeader>
              <DialogTitle>Edit Theme Code: {editingCode?.code}</DialogTitle>
              <DialogDescription>
                {editingCode?.status === 'unused' 
                  ? 'Edit code value, themes, status, or assign to customer'
                  : 'Update theme code status'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Code Value - Only for unused codes */}
              {editingCode?.status === 'unused' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Code Value</Label>
                  <Input
                    id="edit-code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., THEME-ABC-123"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Change the actual redemption code text
                  </p>
                </div>
              )}

              {/* Theme Association - Only for unused codes */}
              {editingCode?.status === 'unused' && (
                <div className="space-y-2">
                  <Label>Theme Association</Label>
                  <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                    {availableThemes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No themes available.</p>
                    ) : (
                      availableThemes.map((theme) => (
                        <div key={theme.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-theme-${theme.id}`}
                            checked={formData.themes.includes(theme.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({
                                  ...formData,
                                  themes: [...formData.themes, theme.id]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  themes: formData.themes.filter(t => t !== theme.id)
                                });
                              }
                            }}
                          />
                          <Label
                            htmlFor={`edit-theme-${theme.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {/* <span className="mr-2">{theme.icon}</span> */}
                            {theme.name}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select themes that this code will unlock
                  </p>
                </div>
              )}

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value as any })
                  }
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unused">Unused</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Expires At - For non-expired codes */}
              {editingCode?.status !== 'expired' && formData.status !== 'expired' && (
                <div className="space-y-2">
                  <Label htmlFor="edit-expires-at">Expires At (Local Time)</Label>
                  <input
                    id="edit-expires-at"
                    type="datetime-local"
                    value={formData.expires_at || ""}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value || null })}
                    min={(() => {
                      const now = new Date();
                      const year = now.getFullYear();
                      const month = String(now.getMonth() + 1).padStart(2, '0');
                      const day = String(now.getDate()).padStart(2, '0');
                      const hours = String(now.getHours()).padStart(2, '0');
                      const minutes = String(now.getMinutes()).padStart(2, '0');
                      return `${year}-${month}-${day}T${hours}:${minutes}`;
                    })()}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-sm text-muted-foreground">
                    Current UTC: {formatDate(editingCode?.expires_at)}
                  </p>
                </div>
              )}

              {/* Current redemption info */}
              {editingCode?.redeemed_by && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Currently redeemed by: <strong>{editingCode.redeemed_by}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Change status to "Unused" to detach from customer
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setEditingCode(null)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEditCode}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ThemeCodes;
