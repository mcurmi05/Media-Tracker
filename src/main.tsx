import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/layout/index.css";
import App from "./App";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react"
import React from "react";



createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <SpeedInsights />
      <Analytics/>
    </BrowserRouter>
  </React.StrictMode>

);
