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
import NotFound from "./pages/NotFound";
import AdminHome from "./pages/admin/AdminHome";
import Codes from "./pages/admin/Codes";
import Packs from "./pages/admin/Packs";

const queryClient = new QueryClient();

const RootRedirect = () => {
  const [shouldRedirectToAdmin, setShouldRedirectToAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if accessed from Shopify admin (has 'host' parameter)
    const urlParams = getAllUrlParams();
    const hostParam = urlParams.get('host');
    const shopParam = urlParams.get('shop');
    
    // If host parameter exists, it's from Shopify admin/embedded app
    if (hostParam || shopParam) {
      console.log('Accessed from Shopify admin, redirecting to /admin');
      setShouldRedirectToAdmin(true);
    } else {
      console.log('Accessed from normal browser, redirecting to /login');
      setShouldRedirectToAdmin(false);
    }
    
    setIsChecking(false);
  }, []);

  if (isChecking) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return <Navigate to={shouldRedirectToAdmin ? "/admin" : "/login"} replace />;
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
