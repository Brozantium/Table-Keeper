// Point buy calculator (/tools/point-buy-calculator). The form is static HTML
// from scripts/seo-tools.mjs; this recomputes it on every change and keeps the
// build in the URL hash (#e=2024&s=15.14.13.12.10.8&p=21&a=int.con) so it can
// be shared. Costs, budget and the standard array come from data attributes.
(() => {
  const form = document.getElementById("pb");
  if (!form) return;
  const COST = JSON.parse(form.dataset.costs);
  const BUDGET = Number(form.dataset.budget);
  const ARRAY = form.dataset.array.split(",").map(Number);
  const KEYS = ["str", "dex", "con", "int", "wis", "cha"];
  const NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
  const $ = (id) => document.getElementById(id);
  const signed = (n) => (n < 0 ? `−${-n}` : `+${n}`);
  const mod = (score) => Math.floor((score - 10) / 2);
  const clamp = (n, lo, hi, fallback) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback);
  const rows = Object.fromEntries(KEYS.map((k) => [k, form.querySelector(`tr[data-ability="${k}"]`)]));
  const picks = [0, 1, 2].map((i) => form.elements[`pick${i}`]);

  /** The build as the form shows it. */
  function read() {
    return {
      edition: form.elements.edition.value,
      scores: KEYS.map((k) => Number(form.elements[k].value)),
      pattern: form.elements.pattern.value,
      picks: picks.map((p) => p.value),
      custom: KEYS.map((k) => clamp(Number(form.elements[`custom-${k}`].value), -2, 2, 0)),
    };
  }

  function write(state) {
    form.elements.edition.value = state.edition;
    KEYS.forEach((k, i) => (form.elements[k].value = String(state.scores[i])));
    form.elements.pattern.value = state.pattern;
    picks.forEach((p, i) => (p.value = state.picks[i] ?? ""));
    KEYS.forEach((k, i) => (form.elements[`custom-${k}`].value = String(state.custom[i])));
  }

  /** Per-ability bonuses, and whether the chosen abilities repeat. */
  function bonuses(state) {
    if (state.pattern === "custom") return { bonus: state.custom, repeated: false };
    const amounts = state.pattern === "111" ? [1, 1, 1] : [2, 1];
    const bonus = KEYS.map(() => 0);
    const seen = new Set();
    let repeated = false;
    amounts.forEach((amount, i) => {
      const k = state.picks[i];
      if (!k) return;
      if (seen.has(k)) repeated = true;
      else bonus[KEYS.indexOf(k)] += amount;
      seen.add(k);
    });
    return { bonus, repeated };
  }

  function render() {
    const state = read();
    // Custom racial bonuses are a 2014 option only.
    if (state.edition === "2024" && state.pattern === "custom") {
      form.elements.pattern.value = "21";
      state.pattern = "21";
    }
    for (const el of form.querySelectorAll("[data-edition]")) el.hidden = el.dataset.edition !== state.edition;
    $("pb-bonus-legend").textContent = state.edition === "2024" ? "Background bonuses" : "Racial bonuses";
    const custom = state.pattern === "custom";
    form.querySelector(".pb-picks").hidden = custom;
    picks[2].closest("label").hidden = state.pattern !== "111";
    const labels = state.pattern === "111" ? ["+1 to", "+1 to", "+1 to"] : ["+2 to", "+1 to", "+1 to"];
    picks.forEach((p, i) => (p.closest("label").querySelector(".pick-label").textContent = labels[i]));

    const { bonus, repeated } = bonuses(state);
    const spent = state.scores.reduce((total, s) => total + COST[s], 0);
    const left = BUDGET - spent;
    let mods = 0;
    KEYS.forEach((k, i) => {
      const row = rows[k];
      const total = state.scores[i] + bonus[i];
      mods += mod(total);
      row.querySelector(".pb-cost").textContent = String(COST[state.scores[i]]);
      const out = row.querySelector(".pb-bonus");
      out.hidden = custom;
      out.textContent = bonus[i] ? signed(bonus[i]) : "—";
      row.querySelector(".pb-custom").hidden = !custom;
      row.querySelector(".pb-total").textContent = String(total);
      row.querySelector(".pb-mod").textContent = signed(mod(total));
    });
    $("pb-left").textContent = String(Math.abs(left));
    $("pb-left-label").textContent = left >= 0 ? `points left of ${BUDGET}` : `points over ${BUDGET}`;
    $("pb-left-box").classList.toggle("over", left < 0);
    $("pb-mods").textContent = signed(mods);

    const over20 = KEYS.filter((k, i) => state.scores[i] + bonus[i] > 20).map((k) => NAMES[k]);
    const problems = [];
    if (left < 0) problems.push(`You’ve spent ${-left} ${left === -1 ? "point" : "points"} more than the ${BUDGET} you have. Lower a score.`);
    if (repeated) problems.push("Pick a different ability for each increase.");
    if (over20.length) problems.push(`${over20.join(" and ")} can’t go above 20.`);
    const msg = $("pb-msg");
    msg.classList.remove("ok");
    msg.textContent = problems.join(" ");
    return state;
  }

  const hashOf = (s) =>
    `e=${s.edition}&s=${s.scores.join(".")}&p=${s.pattern}` + (s.pattern === "custom" ? `&c=${s.custom.join(".")}` : `&a=${s.picks.join(".")}`);

  function fromHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (!params.has("s")) return false;
    const base = read();
    const scores = (params.get("s") ?? "").split(".").map(Number);
    const edition = params.get("e") === "2014" ? "2014" : "2024";
    const pattern = ["21", "111", "custom"].includes(params.get("p")) ? params.get("p") : "21";
    write({
      edition,
      scores: KEYS.map((_, i) => clamp(scores[i], 8, 15, 8)),
      pattern: pattern === "custom" && edition === "2024" ? "21" : pattern,
      picks: (params.get("a") ?? "").split(".").slice(0, 3).map((k) => (KEYS.includes(k) ? k : "")),
      custom: ((params.get("c") ?? "").split(".").map(Number)).concat(base.custom).slice(0, 6).map((n) => clamp(n, -2, 2, 0)),
    });
    return true;
  }

  function update() {
    const state = render();
    history.replaceState(null, "", `${location.pathname}${location.search}#${hashOf(state)}`);
  }

  form.addEventListener("change", update);
  form.addEventListener("input", (event) => {
    if (event.target.classList.contains("pb-custom")) update();
  });
  form.addEventListener("submit", (event) => event.preventDefault());

  // The standard array keeps your priorities: the highest score gets 15, the next 14, and so on.
  $("pb-array").addEventListener("click", () => {
    const state = read();
    const order = KEYS.map((_, i) => i).sort((a, b) => state.scores[b] - state.scores[a] || a - b);
    order.forEach((index, rank) => (state.scores[index] = ARRAY[rank]));
    write(state);
    update();
  });
  $("pb-reset").addEventListener("click", () => {
    const state = read();
    state.scores = KEYS.map(() => 8);
    write(state);
    update();
  });
  $("pb-copy").addEventListener("click", async () => {
    update();
    const msg = $("pb-msg");
    try {
      await navigator.clipboard.writeText(location.href);
      msg.textContent = "Link copied. Anyone who opens it sees this build.";
      msg.classList.add("ok");
    } catch {
      msg.textContent = "Couldn’t copy automatically: copy the page’s address to share this build.";
    }
  });
  window.addEventListener("hashchange", () => {
    if (fromHash()) render();
  });

  fromHash();
  render();
})();
