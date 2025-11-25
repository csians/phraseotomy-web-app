import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type LicenseCode = Tables<"license_codes">;

type CodeExportProps = {
  codes: LicenseCode[];
};

export const CodeExport = ({ codes }: CodeExportProps) => {
  const exportToCSV = () => {
    const headers = ["code", "status", "packs_unlocked", "redeemed_by", "redeemed_at", "expires_at", "created_at"];
    const rows = codes.map(code => [
      code.code,
      code.status,
      code.packs_unlocked.join("|"),
      code.redeemed_by || "",
      code.redeemed_at || "",
      code.expires_at || "",
      code.created_at,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `license-codes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" onClick={exportToCSV} disabled={codes.length === 0}>
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  );
};
