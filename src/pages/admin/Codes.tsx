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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Check, ChevronsUpDown, Trash2, RefreshCw, RotateCcw } from "lucide-react";
import { CSVImport } from "@/components/admin/CSVImport";
import { CodeExport } from "@/components/admin/CodeExport";
import type { Tables } from "@/integrations/supabase/types";
import { redemptionCodeSchema, packsArraySchema, validateInput } from "@/lib/validation";
import { cn } from "@/lib/utils";
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

type LicenseCode = Tables<"license_codes">;

const Codes = () => {
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
  
  const [codes, setCodes] = useState<LicenseCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<LicenseCode | null>(null);
  const { toast } = useToast();

  // Form state for add/edit
  const [formData, setFormData] = useState<{
    code: string;
    packs: string[];
    status: "unused" | "active" | "expired" | "void";
  }>({
    code: "",
    packs: [],
    status: "unused",
  });

  // Packs loaded from database
  const [availablePacks, setAvailablePacks] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
  }>>([]);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningCode, setAssigningCode] = useState<LicenseCode | null>(null);
  
  // Customer search state
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [searchedCustomers, setSearchedCustomers] = useState<Array<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  }>>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    email: string;
    name: string;
  } | null>(null);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Load codes and packs when tenant is available
  useEffect(() => {
    if (tenant?.id) {
      loadCodes();
      loadPacks();
    }
  }, [tenant?.id]);

  const loadCodes = async () => {
    if (!tenant?.shop_domain) {
      console.error('Cannot load codes: tenant or shop_domain missing');
      return;
    }

    console.log('Loading codes for shop:', tenant.shop_domain);
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('list-license-codes', {
        body: { shop_domain: tenant.shop_domain },
      });

      console.log('List codes response:', { data, error });

      if (error || !data?.success) {
        console.error('Error loading codes:', error || data?.error);
        toast({
          title: "Error loading codes",
          description: error?.message || data?.error || 'Failed to load codes',
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log('Codes loaded successfully:', data.codes);
      setCodes(data.codes || []);
    } catch (error) {
      console.error('Exception loading codes:', error);
      toast({
        title: "Error loading codes",
        description: error instanceof Error ? error.message : 'Failed to load codes',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPacks = async () => {
    if (!tenant?.id) {
      console.error('Cannot load packs: tenant missing');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('packs')
        .select('id, name, description')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) {
        console.error('Error loading packs:', error);
        toast({
          title: "Error loading packs",
          description: 'Failed to load available packs',
          variant: "destructive",
        });
        return;
      }

      console.log('Packs loaded successfully:', data);
      setAvailablePacks(data || []);
    } catch (error) {
      console.error('Exception loading packs:', error);
      toast({
        title: "Error loading packs",
        description: error instanceof Error ? error.message : 'Failed to load packs',
        variant: "destructive",
      });
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
      
      // Validate packs
      const validatedPacks = validateInput(packsArraySchema, formData.packs);

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
      setFormData({ code: "", packs: [], status: "unused" });
      await loadCodes();
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
    if (!editingCode || !tenant) return;

    setLoading(true);

    try {
      // If a customer is selected, assign the code (creates license, updates metafield & code status)
      if (selectedCustomer) {
        const { data, error } = await supabase.functions.invoke('assign-code-to-customer', {
          body: {
            customerId: selectedCustomer.id,
            customerEmail: selectedCustomer.email,
            customerName: selectedCustomer.name,
            code: editingCode.code,
            shopDomain: tenant.shop_domain,
          },
        });

        if (error || !data?.success) {
          throw new Error(data?.error || 'Failed to assign code to customer');
        }

        toast({
          title: "Code assigned",
          description: `Code assigned to ${selectedCustomer.name} successfully`,
        });
      } else {
        // Just update the code status (no customer assignment)
        const { data: updateData, error: updateError } = await supabase.functions.invoke('update-license-code', {
          body: {
            codeId: editingCode.id,
            status: formData.status,
            shopDomain: tenant.shop_domain,
          },
        });

        if (updateError || !updateData?.success) {
          throw new Error(updateData?.error || 'Failed to update code status');
        }

        toast({
          title: "Code updated",
          description: "Code status updated successfully",
        });
      }

      setEditingCode(null);
      setSelectedCustomer(null);
      setCustomerSearchQuery("");
      setSearchedCustomers([]);
      setFormData({ code: "", packs: [], status: "unused" });
      await loadCodes();
    } catch (error) {
      console.error('Error updating code:', error);
      toast({
        title: "Error updating code",
        description: error instanceof Error ? error.message : "Failed to update code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (code: LicenseCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      packs: code.packs_unlocked,
      status: code.status as "unused" | "active" | "expired" | "void",
    });
    setSelectedCustomer(null);
    setCustomerSearchQuery("");
    setSearchedCustomers([]);
  };

  const searchCustomers = async (query: string) => {
    if (!tenant?.shop_domain || query.length < 2) {
      setSearchedCustomers([]);
      return;
    }

    setSearchingCustomers(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('search-shopify-customers', {
        body: {
          query,
          shop_domain: tenant.shop_domain,
        },
      });

      if (error || !data?.success) {
        console.error('Error searching customers:', error || data?.error);
        setSearchedCustomers([]);
        return;
      }

      setSearchedCustomers(data.customers || []);
    } catch (error) {
      console.error('Error searching customers:', error);
      setSearchedCustomers([]);
    } finally {
      setSearchingCustomers(false);
    }
  };

  // Debounce customer search
  useEffect(() => {
    if (customerSearchQuery.length < 2) {
      setSearchedCustomers([]);
      return;
    }

    const timer = setTimeout(() => {
      searchCustomers(customerSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearchQuery, tenant?.shop_domain]);

  const handleAssignCode = async () => {
    if (!assigningCode || !selectedCustomer || !tenant) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('update-customer-metafield', {
        body: {
          customerId: selectedCustomer.id,
          customerEmail: selectedCustomer.email,
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
      setSelectedCustomer(null);
      setCustomerSearchQuery("");
      setSearchedCustomers([]);
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
    setSelectedCustomer(null);
    setCustomerSearchQuery("");
    setSearchedCustomers([]);
    setAssignDialogOpen(true);
  };

  const handleDeleteCode = async (code: LicenseCode) => {
    if (!tenant?.shop_domain) {
      toast({
        title: "Error",
        description: "Tenant not found",
        variant: "destructive",
      });
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to delete code "${code.code}"?\n\nThis will:\n- Delete the code permanently\n- Revoke access for any customers who redeemed it\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-license-code', {
        body: {
          codeId: code.id,
          shopDomain: tenant.shop_domain,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to delete code');
      }

      toast({
        title: "Code deleted",
        description: data.message || "Code deleted and customer access revoked",
      });

      // Reload codes
      await loadCodes();
    } catch (error) {
      console.error('Error deleting code:', error);
      toast({
        title: "Error deleting code",
        description: error instanceof Error ? error.message : "Failed to delete code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetCode = async (code: LicenseCode) => {
    if (!tenant?.shop_domain) {
      toast({
        title: "Error",
        description: "Tenant not found",
        variant: "destructive",
      });
      return;
    }

    const confirmed = confirm(
      `Reset code "${code.code}"?\n\nThis will:\n- Mark code as unused\n- Remove customer assignment\n- Remove from customer's Shopify metafields\n\nThe code can be redeemed again.`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-code-redemption', {
        body: {
          code_id: code.id,
          shop_domain: tenant.shop_domain,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to reset code');
      }

      toast({
        title: "Code reset",
        description: "Code has been reset and can be redeemed again",
      });

      await loadCodes();
    } catch (error) {
      console.error('Error resetting code:', error);
      toast({
        title: "Error resetting code",
        description: error instanceof Error ? error.message : "Failed to reset code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={loadCodes}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
            <CodeExport codes={codes} />
            <CSVImport shopDomain={tenant.shop_domain} onImportComplete={loadCodes} />
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
                <div className="space-y-3">
                  <Label>Select Packs to Unlock</Label>
                  {availablePacks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No packs available. Please create packs first in the Packs management page.</p>
                  ) : (
                    <div className="space-y-2">
                      {availablePacks.map((pack) => (
                        <div key={pack.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                          <Checkbox
                            id={`pack-${pack.id}`}
                            checked={formData.packs.includes(pack.name)}
                            onCheckedChange={(checked) => {
                              setFormData({
                                ...formData,
                                packs: checked
                                  ? [...formData.packs, pack.name]
                                  : formData.packs.filter((p) => p !== pack.name),
                              });
                            }}
                          />
                          <div className="flex-1">
                            <Label htmlFor={`pack-${pack.id}`} className="cursor-pointer font-medium">
                              {pack.name}
                            </Label>
                            {pack.description && (
                              <p className="text-sm text-muted-foreground">{pack.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {formData.packs.length === 0 && availablePacks.length > 0 && (
                    <p className="text-sm text-destructive">Please select at least one pack</p>
                  )}
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
                      <TableCell>
                        {code.redeemed_by ? (
                          <a
                            href={`https://${tenant.shop_domain}/admin/customers/${code.redeemed_by}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {(code as any).customer_name || code.redeemed_by}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{formatDate(code.redeemed_at)}</TableCell>
                      <TableCell>{formatDate(code.expires_at)}</TableCell>
                      <TableCell>
                        {code.packs_unlocked.length > 0
                          ? code.packs_unlocked.join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(code)}
                            title="Edit code"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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
                            title="Delete code"
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
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Code: {editingCode?.code}</DialogTitle>
              <DialogDescription>Update code status or assign to a customer</DialogDescription>
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

              <div className="space-y-2">
                <Label>Assign to Customer (Optional)</Label>
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerSearchOpen}
                      className="w-full justify-between"
                    >
                      {selectedCustomer
                        ? `${selectedCustomer.name} (${selectedCustomer.email})`
                        : "Search by email or name..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[460px] p-0 bg-popover z-50" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Type email or name..." 
                        value={customerSearchQuery}
                        onValueChange={setCustomerSearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {searchingCustomers ? "Searching..." : customerSearchQuery.length < 2 ? "Type at least 2 characters" : "No customers found"}
                        </CommandEmpty>
                        <CommandGroup>
                          {searchedCustomers.map((customer) => {
                            const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'No name';
                            return (
                              <CommandItem
                                key={customer.id}
                                value={customer.id}
                                onSelect={() => {
                                  setSelectedCustomer({
                                    id: customer.id,
                                    email: customer.email,
                                    name,
                                  });
                                  setCustomerSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{name}</span>
                                  <span className="text-sm text-muted-foreground">{customer.email}</span>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedCustomer && (
                  <p className="text-sm text-muted-foreground">
                    Will assign code to: {selectedCustomer.name}
                  </p>
                )}
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

        {/* Assign Code Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Assign Code to Customer</DialogTitle>
              <DialogDescription>
                Assign code "{assigningCode?.code}" to a customer's Shopify metafields
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Search Customer</Label>
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerSearchOpen}
                      className="w-full justify-between"
                    >
                      {selectedCustomer
                        ? `${selectedCustomer.name} (${selectedCustomer.email})`
                        : "Search by email or name..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[460px] p-0 bg-popover z-50" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Type email or name..." 
                        value={customerSearchQuery}
                        onValueChange={setCustomerSearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {searchingCustomers ? "Searching..." : customerSearchQuery.length < 2 ? "Type at least 2 characters" : "No customers found"}
                        </CommandEmpty>
                        <CommandGroup>
                          {searchedCustomers.map((customer) => {
                            const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'No name';
                            return (
                              <CommandItem
                                key={customer.id}
                                value={customer.id}
                                onSelect={() => {
                                  setSelectedCustomer({
                                    id: customer.id,
                                    email: customer.email,
                                    name,
                                  });
                                  setCustomerSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{name}</span>
                                  <span className="text-sm text-muted-foreground">{customer.email}</span>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedCustomer && (
                  <p className="text-sm text-muted-foreground">
                    Customer ID: {selectedCustomer.id}
                  </p>
                )}
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
              <Button 
                onClick={handleAssignCode}
                disabled={!selectedCustomer || loading}
              >
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
