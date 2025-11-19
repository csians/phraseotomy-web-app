import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Play from "./pages/Play";
import NotFound from "./pages/NotFound";
import AdminHome from "./pages/admin/AdminHome";
import Codes from "./pages/admin/Codes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/play" replace />} />
          <Route path="/play" element={<Play />} />
          <Route path="/apps/phraseotomy" element={<Play />} />
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/codes" element={<Codes />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
