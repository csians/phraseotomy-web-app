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
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; duration: number; url: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
        mimeType: "audio/webm",
      });

      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const durationSeconds = (Date.now() - recordingStartTime.current) / 1000;
        const audioUrl = URL.createObjectURL(audioBlob);

        setRecordedAudio({ blob: audioBlob, duration: durationSeconds, url: audioUrl });

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        toast({
          title: "Recording Complete",
          description: "Review your recording and click Save to upload",
        });
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

  const handleSaveRecording = async () => {
    if (!recordedAudio) return;

    setIsSaving(true);
    try {
      const formData = new FormData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      formData.append("audio", recordedAudio.blob, `lobby-recording-${timestamp}.webm`);
      formData.append("customer_id", customerId);
      formData.append("shop_domain", shopDomain);
      formData.append("tenant_id", tenantId);
      formData.append("session_id", sessionId);
      formData.append("round_number", "1");
      formData.append("duration_seconds", recordedAudio.duration.toFixed(2));
      formData.append("mime_type", "audio/webm");

      console.log("lobby audio");

      const { data, error } = await supabase.functions.invoke("upload-customer-audio", {
        body: formData,
      });

      console.log("data from lobby upload", data);

      if (error) throw error;

      toast({
        title: "Recording Saved",
        description: "Your recording has been uploaded successfully!",
      });

      // Clean up blob URL
      URL.revokeObjectURL(recordedAudio.url);
      setRecordedAudio(null);

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
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardRecording = () => {
    if (recordedAudio) {
      URL.revokeObjectURL(recordedAudio.url);
      setRecordedAudio(null);
    }
    setRecordingTime(0);
    toast({
      title: "Recording Discarded",
      description: "You can record again",
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const remainingTime = MAX_RECORDING_TIME - recordingTime;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Record Audio
        </CardTitle>
        <CardDescription>Record audio for this game (maximum 3 minutes)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-4">
          {!isRecording && !recordedAudio && (
            <Button onClick={startRecording} size="lg" className="w-full" variant="default">
              <Mic className="mr-2 h-5 w-5" />
              Start Recording
            </Button>
          )}

          {isRecording && (
            <>
              <Button onClick={stopRecording} size="lg" variant="destructive" className="w-full animate-pulse">
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
                  <p className="text-xs text-destructive text-center font-medium">{remainingTime} seconds remaining</p>
                )}
              </div>
            </>
          )}

          {recordedAudio && !isRecording && (
            <div className="w-full space-y-3">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Preview Recording</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(Math.floor(recordedAudio.duration))}
                  </span>
                </div>
                <audio controls src={recordedAudio.url} className="w-full" />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleDiscardRecording} variant="outline" className="flex-1" disabled={isSaving}>
                  Re-record
                </Button>
                <Button onClick={handleSaveRecording} className="flex-1" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Recording"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {hasRecording && !isRecording && !recordedAudio && (
          <div className="pt-4 border-t border-border">
            <Button onClick={onStartGame} className="w-full" size="lg">
              <Music className="mr-2 h-5 w-5" />
              Start Game
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {recordedAudio
            ? "Listen to your recording before saving"
            : "Recording will automatically stop after 3 minutes"}
        </p>
      </CardContent>
    </Card>
  );
};
