import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SimProvider, useSim } from "@/context/SimContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Brief from "./pages/Brief";
import CmPitch from "./pages/CmPitch";
import Campaign from "./pages/Campaign";
import LiveDashboard from "./pages/LiveDashboard";
import SetupScoreCard from "./pages/SetupScoreCard";
import Day30Results from "./pages/Day30Results";
import Leaderboard from "./pages/Leaderboard";
import Trainer from "./pages/Trainer";
import Admin from "./pages/Admin";

import SSOCallback from "./pages/SSOCallback";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

/** Allows trainers AND admins to access /trainer */
function TrainerGuard({ children }: { children: React.ReactNode }) {
  const role = localStorage.getItem("sim_role");
  // Legacy support: old sessions may have sim_trainer = "1" without sim_role
  const legacy = localStorage.getItem("sim_trainer") === "1";
  const allowed = role === "trainer" || role === "admin" || legacy;
  return allowed ? <>{children}</> : <Navigate to="/" replace />;
}

/** Allows only admins to access /admin */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const role = localStorage.getItem("sim_role");
  return role === "admin" ? <>{children}</> : <Navigate to="/" replace />;
}

function FlowGuard({ children }: { children: React.ReactNode }) {
  const { mode } = useSim();
  if (mode === "home") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SimProvider>
          <Routes>
            {/* Core student flow */}
            <Route path="/sso"       element={<SSOCallback />} />
            <Route path="/"          element={<Login />} />
            <Route path="/login"     element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/brief"        element={<FlowGuard><Brief /></FlowGuard>} />
            <Route path="/cm-pitch"     element={<FlowGuard><CmPitch /></FlowGuard>} />
            <Route path="/campaign"     element={<FlowGuard><Campaign /></FlowGuard>} />
            <Route path="/setup-score"  element={<FlowGuard><SetupScoreCard /></FlowGuard>} />
            <Route path="/simulation"   element={<FlowGuard><LiveDashboard /></FlowGuard>} />
            <Route path="/results"      element={<FlowGuard><Day30Results /></FlowGuard>} />

            {/* Utility */}
            <Route path="/leaderboard" element={<Leaderboard />} />

            {/* Trainer — accessible by trainers and admins */}
            <Route path="/trainer" element={<TrainerGuard><Trainer /></TrainerGuard>} />

            {/* Admin — accessible by admins only */}
            <Route path="/admin" element={<AdminGuard><Admin /></AdminGuard>} />

            {/* Legacy redirects */}
            <Route path="/brand-central"        element={<Navigate to="/dashboard" replace />} />
            <Route path="/campaigns-dashboard"  element={<Navigate to="/campaign"  replace />} />
            <Route path="/live-dashboard"       element={<Navigate to="/simulation" replace />} />
            <Route path="/run-results"          element={<Navigate to="/results"   replace />} />
            <Route path="/day-7"                element={<Navigate to="/simulation" replace />} />
            <Route path="/day-14"               element={<Navigate to="/simulation" replace />} />
            <Route path="/day-21"               element={<Navigate to="/simulation" replace />} />
            <Route path="/day-30-results"       element={<Navigate to="/results"   replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </SimProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
