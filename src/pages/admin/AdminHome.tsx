import { useSearchParams, Link } from "react-router-dom";
import { useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Key, Package, Palette } from "lucide-react";
import { getAllUrlParams } from "@/lib/urlUtils";

// Map Shopify internal domains to production domains
const mapShopDomain = (domain: string): string => {
  const domainMappings: Record<string, string> = {
    'qxqtbf-21.myshopify.com': 'phraseotomy.com',
  };
  return domainMappings[domain] || domain;
};

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
    let rawShop: string | null = null;
    
    // First try direct shop param
    const shopParam = searchParams.get('shop');
    if (shopParam) rawShop = shopParam;
    
    // Try from all URL params (includes query params before hash)
    if (!rawShop) {
      const allParams = getAllUrlParams();
      rawShop = allParams.get('shop');
    }
    
    // Try from sessionStorage (stored during URL cleanup in App.tsx)
    if (!rawShop) {
      rawShop = sessionStorage.getItem('shopify_admin_shop');
    }
    
    // Try to extract from host param (Shopify Admin embedded app)
    if (!rawShop) {
      const allParams = getAllUrlParams();
      const hostParam = allParams.get('host') || sessionStorage.getItem('shopify_host');
      rawShop = extractShopFromHost(hostParam);
    }
    
    // Fallback to production domain
    if (!rawShop) rawShop = 'phraseotomy.com';
    
    // Map Shopify internal domain to production domain
    return mapShopDomain(rawShop);
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Themes & Elements
              </CardTitle>
              <CardDescription>
                Manage themes and whisp elements with images
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to={`/admin/themes?shop=${shop}`}>
                <Button className="w-full">Manage Themes</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
