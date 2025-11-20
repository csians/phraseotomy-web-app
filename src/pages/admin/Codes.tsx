import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { redemptionCodeSchema, packsArraySchema, validateInput } from "@/lib/validation";

type LicenseCode = Tables<"license_codes">;

const Codes = () => {
  const [searchParams] = useSearchParams();
  const shop = searchParams.get('shop');
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant(shop);
  
  const [codes, setCodes] = useState<LicenseCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<LicenseCode | null>(null);
  const { toast } = useToast();

  // Form state for add/edit
  const [formData, setFormData] = useState<{
    code: string;
    packs: string;
    status: "unused" | "active" | "expired" | "void";
  }>({
    code: "",
    packs: "",
    status: "unused",
  });

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningCode, setAssigningCode] = useState<LicenseCode | null>(null);
  const [customerIdInput, setCustomerIdInput] = useState("");
  const [customerEmailInput, setCustomerEmailInput] = useState("");

  // Load codes when tenant is available
  useEffect(() => {
    if (tenant?.id) {
      loadCodes(tenant.id);
    }
  }, [tenant?.id]);

  const loadCodes = async (tenant_id: string) => {
    if (!tenant?.shop_domain) return;

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('list-license-codes', {
        body: { shop_domain: tenant.shop_domain },
      });

      if (error || !data?.success) {
        toast({
          title: "Error loading codes",
          description: error?.message || data?.error || 'Failed to load codes',
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setCodes(data.codes || []);
    } catch (error) {
      toast({
        title: "Error loading codes",
        description: error instanceof Error ? error.message : 'Failed to load codes',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCode = async () => {
    if (!tenant?.shop_domain) {
      toast({
        title: "Error",
        description: "Tenant not found",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate code format
      const validatedCode = validateInput(redemptionCodeSchema, formData.code);
      
      // Parse and validate packs
      const packsList = formData.packs.split(',').map(p => p.trim()).filter(Boolean);
      const validatedPacks = validateInput(packsArraySchema, packsList);

      setLoading(true);

      // Use edge function to create code (bypasses RLS with service role)
      const { data, error } = await supabase.functions.invoke('create-license-code', {
        body: {
          code: validatedCode,
          packs_unlocked: validatedPacks,
          shop_domain: tenant.shop_domain,
        },
      });

      if (error || !data?.success) {
        toast({
          title: "Error creating code",
          description: error?.message || data?.error || 'Failed to create license code',
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Code created",
        description: `Code ${validatedCode} has been added`,
      });

      setIsAddDialogOpen(false);
      setFormData({ code: "", packs: "", status: "unused" });
      await loadCodes(tenant.id);
      setLoading(false);
    } catch (error) {
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Invalid input",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleEditCode = async () => {
    if (!editingCode) return;

    const updates: Partial<LicenseCode> = {
      status: formData.status,
    };

    // If status is being changed to unused, clear redemption data
    if (formData.status === "unused") {
      updates.redeemed_by = null;
      updates.redeemed_at = null;
    }

    const { error } = await supabase
      .from("license_codes")
      .update(updates)
      .eq("id", editingCode.id);

    if (error) {
      toast({
        title: "Error updating code",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Code updated",
      description: "Code has been updated successfully",
    });

    setEditingCode(null);
    setFormData({ code: "", packs: "", status: "unused" });
    if (tenant?.id) loadCodes(tenant.id);
  };

  const openEditDialog = (code: LicenseCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      packs: code.packs_unlocked.join(", "),
      status: code.status as "unused" | "active" | "expired" | "void",
    });
  };

  const handleAssignCode = async () => {
    if (!assigningCode || !customerIdInput || !tenant) {
      toast({
        title: "Error",
        description: "Please provide customer ID",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('update-customer-metafield', {
        body: {
          customerId: customerIdInput.trim(),
          customerEmail: customerEmailInput.trim(),
          code: assigningCode.code,
          shopDomain: tenant.shop_domain,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Code assigned",
        description: data.message || `Code ${assigningCode.code} assigned to customer`,
      });

      setAssignDialogOpen(false);
      setAssigningCode(null);
      setCustomerIdInput("");
      setCustomerEmailInput("");
    } catch (error) {
      console.error('Error assigning code:', error);
      toast({
        title: "Error assigning code",
        description: error instanceof Error ? error.message : "Failed to assign code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openAssignDialog = (code: LicenseCode) => {
    setAssigningCode(code);
    setCustomerIdInput("");
    setCustomerEmailInput("");
    setAssignDialogOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString();
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
              <h1 className="text-3xl font-bold text-foreground">License Codes</h1>
              <p className="text-muted-foreground mt-1">
                {tenant.name} - Manage 6-digit codes for your customers
              </p>
            </div>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New License Code</DialogTitle>
                <DialogDescription>Create a new 6-digit license code</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code (6 digits)</Label>
                  <Input
                    id="code"
                    placeholder="ABC123"
                    maxLength={6}
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="packs">Packs Unlocked (comma-separated)</Label>
                  <Input
                    id="packs"
                    placeholder="Core, Horror, Sci-Fi"
                    value={formData.packs}
                    onChange={(e) => setFormData({ ...formData, packs: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCode}>Create Code</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Codes</CardTitle>
            <CardDescription>
              {codes.length} {codes.length === 1 ? "code" : "codes"} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading codes...</p>
            ) : codes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No codes yet. Add your first code to get started.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Redeemed By</TableHead>
              <TableHead>Redeemed At</TableHead>
              <TableHead>Expires At</TableHead>
              <TableHead>Packs Unlocked</TableHead>
              <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((code) => (
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
                      <TableCell>{code.redeemed_by || "—"}</TableCell>
                      <TableCell>{formatDate(code.redeemed_at)}</TableCell>
                      <TableCell>{formatDate(code.expires_at)}</TableCell>
                      <TableCell>
                        {code.packs_unlocked.length > 0
                          ? code.packs_unlocked.join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(code)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Code: {editingCode?.code}</DialogTitle>
              <DialogDescription>Update code status or detach from customer</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
                    <SelectItem value="void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              <Button variant="outline" onClick={() => setEditingCode(null)}>
                Cancel
              </Button>
              <Button onClick={handleEditCode}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Code Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Code to Customer</DialogTitle>
              <DialogDescription>
                Assign code "{assigningCode?.code}" to a customer's Shopify metafields
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer-id">Customer ID *</Label>
                <Input
                  id="customer-id"
                  placeholder="e.g., 9305249448029"
                  value={customerIdInput}
                  onChange={(e) => setCustomerIdInput(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Find this in Shopify Admin → Customers → Customer Details
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">Customer Email (optional)</Label>
                <Input
                  id="customer-email"
                  type="email"
                  placeholder="customer@example.com"
                  value={customerEmailInput}
                  onChange={(e) => setCustomerEmailInput(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAssignDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleAssignCode} disabled={loading || !customerIdInput}>
                {loading ? "Assigning..." : "Assign Code"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Codes;
