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
  name: string;
  description: string;
  isDuplicate?: boolean;
  error?: string;
};

type ImportPreview = {
  rows: CSVRow[];
  duplicates: string[];
};

type PackCSVImportProps = {
  tenantId: string;
  onImportComplete: () => void;
};

export const PackCSVImport = ({ tenantId, onImportComplete }: PackCSVImportProps) => {
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
    
    const nameKey = headerMap.get("name");

    if (!nameKey) {
      throw new Error("File must have a 'name' column");
    }

    return data.map(row => ({
      name: String(row[nameKey] || "").trim(),
      description: String(row.description || row.Description || "").trim(),
    })).filter(row => row.name);
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
          const values = line.split(",").map(v => v.trim());
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

      const names = rows.map(r => r.name.toLowerCase());
      const duplicates = names.filter((name, idx) => names.indexOf(name) !== idx);
      
      rows.forEach(row => {
        row.isDuplicate = duplicates.includes(row.name.toLowerCase());
      });

      setPreview({
        rows,
        duplicates: [...new Set(duplicates)],
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
      const validRows = preview.rows.filter(r => !r.isDuplicate);
      
      const { error } = await supabase.from("packs").insert(
        validRows.map(row => ({
          tenant_id: tenantId,
          name: row.name,
          description: row.description || null,
        }))
      );

      if (error) throw error;

      toast({
        title: "Import successful",
        description: `Imported ${validRows.length} packs.`,
      });

      setIsOpen(false);
      setPreview(null);
      onImportComplete();
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import packs",
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Packs</DialogTitle>
          <DialogDescription>
            Upload a CSV or XLSX file with pack names and descriptions
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
                    Found {preview.duplicates.length} duplicate pack names in CSV: {preview.duplicates.join(", ")}
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
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
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.description || "-"}</TableCell>
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
            Import {preview && `(${preview.rows.filter(r => !r.isDuplicate).length} packs)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
