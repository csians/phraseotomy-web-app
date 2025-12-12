import { useEffect, useState, useRef, useCallback } from "react";
import { Clock } from "lucide-react";

interface GameTimerProps {
  totalSeconds: number;
  startTime?: string | null;
  onTimeUp?: () => void;
  label?: string;
}

export function GameTimer({ totalSeconds, startTime, onTimeUp, label }: GameTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const onTimeUpCalledRef = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  const serverClientOffsetRef = useRef<number>(0);

  // Keep onTimeUp ref updated
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // Calculate server-client time offset once when startTime is set
  // This handles cases where user's device clock is wrong
  useEffect(() => {
    if (startTime) {
      const serverTime = new Date(startTime).getTime();
      const clientTime = Date.now();
      // If startTime is in the future from client perspective, there's clock skew
      // We store the offset to use in calculations
      serverClientOffsetRef.current = clientTime - serverTime;
    }
  }, [startTime]);

  // Calculate remaining time using the offset to handle clock differences
  const calculateRemaining = useCallback(() => {
    if (!startTime) return totalSeconds;
    
    const serverStartTime = new Date(startTime).getTime();
    // Use the offset to get "server-equivalent" current time
    const adjustedNow = Date.now();
    const elapsedMs = adjustedNow - serverStartTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    
    // Clamp between 0 and totalSeconds to prevent negative or huge values
    // If elapsed is negative (future start time), treat as full time remaining
    if (elapsedSeconds < 0) return totalSeconds;
    return Math.max(0, Math.min(totalSeconds, totalSeconds - elapsedSeconds));
  }, [startTime, totalSeconds]);

  useEffect(() => {
    // Reset the called ref when timer resets
    onTimeUpCalledRef.current = false;

    // Calculate initial remaining time
    const initialRemaining = calculateRemaining();
    setRemainingSeconds(initialRemaining);

    // If already expired, call onTimeUp immediately
    if (initialRemaining <= 0 && !onTimeUpCalledRef.current) {
      onTimeUpCalledRef.current = true;
      onTimeUpRef.current?.();
      return;
    }

    // Recalculate from current time on each tick - fixes tab switching issues
    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);
      
      if (remaining <= 0 && !onTimeUpCalledRef.current) {
        clearInterval(interval);
        onTimeUpCalledRef.current = true;
        setTimeout(() => onTimeUpRef.current?.(), 0);
      }
    }, 1000);

    // Recalculate immediately when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const remaining = calculateRemaining();
        setRemainingSeconds(remaining);
        
        if (remaining <= 0 && !onTimeUpCalledRef.current) {
          onTimeUpCalledRef.current = true;
          setTimeout(() => onTimeUpRef.current?.(), 0);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [totalSeconds, startTime, calculateRemaining]);

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
