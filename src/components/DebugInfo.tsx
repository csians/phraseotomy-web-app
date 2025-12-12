import { Card } from "@/components/ui/card";
import type { TenantConfig, ShopifyCustomer } from "@/lib/types";

interface DebugInfoProps {
  tenant: TenantConfig | null;
  shopDomain: string | null;
  customer: ShopifyCustomer | null;
  backendConnected?: boolean;
}

export const DebugInfo = ({ tenant, shopDomain, customer, backendConnected = true }: DebugInfoProps) => {
  const appEnv = import.meta.env.VITE_APP_ENV || "development";

  return (
    <Card className="bg-black/80 border-yellow-500/30 backdrop-blur-sm">
      {/* <div className="p-4 space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-yellow-500 font-semibold">Environment:</span>
          <span className="text-yellow-400 uppercase font-mono">{appEnv}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-yellow-500 font-semibold">Backend:</span>
          <span className="text-yellow-400 font-mono">
            {backendConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        {tenant && (
          <div className="flex justify-between items-center">
            <span className="text-yellow-500 font-semibold">Tenant:</span>
            <span className="text-yellow-400 font-mono">{tenant.environment}</span>
          </div>
        )}
        {shopDomain && (
          <div className="flex justify-between items-center">
            <span className="text-yellow-500 font-semibold">Shop:</span>
            <span className="text-yellow-400 font-mono text-right break-all">{shopDomain}</span>
          </div>
        )}
        {customer && (
          <div className="flex justify-between items-center">
            <span className="text-yellow-500 font-semibold">Customer:</span>
            <span className="text-yellow-400 font-mono text-right break-all">
              {customer.email || customer.name || customer.id}
            </span>
          </div>
        )}
      </div> */}
    </Card>
  );
};
