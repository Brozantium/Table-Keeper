// Multiclass spell slot calculator (/tools/multiclass-spell-slot-calculator).
// Works out the multiclass spellcaster level (full casters count fully;
// paladin and ranger half, rounded down in 2014 and up in 2024; artificer half
// rounded up; Eldritch Knight and Arcane Trickster a third, rounded down), or a
// single spellcasting class's own table, and warlock Pact Magic separately.
// The tables come from data-slots and data-pact (scripts/seo-tools.mjs), and
// the build lives in the URL hash (#e=2014&paladin=5&sorcerer=3).
(() => {
  const form = document.getElementById("ss");
  if (!form) return;
  const SLOTS = JSON.parse(form.dataset.slots);
  const PACT = JSON.parse(form.dataset.pact);
  const $ = (id) => document.getElementById(id);
  const inputs = [...form.querySelectorAll("input[data-kind]")];
  const label = (input) => input.closest("label").firstElementChild.firstChild.textContent.trim();
  const ordinal = (n) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
  const clamp = (value) => Math.min(20, Math.max(0, Math.round(Number(value) || 0)));

  /** Same rules as casterLevel() in seo-tools.mjs. */
  function casterLevel(classes, edition) {
    const minLevel = (kind) => (kind === "third" ? 3 : kind === "half" && edition === "2014" ? 2 : 1);
    const casting = classes.filter((c) => c.level >= minLevel(c.kind));
    if (casting.length === 0) return { level: 0, single: false };
    if (casting.length === 1) {
      const [c] = casting;
      return { level: c.kind === "full" ? c.level : Math.ceil(c.level / (c.kind === "third" ? 3 : 2)), single: c };
    }
    const part = (c) => (c.kind === "full" ? c.level : c.kind === "third" ? Math.floor(c.level / 3) : c.kind === "artificer" || edition === "2024" ? Math.ceil(c.level / 2) : Math.floor(c.level / 2));
    return { level: Math.min(20, classes.reduce((t, c) => t + part(c), 0)), single: false };
  }

  /** Same sentence as casterHow() in seo-tools.mjs. */
  function how(classes, r, edition) {
    if (r.level === 0) return classes.length ? "None of these classes has the Spellcasting feature yet." : "Enter your class levels.";
    if (r.single) return `${r.single.name} ${r.single.level} is your only spellcasting class, so it uses its own table: the slots of a level ${r.level} spellcaster.`;
    const part = (c) => {
      if (c.kind === "full") return `${c.name} ${c.level}`;
      const by = c.kind === "third" ? 3 : 2;
      const up = c.kind === "artificer" || (c.kind === "half" && edition === "2024");
      return `${c.name} ${c.level} ÷ ${by}, rounded ${up ? "up" : "down"} (${up ? Math.ceil(c.level / by) : Math.floor(c.level / by)})`;
    };
    return `${classes.map(part).join(" + ")} = ${r.level}`;
  }

  function render() {
    const edition = form.elements.edition.value;
    const levels = inputs.map((input) => ({ id: input.name, name: label(input), kind: input.dataset.kind, level: clamp(input.value) }));
    const classes = levels.filter((c) => c.kind !== "pact" && c.level > 0);
    const r = casterLevel(classes, edition);
    $("ss-level").textContent = String(r.level);
    $("ss-how").textContent = how(classes, r, edition);
    const row = r.level ? SLOTS[r.level - 1] : SLOTS[0].map(() => 0);
    [...$("ss-slots").children].forEach((cell, i) => (cell.textContent = row[i] ? String(row[i]) : "—"));

    const warlock = levels.find((c) => c.kind === "pact").level;
    const pact = $("ss-pact");
    pact.textContent = "";
    const strong = document.createElement("strong");
    strong.textContent = "Pact Magic:";
    if (warlock) {
      const [count, slotLevel] = PACT[warlock - 1];
      pact.append(strong, ` ${count} ${ordinal(slotLevel)}-level ${count === 1 ? "slot" : "slots"} (Warlock ${warlock}), regained on a short rest.`);
    } else {
      pact.append(strong, " none (no warlock levels).");
    }

    const total = levels.reduce((t, c) => t + c.level, 0);
    $("ss-msg").classList.remove("ok");
    $("ss-msg").textContent = total > 20 ? `That’s ${total} character levels; a character tops out at 20.` : "";
    return { edition, levels };
  }

  function update() {
    const { edition, levels } = render();
    const parts = levels.filter((c) => c.level > 0).map((c) => `${c.id}=${c.level}`);
    history.replaceState(null, "", `${location.pathname}${location.search}#${[`e=${edition}`, ...parts].join("&")}`);
  }

  function fromHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (!params.has("e")) return;
    form.elements.edition.value = params.get("e") === "2014" ? "2014" : "2024";
    for (const input of inputs) input.value = String(clamp(params.get(input.name)));
    render();
  }

  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("input", update);
  form.addEventListener("change", (event) => {
    // Tidy a typed value like "25" or "" into the 0–20 range once the field is left.
    if (event.target.dataset.kind) event.target.value = String(clamp(event.target.value));
    update();
  });
  $("ss-copy").addEventListener("click", async () => {
    update();
    const msg = $("ss-msg");
    try {
      await navigator.clipboard.writeText(location.href);
      msg.textContent = "Link copied. Anyone who opens it sees this build.";
      msg.classList.add("ok");
    } catch {
      msg.textContent = "Couldn’t copy automatically: copy the page’s address to share this build.";
    }
  });
  window.addEventListener("hashchange", fromHash);
  render();
  fromHash();
})();
