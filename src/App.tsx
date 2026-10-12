import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SimProvider, useSim } from "@/context/SimContext";
import { lazy, Suspense } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

// Each later stage loads when it's first opened, so login and the dashboard
// don't wait for the engine, charts and Excel code.
const Brief = lazy(() => import("./pages/Brief"));
const CmPitch = lazy(() => import("./pages/CmPitch"));
const Campaign = lazy(() => import("./pages/Campaign"));
const LiveDashboard = lazy(() => import("./pages/LiveDashboard"));
const SetupScoreCard = lazy(() => import("./pages/SetupScoreCard"));
const Day30Results = lazy(() => import("./pages/Day30Results"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Trainer = lazy(() => import("./pages/Trainer"));
const Admin = lazy(() => import("./pages/Admin"));
const MyProfilePage = lazy(() => import("./pages/StudentProfile"));
const StaffStudentProfilePage = lazy(() => import("./pages/StudentProfile").then((m) => ({ default: m.StaffStudentProfilePage })));

import SSOCallback from "./pages/SSOCallback";
import { StaffReturnBar } from "@/components/StaffReturnBar";
import NotFound from "./pages/NotFound.tsx";
import { HUB_URL, syncMasterFlag } from "@/lib/masterAccess";

const queryClient = new QueryClient();

function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Loading">
      <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/**
 * Gates the app behind the Kraftshala Hub.
 *
 * Passes if the visitor is authenticated (sim_role from SSO, or a student in
 * context), or if this browser has sticky master access. Everyone else is sent
 * to the hub to launch properly.
 *
 * The master check runs BEFORE the redirect on purpose — that's the lockout
 * insurance. If the hub or SSO is down, ?master=<key> still gets you in.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { student } = useSim();
  const simRole = localStorage.getItem("sim_role");
  const master  = syncMasterFlag();

  if (simRole || student || master) return <>{children}</>;

  window.location.replace(HUB_URL);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
        <StaffReturnBar />
        <SimProvider>
          <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* Core student flow */}
            {/* /sso must stay OUTSIDE AuthGuard — it runs pre-auth, and gating it
                would deadlock the SSO handshake. /login is open for the same reason. */}
            <Route path="/sso"       element={<SSOCallback />} />
            <Route path="/"          element={<Login />} />
            <Route path="/login"     element={<Login />} />

            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/brief"        element={<AuthGuard><FlowGuard><Brief /></FlowGuard></AuthGuard>} />
            <Route path="/cm-pitch"     element={<AuthGuard><FlowGuard><CmPitch /></FlowGuard></AuthGuard>} />
            <Route path="/campaign"     element={<AuthGuard><FlowGuard><Campaign /></FlowGuard></AuthGuard>} />
            <Route path="/setup-score"  element={<AuthGuard><FlowGuard><SetupScoreCard /></FlowGuard></AuthGuard>} />
            <Route path="/simulation"   element={<AuthGuard><FlowGuard><LiveDashboard /></FlowGuard></AuthGuard>} />
            <Route path="/results"      element={<AuthGuard><FlowGuard><Day30Results /></FlowGuard></AuthGuard>} />

            {/* Utility */}
            <Route path="/leaderboard" element={<AuthGuard><Leaderboard /></AuthGuard>} />
            <Route path="/profile"     element={<AuthGuard><MyProfilePage /></AuthGuard>} />

            {/* Trainer — accessible by trainers and admins */}
            <Route path="/trainer" element={<AuthGuard><TrainerGuard><Trainer /></TrainerGuard></AuthGuard>} />
            <Route path="/trainer/student/:email" element={<AuthGuard><TrainerGuard><StaffStudentProfilePage /></TrainerGuard></AuthGuard>} />

            {/* Admin — accessible by admins only */}
            <Route path="/admin" element={<AuthGuard><AdminGuard><Admin /></AdminGuard></AuthGuard>} />
            <Route path="/admin/student/:email" element={<AuthGuard><AdminGuard><StaffStudentProfilePage /></AdminGuard></AuthGuard>} />

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
          </Suspense>
        </SimProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
