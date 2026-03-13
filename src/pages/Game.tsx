import React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGameWebSocket } from "@/hooks/useGameWebSocket";
import { Scoreboard } from "@/components/Scoreboard";
import { UnifiedStorytellingInterface } from "../components/UnifiedStorytellingInterface";
import { GuessingInterface } from "@/components/GuessingInterface";
import { ThemeSelectionCards } from "@/components/ThemeSelectionCards";
import { GameTimer } from "@/components/GameTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Trophy, ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import type { IconItem } from "@/components/IconSelectionPanel";

const GAME_ROUNDS_PER_GAME = 4;


interface Player {
  id: string;
  name: string;
  player_id: string;
  score: number;
  turn_order: number;
}

interface Theme {
  id: string;
  name: string;
  icon: string;
  isCore?: boolean;
  isUnlocked?: boolean;
  packName?: string;
  pack_id?: string | null;
}

interface Element {
  id: string;
  name: string;
  icon: string;
}

interface GameSession {
  id: string;
  current_round: number;
  total_rounds: number;
  current_storyteller_id: string;
  status: string;
  selected_theme_id?: string;
  turn_mode?: "audio" | "elements" | null;
  story_time_seconds?: number;
  guess_time_seconds?: number;
}

interface Turn {
  id: string;
  theme_id: string;
  storyteller_id?: string;
  whisp: string | null;
  recording_url: string | null;
  completed_at: string | null;
  created_at: string;
  theme: Theme;
  selected_icon_ids?: string[];
  icon_order?: number[];
  turn_mode?: "audio" | "elements";
}

interface TurnRecap {
  turnId: string;
  icons: IconItem[];
  whisp: string;
  players: Player[];
  roundNumber: number;
  totalRounds: number;
  turnInRound: number;
  turnsPerRound: number;
  guessOutcome: "correct" | "wrong" | "storyteller" | "not_answered";
  playerOutcomes: Record<string, "correct" | "wrong" | "storyteller" | "not_answered">;
}

interface RoundSummaryRow {
  playerId: string;
  name: string;
  turnPoints: number[];
  roundTotal: number;
  cumulativeTotal: number;
}

interface RoundSummary {
  actualRoundNumber: number;
  totalRounds: number;
  turnsPerRound: number;
  turnStorytellerIds: string[];
  rows: RoundSummaryRow[];
}

interface IconItemLocal {
  id: string;
  name: string;
  icon: string;
  isFromCore: boolean;
  image_url?: string | null;
  color?: string | null;
}

type GamePhase = "selecting_theme" | "storytelling" | "guessing" | "scoring";

// --- Types for cumulative round summary ---
interface CumulativeRoundSummaryRow {
  playerId: string;
  name: string;
  roundTurnPoints: number[][]; // [round][turn]
  roundTotals: number[]; // [round]
  total: number;
}

interface CumulativeRoundSummary {
  rounds: number;
  turnsPerRound: number;
  rows: CumulativeRoundSummaryRow[];
  allTurns: { id: string; round_number: number; storyteller_id?: string }[];
}

