import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SimProvider } from "@/context/SimContext";
import Login from "./pages/Login";
import Brief from "./pages/Brief";
import Index from "./pages/Index.tsx";
import Results from "./pages/Results";
import Leaderboard from "./pages/Leaderboard";
import Trainer from "./pages/Trainer";
import TrainerBatch from "./pages/TrainerBatch";
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
            <Route path="/" element={<Login />} />
            <Route path="/brief" element={<Brief />} />
            <Route path="/campaign" element={<Index />} />
            <Route path="/results" element={<Results />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/trainer" element={<Trainer />} />
            <Route path="/trainer/:batch" element={<TrainerBatch />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SimProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
