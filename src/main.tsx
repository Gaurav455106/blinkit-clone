import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { engineOverride } from "./lib/engineFlag";
import "./index.css";

// Honour ?engine=v1|v2|auto on any page, before anything renders
engineOverride();

createRoot(document.getElementById("root")!).render(<App />);
