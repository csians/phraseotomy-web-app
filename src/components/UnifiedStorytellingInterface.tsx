import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconItem } from "@/components/IconSelectionPanel";
import { Loader2, Mic, Square, Send, GripVertical, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Theme {
  id: string;
  name: string;
  icon: string;
}

interface ThemeElement {
  id: string;
  name: string;
  icon: string;
  image_url?: string | null;
  color?: string | null;
}

interface UnifiedStorytellingInterfaceProps {
  theme: Theme;
  whisp: string;
  sessionId: string;
  playerId: string;
  turnId: string;
  onStoryComplete: () => void;
  isStoryteller: boolean;
  storytellerName: string;
  sendWebSocketMessage: (msg: any) => void;
  coreElements: IconItem[];
}

function SortableElement({
  element,
  index,
  isDraggable,
}: {
  element: IconItem;
  index: number;
  isDraggable: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id, disabled: !isDraggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const bgColor = element.color || (element.isFromCore ? "#8B5CF6" : "#6B7280");

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, touchAction: isDraggable ? "none" : "auto" }}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      className={cn(
        "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-w-[100px]",
        isDragging
          ? "bg-primary/20 border-primary shadow-lg scale-105"
          : "bg-card border-border hover:border-primary/50",
        element.isFromCore && "ring-2 ring-offset-2 ring-primary/30",
        isDraggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      {isDraggable && (
        <div className="absolute top-1 right-1 p-2 sm:p-1 rounded-md bg-muted/50 hover:bg-muted pointer-events-none">
          <GripVertical className="h-4 w-4 sm:h-3 sm:w-3 text-muted-foreground" />
        </div>
      )}

      <div className="text-xs text-muted-foreground font-medium">{index + 1}</div>

      <div
        className="h-14 w-14 rounded-full flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: bgColor }}
      >
        {element.image_url ? (
          <img
            src={element.image_url}
            alt={element.name}
            className="h-8 w-8 object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        ) : (
          <Sparkles className="h-6 w-6 text-white" />
        )}
      </div>

      <span className="text-xs font-medium text-center">{element.name}</span>

      {element.isFromCore && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Core</span>
      )}
    </div>
  );
}

