import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSim } from "@/context/SimContext";

const NotFound = () => {
  const { pathname } = useLocation();
  const { student } = useSim();
  const home = student ? { to: "/dashboard", label: "Back to your dashboard" } : { to: "/", label: "Go to the start" };

  return (
    <main className="sim-ui flex min-h-[100dvh] items-center px-6 py-16">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="mb-10 flex items-center gap-2.5">
          <div aria-hidden className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F8CB2E] text-sm font-black text-[#1a1a1a]">b</div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-foreground">blinkit</p>
            <p className="text-[11px] text-muted-foreground">Ads Simulation</p>
          </div>
        </div>
        <p className="sim-num text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground md:text-4xl">This page doesn't exist</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          There's nothing at <code className="sim-mono rounded bg-secondary px-1.5 py-0.5 text-[13px] text-foreground">{pathname}</code>.
          The link may be old or mistyped. Your progress is saved, so nothing is lost.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to={home.to}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" /> {home.label}
          </Link>
          {student && (
            <Link to="/brief" className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-foreground hover:bg-secondary">
              Open your brief
            </Link>
          )}
        </div>
      </div>
    </main>
  );
};

export default NotFound;
