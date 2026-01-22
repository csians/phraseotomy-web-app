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
import RedeemCode from "./pages/Redeem";

import NotFound from "./pages/NotFound";
import AdminHome from "./pages/admin/AdminHome";
import Codes from "./pages/admin/Codes";
import ThemeCodes from "./pages/admin/ThemeCodes";
import Packs from "./pages/admin/Packs";
import Themes from "./pages/admin/Themes";

const queryClient = new QueryClient();

// Clean URL parameters immediately on app load
(function cleanUrlParams() {
  const fullUrl = window.location.href;
  const url = new URL(fullUrl);
  
  // Check both searchParams and also parse manually in case of hash issues
  const searchStr = window.location.search;
  const manualParams = new URLSearchParams(searchStr);
  
  // Also check params in hash (for HashRouter)
  let hashParams = new URLSearchParams();
  if (window.location.hash.includes('?')) {
    const hashParts = window.location.hash.split('?');
    if (hashParts[1]) {
      hashParams = new URLSearchParams(hashParts[1]);
    }
  }
  
  // Helper to get param from multiple sources
  const getParam = (key: string, altKey?: string) => {
    return hashParams.get(key) || hashParams.get(altKey || '') ||
           manualParams.get(key) || manualParams.get(altKey || '') ||
           url.searchParams.get(key) || url.searchParams.get(altKey || '');
  };
  
  const shop = getParam('shop');
  const customer_id = getParam('customer_id', 'CustomerId');
  const customer_email = getParam('customer_email', 'CustomerEmail');
  const customer_name = getParam('customer_name');
  const rToken = getParam('r');
  const hostParam = getParam('host');
  
  // Check for Shopify redeem code parameters (from Shopify redirect after redemption)
  const redeemCode = getParam('Code', 'code');
  const shopDomain = getParam('shop_domain');
  
  // Check if we're in Shopify Admin context
  const isShopifyAdmin = hostParam || window.location.href.includes('admin.shopify.com');
  if (isShopifyAdmin) {
    sessionStorage.setItem('shopify_admin_context', 'true');
    if (hostParam) sessionStorage.setItem('shopify_host', hostParam);
    if (shop) sessionStorage.setItem('shopify_admin_shop', shop);
    console.log('🔐 Shopify Admin context detected');
  }
  
  // Handle redeem code redirect from Shopify
  if (redeemCode && customer_id && shopDomain) {
    const redeemParams = {
      Code: redeemCode,
      CustomerId: customer_id,
      CustomerEmail: customer_email,
      shop_domain: shopDomain
    };
    
    console.log('🎟️ [APP] Redeem code params detected from Shopify:', redeemParams);
    
    // Store in sessionStorage for Play.tsx to process
    sessionStorage.setItem('pending_redeem_params', JSON.stringify(redeemParams));
    
    // Clean URL immediately - remove all query params but keep hash route
    const currentHash = window.location.hash;
    const hashRoute = currentHash.includes('?') ? currentHash.split('?')[0] : currentHash;
    const cleanUrl = url.origin + url.pathname + (hashRoute || '');
    window.history.replaceState({}, '', cleanUrl);
    
    // Redirect to play/host page (Play.tsx will handle redeem code directly)
    if (!window.location.hash.includes('/play/host')) {
      window.location.hash = '/play/host';
    }
    return;
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
    
    // CRITICAL: RootRedirect should only handle root path '/'
    // If we're on any other path, don't redirect - let React Router handle it
    // Also exclude redeem-code path to prevent redirects
    if (currentPath !== '/' && currentPath !== '' && currentPath !== '/redeem') {
      console.log('Not on root path, skipping RootRedirect:', currentPath);
      setRedirectTarget(null); // Don't redirect, let React Router handle it
      return;
    }
    
    // Only check for active lobby session from root path
    if (currentPath === '/' || currentPath === '') {
      const currentLobbySession = sessionStorage.getItem('current_lobby_session') || localStorage.getItem('current_lobby_session');
      const lobbyPlayerId = sessionStorage.getItem('lobby_player_id') || localStorage.getItem('lobby_player_id');
      if (currentLobbySession && lobbyPlayerId) {
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
    
    // Check if accessed via Shopify proxy path
    const isProxyPath = window.location.pathname.includes('/apps/phraseotomy');
    
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
    // If accessed via proxy path and authenticated, go to play page
    else if (isProxyPath && (customerData || (storedCustomerData && sessionToken))) {
      console.log('Accessed via proxy path, redirecting to /play/host');
      setRedirectTarget('/play/host');
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

  // If redirectTarget is null, it means we're on a protected path - don't redirect
  if (redirectTarget === null) {
    return null; // Let React Router handle the route
  }

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
          <Route path="/lobby/:sessionId" element={<Lobby />} />
          <Route path="/game/:sessionId" element={<Game />} />
          <Route path="/redeem" element={<RedeemCode />} />
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/packs" element={<Packs />} />
          <Route path="/admin/codes" element={<Codes />} />
          <Route path="/admin/theme-codes" element={<ThemeCodes />} />
          <Route path="/admin/themes" element={<Themes />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
