import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getAllUrlParams, normalizeCustomerId } from "./lib/urlUtils";
import { getCustomerFromShopifyCookie, setCustomerDataCookie, clearCustomerDataCookie } from "./lib/cookieUtils";
import { getTenantByAppDomain } from "./lib/tenants";

// When visiting ourstagingserver.com directly, there's no parent to postMessage the cookie.
// Redirect to phraseotomy.com so the proxy returns the page with the parent script.
let isRedirecting = false;
if (typeof window !== "undefined" && window.location.hostname === "phraseotomy.ourstagingserver.com" && window.self === window.top) {
  const urlParams = getAllUrlParams();
  const hasCustomer = !!urlParams.get("customer") || !!urlParams.get("customer_id");
  const hasSession = !!localStorage.getItem("phraseotomy_session_token");
  const pathname = window.location.pathname;
  const isRootOrLogin = pathname === "/" || pathname === "" || pathname.includes("login");
  if (!hasCustomer && !hasSession && isRootOrLogin) {
    const tenant = getTenantByAppDomain(window.location.hostname);
    if (tenant?.shopDomain === "phraseotomy.com") {
      console.log("🔀 [INIT] Redirecting to phraseotomy.com so parent can pass cookie via postMessage");
      window.location.replace("https://phraseotomy.com/pages/play-online");
      isRedirecting = true;
    }
  }
}

// When iframe origin (ourstagingserver.com) is outside top-level (phraseotomy.com),
// the parent reads the cookie and postMessages it. Listen for that.
const ALLOWED_ORIGINS = ["https://phraseotomy.com", "https://phraseotomy.ourstagingserver.com"];
window.addEventListener("message", (e) => {
  if (!ALLOWED_ORIGINS.includes(e.origin)) return;
  const msg = e.data;
  if (msg?.type !== "PHRASEOTOMY_CUSTOMER_FROM_COOKIE" || !msg?.payload) return;
  // URL customer_id takes precedence (fresh login) – don't overwrite with parent cookie
  const urlParams = getAllUrlParams();
  if (urlParams.get("customer_id") || urlParams.get("customer")) return;
  const p = msg.payload;
  const rawId = p.id || p.customer_id;
  const normalizedId = normalizeCustomerId(rawId) || String(rawId ?? "");
  const customerData = {
    id: normalizedId,
    customer_id: normalizedId,
    email: p.email,
    name: p.name,
    firstName: p.firstName,
    lastName: p.lastName,
  };
  if (!customerData.id) return;
  localStorage.setItem("customerData", JSON.stringify(customerData));
  (window as any).__PHRASEOTOMY_CUSTOMER__ = customerData;
  const tenant = getTenantByAppDomain(window.location.hostname);
  if (tenant?.shopDomain) localStorage.setItem("shop_domain", tenant.shopDomain);
  if (window.location.hostname === "phraseotomy.ourstagingserver.com") {
    setCustomerDataCookie(customerData);
  }
  console.log("✅ [INIT] Customer from parent postMessage (cookie)");
  window.dispatchEvent(new CustomEvent("phraseotomy:customer-from-parent"));
});

// Initialize customer data: first from URL params, then from Shopify cookie
const urlParams = getAllUrlParams();
const customerParam = urlParams.get('customer');
const customerIdParam = urlParams.get('customer_id');
const customerNameParam = urlParams.get('customer_name') || urlParams.get('customerName') || urlParams.get('CustomerName');
const customerEmailParam = urlParams.get('customer_email') || urlParams.get('customerEmail') || urlParams.get('CustomerEmail');
const shopParam = urlParams.get('shop') || urlParams.get('shop_domain');
const guestSessionParam = urlParams.get('guestSession');

console.log('🔍 [INIT] URL parameters:', {
  hasCustomer: !!customerParam,
  hasCustomerId: !!customerIdParam,
  hasGuestSession: !!guestSessionParam,
  customerParam: customerParam?.substring(0, 100), // Log first 100 chars
});

