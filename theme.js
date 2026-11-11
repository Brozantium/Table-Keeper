// Table Keeper theme bootstrap. This runs before the application to avoid a
// flash of the wrong appearance and is also shared by the static reference pages.
(function initializeTheme() {
"use strict";

document.documentElement.classList.add("js");

const STORAGE_KEY = "table-keeper.theme.v2";
const LEGACY_STORAGE_KEY = "dnd.theme";
const COLORS = new Set(["purple", "blue", "red", "yellow", "green"]);
const APPEARANCES = new Set(["light", "dark"]);

let preference = readPreference();

function readPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const saved = JSON.parse(stored);
        const migrated = {
          color: COLORS.has(saved?.color) ? saved.color : "purple",
          // The former Auto mode migrates to the new initial default.
          appearance: APPEARANCES.has(saved?.appearance) ? saved.appearance : "dark",
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      } catch {
        // Fall through to the legacy preference or the initial default.
      }
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const initial = {
      color: "purple",
      appearance: APPEARANCES.has(legacy) ? legacy : "dark",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return initial;
  } catch {
    return { color: "purple", appearance: "dark" };
  }
}

function applyTheme(notify = false) {
  const mode = preference.appearance;
  const root = document.documentElement;
  root.dataset.colorTheme = preference.color;
  root.dataset.appearance = mode;
  root.dataset.themePreference = `${preference.color}-${mode}`;
  root.dataset.theme = `${preference.color}-${mode}`;
  root.style.colorScheme = mode;

  const updateThemeColor = () => {
    const themeColor = getComputedStyle(root).getPropertyValue("--accent").trim();
    if (themeColor) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
    }
  };
  updateThemeColor();
  requestAnimationFrame(updateThemeColor);

  if (notify) {
    window.dispatchEvent(
      new CustomEvent("tablekeeper:themechange", {
        detail: {
          preference: `${preference.color}-${preference.appearance}`,
          color: preference.color,
          appearance: preference.appearance,
          effectiveMode: mode,
        },
      }),
    );
  }
}

function setPreference(next) {
  const color = COLORS.has(next?.color) ? next.color : preference.color;
  // Missing or invalid fields preserve the corresponding current preference.
  const appearance = APPEARANCES.has(next?.appearance)
    ? next.appearance
    : preference.appearance;
  preference = { color, appearance };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage may be blocked in a privacy-focused browser; the live preview still works.
  }
  applyTheme(true);
}

function setPreferenceToken(token) {
  const [color, appearance] = String(token).split("-");
  setPreference({ color, appearance });
}

function setHostTheme() {
  // Owlbear theme notifications are intentionally ignored. Color and
  // appearance are personal preferences stored in this browser.
}

window.TableKeeperTheme = {
  getPreference: () => ({ ...preference }),
  getPreferenceToken: () => `${preference.color}-${preference.appearance}`,
  setPreference,
  setPreferenceToken,
  setHostTheme,
};

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  preference = readPreference();
  applyTheme(true);
});
applyTheme();

// Keep the imported application's landing routing behavior.
try {
  if (
    /^\/(characters(\/|$)|table\/?$)/.test(location.pathname) ||
    /[?&](join|dm|import|donation|view|code)=/.test(location.search) ||
    /(share|access_token)=/.test(location.hash)
  ) {
    document.documentElement.classList.add("skip-landing");
  }
  let returning = localStorage.getItem("dnd.characters.v1") !== null;
  for (let index = 0; !returning && index < localStorage.length; index += 1) {
    returning = /^sb-.+-auth-token$/.test(localStorage.key(index) || "");
  }
  if (returning) document.documentElement.classList.add("returning");
} catch {
  // Storage blocked: treat this as a first visit.
}
})();
