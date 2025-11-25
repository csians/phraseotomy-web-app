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
}

export function Scoreboard({ players, currentRound, totalRounds, currentStorytellerId }: ScoreboardProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <Card className="bg-card/50 backdrop-blur border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Scoreboard</span>
          <span className="text-sm font-normal text-muted-foreground">
            Round {currentRound} of {totalRounds}
          </span>
        </CardTitle>
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
                <p className="text-2xl font-bold text-primary">{player.score}</p>
                <p className="text-xs text-muted-foreground">points</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
