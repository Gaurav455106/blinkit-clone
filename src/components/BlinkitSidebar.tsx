import { Menu, LayoutGrid, ShoppingBag, Eye, BarChart3, BookOpen, ChevronRight, LogOut } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { WhatsNewCard } from "./WhatsNewCard";
import { useSim } from "@/context/SimContext";

const navItems = [
  { title: "Campaigns", icon: LayoutGrid, active: true },
  { title: "Brand Collections", icon: ShoppingBag, active: false },
  { title: "Visibility Plans", icon: Eye, active: false },
  { title: "Insights", icon: BarChart3, active: false },
  { title: "Catalogue", icon: BookOpen, active: false },
];

export function BlinkitSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const nav = useNavigate();
  const { student, reset } = useSim();

  const signOut = () => {
    localStorage.removeItem("sim_trainer");
    reset();
    nav("/", { replace: true });
  };

  return (
    <div className={`flex flex-col border-r border-border bg-card h-screen transition-all ${collapsed ? "w-16" : "w-64"}`}>

      {/* Header */}
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

      {/* Navigation */}
      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <button
            key={item.title}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
              item.active
                ? "bg-accent text-accent-foreground font-medium border-r-2 border-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.title}</span>
                <ChevronRight className="h-4 w-4 opacity-50" />
              </>
            )}
          </button>
        ))}
      </nav>

      {/* What's New */}
      {!collapsed && (
        <div className="p-4">
          <WhatsNewCard />
        </div>
      )}

      {/* Sign out */}
      <button
        onClick={signOut}
        className="flex items-center gap-3 px-4 py-3 text-sm border-t border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Sign out"
      >
        <LogOut className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <span className="flex-1 text-left truncate">
            {student ? `Sign out (${student.name})` : "Sign out"}
          </span>
        )}
      </button>
    </div>
  );
}
