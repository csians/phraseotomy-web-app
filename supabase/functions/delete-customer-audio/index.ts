import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { audioId, customerId } = await req.json();

    if (!audioId || !customerId) {
      return new Response(
        JSON.stringify({ error: "audioId and customerId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Deleting audio:", audioId, "for customer:", customerId);

    // Verify the audio belongs to the customer
    const { data: audioData, error: fetchError } = await supabase
      .from("customer_audio")
      .select("*")
      .eq("id", audioId)
      .eq("customer_id", customerId)
      .single();

    if (fetchError || !audioData) {
      console.error("Audio not found or doesn't belong to customer:", fetchError);
      return new Response(
        JSON.stringify({ error: "Audio not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract filename from audio_url for storage deletion
    const audioUrl = audioData.audio_url;
    const urlParts = audioUrl.split("/");
    const filename = urlParts[urlParts.length - 1];
    const storagePath = `${customerId}/${filename}`;

    console.log("Deleting from storage:", storagePath);

    // Delete from storage bucket
    const { error: storageError } = await supabase.storage
      .from("audio_uploads")
      .remove([storagePath]);

    if (storageError) {
      console.error("Error deleting from storage:", storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("customer_audio")
      .delete()
      .eq("id", audioId)
      .eq("customer_id", customerId);

    if (deleteError) {
      console.error("Error deleting audio record:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete audio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Audio deleted successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Audio deleted successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in delete-customer-audio:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
