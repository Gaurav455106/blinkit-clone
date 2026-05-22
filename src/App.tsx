import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SimProvider } from "@/context/SimContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Brief from "./pages/Brief";
import CmPitch from "./pages/CmPitch";
import Campaign from "./pages/Campaign";
import LiveDashboard from "./pages/LiveDashboard";
import Day30Results from "./pages/Day30Results";
import Leaderboard from "./pages/Leaderboard";
import Trainer from "./pages/Trainer";

import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SimProvider>
          <Routes>
            {/* Core 7 */}
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/brief" element={<Brief />} />
            <Route path="/cm-pitch" element={<CmPitch />} />
            <Route path="/campaign" element={<Campaign />} />
            <Route path="/simulation" element={<LiveDashboard />} />
            <Route path="/results" element={<Day30Results />} />

            {/* Utility */}
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/trainer" element={<Trainer />} />

            {/* Legacy redirects */}
            <Route path="/brand-central" element={<Navigate to="/dashboard" replace />} />
            <Route path="/campaigns-dashboard" element={<Navigate to="/campaign" replace />} />
            <Route path="/live-dashboard" element={<Navigate to="/simulation" replace />} />
            <Route path="/run-results" element={<Navigate to="/results" replace />} />
            <Route path="/day-7" element={<Navigate to="/simulation" replace />} />
            <Route path="/day-14" element={<Navigate to="/simulation" replace />} />
            <Route path="/day-21" element={<Navigate to="/simulation" replace />} />
            <Route path="/day-30-results" element={<Navigate to="/results" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </SimProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
