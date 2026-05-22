import { Link, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, LayoutDashboard, Trophy, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSim } from "@/context/SimContext";

export function TrainerHeader() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { reset } = useSim();

  const signOut = () => {
    localStorage.removeItem("sim_trainer");
    reset();
    nav("/", { replace: true });
  };

  const linkCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
      active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
    }`;

  const isDash = pathname === "/trainer";
  const isLb = pathname === "/leaderboard";

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border">
      <div className="max-w-6xl mx-auto px-8 h-14 flex items-center justify-between">
        <Link to="/trainer" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground">Trainer Console</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link to="/trainer" className={linkCls(isDash)}>
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link to="/leaderboard" className={linkCls(isLb)}>
            <Trophy className="h-4 w-4" /> Leaderboard
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-muted-foreground hover:text-foreground ml-2">
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </nav>
      </div>
    </header>
  );
}