// Handle customer_id in URL (e.g. iframe: ?customer_id=24118108225884&customer_name=...&customer_email=...)
if (customerIdParam && !customerParam) {
  const normalizedId = normalizeCustomerId(customerIdParam) || String(customerIdParam);
  const urlName = customerNameParam ? decodeURIComponent(customerNameParam.replace(/\+/g, ' ')).trim() : null;
  const urlEmail = customerEmailParam ? decodeURIComponent(customerEmailParam).trim() : null;
  const firstName = urlName ? urlName.split(' ')[0] : undefined;
  const lastName = urlName ? (urlName.split(' ').slice(1).join(' ') || undefined) : undefined;
  const customerData = {
    id: normalizedId,
    customer_id: normalizedId,
    email: urlEmail ?? undefined,
    name: urlName ?? undefined,
    firstName,
    lastName,
  };
  // Clear old customer data before storing new (different account login)
  localStorage.removeItem('customerData');
  localStorage.removeItem('phraseotomy_session_token');
  if ((window as any).__PHRASEOTOMY_CUSTOMER__) delete (window as any).__PHRASEOTOMY_CUSTOMER__;
  if (typeof window !== "undefined" && window.location.hostname === "phraseotomy.ourstagingserver.com") {
    clearCustomerDataCookie();
  }
  localStorage.setItem('customerData', JSON.stringify(customerData));
  (window as any).__PHRASEOTOMY_CUSTOMER__ = customerData;
  if (shopParam) localStorage.setItem('shop_domain', shopParam);
  if (typeof window !== "undefined" && window.location.hostname === "phraseotomy.ourstagingserver.com") {
    setCustomerDataCookie(customerData);
  }
  console.log('✅ [INIT] Customer data from URL customer_id stored');
} else if (customerParam) {
  try {
    const customerData = JSON.parse(customerParam);
    console.log('🔍 [INIT] Parsed customer data:', customerData);
    
    // New customer from URL (e.g. after Shopify login) – clear old customer data first
    localStorage.removeItem('customerData');
    localStorage.removeItem('phraseotomy_session_token');
    if ((window as any).__PHRASEOTOMY_CUSTOMER__) delete (window as any).__PHRASEOTOMY_CUSTOMER__;
    if (typeof window !== "undefined" && window.location.hostname === "phraseotomy.ourstagingserver.com") {
      clearCustomerDataCookie();
    }
    
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
      
      (window as any).__PHRASEOTOMY_CUSTOMER__ = customerData;
      console.log('✅ [INIT] Guest data stored:', {
        playerId: customerData.id,
        playerName: guestName,
      });
    } else {
      // Normalize id/customer_id to string so APIs get consistent format (URL may send number)
      const normalized = {
        ...customerData,
        id: String(customerData.id ?? customerData.customer_id ?? ''),
        customer_id: String(customerData.customer_id ?? customerData.id ?? ''),
      };
      localStorage.setItem('customerData', JSON.stringify(normalized));
      (window as any).__PHRASEOTOMY_CUSTOMER__ = normalized;
      if (typeof window !== "undefined" && window.location.hostname === "phraseotomy.ourstagingserver.com") {
        setCustomerDataCookie(normalized);
      }
      console.log('✅ [INIT] Customer data stored');
    }
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

// On play-online path: if no Shopify cookie, clear session (logout from Shopify = logout from app)
const isPlayOnlinePath = typeof window !== 'undefined' && window.location.pathname.includes('/pages/play-online');
const cookieCustomerCheck = getCustomerFromShopifyCookie();
console.log('🔍 [INIT] Cookie check:', {
  isPlayOnlinePath,
  pathname: typeof window !== 'undefined' ? window.location.pathname : '',
  hasCookieCustomer: !!cookieCustomerCheck,
  cookieCustomer: cookieCustomerCheck ? { id: cookieCustomerCheck.customer_id } : null,
});
if (isPlayOnlinePath && !cookieCustomerCheck) {
  console.log('🔍 [INIT] No cookie on play-online, clearing session');
  localStorage.removeItem('customerData');
  localStorage.removeItem('phraseotomy_session_token');
  localStorage.removeItem('shop_domain');
  if ((window as any).__PHRASEOTOMY_CUSTOMER__) delete (window as any).__PHRASEOTOMY_CUSTOMER__;
  if (typeof window !== "undefined" && window.location.hostname === "phraseotomy.ourstagingserver.com") {
    clearCustomerDataCookie();
  }
}

// If no URL customer/customer_id param, check Shopify cookie (set when customer logs in via Shopify)
if (!customerParam && !customerIdParam) {
  const cookieCustomer = cookieCustomerCheck || getCustomerFromShopifyCookie();
  if (cookieCustomer) {
    console.log('🔍 [INIT] Customer data from Shopify cookie');
    const name = [cookieCustomer.customer_first_name, cookieCustomer.customer_last_name].filter(Boolean).join(' ') || undefined;
    const customerData = {
      id: cookieCustomer.customer_id,
      customer_id: cookieCustomer.customer_id,
      email: cookieCustomer.customer_email,
      name,
      firstName: cookieCustomer.customer_first_name,
      lastName: cookieCustomer.customer_last_name,
    };
    localStorage.setItem('customerData', JSON.stringify(customerData));
    (window as any).__PHRASEOTOMY_CUSTOMER__ = customerData;
    const tenant = getTenantByAppDomain(window.location.hostname);
    if (tenant?.shopDomain) {
      localStorage.setItem('shop_domain', tenant.shopDomain);
    }
    if (window.location.hostname === "phraseotomy.ourstagingserver.com") {
      setCustomerDataCookie(cookieCustomer);
    }
    console.log('✅ [INIT] Customer from cookie stored');
  }
}

createRoot(document.getElementById("root")!).render(
  isRedirecting ? (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-[#fbbf24]">
      Redirecting…
    </div>
  ) : (
    <App />
  )
);
