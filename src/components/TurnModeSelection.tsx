import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Grid3X3, Sparkles } from "lucide-react";

interface TurnModeSelectionProps {
  onModeSelect: (mode: "audio" | "elements") => void;
  playerName?: string;
  disabled?: boolean;
}

export function TurnModeSelection({ 
  onModeSelect, 
  playerName,
  disabled = false 
}: TurnModeSelectionProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {playerName ? `${playerName}'s Turn` : "Your Turn"}
        </h2>
        <p className="text-muted-foreground">
          Choose how you want to give your clue
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Record Audio Mode */}
        <Card 
          className={`cursor-pointer transition-all hover:border-primary hover:shadow-lg ${
            disabled ? 'opacity-50 pointer-events-none' : ''
          }`}
          onClick={() => !disabled && onModeSelect("audio")}
        >
          <CardHeader className="text-center pb-4">
            <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Mic className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-xl">Record Audio</CardTitle>
            <CardDescription>
              Tell a story using your voice
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2 justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
                Record a voice clue
              </li>
              <li className="flex items-center gap-2 justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
                Up to 3 minutes
              </li>
              <li className="flex items-center gap-2 justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
                Others listen & guess
              </li>
            </ul>
            <Button className="mt-6 w-full" size="lg" disabled={disabled}>
              <Mic className="mr-2 h-5 w-5" />
              Choose Audio Mode
            </Button>
          </CardContent>
        </Card>

        {/* Elements Mode */}
        <Card 
          className={`cursor-pointer transition-all hover:border-primary hover:shadow-lg ${
            disabled ? 'opacity-50 pointer-events-none' : ''
          }`}
          onClick={() => !disabled && onModeSelect("elements")}
        >
          <CardHeader className="text-center pb-4">
            <div className="mx-auto h-20 w-20 rounded-full bg-secondary/30 flex items-center justify-center mb-4">
              <Grid3X3 className="h-10 w-10 text-foreground" />
            </div>
            <CardTitle className="text-xl">Arrange Elements</CardTitle>
            <CardDescription>
              Order elements to hint at the wisp
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2 justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
                5 visual elements
              </li>
              <li className="flex items-center gap-2 justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
                Drag to reorder
              </li>
              <li className="flex items-center gap-2 justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
                Others see order & guess
              </li>
            </ul>
            <Button variant="secondary" className="mt-6 w-full" size="lg" disabled={disabled}>
              <Grid3X3 className="mr-2 h-5 w-5" />
              Choose Elements Mode
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
