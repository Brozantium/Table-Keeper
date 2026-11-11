import "./obr.css";
import { installBasePathAdapter } from "./base-path";
import { initializePopover } from "./obr/popover";

installBasePathAdapter();
await initializePopover();
await import("../assets/index-LPPEBOoe.js");
