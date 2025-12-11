import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface GameTimerProps {
  totalSeconds: number;
  startTime?: string | null;
  onTimeUp?: () => void;
  label?: string;
}

export function GameTimer({ totalSeconds, startTime, onTimeUp, label }: GameTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);

  useEffect(() => {
    // Calculate initial remaining time based on when the phase started
    let initialRemaining = totalSeconds;
    
    if (startTime) {
      const startDate = new Date(startTime);
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - startDate.getTime()) / 1000);
      initialRemaining = Math.max(0, totalSeconds - elapsedSeconds);
    }
    
    setRemainingSeconds(initialRemaining);

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [totalSeconds, startTime, onTimeUp]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isLow = remainingSeconds <= 30;
  const isCritical = remainingSeconds <= 10;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold transition-colors ${
      isCritical 
        ? "bg-destructive/20 text-destructive animate-pulse" 
        : isLow 
          ? "bg-yellow-500/20 text-yellow-600" 
          : "bg-primary/10 text-primary"
    }`}>
      <Clock className="h-5 w-5" />
      {label && <span className="text-sm font-normal mr-2">{label}</span>}
      <span>{formatTime(remainingSeconds)}</span>
    </div>
  );
}
