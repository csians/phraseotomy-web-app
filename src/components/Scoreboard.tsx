import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  currentTurnInRound?: number;
  turnsPerRound?: number;
  currentStorytellerId?: string;
  timerElement?: React.ReactNode;
  answeredPlayerIds?: string[]; // Array of player_ids who have answered for current round
  showGuessStatus?: boolean;
}

export function Scoreboard({
  players,
  currentRound,
  totalRounds,
  currentTurnInRound,
  turnsPerRound,
  currentStorytellerId,
  timerElement,
  answeredPlayerIds = [],
  showGuessStatus = false,
}: ScoreboardProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const pendingGuessers = sortedPlayers.filter(
    (player) =>
      player.player_id !== currentStorytellerId &&
      !answeredPlayerIds.includes(player.player_id)
  );

  return (
    <Card className="bg-card/50 backdrop-blur border-border">
      <CardHeader className="space-y-1 pb-2 pt-3">
        <CardTitle className="flex items-center justify-between gap-0">
          <span>Scoreboard</span>
          <div className="text-right text-sm font-normal text-muted-foreground whitespace-nowrap">
            <div>Round {currentRound} of {totalRounds}</div>
            {currentTurnInRound && turnsPerRound ? (
              <div className="text-xs">Turn {currentTurnInRound} of {turnsPerRound}</div>
            ) : null}
          </div>
        </CardTitle>
        {timerElement && (
          <div className="md:hidden flex justify-end -mt-0.5">
            <div className="scale-90 origin-right">{timerElement}</div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sortedPlayers.map((player, index) => {
            const isStoryteller = player.player_id === currentStorytellerId;
            
            return (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 rounded-lg transition-all bg-muted/50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {index === 0 && player.score > 0 && (
                    <Crown className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">{player.name}</p>
                    </div>
                    {isStoryteller && (
                      <p className="text-xs text-primary font-medium">Storyteller</p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-bold text-primary">{player.score}</p>
                    <p className="text-sm text-muted-foreground">pts</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showGuessStatus && (
          <div className="mt-3">
            <p className="text-lg font-semibold text-foreground">
              Pending Guessers
            </p>
            <div className="mt-2 space-y-2">
              {pendingGuessers.length > 0 ? (
                pendingGuessers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 rounded-lg transition-all bg-muted/50"
                  >
                    <p className="font-semibold text-foreground truncate">{player.name}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-lg transition-all bg-muted/50">
                  <p className="text-sm text-muted-foreground">None</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
