import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const STORAGE_KEY = "table-keeper.theme.v2";
const LEGACY_STORAGE_KEY = "dnd.theme";
const themeSource = fs.readFileSync(new URL("../theme.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../assets/index-LPPEBOoe.js", import.meta.url), "utf8");
const themeCss = fs.readFileSync(new URL("../theme-system.css", import.meta.url), "utf8");
const popoverSource = fs.readFileSync(new URL("../src/obr/popover.ts", import.meta.url), "utf8");

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function bootstrap(storage = createStorage()) {
  const listeners = new Map();
  const root = {
    classList: {
      add() {},
    },
    dataset: {},
    style: {},
  };
  const document = {
    documentElement: root,
    querySelector() {
      return null;
    },
  };
  const window = {
    addEventListener(type, listener) {
      const registered = listeners.get(type) ?? new Set();
      registered.add(listener);
      listeners.set(type, registered);
    },
    dispatchEvent(event) {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return true;
    },
  };
  class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  vm.runInNewContext(themeSource, {
    CustomEvent,
    document,
    getComputedStyle() {
      return { getPropertyValue: () => "" };
    },
    localStorage: storage,
    location: { hash: "", pathname: "/", search: "" },
    requestAnimationFrame(callback) {
      callback();
    },
    window,
  });

  return { root, storage, theme: window.TableKeeperTheme };
}

function saved(storage) {
  return JSON.parse(storage.getItem(STORAGE_KEY));
}

function assertApplied(instance, expected) {
  assert.deepEqual(saved(instance.storage), expected);
  assert.equal(instance.root.dataset.colorTheme, expected.color);
  assert.equal(instance.root.dataset.appearance, expected.appearance);
  assert.equal(instance.root.dataset.theme, `${expected.color}-${expected.appearance}`);
  assert.equal(instance.root.dataset.themePreference, `${expected.color}-${expected.appearance}`);
}

const colors = ["purple", "blue", "red", "yellow", "green"];

{
  const instance = bootstrap();
  assertApplied(instance, { color: "purple", appearance: "dark" });
}

for (const appearance of ["dark", "light"]) {
  const instance = bootstrap();
  instance.theme.setPreference({ appearance });
  for (let iteration = 0; iteration < 20; iteration += 1) {
    for (const color of colors) {
      instance.theme.setPreference({ color });
      assertApplied(instance, { color, appearance });
    }
  }
}

{
  const instance = bootstrap();
  const operations = [
    { color: "blue" },
    { appearance: "light" },
    { color: "purple" },
    { color: "green" },
    { appearance: "dark" },
    { color: "yellow" },
    { appearance: "light" },
    { color: "red" },
  ];
  for (const operation of operations) instance.theme.setPreference(operation);
  assertApplied(instance, { color: "red", appearance: "light" });

  const reloaded = bootstrap(instance.storage);
  assertApplied(reloaded, { color: "red", appearance: "light" });
}

{
  const storage = createStorage({
    [STORAGE_KEY]: JSON.stringify({ color: "green", appearance: "auto" }),
  });
  const instance = bootstrap(storage);
  assertApplied(instance, { color: "green", appearance: "dark" });
}

{
  const storage = createStorage({ [LEGACY_STORAGE_KEY]: "light" });
  const instance = bootstrap(storage);
  assertApplied(instance, { color: "purple", appearance: "light" });
  assert.equal(storage.getItem(LEGACY_STORAGE_KEY), null);
}

{
  const instance = bootstrap();
  instance.theme.setPreference({ color: "blue", appearance: "light" });
  instance.theme.setHostTheme({ mode: "DARK" });
  assertApplied(instance, { color: "blue", appearance: "light" });
}

assert.match(appSource, /useSyncExternalStore/);
assert.match(appSource, /setPreference\(\{color:/);
assert.match(appSource, /setPreference\(\{appearance:`light`\}\)/);
assert.match(appSource, /setPreference\(\{appearance:`dark`\}\)/);
assert.doesNotMatch(appSource, /purple-auto/);
assert.doesNotMatch(appSource, /children:`Auto`/);
assert.doesNotMatch(appSource, /Following (?:Owlbear Rodeo|your device) appearance/);
assert.doesNotMatch(appSource, /setPreferenceToken\(pe\)/);
assert.doesNotMatch(appSource, /Sn,\{theme:pe,onChange:me\}/);
assert.doesNotMatch(themeCss, /theme-auto-note/);
assert.doesNotMatch(themeCss, /button:first-of-type:nth-last-of-type\(3\)/);
assert.match(popoverSource, /TableKeeperTheme\?\.setHostTheme\(theme\)/);
assert.match(themeSource, /function setHostTheme\(\) \{/);

console.log("Theme consistency checks passed.");
