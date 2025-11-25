import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TurnRecordingProps {
  sessionId: string;
  playerId: string;
  roundNumber: number;
  onRecordingComplete?: (audioId: string) => void;
}

export const TurnRecording = ({
  sessionId,
  playerId,
  roundNumber,
  onRecordingComplete,
}: TurnRecordingProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const { toast } = useToast();
  const recordingStartTime = useRef<number>(0);

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
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);

      toast({
        title: "Recording Started",
        description: "Speak now...",
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
    }
  };

  const uploadRecording = async (audioBlob: Blob, durationSeconds: number, mimeType: string) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('session_id', sessionId);
      formData.append('player_id', playerId);
      formData.append('round_number', roundNumber.toString());
      formData.append('duration_seconds', durationSeconds.toFixed(2));
      formData.append('mime_type', mimeType);

      const { data, error } = await supabase.functions.invoke('upload-audio', {
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

  return (
    <Card className="bg-card border-game-gray">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Your Turn
        </CardTitle>
        <CardDescription>
          Record your audio for this round
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              size="lg"
              className="bg-game-yellow hover:bg-game-yellow/90 text-game-black font-bold"
            >
              <Mic className="mr-2 h-5 w-5" />
              Start Recording
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              size="lg"
              variant="destructive"
              className="animate-pulse"
            >
              <Square className="mr-2 h-5 w-5" />
              Stop Recording
            </Button>
          )}
        </div>

        {isRecording && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-red-500">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium">Recording...</span>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Supported format: Audio recording (WebM)
        </p>
      </CardContent>
    </Card>
  );
};
