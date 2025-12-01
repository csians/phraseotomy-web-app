import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Send, Lightbulb, AlertCircle, Brain, Sparkles, Lightbulb as LightbulbIcon, Zap, Heart } from "lucide-react";
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
  isStoryteller: boolean;
  storytellerName: string;
  sendWebSocketMessage?: (message: any) => void;
}

export function StorytellingInterface({
  theme,
  elements,
  sessionId,
  playerId,
  turnId,
  onStoryComplete,
  isStoryteller,
  storytellerName,
  sendWebSocketMessage,
}: StorytellingInterfaceProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [secretElement, setSecretElement] = useState<string | null>(null);
  const [whisp, setWhisp] = useState<string>("");
  const [isLoadingWhisp, setIsLoadingWhisp] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const iconMap: Record<string, any> = {
    Brain, Sparkles, Lightbulb: LightbulbIcon, Zap, Heart
  };

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
          
          // Stream audio chunk to other players via WebSocket
          if (sendWebSocketMessage) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              const base64Audio = base64data.split(',')[1]; // Remove data:audio/webm;base64, prefix
              
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
        
        // Notify others recording stopped
        sendWebSocketMessage?.({
          type: "recording_stopped",
        });
      };

      // Request data every 100ms for real-time streaming
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      // Notify others recording started
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

    if (!secretElement) {
      toast({
        title: "Select Secret Element",
        description: "Please choose which element you're describing.",
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
      });

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
              {isStoryteller ? (
                <span className="text-primary">Tell your story</span>
              ) : (
                <span className="text-primary">{storytellerName} is telling a story</span>
              )}
            </CardTitle>
            <CardDescription className="text-center text-lg">
              Theme: {theme.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">
                {isStoryteller ? "Step 1: Select Your Secret Element" : "The 5 Elements"}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {isStoryteller 
                  ? "Choose ONE element to describe - others will guess which one" 
                  : "The storyteller will pick one of these elements and give a clue"}
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                {elements.map((element) => {
                  const IconComponent = iconMap[element.icon] || Brain;
                  const isSelected = secretElement === element.id;
                  return (
                    <button
                      key={element.id}
                      onClick={async () => {
                        if (isStoryteller) {
                          setSecretElement(element.id);
                          setIsLoadingWhisp(true);
                          
                          try {
                            console.log("Generating whisp for element:", element.name, "theme:", theme.name);
                            
                            // Generate whisp (one-word hint)
                            const { data: whispData, error: whispError } = await supabase.functions.invoke("generate-whisp", {
                              body: { 
                                elementName: element.name,
                                themeName: theme.name 
                              },
                            });

                            console.log("Whisp response:", whispData, "error:", whispError);

                            if (whispError) {
                              console.error("Whisp generation error:", whispError);
                              throw whispError;
                            }

                            if (!whispData || !whispData.whisp) {
                              throw new Error("No whisp data returned");
                            }

                            const generatedWhisp = whispData.whisp;
                            console.log("Generated whisp:", generatedWhisp);
                            setWhisp(generatedWhisp);

                            // Update turn with whisp and secret element
                            const { error: updateError } = await supabase
                              .from("game_turns")
                              .update({ 
                                whisp: generatedWhisp,
                                secret_element: element.id 
                              })
                              .eq("id", turnId);

                            if (updateError) {
                              console.error("Error updating turn:", updateError);
                            }
                            
                            // Notify others via WebSocket
                            sendWebSocketMessage?.({
                              type: "secret_element_selected",
                              elementId: element.id,
                            });

                            toast({
                              title: "Whisp Generated! ✨",
                              description: `Your hint word is: "${generatedWhisp}"`,
                            });
                          } catch (error) {
                            console.error("Error generating whisp:", error);
                            toast({
                              title: "Error",
                              description: error instanceof Error ? error.message : "Failed to generate hint. Please try again.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsLoadingWhisp(false);
                          }
                        }
                      }}
                      disabled={!isStoryteller || recordedAudio !== null}
                      className={`flex flex-col items-center justify-center w-24 h-24 rounded-lg transition-all ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary' 
                          : 'bg-muted border-2 border-border hover:bg-muted/80'
                      } ${(!isStoryteller || recordedAudio) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <IconComponent className="h-8 w-8 mb-1" />
                      <p className="text-xs font-medium text-center">{element.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {isStoryteller && whisp && (
              <div className="bg-primary/10 p-4 rounded-lg border-2 border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-primary">Your Whisp (Hint)</h3>
                </div>
                <p className="text-2xl font-bold text-center text-primary">{whisp}</p>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Use this word as inspiration for your story!
                </p>
              </div>
            )}

            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold mb-3">
                {isStoryteller ? "Step 2: Record Your Story" : "Waiting for Story"}
              </h3>
              {isStoryteller ? (
                <>
                  {(!secretElement || isLoadingWhisp) && (
                    <Alert className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {isLoadingWhisp ? "Generating your whisp (hint)..." : "Please select your secret element first"}
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
                        disabled={!secretElement || isLoadingWhisp}
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
                </>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-flex items-center gap-2 text-muted-foreground">
                    <Mic className="h-5 w-5 animate-pulse" />
                    <p className="text-lg">Waiting for {storytellerName} to record...</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The storyteller is choosing their secret element and will record a clue
                  </p>
                </div>
              )}
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  {isStoryteller 
                    ? "Use your whisp (hint word) as inspiration! Craft a creative story that describes your secret element. Other players will listen and try to guess which element you used!"
                    : "Listen carefully when the storyteller records their clue, then you'll have 3 attempts to guess which element they described!"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
