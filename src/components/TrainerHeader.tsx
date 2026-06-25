import { Link, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, LayoutDashboard, Trophy, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSim } from "@/context/SimContext";

export function TrainerHeader() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { reset } = useSim();

  const simRole = localStorage.getItem("sim_role");
  const isAdmin = simRole === "admin";

  const signOut = () => {
    localStorage.removeItem("sim_role");
    // legacy key cleanup
    localStorage.removeItem("sim_trainer");
    reset();
    nav("/", { replace: true });
  };

  const linkCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    }`;

  const isDash  = pathname === "/trainer";
  const isAdmin_ = pathname === "/admin";
  const isLb    = pathname === "/leaderboard";

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border">
      <div className="max-w-6xl mx-auto px-8 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to={isAdmin ? "/admin" : "/trainer"} className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded flex items-center justify-center ${isAdmin ? "bg-amber-500" : "bg-primary"}`}>
            {isAdmin
              ? <ShieldCheck className="h-4 w-4 text-white" />
              : <GraduationCap className="h-4 w-4 text-primary-foreground" />
            }
          </div>
          <span className="font-semibold text-sm text-foreground">
            {isAdmin ? "Admin Console" : "Trainer Console"}
          </span>
          {isAdmin && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Admin
            </span>
          )}
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {/* Trainer tab — visible to both trainer and admin */}
          <Link to="/trainer" className={linkCls(isDash)}>
            <LayoutDashboard className="h-4 w-4" /> Trainer View
          </Link>

          {/* Admin-only tab */}
          {isAdmin && (
            <Link to="/admin" className={linkCls(isAdmin_)}>
              <ShieldCheck className="h-4 w-4" /> Admin Panel
            </Link>
          )}

          <Link to="/leaderboard" className={linkCls(isLb)}>
            <Trophy className="h-4 w-4" /> Leaderboard
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="gap-1.5 text-muted-foreground hover:text-foreground ml-2"
          >
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </nav>
      </div>
    </header>
  );
}
