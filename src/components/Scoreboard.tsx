import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown } from "lucide-react";

interface Player {
  id: string;
  name: string;
  player_id: string;
  score: number;
  turn_order: number;
}

interface ScoreboardProps {
  players: Player[];
  currentRound: number;
  totalRounds: number;
  currentStorytellerId?: string;
  timerElement?: React.ReactNode;
}

export function Scoreboard({ players, currentRound, totalRounds, currentStorytellerId, timerElement }: ScoreboardProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <Card className="bg-card/50 backdrop-blur border-border">
      <CardHeader className="space-y-1 pb-2 pt-3">
        <CardTitle className="flex items-center justify-between gap-0">
          <span>Scoreboard</span>
          <span className="text-sm font-normal text-muted-foreground whitespace-nowrap">
            Round {currentRound} of {totalRounds}
          </span>
        </CardTitle>
        {timerElement && (
          <div className="md:hidden flex justify-end -mt-0.5">
            <div className="scale-90 origin-right">{timerElement}</div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                player.player_id === currentStorytellerId
                  ? "bg-primary/20 border-2 border-primary"
                  : "bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-3">
                {index === 0 && player.score > 0 && (
                  <Crown className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-foreground">{player.name}</p>
                  {player.player_id === currentStorytellerId && (
                    <p className="text-xs text-primary font-medium">Storyteller</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl font-bold text-primary">{player.score}</p>
                  <p className="text-sm text-muted-foreground">pts</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
