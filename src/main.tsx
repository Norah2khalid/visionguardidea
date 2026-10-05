import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PlatformProvider } from "@/app/platform";
import { App } from "@/App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlatformProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PlatformProvider>
  </StrictMode>,
);
