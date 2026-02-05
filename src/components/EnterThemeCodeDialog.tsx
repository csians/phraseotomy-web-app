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
import { Loader2, Gift } from "lucide-react";

interface EnterThemeCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  themeId: string;
  themeName: string;
  customerId: string;
  shopDomain: string;
  tenantId: string;
  onThemeUnlocked: () => void;
}

export function EnterThemeCodeDialog({
  open,
  onOpenChange,
  themeId,
  themeName,
  customerId,
  shopDomain,
  tenantId,
  onThemeUnlocked,
}: EnterThemeCodeDialogProps) {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast({
        title: "Code Required",
        description: "Please enter a theme code",
        variant: "destructive",
      });
      return;
    }
 if (!customerId || !shopDomain || !tenantId || !themeId) {
    console.error("Missing required fields for validate-theme-code:", {
      customerId,
      shopDomain,
      tenantId,
      themeId,
    });
    toast({
      title: "Configuration error",
      description: "Theme shop is missing required data. Please refresh the page.",
      variant: "destructive",
    });
    return;
  }

  const normalizedCode = code.trim().toUpperCase();
  setIsSubmitting(true);

    try {
      // Call the dedicated theme code validation function
      const { data, error } = await supabase.functions.invoke("validate-theme-code", {
        body: {
          code: normalizedCode,
          customerId,
          shopDomain,
          codeType: "theme",
          themeId,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Invalid theme code");
      }

      // If code is already unlocked, just show success
      if (data.alreadyUnlocked) {
        toast({
          title: "Already Unlocked! 🎉",
          description: `"${themeName}" theme is already available!`,
        });
        onThemeUnlocked();
        setCode("");
        onOpenChange(false);
        return;
      }

      // Code is valid, now assign/redeem it
      const { data: assignData, error: assignError } = await supabase.functions.invoke("assign-code-to-customer", {
        body: {
          code: normalizedCode,
          customerId,
          shopDomain,
          codeType: "theme",
          themeId,
        },
      });

      if (assignError || !assignData?.success) {
        throw new Error(assignData?.error || assignError?.message || "Failed to unlock theme");
      }

      toast({
        title: "Theme Unlocked! 🎉",
        description: `Successfully unlocked "${themeName}" theme!`,
      });

      onThemeUnlocked();
      setCode("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error validating theme code:", error);
      toast({
        title: "Invalid Code",
        description: error instanceof Error ? error.message : "Please check your theme code and try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSubmitting) {
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Unlock "{themeName}" Theme
          </DialogTitle>
          <DialogDescription>
            Enter your theme code to unlock this premium theme
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme-code">Theme Code</Label>
            <Input
              id="theme-code"
              placeholder="Enter 6-digit code (e.g., POIU12)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              disabled={isSubmitting}
              maxLength={6}
              className="uppercase font-mono text-center tracking-wider text-lg"
            />
            <p className="text-xs text-muted-foreground">
              Theme codes are 6 characters long and case-insensitive
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !code.trim()}
              className="flex-1"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Validating..." : "Unlock Theme"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}