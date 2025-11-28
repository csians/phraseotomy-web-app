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
import { RefreshCw, Plus, Download, Trash2 } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import type { Tables } from "@/integrations/supabase/types";
import { PackCSVImport } from "@/components/admin/PackCSVImport";
import { getAllUrlParams } from "@/lib/urlUtils";

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
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPack, setNewPack] = useState({ name: "", description: "" });
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
      const { data, error } = await supabase
        .from("packs")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPacks(data || []);
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
      const { error } = await supabase.from("packs").insert({
        tenant_id: tenant.id,
        name: newPack.name.trim(),
        description: newPack.description.trim() || null,
      });

      if (error) throw error;

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
    if (!confirm(`Are you sure you want to delete pack "${packName}"? This will also remove it from all associated codes.`)) {
      return;
    }

    try {
      const { error } = await supabase.from("packs").delete().eq("id", packId);

      if (error) throw error;

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

  const downloadTemplate = () => {
    const csv = [
      "name,description",
      "base,Base game pack",
      "expansion1,First expansion pack",
      "premium,Premium content pack"
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "packs-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportPacks = () => {
    const headers = ["name", "description", "created_at"];
    const rows = packs.map(pack => [
      pack.name,
      pack.description || "",
      pack.created_at,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `packs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Game Packs Management</CardTitle>
          <CardDescription>
            Manage game packs for {tenant.name} ({tenant.shop_domain})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={loadPacks} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button onClick={exportPacks} variant="outline" disabled={packs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            <Button onClick={downloadTemplate} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>

            {tenant?.id && (
              <PackCSVImport tenantId={tenant.id} onImportComplete={loadPacks} />
            )}

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

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : packs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No packs found. Create your first pack above.
                    </TableCell>
                  </TableRow>
                ) : (
                  packs.map((pack) => (
                    <TableRow key={pack.id}>
                      <TableCell className="font-medium">{pack.name}</TableCell>
                      <TableCell>{pack.description || "-"}</TableCell>
                      <TableCell>{new Date(pack.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePack(pack.id, pack.name)}
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
    </div>
  );
}
