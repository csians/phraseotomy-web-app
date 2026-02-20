import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface NamePromptDialogProps {
  open: boolean;
  customerId: string;
  shopDomain: string;
  customerEmail: string | null;
  onNameSaved: (name: string) => void;
}

// Function to extract and format name from email
const extractNameFromEmail = (email: string | null): string => {
  if (!email) return "";
  
  // Extract part before @
  const emailPrefix = email.split("@")[0];
  
  // Replace special characters (., _, -, +, etc.) with spaces
  const withSpaces = emailPrefix.replace(/[._\-+]/g, " ");
  
  // Split by spaces and capitalize each word
  const words = withSpaces.split(/\s+/).filter(word => word.length > 0);
  const capitalizedWords = words.map(word => {
    if (word.length === 0) return "";
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  
  return capitalizedWords.join(" ");
};

export function NamePromptDialog({
  open,
  customerId,
  shopDomain,
  customerEmail,
  onNameSaved,
}: NamePromptDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async (nameToSave?: string) => {
    const trimmedName = (nameToSave || name).trim();
    
    if (!trimmedName) {
      toast({
        title: "Name Required",
        description: "Please enter your name to continue.",
        variant: "destructive",
      });
      return;
    }

    if (trimmedName.length < 2) {
      toast({
        title: "Name Too Short",
        description: "Please enter at least 2 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-customer-name", {
        body: {
          customer_id: customerId,
          customer_name: trimmedName,
          shop_domain: shopDomain,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Welcome!",
        description: `Nice to meet you, ${trimmedName}!`,
      });

      // Update localStorage with new name
      const existingData = localStorage.getItem("customerData");
      if (existingData) {
        const parsed = JSON.parse(existingData);
        const nameParts = trimmedName.split(" ");
        parsed.name = trimmedName;
        parsed.first_name = nameParts[0];
        parsed.last_name = nameParts.slice(1).join(" ") || null;
        // localStorage.setItem("customerData", JSON.stringify(parsed));
      }

      onNameSaved(trimmedName);
    } catch (error) {
      console.error("Error saving name:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not save your name. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [customerId, shopDomain, name, onNameSaved, toast]);

  // Auto-extract name from email when dialog opens
  useEffect(() => {
    if (open && customerEmail && !name) {
      const extractedName = extractNameFromEmail(customerEmail);
      if (extractedName) {
        setName(extractedName);
      }
    }
  }, [open, customerEmail, name]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSaving) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md [&>button]:hidden" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Welcome!</DialogTitle>
          <DialogDescription className="text-center">
            {isSaving 
              ? "Setting up your profile..." 
              : name 
                ? `We've extracted your name "${name}" from your email. You can edit it below if needed.`
                : "Enter your name to personalize your experience."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSaving}
              autoFocus={!isSaving}
            />
            {customerEmail && (
              <p className="text-xs text-muted-foreground">
                Extracted from: {customerEmail}
              </p>
            )}
          </div>
          <Button 
            onClick={() => handleSave()} 
            className="w-full" 
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
