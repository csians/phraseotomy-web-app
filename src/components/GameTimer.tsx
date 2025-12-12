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

  // Keep onTimeUp ref updated
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // Calculate remaining time based on current time - recalculates on every call
  const calculateRemaining = useCallback(() => {
    if (!startTime) return totalSeconds;
    
    const startDate = new Date(startTime);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - startDate.getTime()) / 1000);
    
    // Clamp between 0 and totalSeconds to prevent negative or huge values
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
