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
  
  // Normalize shop / customer param names coming from Shopify
  const shop =
    manualParams.get('shop') ||
    url.searchParams.get('shop') ||
    manualParams.get('shop_domain') ||
    url.searchParams.get('shop_domain');

  const customer_id =
    manualParams.get('customer_id') ||
    url.searchParams.get('customer_id') ||
    manualParams.get('CustomerId') ||
    manualParams.get('customerId') ||
    url.searchParams.get('CustomerId') ||
    url.searchParams.get('customerId');

  const customer_email =
    manualParams.get('customer_email') ||
    manualParams.get('customer_emal') ||
    url.searchParams.get('customer_email') ||
    url.searchParams.get('customer_emal') ||
    manualParams.get('customerEmail') ||
    manualParams.get('CustomerEmail') ||
    url.searchParams.get('customerEmail') ||
    url.searchParams.get('CustomerEmail');

  const customer_name =
    manualParams.get('customer_name') ||
    url.searchParams.get('customer_name') ||
    manualParams.get('customerName') ||
    manualParams.get('CustomerName') ||
    url.searchParams.get('customerName') ||
    url.searchParams.get('CustomerName');
  // r token: from URL only (Shopify redirect passes it)
  const rToken =
    manualParams.get('r') ||
    url.searchParams.get('r') ||
    null;
  const hostParam = manualParams.get('host') || url.searchParams.get('host');
  const codeParam = manualParams.get('Code') || manualParams.get('code') || url.searchParams.get('Code') || url.searchParams.get('code');
  const shopDomainParam = manualParams.get('shop_domain') || url.searchParams.get('shop_domain');

  // Preserve Code in sessionStorage before URL is cleaned (so Play page can use it for lobby pre-fill)
  if (codeParam && /^[A-Za-z0-9]{6}$/.test(codeParam.trim())) {
    const normalizedCode = codeParam.trim().toUpperCase();
    sessionStorage.setItem('phraseotomy_url_code', normalizedCode);
  }

  // Persist customer to localStorage as soon as URL has customer_id + email/name (so it's stored even on redeem flow or before clean)
  if (customer_id && (customer_email || customer_name)) {
    try {
      // Clear old customer data before storing new (different account login)
      localStorage.removeItem('customerData');
      localStorage.removeItem('phraseotomy_session_token');
      const shopForStorage = shopDomainParam || shop;
      const firstName = customer_name ? String(customer_name).trim().split(/\s+/)[0] : '';
      const lastName = customer_name ? String(customer_name).trim().split(/\s+/).slice(1).join(' ') : '';
      localStorage.setItem(
        'customerData',
        JSON.stringify({
          customer_id,
          id: customer_id,
          email: customer_email || undefined,
          name: customer_name || undefined,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
        }),
      );
      if (shopForStorage) localStorage.setItem('shop_domain', shopForStorage);
    } catch (e) {}
  }

  // If this is a redeem-code flow (Code + customer + shop_domain),
  // don't clean the URL here – Play.tsx needs these params intact
  const hasRedeemParams =
    !!codeParam &&
    !!shopDomainParam &&
    !!(
      manualParams.get('CustomerId') ||
      manualParams.get('customer_id') ||
      url.searchParams.get('CustomerId') ||
      url.searchParams.get('customer_id')
    );
  if (hasRedeemParams) {
    return;
  }

  // Check if we're in Shopify Admin context
  const isShopifyAdmin = hostParam || window.location.href.includes('admin.shopify.com');
  if (isShopifyAdmin) {
    sessionStorage.setItem('shopify_admin_context', 'true');
    if (hostParam) sessionStorage.setItem('shopify_host', hostParam);
    if (shop) sessionStorage.setItem('shopify_admin_shop', shop);
  }

  const hasLoginParams = shop || customer_id || customer_email || customer_name || rToken;

  if (hasLoginParams) {
    const params = {
      shop,
      customer_id,
      customer_email,
      customer_name,
      r: rToken,
      Code: codeParam ?? undefined,
      shop_domain: shopDomainParam ?? undefined,
    };

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
      setRedirectTarget(null); // Don't redirect, let React Router handle it
      return;
    }
    
    // Only check for active lobby session from root path
    if (currentPath === '/' || currentPath === '') {
      const currentLobbySession = sessionStorage.getItem('current_lobby_session') || localStorage.getItem('current_lobby_session');
      const lobbyPlayerId = sessionStorage.getItem('lobby_player_id') || localStorage.getItem('lobby_player_id');
      if (currentLobbySession && lobbyPlayerId) {
        setRedirectTarget(`/lobby/${currentLobbySession}`);
        return;
      }
    }

    // If this is a redeem-code flow (Code + customer + shop_domain), send user to Play
    const redeemCodeParam = urlParams.get('Code') || urlParams.get('code');
    const redeemCustomerId = urlParams.get('CustomerId') || urlParams.get('customer_id');
    const redeemShopDomain = urlParams.get('shop_domain');
    if (redeemCodeParam && redeemCustomerId && redeemShopDomain) {
      setRedirectTarget('/play/host');
      return;
    }
    
    // Check if accessed from Shopify admin (has 'host' parameter or stored admin context)
    const hostParam = urlParams.get('host');
    const isShopifyAdmin = hostParam || 
      sessionStorage.getItem('shopify_admin_context') === 'true' ||
      window.location.href.includes('admin.shopify.com');
    
    // Check if accessed via Shopify proxy path
    const isProxyPath = window.location.pathname.includes('/pages/play-online');
    
    // Check for embedded customer data from iframe
    const customerData = window.__PHRASEOTOMY_CUSTOMER__;
    
    // Check for existing session in localStorage (standalone mode)
    const storedCustomerData = localStorage.getItem('customerData');
    const sessionToken = localStorage.getItem('phraseotomy_session_token');
    
    // If in Shopify admin context, go to admin panel
    if (isShopifyAdmin) {
      setRedirectTarget('/admin');
    }
    // If accessed via proxy path and authenticated, go to play page
    else if (isProxyPath && (customerData || (storedCustomerData && sessionToken))) {
      setRedirectTarget('/play/host');
    }
    // If customer is authenticated via iframe, go to play page
    else if (customerData) {
      setRedirectTarget('/play/host');
    }
    // If session exists in localStorage (standalone mode after iframe login)
    else if (storedCustomerData && sessionToken) {
      setRedirectTarget('/play/host');
    }
    // Otherwise, go to login
    else {
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

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

const App = () => {
  useEffect(() => {
    const checkCookie = () => {
      const rawCustomerData = getCookie('customer_data');
      if (rawCustomerData) {
        const decoded = decodeURIComponent(rawCustomerData);
        const parsed = JSON.parse(decoded);
        console.log(parsed);
        return true;
      }
      console.log('customer_data not found');
      return false;
    };

    if (!checkCookie()) {
      const timeoutId = setTimeout(() => checkCookie(), 10000);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/play" element={<Play />} />
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
};

export default App;
