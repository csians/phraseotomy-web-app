import { useSearchParams, Link } from "react-router-dom";
import { useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Key, Package } from "lucide-react";
import { getAllUrlParams } from "@/lib/urlUtils";

// Extract shop domain from Shopify's host parameter (base64 encoded)
const extractShopFromHost = (host: string | null): string | null => {
  if (!host) return null;
  try {
    const decoded = atob(host);
    // Format is typically: "shop-domain.myshopify.com/admin"
    const shopMatch = decoded.match(/([a-zA-Z0-9-]+\.myshopify\.com)/);
    return shopMatch ? shopMatch[1] : null;
  } catch (e) {
    console.error('Error decoding host parameter:', e);
    return null;
  }
};

const AdminHome = () => {
  const [searchParams] = useSearchParams();
  
  // Get shop from multiple sources
  const shop = useMemo(() => {
    // First try direct shop param
    const shopParam = searchParams.get('shop');
    if (shopParam) return shopParam;
    
    // Try from all URL params (includes query params before hash)
    const allParams = getAllUrlParams();
    const shopFromAll = allParams.get('shop');
    if (shopFromAll) return shopFromAll;
    
    // Try to extract from host param (Shopify Admin embedded app)
    const hostParam = allParams.get('host');
    const shopFromHost = extractShopFromHost(hostParam);
    if (shopFromHost) return shopFromHost;
    
    // Fallback to staging for development
    return 'testing-cs-store.myshopify.com';
  }, [searchParams]);
  
  const { tenant, loading, error } = useTenant(shop);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error Loading Shop</CardTitle>
            <CardDescription>
              {error || "Could not find shop configuration. Make sure you're accessing this from within Shopify Admin with the shop parameter."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Phraseotomy Admin</h1>
          <p className="text-muted-foreground mt-2">
            {tenant.name} ({tenant.shop_domain})
          </p>
          <p className="text-muted-foreground text-sm">Manage your app settings and license codes</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Game Packs
              </CardTitle>
              <CardDescription>
                Manage game packs and content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to={`/admin/packs?shop=${shop}`}>
                <Button className="w-full">Manage Packs</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                License Codes
              </CardTitle>
              <CardDescription>
                Manage 6-digit license codes for your customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to={`/admin/codes?shop=${shop}`}>
                <Button className="w-full">Manage Codes</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
