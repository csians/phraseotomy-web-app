import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Upload, CheckCircle2, Mic } from 'lucide-react';

interface AudioUploadProps {
  sessionId: string;
  playerId: string;
  roundNumber: number;
  onUploadComplete?: (audioUrl: string) => void;
}

export function AudioUpload({ sessionId, playerId, roundNumber, onUploadComplete }: AudioUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an audio file (webm, wav, mp3, or ogg)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Audio file must be less than 10MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('session_id', sessionId);
      formData.append('player_id', playerId);
      formData.append('round_number', roundNumber.toString());

      const { data, error } = await supabase.functions.invoke('upload-audio', {
        body: formData,
      });

      if (error) throw error;

      if (data?.url) {
        setUploadedUrl(data.url);
        toast({
          title: 'Upload successful',
          description: 'Your audio has been uploaded',
        });
        onUploadComplete?.(data.url);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload audio',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
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

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
        await handleFileUpload(audioFile);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: 'Recording started',
        description: 'Speak into your microphone',
      });
    } catch (error) {
      console.error('Recording error:', error);
      toast({
        title: 'Recording failed',
        description: 'Could not access microphone',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Upload Game Audio
        </CardTitle>
        <CardDescription>
          Upload one audio file for this game (Round {roundNumber})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {uploadedUrl ? (
          <div className="flex items-center gap-2 p-4 bg-secondary/50 rounded-md">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-sm">Audio uploaded successfully</span>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isRecording}
                variant="outline"
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Choose File
                  </>
                )}
              </Button>
              
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isUploading}
                variant={isRecording ? "destructive" : "default"}
                className="flex-1"
              >
                <Mic className="mr-2 h-4 w-4" />
                {isRecording ? 'Stop Recording' : 'Record Audio'}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/webm,audio/wav,audio/mp3,audio/mpeg,audio/ogg"
              onChange={handleFileSelect}
              className="hidden"
            />

            <p className="text-xs text-muted-foreground text-center">
              Max file size: 10MB • Formats: webm, wav, mp3, ogg
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
