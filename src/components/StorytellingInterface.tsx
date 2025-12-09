import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Send, Lightbulb, AlertCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IconSelectionPanel, IconItem } from "@/components/IconSelectionPanel";

interface StorytellingInterfaceProps {
  theme: { id: string; name: string };
  whisp: string;
  sessionId: string;
  playerId: string;
  turnId: string;
  onStoryComplete: () => void;
  isStoryteller: boolean;
  storytellerName: string;
  sendWebSocketMessage?: (message: any) => void;
  selectedIcons?: IconItem[];
  turnMode?: "audio" | "elements";
}

export function StorytellingInterface({
  theme,
  whisp,
  sessionId,
  playerId,
  turnId,
  onStoryComplete,
  isStoryteller,
  storytellerName,
  sendWebSocketMessage,
  selectedIcons = [],
  turnMode = "audio",
}: StorytellingInterfaceProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [orderedIcons, setOrderedIcons] = useState<IconItem[]>(selectedIcons);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_RECORDING_TIME = 180; // 3 minutes in seconds

  useEffect(() => {
    setOrderedIcons(selectedIcons);
  }, [selectedIcons]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleIconOrderChange = async (newOrder: IconItem[]) => {
    setOrderedIcons(newOrder);
    
    // Save reordered icon IDs to database (order is preserved in the array)
    const reorderedIconIds = newOrder.map((icon) => icon.id);
    try {
      await supabase.functions.invoke("update-icon-order", {
        body: { turnId, reorderedIconIds },
      });
      
      toast({
        title: "Elements Updated",
        description: "Element order saved",
      });
      
      // Notify other players
      sendWebSocketMessage?.({
        type: "icons_reordered",
        reorderedIconIds,
      });
    } catch (error) {
      console.error("Error updating icon order:", error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          
          // Stream audio chunk to other players via WebSocket
          if (sendWebSocketMessage) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              const base64Audio = base64data.split(',')[1];
              
              sendWebSocketMessage({
                type: "audio_chunk",
                audioData: base64Audio,
              });
            };
            reader.readAsDataURL(event.data);
          }
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedAudio(blob);
        stream.getTracks().forEach((track) => track.stop());
        
        sendWebSocketMessage?.({
          type: "recording_stopped",
        });
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      sendWebSocketMessage?.({
        type: "recording_started",
      });

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

      // Update turn with recording URL and mark as completed
      const { error: updateError } = await supabase
        .from("game_turns")
        .update({ 
          recording_url: publicUrl,
          completed_at: new Date().toISOString()
        })
        .eq("id", turnId);

      if (updateError) throw updateError;

      // Notify others via WebSocket
      sendWebSocketMessage?.({
        type: "story_submitted",
        audioUrl: publicUrl,
        selectedIcons: orderedIcons,
      });

      toast({
        title: "Story Submitted!",
        description: "Other players can now guess your whisp.",
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
      <div className="w-full max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              {isStoryteller ? (
                <span className="text-primary">Tell Your Story</span>
              ) : (
                <span className="text-primary">{storytellerName} is telling a story</span>
              )}
            </CardTitle>
            <CardDescription className="text-center text-lg">
              Theme: {theme.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Icons Display - only show in elements mode */}
            {turnMode === "elements" && orderedIcons.length > 0 && (
              <div className="bg-muted/30 p-6 rounded-xl">
                <IconSelectionPanel
                  icons={orderedIcons}
                  onOrderChange={isStoryteller ? handleIconOrderChange : undefined}
                  isDraggable={isStoryteller}
                  label={isStoryteller ? "Your Story Icons (drag to reorder)" : "Story Icons"}
                />
              </div>
            )}

            {/* Whisp display - only visible to storyteller */}
            {isStoryteller && whisp && (
              <div className="bg-primary/10 p-6 rounded-lg border-2 border-primary/20">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <h3 className="text-xl font-semibold text-primary">Your Secret Whisp</h3>
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-4xl font-bold text-center text-primary mb-3">{whisp}</p>
                <p className="text-sm text-muted-foreground text-center">
                  Use the icons above to help tell a story about this word. Other players will guess what it is!
                </p>
              </div>
            )}

            {/* Non-storyteller waiting view */}
            {!isStoryteller && (
              <div className="bg-muted/50 p-6 rounded-lg text-center">
                <Mic className="h-12 w-12 mx-auto mb-3 text-muted-foreground animate-pulse" />
                <p className="text-lg font-medium text-muted-foreground">
                  Waiting for {storytellerName} to record their story...
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Look at the icons above for clues and try to guess the whisp word!
                </p>
              </div>
            )}

            {/* Recording section - only for storyteller */}
            {isStoryteller && (
              <div className="border-t border-border pt-6">
                <h3 className="text-lg font-semibold mb-3">Record Your Story</h3>
                
                {!whisp && (
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Waiting for whisp to be generated...
                    </AlertDescription>
                  </Alert>
                )}

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
                      disabled={!whisp}
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
                        Record Again
                      </Button>
                      <Button
                        onClick={handleSubmitStory}
                        disabled={isUploading}
                        className="flex-1"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {isUploading ? "Sending..." : "Send Story"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tips */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  {isStoryteller 
                    ? turnMode === "audio"
                      ? "Tell a creative story that describes your whisp word without saying it directly. Other players will listen and try to guess!"
                      : "Use the icons to guide your story! Arrange them in the order you'll reference them, then tell a creative story that describes your whisp word without saying it directly."
                    : turnMode === "audio"
                      ? "Listen carefully to the story and try to guess the whisp word based on the clues!"
                      : "Watch the icons and listen carefully to the story. Try to guess the whisp word based on the clues!"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
