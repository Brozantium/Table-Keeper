import "./obr.css";
import { installBasePathAdapter } from "./base-path";
import { initializePopover } from "./obr/popover";

installBasePathAdapter();

void import("../assets/index-LPPEBOoe.js").catch((error) => {
  console.error("[table-keeper] Main application startup failed", error);
});

const integrationLifecycle = new AbortController();
window.addEventListener("pagehide", () => integrationLifecycle.abort(), { once: true });
void initializePopover(integrationLifecycle.signal).catch((error) => {
  console.error("[table-keeper] Owlbear popover startup failed", error);
});
