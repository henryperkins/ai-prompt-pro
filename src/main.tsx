import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { startTelemetryListener } from "./lib/telemetry";
import "./styles/globals.css";

startTelemetryListener();

createRoot(document.getElementById("root")!).render(<App />);
