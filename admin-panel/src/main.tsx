import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Every route is a React.lazy() dynamic import (see router/index.tsx). A new
// deploy renames content-hashed chunk files, so a tab that's been open
// across a deploy — or one serving a stale cached shell from the service
// worker (see public/sw.js) — can ask for a route chunk that no longer
// exists and fail with "Failed to fetch dynamically imported module". Vite
// fires this event for exactly that failure; reload once to pick up the
// current index.html/chunk graph instead of leaving the user stuck on the
// error screen. Guarded to fire at most once per tab so a genuinely broken
// deploy doesn't reload forever.
window.addEventListener("vite:preloadError", () => {
  const key = "vite-reload-on-preload-error";
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
