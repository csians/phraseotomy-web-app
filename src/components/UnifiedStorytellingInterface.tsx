import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconSelectionPanel, IconItem } from "@/components/IconSelectionPanel";
import { Loader2, Mic, Square, Check, Send, ChevronRight, GripVertical, Sparkles } from "lucide-react";
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

interface ThemeElement {
  id: string;
  name: string;
  icon: string;
  image_url?: string | null;
  color?: string | null;
}

interface Theme {
  id: string;
  name: string;
  icon: string;
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
  themeElements: ThemeElement[];
  coreElements: IconItem[];
}

type Phase = "selecting" | "arranging" | "recording" | "submitted";

// Sortable element component for drag-and-drop
function SortableElement({ element, index, isDraggable }: { element: IconItem; index: number; isDraggable: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: element.id,
    disabled: !isDraggable,
  });

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
      style={style}
      className={cn(
        "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-w-[100px]",
        isDragging
          ? "bg-primary/20 border-primary shadow-lg scale-105"
          : "bg-card border-border hover:border-primary/50",
        element.isFromCore && "ring-2 ring-offset-2 ring-primary/30",
        isDraggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      {isDraggable && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 right-1 p-1 rounded-md bg-muted/50 hover:bg-muted"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
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
  themeElements,
  coreElements,
}: UnifiedStorytellingInterfaceProps) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("selecting");
  const [selectedElements, setSelectedElements] = useState<ThemeElement[]>([]);
  const [orderedElements, setOrderedElements] = useState<IconItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Max 3 selections from theme elements
  const MAX_SELECTIONS = 3;
  const canSelectMore = selectedElements.length < MAX_SELECTIONS;

  // Handle element selection (toggle)
  const handleElementClick = (element: ThemeElement) => {
    const isSelected = selectedElements.some((e) => e.id === element.id);

    if (isSelected) {
      setSelectedElements((prev) => prev.filter((e) => e.id !== element.id));
    } else if (canSelectMore) {
      setSelectedElements((prev) => [...prev, element]);
    } else {
      toast({
        title: "Selection Limit",
        description: "You can only select 3 elements from the theme",
        variant: "destructive",
      });
    }
  };

  // Proceed to arrangement phase
  const handleProceedToArrange = () => {
    if (selectedElements.length !== MAX_SELECTIONS) {
      toast({
        title: "Select 3 Elements",
        description: `Please select exactly ${MAX_SELECTIONS} elements from the theme`,
        variant: "destructive",
      });
      return;
    }

    // Combine selected theme elements (3) with core elements (2)
    const themeIconItems: IconItem[] = selectedElements.map((e) => ({
      id: e.id,
      name: e.name,
      icon: e.icon,
      image_url: e.image_url,
      color: e.color,
      isFromCore: false,
    }));

    // Combine: 3 selected + 2 core = 5 total
    const allElements = [...themeIconItems, ...coreElements];
    setOrderedElements(allElements);
    setPhase("arranging");
  };

  // Handle drag end for reordering
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

  // Proceed to recording phase
  const handleProceedToRecord = async () => {
    setIsLoading(true);

    try {
      // Save the selected icon IDs and order to the database
      const iconIds = orderedElements.map((e) => e.id);
      const iconOrder = orderedElements.map((_, idx) => idx);

      const { error } = await supabase
        .from("game_turns")
        .update({
          selected_icon_ids: iconIds,
          icon_order: iconOrder,
        })
        .eq("id", turnId);

      if (error) throw error;

      // Notify other players about the element selection
      sendWebSocketMessage({
        type: "elements_selected",
        turnId,
        iconIds,
      });

      setPhase("recording");
    } catch (error) {
      console.error("Error saving elements:", error);
      toast({
        title: "Error",
        description: "Failed to save element arrangement",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Audio recording functions
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

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Notify others that recording started
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

  // Submit the story
  const handleSubmit = async () => {
    if (!recordedAudio) {
      toast({
        title: "Recording Required",
        description: "Please record your story before submitting",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Upload audio
      const fileName = `${sessionId}/${turnId}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("audio_uploads")
        .upload(fileName, recordedAudio, {
          contentType: "audio/webm",
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("audio_uploads").getPublicUrl(fileName);

      // Update the turn with recording URL and mark as completed
      const { error: updateError } = await supabase
        .from("game_turns")
        .update({
          recording_url: publicUrl,
          completed_at: new Date().toISOString(),
          turn_mode: "audio", // unified flow uses audio mode
        })
        .eq("id", turnId);

      if (updateError) throw updateError;

      // Notify other players
      sendWebSocketMessage({
        type: "story_submitted",
        turnId,
        hasRecording: true,
      });

      setPhase("submitted");

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

  // Non-storyteller waiting view
  if (!isStoryteller) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{storytellerName} is creating their story</CardTitle>
            <CardDescription>Get ready to guess the secret whisp word!</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Waiting for the storyteller to finish...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Tell Your Story</CardTitle>
          <CardDescription>Theme: {theme?.name || "Unknown"}</CardDescription>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {["selecting", "arranging", "recording"].map((step, idx) => (
              <div key={step} className="flex items-center">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium",
                    phase === step
                      ? "bg-primary text-primary-foreground"
                      : ["selecting", "arranging", "recording"].indexOf(phase) > idx
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {idx + 1}
                </div>
                {idx < 2 && (
                  <div
                    className={cn(
                      "w-8 h-0.5 mx-1",
                      ["selecting", "arranging", "recording"].indexOf(phase) > idx ? "bg-primary" : "bg-muted",
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-8 text-xs text-muted-foreground mt-2">
            <span>Select</span>
            <span>Arrange</span>
            <span>Record</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Show whisp to storyteller */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Your Secret Wisp</p>
            <p className="text-2xl font-bold text-primary">{whisp}</p>
            <p className="text-xs text-muted-foreground mt-2">Don't say this word! Describe it using the elements.</p>
          </div>

          {/* Phase 1: Element Selection */}
          {phase === "selecting" && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Select 3 Elements</h3>
                <p className="text-sm text-muted-foreground">
                  Choose 3 elements that will help you describe your wisp ({selectedElements.length}/{MAX_SELECTIONS}{" "}
                  selected)
                </p>
              </div>

              {/* Core elements (auto-selected) */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Core Elements (Auto-selected - 2)</p>
                <div className="flex flex-wrap gap-3 justify-center">
                  {coreElements.map((element) => {
                    const bgColor = element.color || "#8B5CF6";
                    return (
                      <div
                        key={element.id}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-primary/50 bg-primary/5"
                      >
                        <div
                          className="h-12 w-12 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: bgColor }}
                        >
                          {element.image_url ? (
                            <img
                              src={element.image_url}
                              alt={element.name}
                              className="h-7 w-7 object-contain"
                              style={{ filter: "brightness(0) invert(1)" }}
                            />
                          ) : (
                            <Sparkles className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <span className="text-xs font-medium">{element.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Core</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Theme elements (user selects 3) */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Theme Elements (Select 3)</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {themeElements.map((element) => {
                    const isSelected = selectedElements.some((e) => e.id === element.id);
                    const bgColor = element.color || "#6B7280";
                    return (
                      <button
                        key={element.id}
                        onClick={() => handleElementClick(element)}
                        disabled={!canSelectMore && !isSelected}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                          isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-card",
                          !canSelectMore && !isSelected && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <div
                          className="h-12 w-12 rounded-full flex items-center justify-center relative"
                          style={{ backgroundColor: bgColor }}
                        >
                          {element.image_url ? (
                            <img
                              src={element.image_url}
                              alt={element.name}
                              className="h-7 w-7 object-contain"
                              style={{ filter: "brightness(0) invert(1)" }}
                            />
                          ) : (
                            <Sparkles className="h-5 w-5 text-white" />
                          )}
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-medium text-center">{element.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleProceedToArrange}
                  disabled={selectedElements.length !== MAX_SELECTIONS}
                  size="lg"
                >
                  Continue to Arrange
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Phase 2: Drag and Drop Arrangement */}
          {phase === "arranging" && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Arrange Your Elements</h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop to arrange elements in the order you'll describe them
                </p>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedElements.map((e) => e.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex flex-wrap gap-4 justify-center py-4">
                    {orderedElements.map((element, index) => (
                      <SortableElement key={element.id} element={element} index={index} isDraggable={true} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-primary/30" />
                  <span>Core elements</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-full bg-secondary/50" />
                  <span>Theme elements</span>
                </div>
              </div>

              <div className="flex justify-center gap-4 pt-4">
                <Button variant="outline" onClick={() => setPhase("selecting")}>
                  Back
                </Button>
                <Button onClick={handleProceedToRecord} disabled={isLoading} size="lg">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue to Record
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Phase 3: Audio Recording */}
          {phase === "recording" && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Record Your Story</h3>
                <p className="text-sm text-muted-foreground">
                  Tell a story using your arranged elements to describe the whisp
                </p>
              </div>

              {/* Show arranged elements as reference */}
              <div className="flex flex-wrap gap-3 justify-center py-2">
                {orderedElements.map((element, index) => {
                  const bgColor = element.color || (element.isFromCore ? "#8B5CF6" : "#6B7280");
                  return (
                    <div key={element.id} className="flex flex-col items-center gap-1">
                      <div className="text-xs text-muted-foreground">{index + 1}</div>
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: bgColor }}
                      >
                        {element.image_url ? (
                          <img
                            src={element.image_url}
                            alt={element.name}
                            className="h-6 w-6 object-contain"
                            style={{ filter: "brightness(0) invert(1)" }}
                          />
                        ) : (
                          <Sparkles className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <span className="text-[10px] font-medium">{element.name}</span>
                    </div>
                  );
                })}
              </div>

              {/* Recording controls */}
              <div className="flex flex-col items-center gap-4 py-4">
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
                    {isRecording && (
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-lg font-mono">{formatTime(recordingTime)}</span>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {isRecording ? "Click to stop recording" : "Click to start recording"}
                    </p>
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

              <div className="flex justify-center pt-4">
                <Button variant="ghost" onClick={() => setPhase("arranging")}>
                  Back to Arrange
                </Button>
              </div>
            </div>
          )}

          {/* Submitted state */}
          {phase === "submitted" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">Story Submitted!</h3>
              <p className="text-muted-foreground">Waiting for other players to guess...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
