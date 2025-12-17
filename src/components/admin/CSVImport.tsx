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

type CSVRow = {
  code: string;
  pack_names: string[];
  expiration_date: string;
  isDuplicate?: boolean;
  error?: string;
};

type ImportPreview = {
  rows: CSVRow[];
  duplicates: string[];
  newPacks: string[];
};

type CSVImportProps = {
  shopDomain: string;
  onImportComplete: () => void;
};

export const CSVImport = ({ shopDomain, onImportComplete }: CSVImportProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const parseFile = (data: any[]): CSVRow[] => {
    if (data.length === 0) {
      throw new Error("File is empty");
    }

    const originalHeaders = Object.keys(data[0]);
    const headerMap = new Map(originalHeaders.map(h => [h.toLowerCase().trim(), h]));
    
    // Support both "Code" and "code" column names
    const codeKey = headerMap.get("code");
    // Support "Pack" column (comma-separated like "Base, Gold, Premium")
    const packKey = headerMap.get("pack");

    if (!codeKey || !packKey) {
      throw new Error("File must have columns: Code, Pack");
    }

    return data.map(row => {
      const packNamesRaw = String(row[packKey] || "");
      // Split by comma and trim each pack name
      const packNames = packNamesRaw.split(",").map(p => p.trim()).filter(p => p);
      
      return {
        code: String(row[codeKey] || "").toUpperCase().trim(),
        pack_names: packNames,
        expiration_date: "", // No expiration in new format
      };
    }).filter(row => row.code && row.pack_names.length > 0);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let rows: CSVRow[];
      
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim());
        const data = lines.slice(1).map(line => {
          // Handle CSV with commas inside pack values (e.g., "Base, Gold, Premium")
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          
          const obj: any = {};
          headers.forEach((header, idx) => {
            obj[header] = values[idx] || "";
          });
          return obj;
        });
        rows = parseFile(data);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet);
        rows = parseFile(data);
      }

      const codes = rows.map(r => r.code);
      const duplicates = codes.filter((code, idx) => codes.indexOf(code) !== idx);
      
      rows.forEach(row => {
        row.isDuplicate = duplicates.includes(row.code);
      });

      const allPackNames = rows.flatMap(r => r.pack_names);
      const uniquePackNames = [...new Set(allPackNames)];
      
      setPreview({
        rows,
        duplicates: [...new Set(duplicates)],
        newPacks: uniquePackNames,
      });
    } catch (error) {
      toast({
        title: "Error parsing file",
        description: error instanceof Error ? error.message : "Invalid file format",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-license-codes', {
        body: {
          shop_domain: shopDomain,
          codes: preview.rows.filter(r => !r.isDuplicate),
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Import failed");
      }

      toast({
        title: "Import successful",
        description: `Imported ${data.imported} codes. ${data.duplicates_found} duplicates skipped.`,
      });

      setIsOpen(false);
      setPreview(null);
      onImportComplete();
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import codes",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV/XLSX
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import License Codes</DialogTitle>
          <DialogDescription>
            Upload a CSV or XLSX file with Code and Pack columns (Pack can be comma-separated like "Base, Gold, Premium")
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileUpload}
              disabled={importing}
            />
          </div>

          {preview && (
            <>
              {preview.duplicates.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Found {preview.duplicates.length} duplicate codes in file: {preview.duplicates.join(", ")}
                  </AlertDescription>
                </Alert>
              )}

              {preview.newPacks.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Packs found: {preview.newPacks.join(", ")}
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Pack</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row, idx) => (
                      <TableRow key={idx} className={row.isDuplicate ? "bg-destructive/10" : ""}>
                        <TableCell>
                          {row.isDuplicate ? (
                            <X className="h-4 w-4 text-destructive" />
                          ) : (
                            <Check className="h-4 w-4 text-success" />
                          )}
                        </TableCell>
                        <TableCell>{row.code}</TableCell>
                        <TableCell>{row.pack_names.join(", ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={importing}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!preview || importing || preview.rows.filter(r => !r.isDuplicate).length === 0}
          >
            Import {preview && `(${preview.rows.filter(r => !r.isDuplicate).length} codes)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
