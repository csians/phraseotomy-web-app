import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Send, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Element {
  id: string;
  name: string;
  icon: string;
}

interface StorytellingInterfaceProps {
  theme: { id: string; name: string };
  elements: Element[];
  sessionId: string;
  playerId: string;
  turnId: string;
  onStoryComplete: () => void;
}

export function StorytellingInterface({
  theme,
  elements,
  sessionId,
  playerId,
  turnId,
  onStoryComplete,
}: StorytellingInterfaceProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_RECORDING_TIME = 180; // 3 minutes in seconds

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedAudio(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_RECORDING_TIME) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Microphone Error",
        description: "Could not access your microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleSubmitStory = async () => {
    if (!recordedAudio) {
      toast({
        title: "No Recording",
        description: "Please record your story first.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Upload audio to storage
      const fileName = `turn_${turnId}_${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("audio_uploads")
        .upload(fileName, recordedAudio);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("audio_uploads")
        .getPublicUrl(fileName);

      // Update turn with recording URL
      const { error: updateError } = await supabase
        .from("game_turns")
        .update({ 
          recording_url: publicUrl,
          completed_at: new Date().toISOString()
        })
        .eq("id", turnId);

      if (updateError) throw updateError;

      toast({
        title: "Story Submitted!",
        description: "Other players can now guess your elements.",
      });

      onStoryComplete();
    } catch (error) {
      console.error("Error submitting story:", error);
      toast({
        title: "Upload Failed",
        description: "Could not submit your story. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              <span className="text-primary">Tell your story</span> using these elements
            </CardTitle>
            <CardDescription className="text-center text-lg">
              Theme: {theme.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Your Elements</h3>
              <div className="flex gap-3 flex-wrap justify-center">
                {elements.map((element) => (
                  <div
                    key={element.id}
                    className="flex items-center justify-center w-20 h-20 rounded-lg bg-muted border-2 border-border"
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">{element.icon}</div>
                      <p className="text-xs font-medium">{element.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-6">
              {!recordedAudio ? (
                <div className="space-y-4">
                  {isRecording && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">
                        {formatTime(recordingTime)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Max: {formatTime(MAX_RECORDING_TIME)}
                      </p>
                    </div>
                  )}
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    className="w-full"
                  >
                    {isRecording ? (
                      <>
                        <Square className="mr-2 h-5 w-5" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-5 w-5" />
                        Start Recording
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <audio controls src={URL.createObjectURL(recordedAudio)} className="w-full" />
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setRecordedAudio(null)}
                      variant="outline"
                      className="flex-1"
                    >
                      Re-record
                    </Button>
                    <Button
                      onClick={handleSubmitStory}
                      disabled={isUploading}
                      className="flex-1"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isUploading ? "Submitting..." : "Submit Story"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Craft a creative story using the elements above. Other players will listen and try to guess which elements you used!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
