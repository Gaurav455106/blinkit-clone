import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { useSim } from "@/context/SimContext";

const HUB_URL  = "https://simulationmixer-dv360-more.vercel.app";
const SIM_SLUG = "blinkit-sim";

// Fetches and caches the hub's public key — no credentials needed
const JWKS = createRemoteJWKSet(
  new URL(`${HUB_URL}/.well-known/jwks.json`)
);

export default function SSOCallback() {
  const nav = useNavigate();
  const { setStudent } = useSim();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (!token) {
        setError("No token provided. Please launch the simulation from the Kraftshala Hub.");
        return;
      }

      try {
        const { payload } = await jwtVerify(token, JWKS, {
          issuer:   HUB_URL,
          audience: SIM_SLUG,
        });

        const name    = payload.name    as string;
        const email   = payload.email   as string;
        const simRole = payload.sim_role as string;
        const batch   = (payload.batch  as string | null) ?? "";
        const course  = (payload.course as string | null) ?? "";

        // Map sim_role → internal role + redirect
        if (simRole === "super_admin") {
          localStorage.setItem("sim_role", "admin");
          nav("/admin", { replace: true });

        } else if (simRole === "instructor") {
          localStorage.setItem("sim_role", "trainer");
          nav("/trainer", { replace: true });

        } else if (simRole === "student") {
          localStorage.setItem("sim_role", "student");
          setStudent({
            name:  name,
            email: email.toLowerCase(),
            batch: batch || course || "HUB",
          });
          nav("/dashboard", { replace: true });

        } else {
          setError(`Unknown role "${simRole}". Please contact your Kraftshala admin.`);
        }

      } catch (err) {
        console.error("SSO token rejected:", err);
        setError("Login failed — your session link has expired or is invalid. Please go back to the Kraftshala Hub and launch again.");
      }
    };

    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-bold text-foreground">Login Failed</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a
            href="https://simulationmixer-dv360-more.vercel.app"
            className="inline-block mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            Back to Kraftshala Hub
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
