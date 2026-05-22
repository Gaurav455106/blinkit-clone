import { Menu, Home, FileText, MessageSquare, LayoutGrid, Activity, Trophy, BarChart3, LogOut } from "lucide-react";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSim } from "@/context/SimContext";

const HOME_ITEMS = [
  { title: "Dashboard", icon: Home, path: "/dashboard" },
  { title: "Leaderboard", icon: BarChart3, path: "/leaderboard" },
];

const FLOW_ITEMS = [
  { title: "Dashboard", icon: Home, path: "/dashboard" },
  { title: "Brief", icon: FileText, path: "/brief" },
  { title: "CM Pitch", icon: MessageSquare, path: "/cm-pitch" },
  { title: "Campaigns", icon: LayoutGrid, path: "/campaign" },
  { title: "Simulation", icon: Activity, path: "/simulation" },
  { title: "Results", icon: Trophy, path: "/results" },
  { title: "Leaderboard", icon: BarChart3, path: "/leaderboard" },
];

export function BlinkitSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const { student, reset, mode } = useSim();

  const signOut = () => {
    localStorage.removeItem("sim_trainer");
    reset();
    nav("/", { replace: true });
  };

  // Route-based nav: dashboard/leaderboard always show home nav, even if a run is active.
  const isHomeRoute = loc.pathname === "/dashboard" || loc.pathname === "/leaderboard";
  const navItems = isHomeRoute || mode === "home" ? HOME_ITEMS : FLOW_ITEMS;

  return (
    <div className={`flex flex-col border-r border-border bg-card h-screen transition-all ${collapsed ? "w-16" : "w-56"}`}>
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={() => setCollapsed(!collapsed)} className="text-foreground hover:text-primary">
          <Menu className="h-5 w-5" />
        </button>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">B</span>
            </div>
            <span className="font-semibold text-sm text-foreground">Brand Panel</span>
          </div>
        )}
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const active = loc.pathname === item.path;
          return (
            <button
              key={item.title}
              onClick={() => nav(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-accent text-accent-foreground font-medium border-r-2 border-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{item.title}</span>}
            </button>
          );
        })}
      </nav>

      <button
        onClick={signOut}
        className="flex items-center gap-3 px-4 py-3 text-sm border-t border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Sign out"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <span className="flex-1 text-left truncate">
            {student ? `Sign out (${student.name})` : "Sign out"}
          </span>
        )}
      </button>
    </div>
  );
}