export default function Game() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false); // Start with false to prevent stuck loading screen
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentTurn, setCurrentTurn] = useState<Turn | null>(null);
  const [selectedIcons, setSelectedIcons] = useState<IconItem[]>([]);
  const [gamePhase, setGamePhase] = useState<GamePhase>("selecting_theme");
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("");
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [isGeneratingWhisp, setIsGeneratingWhisp] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<string>("");
  const [gameCompleted, setGameCompleted] = useState(false);
  const [isAnnouncingWinner, setIsAnnouncingWinner] = useState(false);
  const [gameWinner, setGameWinner] = useState<Player | null>(null);
  const [isTieGame, setIsTieGame] = useState(false);
  const [isRoundTransitioning, setIsRoundTransitioning] = useState(false);
  const [turnRecap, setTurnRecap] = useState<TurnRecap | null>(null);
  const [isRoundSummaryOpen, setIsRoundSummaryOpen] = useState(false);
  // --- Cumulative round summary state ---
  const [cumulativeRoundSummary, setCumulativeRoundSummary] = useState<CumulativeRoundSummary | null>(null);
  // Build cumulative round summary up to the current round
  const buildCumulativeRoundSummary = useCallback(
    async (currentRoundNumber: number, playersData: Player[]): Promise<CumulativeRoundSummary | null> => {
      if (!sessionId || playersData.length === 0) {
        return null;
      }
      const turnsPerRound = Math.max(playersData.length, 1);
      const totalRounds = Math.max(
        1,
        Math.ceil((session?.total_rounds || GAME_ROUNDS_PER_GAME * turnsPerRound) / turnsPerRound)
      );
      // Fetch all turns up to and including the current round
      const maxTurnNumber = currentRoundNumber * turnsPerRound;
      try {
        const { data: allTurns, error: allTurnsError } = await supabase
          .from("game_turns")
          .select("id, round_number, storyteller_id")
          .eq("session_id", sessionId)
          .lte("round_number", maxTurnNumber)
          .order("round_number", { ascending: true });
        if (allTurnsError || !allTurns || allTurns.length === 0) {
          console.error("Error loading all turns for cumulative summary:", allTurnsError);
          return null;
        }
        const turnIds = allTurns.map((turn) => turn.id);
        const { data: guesses, error: guessesError } = await supabase
          .from("game_guesses")
          .select("turn_id, player_id, points_earned")
          .in("turn_id", turnIds);
        if (guessesError) {
          console.error("Error loading guesses for cumulative summary:", guessesError);
          return null;
        }
        // Map: turnId -> { playerId -> points } (with storyteller bonus for wrong guesses)
        const pointsByTurn = new Map();
        // Build a map of turnId -> storytellerId for all turns
        const storytellerByTurn = new Map();
        allTurns.forEach((turn) => {
          if (turn && turn.id && turn.storyteller_id) {
            storytellerByTurn.set(turn.id, turn.storyteller_id);
          }
        });
        (guesses || []).forEach((guess) => {
          const turnPoints = pointsByTurn.get(guess.turn_id) || new Map();
          const guessPoints = guess.points_earned || 0;
          turnPoints.set(guess.player_id, (turnPoints.get(guess.player_id) || 0) + guessPoints);
          // If guess was wrong, give 1 point to the storyteller for this turn
          if (guessPoints === 0) {
            const storytellerId = storytellerByTurn.get(guess.turn_id);
            if (storytellerId) {
              turnPoints.set(storytellerId, (turnPoints.get(storytellerId) || 0) + 1);
            }
          }
          pointsByTurn.set(guess.turn_id, turnPoints);
        });
        // Build per-player, per-round, per-turn points (with bonus for storyteller)
        const rows = playersData.map((player) => {
          const roundTurnPoints = [];
          const roundTotals = [];
          let total = 0;
          for (let r = 0; r < currentRoundNumber; r++) {
            const turnPoints = [];
            let roundSum = 0;
            for (let t = 0; t < turnsPerRound; t++) {
              const turnIndex = r * turnsPerRound + t;
              const turn = allTurns[turnIndex];
              if (turn) {
                const pts = pointsByTurn.get(turn.id)?.get(player.player_id) || 0;
                turnPoints.push(pts);
                roundSum += pts;
              } else {
                turnPoints.push(0);
              }
            }
            roundTurnPoints.push(turnPoints);
            roundTotals.push(roundSum);
            total += roundSum;
          }
          return {
            playerId: player.player_id,
            name: player.name,
            roundTurnPoints,
            roundTotals,
            total,
          };
        });
        return {
          rounds: currentRoundNumber,
          turnsPerRound,
          rows,
          allTurns,
        };
      } catch (error) {
        console.error("Error building cumulative round summary:", error);
        return null;
      }
    },
    [session?.total_rounds, sessionId]
  );
  // // When round summary should be shown, build cumulative summary up to current round
  // useEffect(() => {
  //   if (isRoundSummaryOpen && session && players.length > 0) {
  //     const turnsPerRound = Math.max(players.length, 1);
  //     const currentRoundNumber = Math.min(
  //       GAME_ROUNDS_PER_GAME,
  //       Math.ceil((session.current_round || 1) / turnsPerRound)
  //     );
  //     buildCumulativeRoundSummary(currentRoundNumber, players).then(setCumulativeRoundSummary);
  //   } else {
  //     setCumulativeRoundSummary(null);
  //   }
  // }, [isRoundSummaryOpen, session, players, buildCumulativeRoundSummary]);
  const [isModeTransitioning, setIsModeTransitioning] = useState(false);
  const [selectedTurnMode, setSelectedTurnMode] = useState<"audio" | "elements" | null>(null);
  const [coreElementsForSelection, setCoreElementsForSelection] = useState<IconItem[]>([]);
  const [currentWhisp, setCurrentWhisp] = useState<string>("");
  const [answeredPlayerIds, setAnsweredPlayerIds] = useState<string[]>([]); // Track which players have answered for current turn
  const [frozenGuessScores, setFrozenGuessScores] = useState<{
    turnId: string;
    scores: Record<string, number>;
  } | null>(null);
  const [hasSeenRecapForTurn, setHasSeenRecapForTurn] = useState(false);


  {/* Icons Recap */ }
  // Refs to track completion state for use in callbacks (avoid stale closures)
  const gameCompletedRef = useRef(false);
  const isAnnouncingWinnerRef = useRef(false);
  const isModeSelectingRef = useRef(false); // Prevent refresh during mode selection
  const isStorytellerActiveRef = useRef(false); // Prevent polling during storytelling
  const roundTransitionTriggeredRef = useRef<string | null>(null); // Prevent duplicate round transitions
  const gameCompletionResultShownRef = useRef(false); // Prevent duplicate game completion result displays
  const isRoundSummaryOpenRef = useRef(false);
  const [lifetimePoints, setLifetimePoints] = useState<Record<string, number>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const refreshDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshRef = useRef<number>(0);
  // Track if timer callbacks have been triggered for current turn to prevent loops
  const storyTimeUpTriggeredRef = useRef<string>("");
  const guessTimeUpTriggeredRef = useRef<string>("");
  const recapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recapShownTurnRef = useRef<string | null>(null);
  // Broadcast channel ref for sending Realtime messages
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  type RefreshOptions = { bypassStoryPause?: boolean; showLoading?: boolean };

  // Debounced refresh to prevent infinite loops

  {/* Whisp Recap */ }
  const debouncedRefresh = useCallback((options: RefreshOptions = {}) => {
    const bypassStoryPause = options.bypassStoryPause === true;
    // Default to false - only show loading if explicitly requested (initial load only)
    const showLoading = options.showLoading === true;

    {/* Player Outcome Recap */ }

    // Don't refresh if game is completed, announcing winner, selecting mode, storyteller is active, or round is transitioning
    if (
      gameCompletedRef.current ||
      isAnnouncingWinnerRef.current ||
      isModeSelectingRef.current ||
      (!bypassStoryPause && isStorytellerActiveRef.current) ||
      roundTransitionTriggeredRef.current !== null // Don't refresh while round transition is active
    ) {
      console.log("Skipping refresh - game completed, announcing winner, selecting mode, storyteller active, or round transitioning");
      return;
    }

    const now = Date.now();
    // Prevent refreshing more than once per second

    {/* Scoreboard Recap */ }
    if (now - lastRefreshRef.current < 1000) {
      return;
    }

    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
    }

    refreshDebounceRef.current = setTimeout(() => {
      lastRefreshRef.current = Date.now();
      // Ensure showLoading is false unless explicitly set to true
      initializeGame({ ...options, showLoading: options.showLoading === true });
    }, 300);
  }, []); // Using refs instead of state for checks

  // Force refresh that bypasses storyteller active check - for critical state transitions
  const forceRefresh = useCallback(() => {
    // Still skip if game is completed or announcing winner
    if (gameCompletedRef.current || isAnnouncingWinnerRef.current) {
      console.log("Skipping forceRefresh - game completed or announcing winner");
      return;
    }

    // Clear the storyteller active flag since story is submitted
    isStorytellerActiveRef.current = false;

    <div className="text-center text-xs text-muted-foreground">
      Moving to the next turn...
    </div>

    {
      !turnRecap && (
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground animate-pulse">Preparing recap...</p>
        </div>
      )
    }

    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
    }

    console.log("🔄 Force refresh triggered - story submitted, transitioning to guessing phase");
    refreshDebounceRef.current = setTimeout(() => {
      lastRefreshRef.current = Date.now();
      initializeGame({ bypassStoryPause: true, showLoading: false });
    }, 100); // Shorter delay for immediate transition
  }, []);

  const buildRoundSummary = useCallback(
    async (actualRoundNumber: number, playersData: Player[]): Promise<RoundSummary | null> => {
      if (!sessionId || playersData.length === 0) {
        return null;
      }

      const turnsPerRound = Math.max(playersData.length, 1);
      const totalRounds = Math.max(
        1,
        Math.ceil((session?.total_rounds || GAME_ROUNDS_PER_GAME * turnsPerRound) / turnsPerRound)
      );
      const roundStartTurn = (actualRoundNumber - 1) * turnsPerRound + 1;
      const roundEndTurn = roundStartTurn + turnsPerRound - 1;

      try {
        const { data: roundTurns, error: roundTurnsError } = await supabase
          .from("game_turns")
          .select("id, round_number, storyteller_id")
          .eq("session_id", sessionId)
          .gte("round_number", roundStartTurn)
          .lte("round_number", roundEndTurn)
          .order("round_number", { ascending: true });

        if (roundTurnsError || !roundTurns || roundTurns.length === 0) {
          console.error("Error loading round summary turns:", roundTurnsError);
          return null;
        }

        const turnIds = roundTurns.map((turn) => turn.id);
        const storytellerByTurn = new Map<string, string>(
          roundTurns.map((turn) => [turn.id, turn.storyteller_id])
        );
        const pointsByTurn = new Map<string, Map<string, number>>();

        const { data: guesses, error: guessesError } = await supabase
          .from("game_guesses")
          .select("turn_id, player_id, points_earned")
          .in("turn_id", turnIds);

        if (guessesError) {
          console.error("Error loading round summary guesses:", guessesError);
          return null;
        }

        (guesses || []).forEach((guess) => {
          const turnPoints = pointsByTurn.get(guess.turn_id) || new Map<string, number>();
          const guessPoints = guess.points_earned || 0;

          turnPoints.set(guess.player_id, (turnPoints.get(guess.player_id) || 0) + guessPoints);

          if (guessPoints === 0) {
            const storytellerId = storytellerByTurn.get(guess.turn_id);
            if (storytellerId) {
              turnPoints.set(storytellerId, (turnPoints.get(storytellerId) || 0) + 1);
            }
          }

          pointsByTurn.set(guess.turn_id, turnPoints);
        });

        const rows = [...playersData]
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .map((player) => {
            const turnPoints = roundTurns.map((turn) => pointsByTurn.get(turn.id)?.get(player.player_id) || 0);
            const roundTotal = turnPoints.reduce((sum, value) => sum + value, 0);

            return {
              playerId: player.player_id,
              name: player.name,
              turnPoints,
              roundTotal,
              cumulativeTotal: player.score || 0,
            };
          });

        return {
          actualRoundNumber,
          totalRounds,
          turnsPerRound,
          turnStorytellerIds: roundTurns.map((turn) => turn.storyteller_id),
          rows,
        };
      } catch (error) {
        console.error("Error building round summary:", error);
        return null;
      }
    },
    [session?.total_rounds, sessionId]
  );

  const showTurnRecap = useCallback(
    async (
      secretElement?: string,
      playersData?: Player[],
      turnIdOverride?: string,
      wasCorrectFallback?: boolean,
    ) => {
      const recapTurnId = turnIdOverride || currentTurn?.id;
      if (!recapTurnId) {
        return;
      }

      if (recapShownTurnRef.current === recapTurnId) {
        return;
      }

      recapShownTurnRef.current = recapTurnId;
      roundTransitionTriggeredRef.current = recapTurnId;
      setHasSeenRecapForTurn(false);

      if (recapTimerRef.current) {
        clearTimeout(recapTimerRef.current);
        recapTimerRef.current = null;
      }

      let recapPlayers = (playersData && playersData.length > 0 ? playersData : players).slice();
      recapPlayers.sort((a, b) => (b.score || 0) - (a.score || 0));
      let recapWhisp = secretElement || currentTurn?.whisp || "?";
      let storytellerIdForTurn = currentTurn?.storyteller_id || session?.current_storyteller_id;
      let recapIcons: IconItem[] = [...selectedIcons];
      let recapTurnNumber = session?.current_round || 1;

      // Fetch recap metadata from DB; retry briefly because selected icons can arrive just after story submission.
      try {
        let turnData: {
          whisp: string | null;
          storyteller_id: string | null;
          selected_icon_ids: string[] | null;
          round_number: number | null;
        } | null = null;

        for (let attempt = 0; attempt < 4; attempt++) {
          const { data, error } = await supabase
            .from("game_turns")
            .select("whisp, storyteller_id, selected_icon_ids, round_number")
            .eq("id", recapTurnId)
            .maybeSingle();

          if (!error && data) {
            turnData = data;
            if ((data.selected_icon_ids || []).length > 0) {
              break;
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        if (turnData?.whisp) {
          recapWhisp = turnData.whisp;
        }

        if (turnData?.storyteller_id) {
          storytellerIdForTurn = turnData.storyteller_id;
        }

        if (typeof turnData?.round_number === "number") {
          recapTurnNumber = turnData.round_number;
        }

        const turnIconIds = turnData?.selected_icon_ids || [];
        if (turnIconIds.length > 0) {
          const iconById = new Map<string, IconItem>(
            selectedIcons.map((icon) => [String(icon.id), icon])
          );

          const missingIconIds = turnIconIds.filter((id) => !iconById.has(String(id)));
          if (missingIconIds.length > 0) {
            const { data: missingIconRows, error: missingIconError } = await supabase
              .from("elements")
              .select("id, name, icon, image_url, color")
              .in("id", missingIconIds);

            if (!missingIconError && missingIconRows) {
              missingIconRows.forEach((row) => {
                iconById.set(String(row.id), {
                  id: row.id,
                  name: row.name,
                  icon: row.icon,
                  image_url: row.image_url || undefined,
                  color: row.color || undefined,
                  isFromCore: false,
                });
              });
            }
          }

          const orderedTurnIcons = turnIconIds
            .map((id) => iconById.get(String(id)))
            .filter((icon): icon is IconItem => !!icon);

          if (orderedTurnIcons.length > 0) {
            recapIcons = orderedTurnIcons;
          }
        }
      } catch (error) {
        console.error("Error fetching recap whisp:", error);
      }

      // Final fallback: keep recap from appearing empty if icon ids have not landed yet.
      if (recapIcons.length === 0 && recapTurnId === currentTurn?.id && coreElementsForSelection.length > 0) {
        recapIcons = [...coreElementsForSelection];
      }

      // Safety: decode if value is still encoded.
      if (typeof recapWhisp === "string" && recapWhisp.startsWith("_ENC_")) {
        try {
          recapWhisp = atob(recapWhisp.substring(5));
        } catch (error) {
          console.error("Error decoding recap whisp:", error);
        }
      }

      // Pull freshest scores from DB so recap and sidebar scoreboard reflect point changes immediately.
      try {
        if (sessionId) {
          const { data: latestPlayers, error: latestPlayersError } = await supabase
            .from("game_players")
            .select("id, name, player_id, score, turn_order")
            .eq("session_id", sessionId)
            .order("turn_order", { ascending: true });

          if (!latestPlayersError && latestPlayers && latestPlayers.length > 0) {
            recapPlayers = [...latestPlayers].sort((a, b) => (b.score || 0) - (a.score || 0));
            setPlayers(recapPlayers);
          }
        }
      } catch (error) {
        console.error("Error refreshing recap scoreboard:", error);
      }

      const isStorytellerForRecap =
        !!storytellerIdForTurn && String(storytellerIdForTurn) === String(currentPlayerId);
      const turnsPerRound = Math.max(recapPlayers.length, 1);
      const totalRounds = Math.max(
        1,
        Math.ceil((session?.total_rounds || GAME_ROUNDS_PER_GAME * turnsPerRound) / turnsPerRound)
      );
      const actualRoundNumber = Math.min(totalRounds, Math.ceil(recapTurnNumber / turnsPerRound));
      const turnInRound = ((recapTurnNumber - 1) % turnsPerRound) + 1;
      const isFinalTurnOfGame = actualRoundNumber === GAME_ROUNDS_PER_GAME && turnInRound === turnsPerRound;
      const playerOutcomes: TurnRecap["playerOutcomes"] = {};

      recapPlayers.forEach((player) => {
        playerOutcomes[player.player_id] =
          storytellerIdForTurn && String(player.player_id) === String(storytellerIdForTurn) ? "storyteller" : "not_answered";
      });

      let guessOutcome: TurnRecap["guessOutcome"] =
        (playerOutcomes[currentPlayerId] as TurnRecap["guessOutcome"]) || (isStorytellerForRecap ? "storyteller" : "not_answered");

      if (!isStorytellerForRecap && typeof wasCorrectFallback === "boolean") {
        guessOutcome = wasCorrectFallback ? "correct" : "wrong";
        playerOutcomes[currentPlayerId] = guessOutcome;
      }

      try {
        const { data: guesses, error: guessesError } = await supabase
          .from("game_guesses")
          .select("player_id, points_earned")
          .eq("turn_id", recapTurnId);

        if (!guessesError && guesses) {
          guesses.forEach((guess: { player_id: string; points_earned: number | null }) => {
            if (playerOutcomes[guess.player_id] !== "storyteller") {
              playerOutcomes[guess.player_id] = (guess.points_earned || 0) > 0 ? "correct" : "wrong";
            }
          });
          guessOutcome =
            (playerOutcomes[currentPlayerId] as TurnRecap["guessOutcome"]) || guessOutcome;
        }
      } catch (error) {
        console.error("Error loading recap player outcomes:", error);
      }


      // Show round summary dialog after last turn in a round (including after last round)
      const isLastTurnOfRound = turnInRound === turnsPerRound;
      if (isLastTurnOfRound && recapPlayers.length > 0) {
        const turnsPerRoundForSummary = Math.max(recapPlayers.length, 1);
        const currentRoundNumber = Math.min(
          GAME_ROUNDS_PER_GAME,
          Math.ceil(((session?.current_round || 1) as number) / turnsPerRoundForSummary)
        );

        try {
          const summary = await buildCumulativeRoundSummary(
            currentRoundNumber,
            recapPlayers
          );
          if (summary) {
            setCumulativeRoundSummary(summary);
          }
        } catch (error) {
          console.error("Error building cumulative round summary:", error);
        }
      }
      setTurnRecap({
        turnId: recapTurnId,
        icons: recapIcons,
        whisp: recapWhisp,
        players: recapPlayers,
        roundNumber: actualRoundNumber,
        totalRounds,
        turnInRound,
        turnsPerRound,
        guessOutcome,
        playerOutcomes,
      });

      // If this is the final turn of the final round AND the game is already marked completed,
      // do not open the separate Turn Recap dialog. Instead, let the existing Game Over dialog
      // render the recap + final scoreboard using this turnRecap / cumulativeRoundSummary data.
      if (!(isFinalTurnOfGame && gameCompletedRef.current)) {
        setIsRoundTransitioning(true);
      }

      // Resolve per-player result from DB so each player sees their own correct/wrong status.
      if (!isStorytellerForRecap && typeof wasCorrectFallback !== "boolean") {
        try {
          const { data: myGuess } = await supabase
            .from("game_guesses")
            .select("points_earned")
            .eq("turn_id", recapTurnId)
            .eq("player_id", currentPlayerId)
            .maybeSingle();

          const resolvedOutcome: TurnRecap["guessOutcome"] =
            myGuess == null ? "not_answered" : (myGuess.points_earned || 0) > 0 ? "correct" : "wrong";

          setTurnRecap((prev) =>
            prev && prev.turnId === recapTurnId
              ? {
                ...prev,
                guessOutcome: resolvedOutcome,
                playerOutcomes: {
                  ...prev.playerOutcomes,
                  [currentPlayerId]: resolvedOutcome,
                },
              }
              : prev
          );
        } catch (error) {
          console.error("Error resolving recap guess outcome:", error);
        }
      }

      recapTimerRef.current = setTimeout(async () => {
        const isFinalTurn =
          actualRoundNumber === GAME_ROUNDS_PER_GAME &&
          turnInRound === turnsPerRound;

        // For the final turn when the game is already completed, keep the Game Over
        // dialog open with recap + scoreboard and skip closing/refreshing.
        if (isFinalTurn && gameCompletedRef.current) {
          return;
        }

        setIsRoundTransitioning(false);

        if (!isFinalTurn) {
          setTurnRecap(null);
        }

        setHasSeenRecapForTurn(true);
        roundTransitionTriggeredRef.current = null;
        initializeGame({ showLoading: false });
      }, 10000);
    }, [currentTurn, players, selectedIcons, session, currentPlayerId, buildCumulativeRoundSummary, coreElementsForSelection]
  );
  // useEffect(() => {
  useEffect(() => {
    isRoundSummaryOpenRef.current = isRoundSummaryOpen;
  }, [isRoundSummaryOpen]);

  useEffect(() => {
    return () => {
      if (recapTimerRef.current) {
        clearTimeout(recapTimerRef.current);
      }
    };
  }, []);

  // Get current player ID from storage - must be defined before getCurrentPlayerInfo
  const getCurrentPlayerId = () => {
    const storageKeys = ["customerData", "phraseotomy_customer_data", "customer_data"];
    for (const key of storageKeys) {
      const dataStr = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          return parsed.customer_id || parsed.id || parsed.customerId;
        } catch (e) {
          console.error(`Error parsing ${key}:`, e);
        }
      }
    }

    // Guest users may only have the id in sessionStorage (Safari/3rd-party iframe constraints)
    return sessionStorage.getItem("guest_player_id") || localStorage.getItem("guest_player_id") || "";
  };

  // Get current player info for WebSocket
  const getCurrentPlayerInfo = () => {
    const playerId = getCurrentPlayerId();
    const player = players.find((p) => p.player_id === playerId);
    return {
      playerId,
      playerName: player?.name || "Player",
    };
  };

  // Fetch lifetime points for players from customers table
  const fetchLifetimePoints = async (playersToFetch: Player[]) => {
    try {
      const playerIds = playersToFetch.map(p => p.player_id);
      const { data, error } = await supabase
        .from('customers')
        .select('customer_id, total_points')
        .in('customer_id', playerIds);

      if (error) {
        console.error("Error fetching lifetime points:", error);
        return;
      }

      const pointsMap: Record<string, number> = {};
      data?.forEach(c => {
        pointsMap[c.customer_id] = c.total_points || 0;
      });
      setLifetimePoints(pointsMap);
    } catch (err) {
      console.error("Failed to fetch lifetime points:", err);
    }
  };

  // Helper function to determine winner and detect ties
  const determineWinnerAndTies = (playersData: Player[]) => {
    if (!playersData || playersData.length === 0) {
      setGameWinner(null);
      setIsTieGame(false);
      return;
    }

    const sortedPlayers = [...playersData].sort((a, b) => (b.score || 0) - (a.score || 0));
    const highestScore = sortedPlayers[0]?.score || 0;

    // Count how many players have the highest score
    const playersWithHighestScore = sortedPlayers.filter(p => (p.score || 0) === highestScore);

    if (playersWithHighestScore.length > 1) {
      // It's a tie
      setIsTieGame(true);
      setGameWinner(null);
    } else {
      setIsTieGame(false);
      setGameWinner(sortedPlayers[0] || null);
    }
  };

  // Keep refs in sync with state (for use in callbacks to avoid stale closures)
  useEffect(() => {
    gameCompletedRef.current = gameCompleted;
  }, [gameCompleted]);

  useEffect(() => {
    isAnnouncingWinnerRef.current = isAnnouncingWinner;
  }, [isAnnouncingWinner]);

  // Pause polling during storytelling phase for ALL players (not just storyteller)
  // This prevents continuous get-game-state calls while someone is creating their story
  useEffect(() => {
    const shouldPausePolling = gamePhase === "storytelling" && !gameCompleted;
    isStorytellerActiveRef.current = shouldPausePolling;
    console.log("Polling paused during storytelling:", shouldPausePolling, "gamePhase:", gamePhase);
  }, [gamePhase, gameCompleted]);
  // Initialize audio context for real-time playback
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Function to play audio chunks in real-time
  const playAudioChunk = async (base64Audio: string) => {
    if (!audioContextRef.current) return;

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data
      const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);

      // Create source and play
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
    } catch (error) {
      console.error("Error playing audio chunk:", error);
    }
  };

  // WebSocket for real-time updates - just refreshes from database
  const { sendMessage: sendWebSocketMessage, isConnected } = useGameWebSocket({
    sessionId: sessionId || "",
    playerId: currentPlayerId,
    playerName: getCurrentPlayerInfo().playerName,
    enabled: !!sessionId && !!currentPlayerId,
    onMessage: (message) => {
      switch (message.type) {
        case "recording_started":
          setIsReceivingAudio(true);
          toast({
            title: "🎤 Recording Started",
            description: "Listen to the storyteller's live recording",
          });
          break;

        case "recording_stopped":
          setIsReceivingAudio(false);
          break;

        case "audio_chunk":
          if (message.audioData && message.storytellerId !== currentPlayerId) {
            playAudioChunk(message.audioData);
          }
          break;

        case "theme_selected":
          toast({
            title: "Theme Selected",
            description: `${message.storytellerName || "Storyteller"} chose a theme`,
          });
          debouncedRefresh({ showLoading: false });
          break;

        case "mode_selected":
        case "storyteller_ready":
          toast({
            title: "Mode Selected",
            description: `${message.storytellerName || "Storyteller"} is ready`,
          });
          debouncedRefresh({ showLoading: false });
          break;

        case "recording_uploaded":
        case "story_submitted":
          toast({
            title: "Audio Ready! 🎤",
            description: "Listen to the clue and guess the secret element",
          });
          // Use forceRefresh to bypass storyteller active check and transition to guessing
          forceRefresh();
          break;

        case "elements_submitted":
          toast({
            title: "Elements Ready!",
            description: "The storyteller has submitted their elements",
          });
          debouncedRefresh();
          break;

        case "icons_reordered":
          // Ignore live reordering - only refresh on elements_submitted
          break;

        case "guess_submitted":
          if (message.playerId !== currentPlayerId) {
            toast({
              title: "Guess Submitted",
              description: `${message.playerName} submitted a guess`,
            });
          }
          break;

        case "correct_answer":
          toast({
            title: "Round Complete",
            description: "Preparing recap...",
          });
          debouncedRefresh({ showLoading: false });
          break;

        case "next_turn":
          showTurnRecap(
            message.secretElement,
            message.players,
            message.completedTurnId || currentTurn?.id,
            typeof message.wasCorrect === "boolean" ? message.wasCorrect : undefined,
          );
          break;

        case "round_result":
          // This message should only be shown when ALL players have answered
          // Skip if turn is not actually completed (check via realtime or polling instead)
          console.log("📢 Round result received (ignoring - should use next_turn or realtime instead):", message);
          // Don't show dialog here - let the realtime subscription or polling handle it
          break;

        case "game_completed":
          console.log("🎉 Received game_completed event:", message);

          // Don't process if already showing result (use ref to prevent race conditions)
          if (gameCompletionResultShownRef.current) {
            console.log("Game completion result already shown, skipping duplicate WebSocket event");
            return;
          }

          // NO REFRESH - Use only WebSocket message data for instant display
          // WebSocket message should contain all necessary data (players, secretElement, wasCorrect)
          if (!message.players || message.players.length === 0) {
            console.error("⚠️ WebSocket game_completed message missing players data");
            return;
          }

          const secretElement = message.secretElement || currentTurn?.whisp || "?";
          // Use wasCorrect from message if available (for the last player who submitted)
          // submittingPlayerId identifies who submitted the answer - only they see the result
          const playerWasCorrect = message.wasCorrect !== undefined ? message.wasCorrect : undefined;
          const submittingPlayerId = message.submittingPlayerId || message.playerId; // Fallback to playerId for backward compatibility

          // Use shared handler - only the submitting player sees their answer, others skip to final results
          // WebSocket broadcasts to ALL players simultaneously, ensuring synchronization
          // NO REFRESH CALLS - all data comes from WebSocket message
          handleGameCompletion(message.players, secretElement, playerWasCorrect, submittingPlayerId);

          supabase
            .from("game_sessions")
            .update({ status: "expired" })
            .eq("id", sessionId)
            .then(() => console.log("✅ Session marked as expired"));

          // Auto-cleanup disabled - keeping sessions for history
          break;

        case "player_joined":
          toast({
            title: "Player Joined",
            description: `${message.playerName} joined the game`,
          });
          debouncedRefresh({ showLoading: false });
          break;

        case "player_left":
          toast({
            title: "Player Left",
            description: `${message.playerName} left the game`,
          });
          debouncedRefresh({ showLoading: false });
          break;

        case "refresh_game_state":
          debouncedRefresh({ showLoading: false });
          break;

        default:
          // Don't refresh on unknown messages
          break;
      }
    },
  });

  useEffect(() => {
    console.log("Game component mounted, sessionId:", sessionId);
    if (!sessionId) {
      console.log("No sessionId, redirecting to /play/host");
      setLoading(false);
      navigate("/play/host");
      return;
    }

    // Set a timeout fallback to ensure loading never gets stuck (3 seconds max)
    let loadingTimeoutId: NodeJS.Timeout | null = setTimeout(() => {
      console.warn("⚠️ Loading timeout - clearing loading state to prevent stuck screen");
      setLoading(false);
    }, 3000);

    // Only show loading briefly for initial load
    setLoading(true);
    initializeGame({ showLoading: true }).finally(() => {
      // Always clear loading after initialization, regardless of success/failure
      setLoading(false);
      // Clear timeout once initialization completes
      if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
        loadingTimeoutId = null;
      }
    });

    const cleanup = setupRealtimeSubscriptions();

    // Poll fallback: only when WS is disconnected. Used as a safety net for completion state.
    const pollId = window.setInterval(async () => {
      try {
        if (!sessionId) return;
        if (isConnected) return;
        if (gameCompletedRef.current || isAnnouncingWinnerRef.current || isModeSelectingRef.current) return;
        // Skip polling when storyteller is actively creating their story
        if (isStorytellerActiveRef.current) return;

        const playerId = getCurrentPlayerId();
        const { data, error } = await supabase.functions.invoke("get-game-state", {
          body: { sessionId, playerId },
        });

        if (error) {
          console.log("poll:get-game-state error", error);
          const msg = error.message || error.context?.error || "";
          const isNotFound =
            error.status === 404 ||
            msg.toLowerCase().includes("session not found") ||
            msg.toLowerCase().includes("game not found");

          if (isNotFound) {
            toast({
              title: "Game not found",
              description: "This game session doesn't exist or has already ended.",
              variant: "destructive",
            });
            navigate("/play/host", { replace: true });
            window.clearInterval(pollId);
          }
          return;
        }

        const status = data?.session?.status;
        if (status === "completed" || status === "expired") {
          console.log("🎯 Poll detected game completed:", status);

          // Don't process if already showing result (use ref to prevent race conditions)
          // WebSocket should be the primary source for synchronized display - skip poll if WebSocket already handled it
          if (gameCompletionResultShownRef.current || isRoundTransitioning || isRoundSummaryOpen || isAnnouncingWinnerRef.current || gameCompletedRef.current) {
            console.log("Already showing game completion result via WebSocket, skipping poll fallback");
            return;
          }

          // Poll is fallback only - WebSocket should handle this first
          // Use data from poll response - no additional refresh needed
          const secret = data?.currentTurn?.whisp || currentTurn?.whisp || "?";
          const playersForCompletion: Player[] = data?.players || [];

          if (playersForCompletion.length > 0) {
            setSession(data.session);
            // Use shared handler to show round result - ensures all players see it the same way
            // NO REFRESH - using data from poll response
            handleGameCompletion(playersForCompletion, secret);
          }
        }
      } catch (err) {
        console.error("poll:get-game-state failed", err);
      }
    }, 10000);

    return () => {
      if (cleanup) cleanup();
      window.clearInterval(pollId);
      // Clear loading timeout on unmount
      if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
      }
    };
  }, [sessionId, isConnected]);

  // Auto-trigger turn start when theme is selected but no whisp yet
  const autoTurnTriggeredRef = useRef(false);
  useEffect(() => {
    // Only run once when conditions are met
    if (autoTurnTriggeredRef.current) return;

    const hasWhisp = !!currentTurn?.whisp;
    const isStoryteller = session?.current_storyteller_id === currentPlayerId;
    const hasTheme = !!currentTurn?.theme_id;

    // Don't auto-trigger if we're in the middle of theme selection or whisp generation
    // This prevents duplicate calls when handleThemeSelect already calls handleStartTurn
    if (
      hasTheme &&
      isStoryteller &&
      !hasWhisp &&
      !isGeneratingWhisp &&
      !isModeTransitioning &&
      gamePhase === "storytelling" &&
      currentTurn?.theme_id // Ensure theme_id is actually set and not empty
    ) {
      console.log("Auto-triggering turn start with theme:", currentTurn?.theme_id);
      autoTurnTriggeredRef.current = true;
      handleStartTurn(currentTurn.theme_id);
    }

    // Reset flag when turn changes
    if (hasWhisp) {
      autoTurnTriggeredRef.current = false;
    }
  }, [
    currentTurn?.theme_id,
    session?.current_storyteller_id,
    currentPlayerId,
    currentTurn?.whisp,
    gamePhase,
    isGeneratingWhisp,
    isModeTransitioning,
  ]);

  const initializeGame = async (options: RefreshOptions = {}) => {
    const bypassStoryPause = options.bypassStoryPause === true;
    // Default to false - only show loading if explicitly requested (initial load only)
    const showLoading = options.showLoading === true;

    // Don't reinitialize if game is already completed, announcing winner, selecting mode, or storyteller is active
    if (
      gameCompletedRef.current ||
      isAnnouncingWinnerRef.current ||
      isModeSelectingRef.current ||
      (!bypassStoryPause && isStorytellerActiveRef.current)
    ) {
      console.log(
        "Skipping initializeGame - game completed, announcing winner, selecting mode, or storyteller active",
      );
      // Only clear loading if it was shown
      if (showLoading) {
        setLoading(false);
      }
      return;
    }

    try {
      // Only show loading if explicitly requested (initial load or user action)
      if (showLoading) {
        setLoading(true);
      }
      const playerId = getCurrentPlayerId();
      console.log("Current player ID:", playerId);
      setCurrentPlayerId(playerId);

      console.log("Fetching game state for session:", sessionId);
      const { data, error } = await supabase.functions.invoke("get-game-state", {
        body: { sessionId, playerId },
      });

      if (error) {
        console.error("Error from get-game-state:", error);
        // Always clear loading on error
        setLoading(false);

        const msg = error.message || error.context?.error || "Unable to load this game.";
        const isNotFound =
          error.status === 404 ||
          msg.toLowerCase().includes("session not found") ||
          msg.toLowerCase().includes("game not found");

        toast({
          title: isNotFound ? "Game not found" : "Game error",
          description: isNotFound
            ? "This game session doesn't exist or has already ended."
            : msg,
          variant: "destructive",
        });

        navigate("/play/host", { replace: true });
        return;
      }

      // If session not found in response, it was deleted
      if (!data?.session) {
        console.log("Session not found in response, likely cleaned up");
        // Always clear loading
        setLoading(false);
        toast({
          title: "Game Ended",
          description: "This game session has ended.",
        });
        navigate("/play/host");
        return;
      }

      // If session is expired/completed, delay winner dialog until after last round summary
      if (data.session?.status === "expired" || data.session?.status === "completed") {
        console.log("Game already completed, status:", data.session.status);
        setSession(data.session);
        setPlayers(data.players || []);
        determineWinnerAndTies(data.players || []);
        fetchLifetimePoints(data.players || []);
        // Instead of showing result now, set a flag to show after round summary
        setTimeout(() => {
          if (!isRoundTransitioning && !isRoundSummaryOpen) {
            setGameCompleted(true);
          } else {
            // Poll until both dialogs are closed
            const poll = setInterval(() => {
              if (!isRoundTransitioning && !isRoundSummaryOpen) {
                setGameCompleted(true);
                clearInterval(poll);
              }
            }, 200);
          }
        }, 0);
        setLoading(false);
        return;
      }

      console.log("Game state received:", data);
      console.log("Session:", data.session);
      console.log("Players:", data.players);
      console.log("Themes count:", data.themes?.length);
      console.log("Current turn:", data.currentTurn);
      console.log("Current storyteller:", data.session?.current_storyteller_id);

      // Reset round transition trigger when round changes
      const previousRound = session?.current_round;
      const newRound = data.session?.current_round;
      const previousTurnId = currentTurn?.id;
      const newTurnId = data.currentTurn?.id;

      if (previousRound !== undefined && newRound !== undefined && previousRound !== newRound) {
        console.log(`🔄 Round changed from ${previousRound} to ${newRound} - resetting transition trigger`);
        roundTransitionTriggeredRef.current = null;
        // Clear answered players when round changes
        setAnsweredPlayerIds([]);
      }

      // Clear answered players when turn changes (new turn = new round of guessing)
      if (previousTurnId && newTurnId && previousTurnId !== newTurnId) {
        console.log(`🔄 Turn changed from ${previousTurnId} to ${newTurnId} - clearing answered players`);
        setAnsweredPlayerIds([]);
      }

      setSession(data.session);
      setPlayers(data.players || []);
      setThemes(data.themes || []);

      // Decode whisp for storyteller if it's encrypted
      const isStoryteller = data.session?.current_storyteller_id === playerId;
      if (data.currentTurn && data.currentTurn.whisp && isStoryteller) {
        // Decode if it's encrypted (starts with _ENC_)
        let decodedWhisp = data.currentTurn.whisp;
        if (data.currentTurn.whisp.startsWith('_ENC_')) {
          try {
            decodedWhisp = atob(data.currentTurn.whisp.substring(5));
          } catch (e) {
            console.error('Error decoding whisp:', e);
            decodedWhisp = data.currentTurn.whisp;
          }
        }
        setCurrentTurn({ ...data.currentTurn, whisp: decodedWhisp });
      } else {
        setCurrentTurn(data.currentTurn);
      }

      // Fetch answered players for current turn (only if turn exists and is in guessing phase)
      if (data.currentTurn?.id && data.currentTurn?.completed_at) {
        fetchAnsweredPlayers(data.currentTurn.id);
      } else {
        // Clear answered players if turn doesn't exist or isn't completed yet
        setAnsweredPlayerIds([]);
      }

      setSelectedIcons(data.selectedIcons || []);
      // Keep storyteller drag list hydrated from server state so icons persist across refresh/reconnect.
      setCoreElementsForSelection(data.selectedIcons || []);
      // Themes are now filtered by packs_used from session, no need for unlockedPackIds

      // Determine game phase based on turn state
      let phase: GamePhase;
      const turnMode = data.currentTurn?.turn_mode;
      const hasWhisp = !!data.currentTurn?.whisp;
      const hasTheme = !!data.currentTurn?.theme_id;

      // Session-level turn mode (set at lobby creation - skips per-turn mode selection)
      const sessionTurnMode = data.session?.turn_mode;

      // Phase determination (theme selected per turn by storyteller):
      // 1. No turn theme -> show theme selection (storyteller selects theme)
      // 2. Theme exists but no whisp -> storytelling (unified)
      // 3. Has whisp and completed -> guessing

      if (!hasTheme) {
        phase = "selecting_theme";
      } else if (!hasWhisp || !data.currentTurn?.completed_at) {
        phase = "storytelling";
      } else {
        phase = "guessing";
      }

      console.log(
        "Game phase:",
        phase,
        "hasTheme:",
        hasTheme,
        "hasWhisp:",
        hasWhisp,
        "turnMode:",
        turnMode,
        "sessionTurnMode:",
        sessionTurnMode,
      );
      setGamePhase(phase);

      // Use turn theme (selected by storyteller at start of each turn)
      if (data.currentTurn?.theme_id) {
        setSelectedThemeId(data.currentTurn.theme_id);
      } else {
        setSelectedThemeId(""); // Clear if no theme selected yet
      }

      // Set turn mode: prefer session-level, fallback to turn-level
      if (sessionTurnMode) {
        setSelectedTurnMode(sessionTurnMode);
      } else if (data.currentTurn?.turn_mode) {
        setSelectedTurnMode(data.currentTurn.turn_mode);
      } else {
        setSelectedTurnMode(null); // Reset for new turn - storyteller will choose
      }
    } catch (error) {
      console.error("Error initializing game:", error);
      // Don't show error toast if game is already completed/expired or we're announcing winner (use refs)
      if (
        session?.status !== "expired" &&
        session?.status !== "completed" &&
        !gameCompletedRef.current &&
        !isAnnouncingWinnerRef.current
      ) {
        toast({
          title: "Error",
          description: "Failed to load game state.",
          variant: "destructive",
        });
      }
    } finally {
      // Only hide loading if it was shown
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Fetch which players have answered for the current turn
  const fetchAnsweredPlayers = async (turnId: string) => {
    try {
      const { data: guesses, error } = await supabase
        .from("game_guesses")
        .select("player_id")
        .eq("turn_id", turnId);

      if (error) {
        console.error("Error fetching answered players:", error);
        return;
      }

      // Extract unique player IDs who have answered
      const answeredIds = [...new Set(guesses?.map((g: any) => g.player_id) || [])];
      setAnsweredPlayerIds(answeredIds);
    } catch (error) {
      console.error("Error in fetchAnsweredPlayers:", error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const channel = supabase
      .channel(`game-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          // Check if game was just completed - show winner popup for everyone
          const newStatus = (payload.new as any)?.status;
          if (newStatus === "completed" || newStatus === "expired") {
            console.log("🎉 Game session status changed to (via Realtime):", newStatus);

            // Don't process if already showing result (use ref to prevent race conditions)
            // WebSocket should be the primary source for synchronized display - skip realtime if WebSocket already handled it
            if (gameCompletionResultShownRef.current || isAnnouncingWinnerRef.current || gameCompletedRef.current || isRoundTransitioning || isRoundSummaryOpen) {
              console.log("Already showing game completion result via WebSocket, skipping realtime event");
              return;
            }

            // Realtime is fallback only - WebSocket should handle this first
            // If we reach here, WebSocket might not be connected, so use realtime as fallback
            // But still try to avoid refresh by using existing data
            // Don't show answer to anyone via this path (no submittingPlayerId)
            const secretElement = currentTurn?.whisp || "?";
            if (players && players.length > 0) {
              // Use existing players data if available - no refresh needed
              // No submittingPlayerId means no one sees the answer
              handleGameCompletion(players, secretElement, undefined, undefined);
            } else {
              // Only fetch if we don't have players data
              const fetchAndShowCompletion = async () => {
                try {
                  const { data: latestPlayers } = await supabase
                    .from("game_players")
                    .select("id, player_id, name, score, turn_order")
                    .eq("session_id", sessionId)
                    .order("score", { ascending: false });

                  const playersForCompletion = (latestPlayers && latestPlayers.length > 0) ? latestPlayers : players;
                  // No submittingPlayerId means no one sees the answer
                  handleGameCompletion(playersForCompletion, secretElement, undefined, undefined);
                } catch (err) {
                  console.error("Error fetching data for completion:", err);
                  handleGameCompletion(players, secretElement, undefined, undefined);
                }
              };
              fetchAndShowCompletion();
            }
          } else {
            debouncedRefresh({ showLoading: false });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_turns",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("game_turns Realtime update received:", payload);

          // Prevent the storyteller UI from resetting while they are building the story.
          // We can reliably detect this from the updated row itself (no stale React state/closures).
          const myId = getCurrentPlayerId();
          const newRow = (payload as any)?.new;
          const storytellerId = newRow?.storyteller_id;
          const isMyTurn = !!storytellerId && myId === storytellerId;
          const isTurnCompleted = !!newRow?.completed_at;
          const oldRow = (payload as any)?.old;
          const wasJustCompleted = !oldRow?.completed_at && isTurnCompleted;

          // If I'm the storyteller and the turn is not completed yet, skip refresh.
          // (Refreshing sets loading=true in Game.tsx, which unmounts the interface and sends you back to Step 1.)
          if (isMyTurn && !isTurnCompleted) {
            console.log("Skipping refresh - storyteller is still composing the story");
            return;
          }

          // If turn was just completed (all players answered), show round transition for ALL players
          if (wasJustCompleted && isTurnCompleted && gamePhase === "guessing") {
            const turnId = newRow?.id;

            // Prevent duplicate transitions - check if we already showed this transition
            if (roundTransitionTriggeredRef.current === turnId) {
              console.log("⏭️ Skipping duplicate round transition for turn:", turnId);
              return;
            }

            // completed_at is set when storyteller submits story, not when all guesses are in.
            // Recap is triggered from game_guesses final-answer logic instead.
            console.log("🎯 Turn updated to completed_at - waiting for all guesses before recap");
            debouncedRefresh({ bypassStoryPause: true, showLoading: false });
            return;
          }

          // Skip refresh if round transition is already showing (prevents multiple API calls)
          if (roundTransitionTriggeredRef.current === null) {
            // Only refresh if not in round transition
            debouncedRefresh({ bypassStoryPause: true, showLoading: false });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Silent refresh when new player joins - don't show loading
          console.log("New player joined - silent refresh");
          debouncedRefresh({ showLoading: false, bypassStoryPause: true });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Silent refresh for player updates (score changes, etc.) - don't show loading
          debouncedRefresh({ showLoading: false, bypassStoryPause: true });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "game_players",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          console.log("Player deleted from game, refreshing...");
          debouncedRefresh({ showLoading: false });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_guesses",
        },
        async (payload) => {
          // Get turn_id and player_id from the inserted guess
          const guessTurnId = (payload.new as any)?.turn_id;
          const guessPlayerId = (payload.new as any)?.player_id;

          // Verify this guess belongs to the current session
          // Check if turn_id matches currentTurn.id (fast check)
          const isCurrentTurn = currentTurn?.id === guessTurnId;

          // If not current turn, verify the turn belongs to this session
          if (!isCurrentTurn && guessTurnId) {
            try {
              const { data: turnData } = await supabase
                .from("game_turns")
                .select("session_id")
                .eq("id", guessTurnId)
                .single();

              // If turn doesn't belong to current session, ignore this guess
              if (!turnData || turnData.session_id !== sessionId) {
                console.log("Ignoring guess from different session:", guessTurnId);
                return;
              }
            } catch (err) {
              console.error("Error verifying turn session:", err);
              return; // Don't process if we can't verify
            }
          }

          // Only process guesses for the current session
          // Find player name from current players state (only if player is in this session)
          const guessingPlayer = players.find((p) => p.player_id === guessPlayerId);

          const playerName = guessingPlayer?.name || "A player";

          // Update answered players list
          setAnsweredPlayerIds((prev) => {
            if (!prev.includes(guessPlayerId)) {
              return [...prev, guessPlayerId];
            }
            return prev;
          });

          // Don't show toast if it's the current player (they already see their own submission)
          if (guessPlayerId !== currentPlayerId) {
            toast({
              title: "Player Guessed!",
              description: `${playerName} submitted their guess`,
            });
          }

          // If this was the final required guess for the turn, show recap for everyone.
          if (guessTurnId && recapShownTurnRef.current !== guessTurnId) {
            try {
              const { data: turnMeta } = await supabase
                .from("game_turns")
                .select("session_id, storyteller_id, whisp")
                .eq("id", guessTurnId)
                .maybeSingle();

              if (!turnMeta || turnMeta.session_id !== sessionId || !turnMeta.storyteller_id) {
                return;
              }

              const { data: sessionPlayers } = await supabase
                .from("game_players")
                .select("player_id")
                .eq("session_id", sessionId);

              const eligibleGuessers = new Set(
                (sessionPlayers || [])
                  .map((p: { player_id: string }) => p.player_id)
                  .filter((id: string) => id !== turnMeta.storyteller_id)
              );

              const { data: allGuesses } = await supabase
                .from("game_guesses")
                .select("player_id")
                .eq("turn_id", guessTurnId);

              const answeredGuessers = new Set(
                (allGuesses || [])
                  .map((g: { player_id: string }) => g.player_id)
                  .filter((id: string) => eligibleGuessers.has(id))
              );

              const allRequiredAnswered =
                eligibleGuessers.size > 0 && answeredGuessers.size === eligibleGuessers.size;

              if (allRequiredAnswered) {
                // Small delay helps ensure score updates are committed before recap fetches latest players.
                setTimeout(() => {
                  showTurnRecap(turnMeta.whisp || undefined, players, guessTurnId);
                }, 250);
              }
            } catch (error) {
              console.error("Error checking final guess for recap:", error);
            }
          }

          debouncedRefresh({ showLoading: false });
        },
      )
      .on("broadcast", { event: "lobby_ended" }, () => {
        toast({
          title: "Game Ended",
          description: "The host has ended this game",
        });
        navigate("/login", { replace: true });
      })
      .on("broadcast", { event: "player_left" }, (payload) => {
        const leftPlayerName = payload.payload?.senderName || "A player";
        toast({
          title: "Player Left",
          description: `${leftPlayerName} left the game`,
        });
        debouncedRefresh({ showLoading: false });
      })
      .on("broadcast", { event: "game_completed" }, (payload) => {
        console.log("🎉 Received game_completed broadcast via Realtime:", payload);

        // Don't process if already showing result (use ref to prevent race conditions)
        if (gameCompletionResultShownRef.current || isAnnouncingWinnerRef.current || gameCompletedRef.current || isRoundTransitioning || isRoundSummaryOpen) {
          console.log("Already showing game completion result, skipping Realtime broadcast");
          return;
        }

        // Use broadcast payload data - ensures ALL players (including storyteller) see result simultaneously
        // This is synchronized similar to the "3-2-1-Start" countdown
        const broadcastData = payload.payload;
        if (!broadcastData?.players || broadcastData.players.length === 0) {
          console.error("⚠️ game_completed broadcast missing players data");
          return;
        }

        const secretElement = broadcastData.secretElement || currentTurn?.whisp || "?";
        const playerWasCorrect = broadcastData.wasCorrect !== undefined ? broadcastData.wasCorrect : undefined;
        const submittingPlayerId = broadcastData.submittingPlayerId || broadcastData.senderId; // Get submitting player ID

        // Use shared handler - only the submitting player sees their answer, others skip to final results
        // Realtime broadcast ensures synchronization - all players receive it at the same time
        // NO REFRESH CALLS - all data comes from broadcast payload
        handleGameCompletion(broadcastData.players, secretElement, playerWasCorrect, submittingPlayerId);
      })
      .subscribe();

    // Store channel ref for broadcasting after subscribe
    broadcastChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Handle theme selection - immediately start turn with unified flow
  // Theme is selected per turn by the storyteller
  const handleThemeSelect = async (themeId: string) => {
    console.log("🎯 handleThemeSelect called with themeId:", themeId);
    setSelectedThemeId(themeId);
    setIsGeneratingWhisp(true);
    setIsModeTransitioning(true);

    try {
      // Notify other players
      sendWebSocketMessage({
        type: "theme_selected",
        themeId,
      });

      // Start the turn immediately (start-turn will update the turn with theme_id)
      console.log("🚀 Calling handleStartTurn with themeId:", themeId);
      await handleStartTurn(themeId);
    } catch (error) {
      console.error("Error selecting theme:", error);
      toast({
        title: "Error",
        description: "Failed to select theme.",
        variant: "destructive",
      });
      setIsGeneratingWhisp(false);
      setIsModeTransitioning(false);
    }
  };

  // Handle starting a turn - unified flow (no mode selection)
  const handleStartTurn = async (themeId: string) => {
    console.log("🔥 handleStartTurn called with themeId:", themeId);

    if (!themeId || themeId.trim() === "") {
      console.error("❌ handleStartTurn called with empty themeId");
      toast({
        title: "Error",
        description: "No theme selected.",
        variant: "destructive",
      });
      setIsGeneratingWhisp(false);
      setIsModeTransitioning(false);
      return;
    }

    try {
      // Get the current turn to ensure we have the latest turn ID
      const { data: gameState } = await supabase.functions.invoke("get-game-state", {
        body: { sessionId },
      });

      const turnId = gameState?.currentTurn?.id || currentTurn?.id;

      console.log("Starting turn with themeId:", themeId, "turnId:", turnId);

      // Call start-turn to get whisp, theme elements, and core elements
      const { data, error } = await supabase.functions.invoke("start-turn", {
        body: {
          sessionId,
          turnId,
          selectedThemeId: themeId,
        },
      });

      if (error) throw error;

      console.log("Start-turn response:", data);

      // Update local state with turn data
      const turnWithTheme = {
        ...data.turn,
        theme: data.theme,
      };
      setCurrentTurn(turnWithTheme);

      // Store auto-assigned icons for the unified interface (5 total)
      setCoreElementsForSelection(data.coreElements || []);
      setCurrentWhisp(data.whisp || "");

      // Move to storytelling phase (unified)
      setGamePhase("storytelling");

      // Notify other players
      sendWebSocketMessage({
        type: "mode_selected",
        whisp: data.whisp,
      });

      toast({
        title: "Turn Started! ✨",
        description: `Your secret whisp is: "${data.whisp}"`,
      });

      setTimeout(() => {
        setIsGeneratingWhisp(false);
        setIsModeTransitioning(false);
      }, 500);
    } catch (error) {
      console.error("Error starting turn:", error);
      toast({
        title: "Error",
        description: "Failed to start turn.",
        variant: "destructive",
      });
      setIsGeneratingWhisp(false);
      setIsModeTransitioning(false);
    }
  };

  const handleStoryComplete = () => {
    // Allow polling again after storyteller finishes
    isStorytellerActiveRef.current = false;
    toast({
      title: "Story Submitted!",
      description: "Waiting for other players to guess...",
    });
    initializeGame({ showLoading: false }); // Silent refresh after story submission
  };

  // Shared function to handle game completion - ensures all players see results the same way
  // NO REFRESH CALLS - uses only WebSocket data for instant display
  const handleGameCompletion = useCallback(
    async (
      playersData: Player[],
      secretElement: string,
      playerWasCorrect?: boolean | null,
      submittingPlayerId?: string
    ) => {
      if (
        gameCompletionResultShownRef.current ||
        isAnnouncingWinnerRef.current ||
        gameCompletedRef.current
      ) {
        console.log("Already showing result, skipping");
        return;
      }

      gameCompletionResultShownRef.current = true;

      const isSubmittingPlayer = submittingPlayerId === currentPlayerId;

      setPlayers(playersData);
      determineWinnerAndTies(playersData);
      fetchLifetimePoints(playersData);

      // No immediate right/wrong reveal on game completion.
      gameCompletedRef.current = true;
      setGameCompleted(true);
    },
    [currentPlayerId, determineWinnerAndTies, fetchLifetimePoints]
  );

const loadLastTurnRecap = async (playersData: Player[]) => {
  try {
    let lastTurn: any = null;

    // retry up to 4 times (800ms total)
    for (let i = 0; i < 4; i++) {
      const { data } = await supabase
        .from("game_turns")
        .select("id, whisp, selected_icon_ids, storyteller_id, round_number")
        .eq("session_id", sessionId)
        .not("completed_at", "is", null)   // ensure completed turn
        .order("round_number", { ascending: false })
        .limit(1)
        .single();

      if (data?.selected_icon_ids?.length && data?.whisp) {
        lastTurn = data;
        break;
      }

      lastTurn = data;

      await new Promise((r) => setTimeout(r, 200));
    }

    if (!lastTurn) return;

    let recapWhisp = lastTurn.whisp || "";

    // decode encrypted whisp
    if (recapWhisp.startsWith("_ENC_")) {
      try {
        recapWhisp = atob(recapWhisp.substring(5));
      } catch (e) {
        console.error("Whisp decode error", e);
      }
    }

    let recapIcons: IconItem[] = [];

    if (lastTurn.selected_icon_ids?.length) {
      const { data: iconRows } = await supabase
        .from("elements")
        .select("id, name, icon, image_url, color")
        .in("id", lastTurn.selected_icon_ids);

      const iconMap = new Map(
        (iconRows || []).map((i) => [String(i.id), i])
      );

      recapIcons = lastTurn.selected_icon_ids
        .map((id: string) => iconMap.get(String(id)))
        .filter(Boolean)
        .map((row: any) => ({
          id: row.id,
          name: row.name,
          icon: row.icon,
          image_url: row.image_url || undefined,
          color: row.color || undefined,
          isFromCore: false,
        }));
    }

    const { data: guesses } = await supabase
      .from("game_guesses")
      .select("player_id, points_earned")
      .eq("turn_id", lastTurn.id);

    const outcomes: Record<string, any> = {};

    playersData.forEach((p) => {
      if (p.player_id === lastTurn.storyteller_id) {
        outcomes[p.player_id] = "storyteller";
      } else {
        outcomes[p.player_id] = "not_answered";
      }
    });

    guesses?.forEach((g) => {
      outcomes[g.player_id] =
        (g.points_earned || 0) > 0 ? "correct" : "wrong";
    });

    setTurnRecap({
      turnId: lastTurn.id,
      icons: recapIcons,
      whisp: recapWhisp,
      players: playersData,
      roundNumber: lastTurn.round_number || 1,
      totalRounds: GAME_ROUNDS_PER_GAME,
      turnInRound: 1,
      turnsPerRound: playersData.length,
      guessOutcome: "correct",
      playerOutcomes: outcomes,
    });

  } catch (err) {
    console.error("Error loading last turn recap", err);
  }
};
  const handleGuessSubmit = async (gameCompletedFromGuess?: boolean, playersFromGuess?: any[], wasCorrect?: boolean, whisp?: string, nextRound?: any, allPlayersAnswered?: boolean) => {
    console.log("📝 handleGuessSubmit called:", { gameCompletedFromGuess, wasCorrect, whisp, playersCount: playersFromGuess?.length });

    // Immediately add current player to answered players for instant UI feedback
    setAnsweredPlayerIds((prev) => {
      if (!prev.includes(currentPlayerId)) {
        return [...prev, currentPlayerId];
      }
      return prev;
    });

    toast({
      title: "Guess Submitted!",
      description: "Waiting for other players...",
    });

    // If game just completed, broadcast game_completed message via both WebSocket and Realtime
    // This ensures ALL players (including storyteller) receive it simultaneously, similar to "3-2-1-Start"
    if (gameCompletedFromGuess && playersFromGuess && playersFromGuess.length > 0) {
      console.log("🎉 Game completed from guess submission, wasCorrect:", wasCorrect);

      const sortedPlayers = [...playersFromGuess].sort((a: Player, b: Player) => (b.score || 0) - (a.score || 0));
      const winner = sortedPlayers[0];
      const secretElement = whisp || currentTurn?.whisp || "?";

      // Broadcast via WebSocket - ensures all players receive it
      // Include submittingPlayerId so only that player sees their answer
      sendWebSocketMessage({
        type: "game_completed",
        winnerId: winner?.player_id,
        winnerName: winner?.name,
        players: playersFromGuess,
        wasCorrect: wasCorrect === true, // Include wasCorrect so submitting player sees their result correctly
        secretElement: secretElement,
        submittingPlayerId: currentPlayerId, // Identify who submitted the answer
      });

      // Also broadcast via Realtime to ensure storyteller and all players receive it simultaneously
      // This provides redundancy and ensures synchronization similar to the countdown
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.send({
            type: "broadcast",
            event: "game_completed",
            payload: {
              winnerId: winner?.player_id,
              winnerName: winner?.name,
              winnerScore: winner?.score,
              players: playersFromGuess,
              secretElement: secretElement,
              wasCorrect: wasCorrect === true,
              submittingPlayerId: currentPlayerId, // Identify who submitted the answer
              timestamp: new Date().toISOString(),
            },
          });
          console.log("📡 Broadcasted game_completed via Realtime to all players");
        } catch (broadcastError) {
          console.error("Error broadcasting game completion via Realtime:", broadcastError);
          // Continue - WebSocket should still work
        }
      }

      // Don't call handleGameCompletion directly - let WebSocket/Realtime handler do it for consistency
      // This ensures ALL players (including storyteller) see the result dialog at the same time
      return;
    }

    // If all players answered but game continues (next round), skip dialog and refresh silently
    if (nextRound && nextRound.newStorytellerId && !gameCompletedFromGuess && allPlayersAnswered === true) {
      console.log("📢 Round complete, showing recap");
      showTurnRecap(whisp, nextRound.players || players, currentTurn?.id, wasCorrect);
      return;
    }

    // Do not refresh immediately after each individual submission.
    // Recap flow will refresh and update scoreboard once all required players have answered.
  };
 const handleOpenRoundSummary = async () => {
  if (!session || players.length === 0) return;

  const turnsPerRound = players.length;

  const currentRoundNumber = Math.ceil(
    (session.current_round || 1) / turnsPerRound
  );

  const summary = await buildCumulativeRoundSummary(
    currentRoundNumber,
    players
  );

  if (summary) {
    setCumulativeRoundSummary(summary);
  }

  // Load recap with players data
  await loadLastTurnRecap(players);

  setIsRoundSummaryOpen(true);
};

  // Handle storyteller timer expiry - skip the round
  const handleStoryTimeUp = useCallback(async () => {
    const isCurrentStoryteller = currentPlayerId === session?.current_storyteller_id;
    const turnId = currentTurn?.id || "";

    // Prevent multiple triggers for the same turn
    if (!sessionId || !isCurrentStoryteller || gameCompleted) return;
    if (storyTimeUpTriggeredRef.current === turnId) {
      console.log("⏰ Story time already triggered for this turn, skipping");
      return;
    }
    storyTimeUpTriggeredRef.current = turnId;

    console.log("⏰ Story time expired - skipping round");
    toast({
      title: "⏰ Time's Up!",
      description: "Round skipped - moving to next storyteller",
      variant: "destructive",
    });

    try {
      const { data, error } = await supabase.functions.invoke("skip-turn", {
        body: { sessionId, reason: "storyteller_timeout" },
      });

      if (error) throw error;

      console.log("Skip turn response:", data);

      if (data.game_completed) {
        // Use WebSocket to broadcast game completion - ensures all players see result once and simultaneously
        const { data: latestPlayers } = await supabase
          .from("game_players")
          .select("id, player_id, name, score, turn_order")
          .eq("session_id", sessionId)
          .order("score", { ascending: false });

        const playersToUse = latestPlayers || players;
        const sortedPlayers = [...playersToUse].sort((a: Player, b: Player) => (b.score || 0) - (a.score || 0));

        // Broadcast via WebSocket - all players (including storyteller) will see result once via WebSocket handler
        sendWebSocketMessage({
          type: "game_completed",
          winnerId: sortedPlayers[0]?.player_id,
          winnerName: sortedPlayers[0]?.name,
          players: playersToUse,
          secretElement: currentTurn?.whisp || "?",
        });
      } else if (data.next_round) {
        sendWebSocketMessage({
          type: "next_turn",
          roundNumber: data.next_round.roundNumber,
          newStorytellerId: data.next_round.newStorytellerId,
          newStorytellerName: data.next_round.newStorytellerName,
          completedTurnId: currentTurn?.id,
        });
        // Only refresh if game continues
        initializeGame({ showLoading: false }); // Silent refresh after skip
      }
    } catch (error) {
      console.error("Error skipping turn:", error);
    }
  }, [sessionId, currentPlayerId, session?.current_storyteller_id, currentTurn?.id, gameCompleted, players, sendWebSocketMessage, toast]);

  // Handle guess timer expiry - auto-submit for players who haven't answered
  const handleGuessTimeUp = useCallback(async () => {
    const isCurrentStoryteller = currentPlayerId === session?.current_storyteller_id;
    const turnId = currentTurn?.id || "";

    // Prevent multiple triggers for the same turn
    if (!sessionId || !currentTurn || !session || isCurrentStoryteller || gameCompleted) return;
    if (guessTimeUpTriggeredRef.current === turnId) {
      console.log("⏰ Guess time already triggered for this turn, skipping");
      return;
    }
    guessTimeUpTriggeredRef.current = turnId;

    console.log("⏰ Guess time expired - auto-submitting");
    toast({
      title: "⏰ Time's Up!",
      description: "Your guess was automatically skipped",
      variant: "destructive",
    });

    try {
      const { data, error } = await supabase.functions.invoke("auto-submit-guess", {
        body: {
          sessionId,
          roundNumber: session.current_round,
          playerId: currentPlayerId,
          reason: "timeout",
        },
      });

      if (error) throw error;

      console.log("Auto-submit response:", data);

      if (data.game_completed) {
        // Use WebSocket to broadcast game completion - ensures all players see result once and simultaneously
        const { data: latestPlayers } = await supabase
          .from("game_players")
          .select("id, player_id, name, score, turn_order")
          .eq("session_id", sessionId)
          .order("score", { ascending: false });

        const playersToUse = latestPlayers || players;
        const sortedPlayers = [...playersToUse].sort((a: Player, b: Player) => (b.score || 0) - (a.score || 0));

        // Broadcast via WebSocket - all players (including storyteller) will see result once via WebSocket handler
        sendWebSocketMessage({
          type: "game_completed",
          winnerId: sortedPlayers[0]?.player_id,
          winnerName: sortedPlayers[0]?.name,
          players: playersToUse,
          secretElement: currentTurn?.whisp || "?",
        });
      } else if (data.next_round) {
        sendWebSocketMessage({
          type: "next_turn",
          roundNumber: data.next_round.roundNumber,
          newStorytellerId: data.next_round.newStorytellerId,
          newStorytellerName: data.next_round.newStorytellerName,
          completedTurnId: currentTurn?.id,
        });
        // Only refresh if game continues
        initializeGame({ showLoading: false }); // Silent refresh after auto-submit
      }
    } catch (error) {
      console.error("Error auto-submitting guess:", error);
    }
  }, [sessionId, currentTurn, session, currentPlayerId, gameCompleted, players, sendWebSocketMessage, toast]);

  // Keep scoreboard scores frozen during guessing so points are only revealed
  // after every non-storyteller player has submitted.
  useEffect(() => {
    if (gamePhase === "guessing" && currentTurn?.id) {
      setFrozenGuessScores((prev) => {
        if (prev?.turnId === currentTurn.id) {
          return prev;
        }

        const scoresSnapshot: Record<string, number> = {};
        players.forEach((player) => {
          scoresSnapshot[player.player_id] = player.score || 0;
        });

        return {
          turnId: currentTurn.id,
          scores: scoresSnapshot,
        };
      });
      setHasSeenRecapForTurn(false);
      return;
    }

    setFrozenGuessScores(null);
  }, [gamePhase, currentTurn?.id, players]);

  // Only show the global loading screen before we have a session.
  // Once the game has loaded, avoid replacing the UI with "Loading game..."
  // during background refreshes of get-game-state.
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  if (!loading && !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Game not found</p>
      </div>
    );
  }

  const isStoryteller = currentPlayerId === session.current_storyteller_id;
  const currentPlayer = players.find((p) => p.player_id === currentPlayerId);
  const requiredGuesserIds = players
    .filter((p) => p.player_id !== session.current_storyteller_id)
    .map((p) => p.player_id);
  const allRequiredGuessersAnswered =
    requiredGuesserIds.length > 0 &&
    requiredGuesserIds.every((playerId) => answeredPlayerIds.includes(playerId));
  const shouldShowLiveScores =
    gamePhase !== "guessing" ||
    (allRequiredGuessersAnswered && hasSeenRecapForTurn && !isRoundTransitioning && !isRoundSummaryOpen);
  const scoreboardPlayers = !shouldShowLiveScores && frozenGuessScores
    ? players.map((player) => ({
      ...player,
      score: frozenGuessScores.scores[player.player_id] ?? player.score,
    }))
    : players;
  const pendingGuesserNames = players
    .filter((p) => p.player_id !== session.current_storyteller_id)
    .filter((p) => !answeredPlayerIds.includes(p.player_id))
    .map((p) => p.name);
  const turnsPerRound = Math.max(players.length, 1);
  const gameRoundNumber = Math.min(
    GAME_ROUNDS_PER_GAME,
    Math.ceil((session.current_round || 1) / turnsPerRound)
  );
  const currentTurnInRound = ((session.current_round || 1) - 1) % turnsPerRound + 1;

  // Debug render state (only log once when phase changes)
  // console.log("🎮 [RENDER DEBUG] gamePhase:", gamePhase, "isStoryteller:", isStoryteller);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* <Header /> */}

      {/* Main content area with responsive layout */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Scoreboard - top on mobile, sidebar on desktop */}
        <aside className="w-full md:w-64 lg:w-80 flex-shrink-0 p-2 md:p-4 md:sticky md:top-0 md:h-[calc(100vh-64px)] md:overflow-y-auto">
          <Scoreboard
            players={scoreboardPlayers}
            currentRound={gameRoundNumber}
            totalRounds={GAME_ROUNDS_PER_GAME}
            currentTurnInRound={currentTurnInRound}
            turnsPerRound={turnsPerRound}
            currentStorytellerId={session.current_storyteller_id}
            answeredPlayerIds={answeredPlayerIds}
            showGuessStatus={gamePhase === "guessing"}
            timerElement={
              !gameCompleted && gamePhase === "selecting_theme" && session.story_time_seconds && currentTurn ? (
                <GameTimer
                  totalSeconds={session.story_time_seconds}
                  startTime={currentTurn.created_at}
                  label="Theme Selection Time"
                  onTimeUp={isStoryteller ? handleStoryTimeUp : undefined}
                />
              ) : !gameCompleted && currentTurn && gamePhase === "storytelling" && session.story_time_seconds ? (
                <GameTimer
                  totalSeconds={session.story_time_seconds}
                  startTime={currentTurn.created_at}
                  label="Story Time"
                  onTimeUp={isStoryteller ? handleStoryTimeUp : undefined}
                />
              ) : !gameCompleted && currentTurn && gamePhase === "guessing" && session.guess_time_seconds ? (
                <GameTimer
                  totalSeconds={session.guess_time_seconds}
                  startTime={currentTurn.completed_at}
                  label="Guess Time"
                  onTimeUp={!isStoryteller ? handleGuessTimeUp : undefined}
                />
              ) : undefined
            }

          /> {!gameCompleted && (
            <div className="mt-4 flex justify-center">
              <Button
                onClick={handleOpenRoundSummary}
                className="w-full rounded-lg"
              >
                Show Summary
              </Button>
            </div>
          )}

        </aside>

        {/* Status Indicators - Timer and Connection (desktop only) */}
        <div className="hidden md:flex fixed top-20 right-4 z-50 flex-col gap-2 items-end">
          {/* Game Timer - show during theme selection, storytelling, and guessing phases */}
          {!gameCompleted && gamePhase === "selecting_theme" && session.story_time_seconds && currentTurn && (
            <GameTimer
              totalSeconds={session.story_time_seconds}
              startTime={currentTurn.created_at}
              label="Theme Selection Time"
              onTimeUp={isStoryteller ? handleStoryTimeUp : undefined}
            />
          )}
          {!gameCompleted && currentTurn && gamePhase === "storytelling" && session.story_time_seconds && (
            <GameTimer
              totalSeconds={session.story_time_seconds}
              startTime={currentTurn.created_at}
              label="Story Time"
              onTimeUp={isStoryteller ? handleStoryTimeUp : undefined}
            />
          )}
          {!gameCompleted && currentTurn && gamePhase === "guessing" && session.guess_time_seconds && (
            <GameTimer
              totalSeconds={session.guess_time_seconds}
              startTime={currentTurn.completed_at}
              label="Guess Time"
              onTimeUp={!isStoryteller ? handleGuessTimeUp : undefined}
            />
          )}

          {/* Connection Status */}
          {/* <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              isConnected 
                ? "bg-green-500/10 text-green-600 border border-green-500/20" 
                : "bg-red-500/10 text-red-600 border border-red-500/20"
            }`}>
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3" />
                  <span>Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span>Connecting...</span>
                </>
              )}
            </div> */}
        </div>

        {/* Game Content */}
        <main className="flex-1 p-4">

          {/* Mode Transition Loading Overlay - prevents flicker during mode selection */}
          {/* {isModeTransitioning && (
              <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-lg text-muted-foreground">Setting up your turn...</p>
                </div>
              </div>
            )} */}

          {/* Theme Selection Phase - Storyteller chooses theme */}
          {gamePhase === "selecting_theme" && isStoryteller && (
            <div className="min-h-screen flex items-center justify-center p-4">
              <Card className="w-full max-w-4xl">
                <CardHeader>
                  <CardTitle className="text-center text-2xl">Your Turn to Tell a Story!</CardTitle>
                </CardHeader>
                <CardContent>
                  {isGeneratingWhisp ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="text-lg text-muted-foreground">Generating your secret whisp word...</p>
                    </div>
                  ) : (
                    <ThemeSelectionCards
                      themes={themes.map((t) => ({
                        id: t.id,
                        name: t.name,
                        icon: t.icon,
                        isCore: t.isCore || false,
                        isUnlocked: t.isUnlocked == true,
                        packName: t.packName,
                        packId: t.pack_id,
                      }))}
                      onThemeSelect={handleThemeSelect}
                      selectedThemeId={selectedThemeId}
                      disabled={isGeneratingWhisp}
                      playerName={players.find((p) => p.player_id === currentPlayerId)?.name}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {gamePhase === "selecting_theme" && !isStoryteller && (
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground mb-2">Waiting for storyteller...</h2>
                <p className="text-muted-foreground">
                  {players.find((p) => p.player_id === session.current_storyteller_id)?.name} is selecting a theme
                </p>
              </div>
            </div>
          )}

          {/* Storytelling Phase - Unified flow */}
          {gamePhase === "storytelling" && isStoryteller && currentTurn && !isModeTransitioning && (
            <UnifiedStorytellingInterface
              theme={currentTurn.theme}
              whisp={currentTurn.whisp || currentWhisp || ""}
              sessionId={sessionId!}
              playerId={currentPlayerId}
              turnId={currentTurn.id}
              onStoryComplete={handleStoryComplete}
              isStoryteller={isStoryteller}
              storytellerName={players.find((p) => p.player_id === session.current_storyteller_id)?.name || "Player"}
              sendWebSocketMessage={sendWebSocketMessage}
              coreElements={coreElementsForSelection}
            />
          )}

          {gamePhase === "storytelling" && !isStoryteller && !isModeTransitioning && (
            <div className="w-full flex items-start justify-center px-2 py-2 sm:min-h-screen sm:items-center sm:p-4">
              <div className="max-w-2xl w-full space-y-3 sm:space-y-6">
                <div className="text-center">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1 sm:mb-2">
                    {players.find((p) => p.player_id === session.current_storyteller_id)?.name} is creating their story
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">Get ready to listen and guess the secret wisp!</p>
                  {isReceivingAudio && (
                    <div className="mt-2 sm:mt-4 flex items-center justify-center gap-2 text-xs sm:text-sm text-green-600">
                      <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-green-600 animate-pulse" />
                      <span className="font-medium">Listening to live recording...</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-center pb-2 sm:pb-0">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                </div>
              </div>
            </div>
          )}

          {/* Guessing Phase - only show if game is NOT completed/announcing */}
          {gamePhase === "guessing" && !isStoryteller && currentTurn && !gameCompleted && !isAnnouncingWinner && (
            <GuessingInterface
              storytellerName={players.find((p) => p.player_id === session.current_storyteller_id)?.name || "Player"}
              theme={currentTurn.theme}
              audioUrl={currentTurn.turn_mode === "audio" ? currentTurn.recording_url || undefined : undefined}
              sessionId={sessionId!}
              roundNumber={session.current_round ?? 1}
              playerId={currentPlayerId}
              onGuessSubmit={handleGuessSubmit}
              selectedIcons={selectedIcons}
              turnMode={currentTurn.turn_mode || "audio"}
              sendWebSocketMessage={sendWebSocketMessage}
              turnId={currentTurn.id}
              onAllPlayersAnswered={(whisp, wasCorrect) => {
                console.log("✅ All players answered - showing recap");
                showTurnRecap(whisp, players, currentTurn.id, wasCorrect);
              }}
            />
          )}

          {gamePhase === "guessing" && isStoryteller && !gameCompleted && !isAnnouncingWinner && session?.status !== "completed" && session?.status !== "expired" && (
            <div className="w-full flex items-start justify-center px-2 py-2 sm:min-h-screen sm:items-center sm:p-4">
              <div className="text-center max-w-2xl w-full">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1 sm:mb-2">Players are guessing...</h2>
                <p className="text-sm sm:text-base md:text-lg font-semibold text-primary mb-2 sm:mb-0">
                  {pendingGuesserNames.length > 0
                    ? `Waiting for: ${pendingGuesserNames.join(", ")}`
                    : "All players have submitted. Finalizing round..."}
                </p>
                {currentTurn?.whisp && (
                  <p className="mt-2 sm:mt-4 text-sm sm:text-base md:text-lg">
                    Your wisp was: <span className="font-bold text-primary">{currentTurn.whisp}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>


      {/* Turn Recap Dialog - shown after each completed turn, and merged with Round Summary if last turn of round */}
      <Dialog open={isRoundSummaryOpen} onOpenChange={setIsRoundSummaryOpen}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">

   
          {cumulativeRoundSummary && (
            <div className="space-y-6">

              {/* ===== LAST TURN RECAP ===== */}
           

              {/* ===== ROUND SUMMARY TABLE ===== */}
              <div className="w-full border rounded-xl overflow-hidden">

                <table className="min-w-full border border-muted rounded-lg">

                  <thead>
                    <tr className="border-b bg-muted/30">

                      <th className="px-3 py-3 text-left font-semibold">
                        Player
                      </th>

                      {Array.from({ length: cumulativeRoundSummary.rounds }).map((_, r) => (
                        <React.Fragment key={r}>

                          {Array.from({ length: cumulativeRoundSummary.turnsPerRound }).map((_, t) => (
                            <th
                              key={`r${r}-t${t}`}
                              className="px-3 py-3 text-center font-semibold"
                            >
                              R{r + 1} T{t + 1}
                            </th>
                          ))}

                          <th className="px-3 py-3 text-center font-semibold bg-muted/20">
                            R{r + 1} Total
                          </th>

                        </React.Fragment>
                      ))}

                      <th className="px-3 py-3 text-center font-semibold bg-primary/10">
                        Total
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {cumulativeRoundSummary.rows.map((row) => (
                      <tr key={row.playerId} className="border-b last:border-b-0">

                        <td className="px-3 py-3 font-medium">
                          {row.name}
                        </td>

                        {row.roundTurnPoints.map((turns, r) => (
                          <React.Fragment key={r}>

                            {turns.map((points, t) => (
                              <td key={t} className="px-3 py-3 text-center">
                                {points}
                              </td>
                            ))}

                            <td className="px-3 py-3 text-center font-semibold bg-muted/20">
                              {row.roundTotals[r]}
                            </td>

                          </React.Fragment>
                        ))}

                        <td className="px-3 py-3 text-center font-semibold bg-primary/10">
                          {players.find(p => p.player_id === row.playerId)?.score ?? row.total}
                        </td>

                      </tr>
                    ))}

                  </tbody>

                </table>

              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Game Completed Winner Dialog - CANNOT BE SKIPPED */}

      <Dialog open={gameCompleted} onOpenChange={() => { }}>
        <DialogContent
          className="sm:max-w-5xl h-[90vh] overflow-y-scroll scrollbar-none scroll-smooth overscroll-contain"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          hideCloseButton
        >

          <div className="flex flex-col gap-6 min-h-full">

            {/* ================= GAME OVER HEADER ================= */}

            <DialogHeader className="text-center">

              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Trophy className="h-8 w-8 text-primary" />
              </div>

              <DialogTitle className="text-2xl text-center">
                Game Over! 🎊
              </DialogTitle>

              <DialogDescription className="text-center space-y-8">

                {isTieGame ? (
                  <div className="space-y-2 pt-4">
                    <p className="text-lg font-semibold">🤝 It's a Tie!</p>

                    <p className="text-muted-foreground">
                      {(() => {
                        const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
                        const highestScore = sortedPlayers[0]?.score || 0;
                        const tiedPlayers = sortedPlayers.filter(p => (p.score || 0) === highestScore);
                        return `${tiedPlayers.map(p => p.name).join(" & ")} tied with ${highestScore} points!`;
                      })()}
                    </p>
                  </div>
                ) : gameWinner ? (
                  <div className="space-y-2 pt-4">
                    <p className="text-lg font-semibold">
                      🏆 {gameWinner.name} wins!
                    </p>

                    <p className="text-muted-foreground">
                      Final Score: {gameWinner.score || 0} points
                    </p>
                  </div>
                ) : (
                  <p>Thanks for playing!</p>
                )}

                {/* ================= FINAL STANDINGS ================= */}

                <div className="mt-6 space-y-2 text-left">
                  <p className="text-sm font-medium">Final Standings:</p>

                  {[...players]
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((player, index) => {

                      const highestScore = Math.max(...players.map(p => p.score || 0))
                      const isTied = isTieGame && (player.score || 0) === highestScore

                      return (
                        <div
                          key={player.id}
                          className="flex items-center justify-between py-2 px-3 rounded bg-muted/50"
                        >

                          <span className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {index + 1}.
                            </span>

                            <span>{player.name}</span>

                            {isTied && <span>🤝</span>}
                            {!isTieGame && index === 0 && <span>👑</span>}
                          </span>

                          <div className="flex flex-col items-end">

                            <span className="font-semibold">
                              {player.score || 0} pts
                            </span>

                            {lifetimePoints[player.player_id] !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                Total: {lifetimePoints[player.player_id]} pts
                              </span>
                            )}

                          </div>

                        </div>
                      )
                    })}
                </div>

              </DialogDescription>
            </DialogHeader>


            {/* ================= FINAL TURN RECAP ================= */}

            {cumulativeRoundSummary && turnRecap && turnRecap.turnInRound === turnRecap.turnsPerRound && gameRoundNumber === GAME_ROUNDS_PER_GAME && (

              <div className="w-full flex flex-col items-center gap-6 py-6">

                <div className="w-full max-w-4xl bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl p-8">

                  <h2 className="text-center text-3xl font-bold text-yellow-400">
                    Last Turn Recap
                  </h2>

                  <div className="flex flex-wrap justify-center gap-6 mt-6">

                    {turnRecap.icons.map(icon => (
                      <div key={icon.id} className="flex flex-col items-center">

                        <div
                          className="h-14 w-14 rounded-full flex items-center justify-center"
                          style={{ background: icon.color || "#ff3b30" }}
                        >

                          {icon.image_url ? (
                            <img
                              src={icon.image_url}
                              alt={icon.name}
                              className="h-10 w-10 object-contain filter brightness-0 invert"
                            />
                          ) : (
                            <span className="text-white text-2xl">
                              {icon.icon}
                            </span>
                          )}

                        </div>

                        <span className="text-xs mt-2 text-yellow-400">
                          {icon.name}
                        </span>

                      </div>
                    ))}

                  </div>

                  {/* Wisp */}

                  <div className="mt-6 mb-6 bg-[#2a230f] border border-yellow-700 rounded-xl p-6 text-center">

                    <div className="text-yellow-400 text-sm">
                      The Wisp
                    </div>

                    <div className="text-4xl font-bold text-yellow-300 mt-2">
                      {turnRecap.whisp}
                    </div>

                  </div>
                  <div className="w-full">

                    <div className="rounded-xl border border-[#28222e] overflow-hidden">

                      <div className="px-6 py-4 text-center border-b border-[#28222e]">
                        <span className="text-[#ffe066] font-bold text-lg">
                          Scoreboard (After This Turn)
                        </span>
                      </div>

                      <table className="w-full text-base">

                        <tbody>

                          {turnRecap.players.map((player, idx) => {

                            const outcome =
                              turnRecap.playerOutcomes[player.player_id]

                            let badgeClass = ""
                            let badgeText = ""

                            if (outcome === "correct") {
                              badgeClass = "bg-[#232e1b] text-[#aaff66] border border-[#aaff66]"
                              badgeText = "Correct"
                            }
                            else if (outcome === "wrong") {
                              badgeClass = "bg-[#2e1b1b] text-[#ff6666] border border-[#ff6666]"
                              badgeText = "Wrong"
                            }
                            else if (outcome === "storyteller") {
                              badgeClass = "bg-[#1b233a] text-[#66aaff] border border-[#66aaff]"
                              badgeText = "Storyteller"
                            }
                            else {
                              badgeClass = "bg-[#23202a] text-[#bdbdbd] border border-[#444]"
                              badgeText = "No Guess"
                            }

                            return (
                              <tr
                                key={player.player_id}
                                className="border-b border-[#28222e] last:border-none"
                              >

                                <td className="px-6 py-4 flex items-center gap-3">

                                  <span className="text-[#ffe066] font-bold text-lg">
                                    {idx + 1}.
                                  </span>

                                  <span className="text-[#ffe066] font-bold">
                                    {player.name}
                                  </span>

                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                                    {badgeText}
                                  </span>

                                </td>

                                <td className="px-6 py-4 text-right">
                                  <span className="text-[#ffe066] font-bold text-lg">
                                    {player.score} pts
                                  </span>
                                </td>

                              </tr>
                            )

                          })}

                        </tbody>

                      </table>

                    </div>

                  </div>

                </div>

                {/* ================= FINAL ROUND SUMMARY ================= */}
                <div className="w-full flex flex-col items-center gap-6 py-6">
                  <div className="w-full max-w-6xl">

                    <h2 className="text-3xl font-bold text-center mb-6">
                      Final Summary
                    </h2>
                    <div className="w-full border rounded-xl overflow-hidden">
                      <table className="w-full table-fixed border rounded-lg">
                        <thead>
                          <tr className="border-b bg-muted/30">

                            <th className="px-3 py-3 text-left">Player</th>

                            {Array.from({ length: cumulativeRoundSummary.rounds }).map((_, r) => (

                              <React.Fragment key={r}>

                                {Array.from({ length: cumulativeRoundSummary.turnsPerRound }).map((_, t) => (
                                  <th key={t} className="px-3 py-3 text-center">
                                    R{r + 1} T{t + 1}
                                  </th>
                                ))}

                                <th className="px-3 py-3 text-center bg-muted/20">
                                  R{r + 1} Total
                                </th>

                              </React.Fragment>

                            ))}

                            <th className="px-3 py-3 text-center bg-primary/10">
                              Total
                            </th>

                          </tr>
                        </thead>


                        <tbody>

                          {cumulativeRoundSummary.rows.map(row => (

                            <tr key={row.playerId} className="border-b">

                              <td className="px-3 py-3">
                                {row.name}
                              </td>

                              {row.roundTurnPoints.map((turns, r) => (

                                <React.Fragment key={r}>

                                  {turns.map((points, t) => (

                                    <td key={t} className="text-center">
                                      {points}
                                    </td>

                                  ))}

                                  <td className="text-center bg-muted/20">
                                    {row.roundTotals[r]}
                                  </td>

                                </React.Fragment>

                              ))}

                              <td className="text-center font-semibold bg-primary/10">
                                {players.find(p => p.player_id === row.playerId)?.score ?? row.total}
                              </td>

                            </tr>

                          ))}

                        </tbody>

                      </table>

                    </div>
                  </div>

                  {/* ================= BACK BUTTON ================= */}

                  <div className="flex justify-center mt-6">

                    <Button
                      onClick={() => navigate("/play/host")}
                      className="gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Home
                    </Button>

                  </div>

                </div>

              </div>

            )}

          </div>

        </DialogContent>
      </Dialog>
    </div >
  );
}
