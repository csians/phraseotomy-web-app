import { useState } from "react";
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
  onNameSaved: (name: string) => void;
}

export function NamePromptDialog({
  open,
  customerId,
  shopDomain,
  onNameSaved,
}: NamePromptDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmedName = name.trim();
    
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
        localStorage.setItem("customerData", JSON.stringify(parsed));
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
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSaving) {
      handleSave();
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">What should we call you?</DialogTitle>
          <DialogDescription className="text-center">
            Enter your name to personalize your experience.
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
              autoFocus
            />
          </div>
          <Button 
            onClick={handleSave} 
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
