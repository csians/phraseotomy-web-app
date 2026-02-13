  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const { sessionId, playerId } = await req.json();

      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: "Missing sessionId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Get session with current state
      const { data: session, error: sessionError } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: "Session not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get all players with scores
      const { data: players, error: playersError } = await supabase
        .from("game_players")
        .select("*")
        .eq("session_id", sessionId)
        .order("turn_order");

      if (playersError) {
        console.error("Error fetching players:", playersError);
      }

      // Get packs_used from session (the pack selected when game was created)
      const packsUsed = session.packs_used || [];
      console.log("Session packs_used:", packsUsed);

      // Get all themes with pack info
      const { data: themes, error: themesError } = await supabase
        .from("themes")
        .select("*, pack:packs(id, name)");

      if (themesError) {
        console.error("Error fetching themes:", themesError);
      }

      // Base themes that are always unlocked (static)
      const baseThemeNames = ["At Home", "Lifestyle", "At Work", "Travel"];
      const baseThemeIds = new Set(
        (themes || [])
          .filter(t => baseThemeNames.includes(t.name))
          .map(t => t.id)
      );

      // Get customer's email and name from their ID
      let customerEmail = null;
      let customerName = null;
      if (playerId) {
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("customer_email, customer_name")
          .eq("customer_id", playerId)
          .maybeSingle();
        
        if (!customerError && customer) {
          customerEmail = customer.customer_email;
          customerName = customer.customer_name;
          console.log(`Found customer for ${playerId}: email=${customerEmail}, name=${customerName}`);
        } else {
          console.log(`No customer found for player ID: ${playerId}`);
        }
      }

      // Get customer's unlocked themes from theme_codes
      // Note: redeemed_by can be email, name, customer_id, or 'Customer_{id}'
      let redeemedCodes = [];
      if (playerId) {
        // Build array of possible redeemed_by values
        const possibleValues = [playerId];
        if (customerEmail) possibleValues.push(customerEmail);
        if (customerName) possibleValues.push(customerName);
        possibleValues.push(`Customer_${playerId}`);

        const { data, error: redeemedCodesError } = await supabase
          .from("theme_codes")
          .select("themes_unlocked")
          .in("redeemed_by", possibleValues)
          .eq("status", "active");

        if (redeemedCodesError) {
          console.error("Error fetching redeemed theme codes:", redeemedCodesError);
        } else {
          redeemedCodes = data || [];
          console.log(`Found ${redeemedCodes.length} redeemed theme codes for customer`);
        }
      }

      // Flatten all themes_unlocked arrays into a set of theme IDs
      const customerUnlockedThemeIds = new Set<string>();
      redeemedCodes.forEach(code => {
        (code.themes_unlocked || []).forEach(themeId => {
          customerUnlockedThemeIds.add(themeId);
        });
      });

      console.log("Customer unlocked themes:", Array.from(customerUnlockedThemeIds));
      console.log("Base themes (always unlocked):", Array.from(baseThemeIds));

      // Get customer's licenses with their packs_unlocked (based on individual player's access)
      let playerPacksUnlocked = new Set<string>();
      if (playerId) {
        const { data: licenses, error: licensesError } = await supabase
          .from("customer_licenses")
          .select(`
            id,
            license_code:license_codes(packs_unlocked)
          `)
          .eq("customer_id", playerId)
          .eq("status", "active");

        if (!licensesError && licenses && licenses.length > 0) {
          licenses.forEach((license: any) => {
            if (license.license_code?.packs_unlocked && Array.isArray(license.license_code.packs_unlocked)) {
              license.license_code.packs_unlocked.forEach((pack: string) => {
                playerPacksUnlocked.add(pack);
              });
            }
          });
        } else if (licensesError) {
          console.error("Error fetching customer licenses:", licensesError);
        }
      }

      console.log("Player unlocked packs:", Array.from(playerPacksUnlocked));

      // Get all packs to map names to IDs
      const { data: allPacks, error: packsError } = await supabase
        .from("packs")
        .select("id, name");

      if (packsError) {
        console.error("Error fetching packs:", packsError);
      }


      // Create a mapping of pack names to IDs and filter to player's unlocked packs (case-insensitive)
      const playerPackIds = new Set<string>();
      (allPacks || []).forEach(pack => {
        if (
          Array.from(playerPacksUnlocked).some(
            unlockedName => unlockedName.toLowerCase() === (pack.name || '').toLowerCase()
          )
        ) {
          playerPackIds.add(pack.id);
        }
      });

      console.log("Player unlocked pack IDs:", Array.from(playerPackIds));

      // Get theme_packs junction table to find themes linked to player's packs
      let themePacks = [];
      if (playerPackIds.size > 0) {
        const { data, error: themePacksError } = await supabase
          .from("theme_packs")
          .select("theme_id, pack_id")
          .in("pack_id", Array.from(playerPackIds));

        if (themePacksError) {
          console.error("Error fetching theme_packs:", themePacksError);
        } else {
          themePacks = data || [];
        }
      }

      // Create a set of theme IDs that are linked to player's unlocked packs
      const themeIdsInPlayerPacks = new Set(
        (themePacks || []).map(tp => tp.theme_id)
      );

      // Filter themes: show core themes OR base themes OR customer-unlocked themes OR themes linked to player's packs
      const availableThemes = (themes || []).filter(theme => {
        // Always include core themes
        if (theme.is_core) return true;
        
        // Include base themes (always available)
        if (baseThemeIds.has(theme.id)) return true;
        
        // Include customer-unlocked themes (from redeemed theme codes)
        if (customerUnlockedThemeIds.has(theme.id)) return true;
        
        // Include themes directly linked to player's packs via pack_id
        if (theme.pack_id && playerPackIds.has(theme.pack_id)) return true;
        
        // Include themes linked via theme_packs junction table to player's packs
        if (themeIdsInPlayerPacks.has(theme.id)) return true;
        
        return false;
      });

      console.log(`Filtered ${availableThemes.length} themes from ${themes?.length || 0} total themes based on player's packs:`, Array.from(playerPackIds));

      // Process themes to add unlock status (all filtered themes are unlocked for this game)
      const processedThemes = availableThemes.map(theme => ({
        ...theme,
        isCore: theme.is_core,
        isUnlocked: true, // All filtered themes are available for this game
        packName: theme.pack?.name || null,
      }));

      // Get current turn if exists - get the LATEST one for this round/storyteller
      console.log("Fetching turn for session:", sessionId, "round:", session.current_round, "storyteller:", session.current_storyteller_id);
      
      const { data: turns, error: turnError } = await supabase
        .from("game_turns")
        .select(`
          *,
          theme:themes(*)
        `)
        .eq("session_id", sessionId)
        .eq("round_number", session.current_round)
        .eq("storyteller_id", session.current_storyteller_id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (turnError) {
        console.error("Error fetching turn:", turnError);
      }
      
      // Get the latest turn (first in descending order)
      let currentTurn = turns && turns.length > 0 ? turns[0] : null;
      
      console.log("Current turn found:", currentTurn ? currentTurn.id : "null", "turn_mode:", currentTurn?.turn_mode);

      // SECURITY: Encrypt whisp for non-storyteller players so it's not readable in inspect
      // Only storyteller should see the real whisp value
      if (currentTurn && currentTurn.whisp) {
        const isStoryteller = playerId === currentTurn.storyteller_id;
        
        if (!isStoryteller) {
          // For non-storytellers: encrypt/obfuscate the whisp
          // Use base64 encoding to make it not immediately readable
          const encoded = btoa(currentTurn.whisp);
          currentTurn = { ...currentTurn, whisp: `_ENC_${encoded}` };
        }
        // For storyteller: keep whisp as-is (no encryption needed)
      }

      // If there's a current turn with selected_icon_ids, get the icon details
      let selectedIcons: any[] = [];
      if (currentTurn?.selected_icon_ids && currentTurn.selected_icon_ids.length > 0) {
        const { data: elements, error: elementsError } = await supabase
          .from("elements")
          .select("id, name, icon, image_url, color, theme_id")
          .in("id", currentTurn.selected_icon_ids);

        if (!elementsError && elements) {
          // Get core theme IDs to determine isFromCore
          const { data: coreThemes } = await supabase
            .from("themes")
            .select("id")
            .eq("is_core", true);

          const coreThemeIds = new Set((coreThemes || []).map(t => t.id));

          // Create a map for quick lookup
          const elementMap = new Map(elements.map(e => [e.id, e]));
          
          // Preserve the order from selected_icon_ids array (which is the reordered order)
          selectedIcons = currentTurn.selected_icon_ids.map((id: string) => {
            const element = elementMap.get(id);
            if (!element) return null;
            return {
              id: element.id,
              name: element.name,
              icon: element.icon,
              image_url: element.image_url,
              color: element.color,
              isFromCore: element.theme_id !== currentTurn.theme_id,
            };
          }).filter(Boolean);
        }
      }

      // Get all elements for the selected theme (for guessing)
      let themeElements = null;
      if (currentTurn?.theme_id) {
        const { data: elements, error: elementsError } = await supabase
          .from("elements")
          .select("*")
          .eq("theme_id", currentTurn.theme_id);

        if (!elementsError) {
          themeElements = elements;
        }
      }

      return new Response(
        JSON.stringify({
          session,
          players: players || [],
          themes: processedThemes,
          currentTurn,
          selectedIcons,
          themeElements,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error in get-game-state:", error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  });