export function UnifiedStorytellingInterface({
  theme,
  whisp,
  sessionId,
  playerId,
  turnId,
  onStoryComplete,
  isStoryteller,
  storytellerName,
  sendWebSocketMessage,
  coreElements,
}: UnifiedStorytellingInterfaceProps) {
  const { toast } = useToast();
  const [orderedElements, setOrderedElements] = useState<IconItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const MAX_RECORDING_TIME_SECONDS = 180;
  const MIN_RECORDING_TIME_SECONDS = 20;
  const maxReachedRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const allElements = [...coreElements];

    setOrderedElements((previousOrder) => {
      if (previousOrder.length === 0) {
        return allElements;
      }

      const allIds = new Set(allElements.map((item) => item.id));
      const kept = previousOrder.filter((item) => allIds.has(item.id));
      const keptIds = new Set(kept.map((item) => item.id));
      const newItems = allElements.filter((item) => !keptIds.has(item.id));
      return [...kept, ...newItems];
    });
  }, [coreElements]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedElements((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedAudio(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      maxReachedRef.current = false;

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_RECORDING_TIME_SECONDS) {
            if (!maxReachedRef.current) {
              maxReachedRef.current = true;
              toast({
                title: "Recording stopped",
                description: "Maximum recording time is 3 minutes.",
              });
            }
            setTimeout(() => stopRecording(), 0);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      sendWebSocketMessage({
        type: "recording_started",
        storytellerId: playerId,
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
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
        timerRef.current = null;
      }

      sendWebSocketMessage({
        type: "recording_stopped",
        storytellerId: playerId,
      });
    }
  };

  const handleSubmit = async () => {
    if (!recordedAudio) {
      toast({
        title: "Recording Required",
        description: "Please record your story before submitting",
        variant: "destructive",
      });
      return;
    }

    if (recordingTime < MIN_RECORDING_TIME_SECONDS) {
      toast({
        title: "Recording Too Short",
        description: `Recording must be at least ${MIN_RECORDING_TIME_SECONDS} seconds.`,
        variant: "destructive",
      });
      return;
    }

    if (orderedElements.length !== coreElements.length) {
      toast({
        title: "Arrange Elements",
        description: "Please arrange the assigned elements before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const iconIds = orderedElements.map((e) => e.id);
      const iconOrder = orderedElements.map((_, idx) => idx);

      const { error: elementUpdateError } = await supabase
        .from("game_turns")
        .update({
          selected_icon_ids: iconIds,
          icon_order: iconOrder,
        })
        .eq("id", turnId)
        .select("id, selected_icon_ids, icon_order")
        .single();

      if (elementUpdateError) throw elementUpdateError;

      sendWebSocketMessage({
        type: "elements_selected",
        turnId,
        iconIds,
      });

      const fileName = `${sessionId}/${turnId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("audio_uploads")
        .upload(fileName, recordedAudio, {
          contentType: "audio/webm",
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("audio_uploads").getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("game_turns")
        .update({
          recording_url: publicUrl,
          completed_at: new Date().toISOString(),
          turn_mode: "audio",
        })
        .eq("id", turnId)
        .select("id, recording_url, completed_at, turn_mode")
        .single();

      if (updateError) throw updateError;

      sendWebSocketMessage({
        type: "story_submitted",
        turnId,
        hasRecording: true,
      });

      toast({
        title: "Story Submitted! 🎉",
        description: "Waiting for other players to guess...",
      });

      onStoryComplete();
    } catch (error) {
      console.error("Error submitting story:", error);
      toast({
        title: "Error",
        description: "Failed to submit story",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isStoryteller) {
    return (
      <div className="w-full flex justify-center items-start px-0 py-2 sm:px-2 sm:py-3 sm:min-h-screen-safe sm:items-center">
        <Card className="w-full rounded-none border-0 shadow-none sm:h-auto sm:rounded-xl sm:border sm:shadow-sm sm:max-w-2xl sm:max-h-[calc(100vh-1.5rem)] sm:overflow-y-auto">
          <CardHeader className="text-center pb-3 pt-4 sm:pt-6 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl md:text-2xl">
              {storytellerName} is creating their story
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">Get ready to guess the secret wisp word!</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2 pb-safe sm:gap-4 sm:pb-6">
            <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 animate-spin text-primary" />
            <p className="text-xs sm:text-sm text-muted-foreground">Waiting for the storyteller to finish...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full sm:min-h-screen-safe flex justify-center items-start sm:items-center px-0 py-0 sm:px-2 sm:py-3">
      <Card className="w-full h-full rounded-none border-0 shadow-none sm:h-auto sm:rounded-xl sm:border sm:shadow-sm sm:max-w-5xl sm:max-h-[calc(100vh-2rem)] sm:overflow-y-auto">
        <CardHeader className="text-center px-3 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl">Tell Your Story</CardTitle>
          <CardDescription className="text-sm sm:text-base">Theme: {theme?.name || "Unknown"}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 sm:space-y-6 px-3 pb-safe sm:px-6 sm:pb-6">
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Your Secret Wisp</p>
            <p className="text-2xl font-bold text-primary">{whisp}</p>
            <p className="text-xs text-muted-foreground mt-2">Don't say this word. Describe it using your selected elements.</p>
          </div>

          <div className="space-y-5">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Your 5 Auto-assigned Icons</h3>
              <p className="text-sm text-muted-foreground">
                3 theme icons + 1 emotion icon + 1 event icon are assigned automatically each turn.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Arrange Story Order</h3>
              <p className="text-sm text-muted-foreground">Drag and drop icons in the order you will describe them</p>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedElements.map((e) => e.id)} strategy={horizontalListSortingStrategy}>
                <div className="flex flex-wrap gap-4 justify-center py-2">
                  {orderedElements.map((element, index) => (
                    <SortableElement key={element.id} element={element} index={index} isDraggable={true} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Record and Submit</h3>
              <p className="text-sm text-muted-foreground">Record your story, then submit it for guessing</p>
            </div>
            <div className="flex flex-col items-center gap-4 py-2">
              {!recordedAudio ? (
                <>
                  <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    onClick={isRecording ? stopRecording : startRecording}
                    className="h-16 w-16 rounded-full"
                  >
                    {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>
                  {isRecording ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-lg font-mono">{formatTime(recordingTime)}</span>
                        <span className="text-sm text-muted-foreground">/ {formatTime(MAX_RECORDING_TIME_SECONDS)}</span>
                      </div>
                      {recordingTime >= MAX_RECORDING_TIME_SECONDS - 30 && (
                        <span className="text-xs text-destructive font-medium">
                          {MAX_RECORDING_TIME_SECONDS - recordingTime}s remaining
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Minimum: {formatTime(MIN_RECORDING_TIME_SECONDS)} - Maximum: {formatTime(MAX_RECORDING_TIME_SECONDS)}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{isRecording ? "Click to stop recording" : "Click to start recording"}</p>
                </>
              ) : (
                <div className="space-y-4 w-full max-w-md">
                  <audio controls src={audioUrl || undefined} className="w-full" />
                  <div className="flex justify-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRecordedAudio(null);
                        setAudioUrl(null);
                        setRecordingTime(0);
                      }}
                    >
                      Re-record
                    </Button>
                    <Button onClick={handleSubmit} disabled={isLoading} size="lg">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit Story
                          <Send className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
