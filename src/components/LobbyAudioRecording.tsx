import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Square, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LobbyAudioRecordingProps {
  sessionId: string;
  customerId: string;
  shopDomain: string;
  tenantId: string;
  onRecordingComplete?: (audioId: string) => void;
  onStartGame?: () => void;
  hasRecording: boolean;
}

export const LobbyAudioRecording = ({
  sessionId,
  customerId,
  shopDomain,
  tenantId,
  onRecordingComplete,
  onStartGame,
  hasRecording,
}: LobbyAudioRecordingProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const { toast } = useToast();
  const recordingStartTime = useRef<number>(0);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const MAX_RECORDING_TIME = 180; // 3 minutes in seconds

  useEffect(() => {
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const durationSeconds = (Date.now() - recordingStartTime.current) / 1000;
        
        await uploadRecording(audioBlob, durationSeconds, 'audio/webm');

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      recordingStartTime.current = Date.now();
      setRecordingTime(0);
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);

      // Start timer
      timerInterval.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime.current) / 1000);
        setRecordingTime(elapsed);

        // Auto-stop at max time
        if (elapsed >= MAX_RECORDING_TIME) {
          stopRecording();
        }
      }, 100);

      toast({
        title: "Recording Started",
        description: "Maximum recording time is 3 minutes",
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Recording Error",
        description: "Could not access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    }
  };

  const uploadRecording = async (audioBlob: Blob, durationSeconds: number, mimeType: string) => {
    try {
      const formData = new FormData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      formData.append('audio', audioBlob, `lobby-recording-${timestamp}.webm`);
      formData.append('customer_id', customerId);
      formData.append('shop_domain', shopDomain);
      formData.append('tenant_id', tenantId);
      formData.append('duration_seconds', durationSeconds.toFixed(2));
      formData.append('mime_type', mimeType);

      const { data, error } = await supabase.functions.invoke('upload-customer-audio', {
        body: formData,
      });

      if (error) throw error;

      toast({
        title: "Recording Uploaded",
        description: "Your recording has been saved!",
      });

      if (onRecordingComplete && data?.audio_id) {
        onRecordingComplete(data.audio_id);
      }
    } catch (error) {
      console.error("Error uploading recording:", error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Could not upload recording",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const remainingTime = MAX_RECORDING_TIME - recordingTime;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Record Audio
        </CardTitle>
        <CardDescription>
          Record audio for this game (maximum 3 minutes)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-4">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              size="lg"
              className="w-full"
              variant="default"
            >
              <Mic className="mr-2 h-5 w-5" />
              Start Recording
            </Button>
          ) : (
            <>
              <Button
                onClick={stopRecording}
                size="lg"
                variant="destructive"
                className="w-full animate-pulse"
              >
                <Square className="mr-2 h-5 w-5" />
                Stop Recording
              </Button>
              
              <div className="w-full space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-destructive">
                    <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                    <span className="font-medium">Recording...</span>
                  </div>
                  <span className="font-mono text-muted-foreground">
                    {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
                  </span>
                </div>
                
                <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-destructive transition-all duration-100"
                    style={{ width: `${(recordingTime / MAX_RECORDING_TIME) * 100}%` }}
                  />
                </div>
                
                {remainingTime <= 30 && (
                  <p className="text-xs text-destructive text-center font-medium">
                    {remainingTime} seconds remaining
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {hasRecording && !isRecording && (
          <div className="pt-4 border-t border-border">
            <Button 
              onClick={onStartGame} 
              className="w-full"
              size="lg"
            >
              <Music className="mr-2 h-5 w-5" />
              Start Game
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Recording will automatically stop after 3 minutes
        </p>
      </CardContent>
    </Card>
  );
};
