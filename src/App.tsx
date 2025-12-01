import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getAllUrlParams } from "@/lib/urlUtils";
import Play from "./pages/Play";
import Login from "./pages/Login";
import CreateLobby from "./pages/CreateLobby";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import GuestJoin from "./pages/GuestJoin";
import NotFound from "./pages/NotFound";
import AdminHome from "./pages/admin/AdminHome";
import Codes from "./pages/admin/Codes";
import Packs from "./pages/admin/Packs";

const queryClient = new QueryClient();

// Clean URL parameters immediately on app load
(function cleanUrlParams() {
  const fullUrl = window.location.href;
  const url = new URL(fullUrl);
  
  // Check both searchParams and also parse manually in case of hash issues
  const searchStr = window.location.search;
  const manualParams = new URLSearchParams(searchStr);
  
  const shop = manualParams.get('shop') || url.searchParams.get('shop');
  const customer_id = manualParams.get('customer_id') || url.searchParams.get('customer_id');
  const customer_email = manualParams.get('customer_email') || url.searchParams.get('customer_email');
  const customer_name = manualParams.get('customer_name') || url.searchParams.get('customer_name');
  const rToken = manualParams.get('r') || url.searchParams.get('r');
  const hostParam = manualParams.get('host') || url.searchParams.get('host');
  
  // Check if we're in Shopify Admin context
  const isShopifyAdmin = hostParam || window.location.href.includes('admin.shopify.com');
  if (isShopifyAdmin) {
    sessionStorage.setItem('shopify_admin_context', 'true');
    if (hostParam) sessionStorage.setItem('shopify_host', hostParam);
    if (shop) sessionStorage.setItem('shopify_admin_shop', shop);
    console.log('🔐 Shopify Admin context detected');
  }
  
  const hasLoginParams = shop || customer_id || customer_email || customer_name || rToken;
  
  if (hasLoginParams) {
    const params = {
      shop,
      customer_id,
      customer_email,
      customer_name,
      r: rToken
    };
    
    console.log('🧹 Cleaned URL params at app level:', params);
    
    // Store in sessionStorage for Login.tsx to process
    sessionStorage.setItem('pending_login_params', JSON.stringify(params));
    
    // Clean URL immediately - remove all query params
    const cleanUrl = url.origin + url.pathname + (url.hash ? url.hash.split('?')[0] : '');
    window.history.replaceState({}, '', cleanUrl);
  }
})();

const RootRedirect = () => {
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);

  useEffect(() => {
    const currentPath = window.location.hash.replace('#', '');
    const urlParams = getAllUrlParams();
    
    // CRITICAL: Check for guest join first - bypass all other logic
    const guestParam = urlParams.get('guest');
    if (guestParam === 'true' && currentPath.startsWith('/lobby/join')) {
      console.log('Guest join detected, staying on /lobby/join');
      setRedirectTarget('/lobby/join');
      return;
    }
    
    // CRITICAL: Don't redirect if already on lobby/game pages
    if (currentPath.startsWith('/lobby/') || currentPath.startsWith('/game/')) {
      console.log('Already on lobby/game page, skipping RootRedirect entirely');
      setRedirectTarget(currentPath); // Stay on current path
      return;
    }
    
    // Only check for active lobby session from root path
    if (currentPath === '/' || currentPath === '') {
      const currentLobbySession = sessionStorage.getItem('current_lobby_session');
      if (currentLobbySession) {
        console.log('Active lobby session found, redirecting to lobby');
        setRedirectTarget(`/lobby/${currentLobbySession}`);
        return;
      }
    }

    // Check if accessed from Shopify admin (has 'host' parameter or stored admin context)
    const hostParam = urlParams.get('host');
    const isShopifyAdmin = hostParam || 
      sessionStorage.getItem('shopify_admin_context') === 'true' ||
      window.location.href.includes('admin.shopify.com');
    
    // Check for embedded customer data from iframe
    const customerData = window.__PHRASEOTOMY_CUSTOMER__;
    
    // Check for existing session in localStorage (standalone mode)
    const storedCustomerData = localStorage.getItem('customerData');
    const sessionToken = localStorage.getItem('phraseotomy_session_token');
    
    // If in Shopify admin context, go to admin panel
    if (isShopifyAdmin) {
      console.log('Accessed from Shopify admin, redirecting to /admin');
      setRedirectTarget('/admin');
    }
    // If customer is authenticated via iframe, go to play page
    else if (customerData) {
      console.log('Customer authenticated via iframe, redirecting to /play/host');
      setRedirectTarget('/play/host');
    }
    // If session exists in localStorage (standalone mode after iframe login)
    else if (storedCustomerData && sessionToken) {
      console.log('Existing session found, redirecting to /play/host');
      setRedirectTarget('/play/host');
    }
    // Otherwise, go to login
    else {
      console.log('No session found, redirecting to /login');
      setRedirectTarget('/login');
    }
  }, []);

  if (!redirectTarget) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return <Navigate to={redirectTarget} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/play/host" element={<Play />} />
          <Route path="/apps/phraseotomy" element={<Play />} />
          <Route path="/create-lobby" element={<CreateLobby />} />
          <Route path="/lobby/join" element={<GuestJoin />} />
          <Route path="/lobby/:sessionId" element={<Lobby />} />
          <Route path="/game/:sessionId" element={<Game />} />
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/packs" element={<Packs />} />
          <Route path="/admin/codes" element={<Codes />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
