import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, AlertCircle, Check, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from 'xlsx';

type ThemeCSVRow = {
  code: string;
  themes: string[];
  status: string;
  isDuplicate?: boolean;
  error?: string;
};

type ImportPreview = {
  rows: ThemeCSVRow[];
  duplicates: string[];
  invalidThemes: string[];
};

type ThemeCSVImportProps = {
  tenantId: string;
  onImportComplete: () => void;
};

export const ThemeCSVImport = ({ tenantId, onImportComplete }: ThemeCSVImportProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const parseFile = (data: any[]): ThemeCSVRow[] => {
    if (data.length === 0) {
      throw new Error("File is empty");
    }

    const originalHeaders = Object.keys(data[0]);
    const headerMap = new Map(originalHeaders.map(h => [h.toLowerCase().trim(), h]));
    
    const codeKey = headerMap.get("code");
    const themesKey = headerMap.get("themes") || headerMap.get("theme");
    const statusKey = headerMap.get("status");

    if (!codeKey) {
      throw new Error("CSV must contain a 'Code' column");
    }

    if (!themesKey) {
      throw new Error("CSV must contain a 'Themes' or 'Theme' column");
    }

    return data.map((row, index) => {
      const code = String(row[codeKey] || "").trim();
      const themesStr = String(row[themesKey] || "").trim();
      const status = String(row[statusKey] || "unused").toLowerCase().trim();

      if (!code) {
        throw new Error(`Row ${index + 2}: Code is required`);
      }

      if (!themesStr) {
        throw new Error(`Row ${index + 2}: Themes are required`);
      }

      // Parse themes (comma-separated)
      const themes = themesStr.split(',').map(t => t.trim()).filter(t => t.length > 0);

      if (themes.length === 0) {
        throw new Error(`Row ${index + 2}: At least one theme is required`);
      }

      // Validate status
      const validStatuses = ['unused', 'active', 'expired'];
      const finalStatus = validStatuses.includes(status) ? status : 'unused';

      return {
        code: code.toUpperCase(),
        themes,
        status: finalStatus,
      };
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      let data: any[];
      
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          throw new Error("CSV file is empty");
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });
      } else {
        // Handle XLSX files
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      }

      const parsedRows = parseFile(data);

      // Get available themes from database
      const { data: availableThemes, error: themesError } = await supabase
        .from("themes")
        .select("id, name")
        .eq("tenant_id", tenantId);

      if (themesError) {
        throw new Error("Failed to load available themes");
      }

      const themeMap = new Map(availableThemes?.map(t => [t.name.toLowerCase(), t.id]) || []);

      // Get existing codes to check for duplicates
      const { data: existingCodes, error: codesError } = await supabase
        .from("theme_codes")
        .select("code")
        .eq("tenant_id", tenantId);

      if (codesError) {
        throw new Error("Failed to check existing codes");
      }

      const existingCodeSet = new Set(existingCodes?.map(c => c.code) || []);

      const processedRows = parsedRows.map(row => ({
        ...row,
        isDuplicate: existingCodeSet.has(row.code),
        themes: row.themes.filter(themeName => themeMap.has(themeName.toLowerCase())),
      }));

      const duplicates = processedRows.filter(row => row.isDuplicate).map(row => row.code);
      const invalidThemes = [...new Set(parsedRows.flatMap(row => 
        row.themes.filter(themeName => !themeMap.has(themeName.toLowerCase()))
      ))];

      setPreview({
        rows: processedRows,
        duplicates,
        invalidThemes,
      });

    } catch (error) {
      console.error("Error parsing file:", error);
      toast({
        title: "Import Error",
        description: error instanceof Error ? error.message : "Failed to parse file",
        variant: "destructive",
      });
    }

    // Reset input
    event.target.value = '';
  };

  const handleImport = async () => {
    if (!preview || !tenantId) return;

    setImporting(true);

    try {
      // Get available themes for mapping
      const { data: availableThemes, error: themesError } = await supabase
        .from("themes")
        .select("id, name")
        .eq("tenant_id", tenantId);

      if (themesError) {
        throw new Error("Failed to load available themes");
      }

      const themeMap = new Map(availableThemes?.map(t => [t.name.toLowerCase(), t.id]) || []);

      // Filter out duplicates and prepare for insertion
      const validRows = preview.rows.filter(row => !row.isDuplicate && row.themes.length > 0);
      
      if (validRows.length === 0) {
        throw new Error("No valid codes to import");
      }

      const codesToInsert = validRows.map(row => ({
        tenant_id: tenantId,
        code: row.code,
        status: row.status,
        themes_unlocked: row.themes.map(themeName => themeMap.get(themeName.toLowerCase())).filter(Boolean),
      }));

      const { error: insertError } = await supabase
        .from("theme_codes")
        .insert(codesToInsert);

      if (insertError) {
        throw insertError;
      }

      toast({
        title: "Import Successful",
        description: `${validRows.length} theme codes imported successfully`,
      });

      setIsOpen(false);
      setPreview(null);
      onImportComplete();

    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import theme codes",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setPreview(null);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV/XLSX
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Theme Codes</DialogTitle>
          <DialogDescription>
            Upload a CSV or XLSX file with theme codes. Required columns: Code, Themes. Optional: Status (defaults to "unused")
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
          </div>

          {preview && (
            <div className="space-y-4">
              {/* Validation Alerts */}
              {preview.duplicates.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {preview.duplicates.length} duplicate codes will be skipped: {preview.duplicates.join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              {preview.invalidThemes.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Unknown themes will be ignored: {preview.invalidThemes.join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview Table */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Preview ({preview.rows.length} codes)</h3>
                <ScrollArea className="h-[400px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Themes</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.map((row, index) => (
                        <TableRow key={index} className={row.isDuplicate ? "bg-destructive/10" : ""}>
                          <TableCell>
                            {row.isDuplicate ? (
                              <X className="h-4 w-4 text-destructive" />
                            ) : row.themes.length > 0 ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-yellow-600" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono">{row.code}</TableCell>
                          <TableCell>{row.themes.join(', ')}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              row.status === 'active' ? 'bg-green-100 text-green-700' :
                              row.status === 'expired' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {row.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          {preview && (
            <Button
              onClick={handleImport}
              disabled={importing || preview.rows.filter(r => !r.isDuplicate && r.themes.length > 0).length === 0}
            >
              {importing ? "Importing..." : `Import ${preview.rows.filter(r => !r.isDuplicate && r.themes.length > 0).length} Codes`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};