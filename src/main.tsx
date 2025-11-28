import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getAllUrlParams } from "./lib/urlUtils";

// Initialize customer data from URL parameters (passed from Shopify proxy iframe)
const urlParams = getAllUrlParams();
const customerParam = urlParams.get('customer');
const guestSessionParam = urlParams.get('guestSession');

console.log('🔍 [INIT] URL parameters:', {
  hasCustomer: !!customerParam,
  hasGuestSession: !!guestSessionParam,
  customerParam: customerParam?.substring(0, 100), // Log first 100 chars
});

if (customerParam) {
  try {
    const customerData = JSON.parse(customerParam);
    console.log('🔍 [INIT] Parsed customer data:', customerData);
    
    // If this is a guest user, store their data properly
    if (customerData.isGuest || customerData.id?.startsWith('guest_')) {
      console.log('🔍 [INIT] Guest user detected, storing guest data');
      
      // Store guest player ID in both session and local storage
      sessionStorage.setItem('guest_player_id', customerData.id);
      localStorage.setItem('guest_player_id', customerData.id);
      
      // Store guest player name
      const guestName = customerData.name || customerData.firstName || 'Guest';
      sessionStorage.setItem('guest_player_name', guestName);
      localStorage.setItem('guest_player_name', guestName);
      
      console.log('✅ [INIT] Guest data stored:', {
        playerId: customerData.id,
        playerName: guestName,
      });
    } else {
      // Regular customer - store in localStorage
      localStorage.setItem('customerData', JSON.stringify(customerData));
      console.log('✅ [INIT] Customer data stored');
    }
    
    // Set global variable for App.tsx to check
    (window as any).__PHRASEOTOMY_CUSTOMER__ = customerData;
  } catch (error) {
    console.error('❌ [INIT] Failed to parse customer data:', error);
  }
}

// Store guest session if present
if (guestSessionParam) {
  console.log('🔍 [INIT] Storing guest session:', guestSessionParam);
  sessionStorage.setItem('current_lobby_session', guestSessionParam);
  localStorage.setItem('current_lobby_session', guestSessionParam);
}

createRoot(document.getElementById("root")!).render(<App />);
