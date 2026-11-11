// Encounter calculator (/tools/encounter-calculator). The form is static HTML
// from scripts/seo-tools.mjs, which also puts the XP tables in data-rules
// (from seo-encounters.mjs) and writes /tools/monsters.json for the picker.
// The encounter lives in the URL hash so it can be shared:
// #e=2014&p=4x3.1x5&m=4x1/2.1x2:ogre (count x level; count x CR[:monster id]).
(() => {
  const form = document.getElementById("enc");
  if (!form) return;
  const R = JSON.parse(form.dataset.rules);
  const $ = (id) => document.getElementById(id);
  const num = (n) => n.toLocaleString("en-US");
  const partyList = $("enc-party");
  const monsterList = $("enc-monsters");
  const clampInt = (value, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(value) || lo)));

  /** 2014 multiplier for the number of monsters, a step up for small parties and down for big ones (as seo-encounters.mjs). */
  function multiplier(count, size) {
    if (count < 1) return 0;
    const base = count === 1 ? 1 : count === 2 ? 2 : count <= 6 ? 3 : count <= 10 ? 4 : count <= 14 ? 5 : 6;
    const step = size < 3 ? base + 1 : size >= 6 ? base - 1 : base;
    return R.steps[Math.max(0, Math.min(R.steps.length - 1, step))];
  }

  // ------------------------------------------------------------------ rows

  function addRow(list, templateId) {
    const row = $(templateId).content.firstElementChild.cloneNode(true);
    list.append(row);
    return row;
  }
  const rowsOf = (list) => [...list.children];

  /** A monster row picked by name carries its id and XP; changing the CR by hand makes it a plain row again. */
  function nameRow(row, monster) {
    const name = row.querySelector(".row-name");
    name.textContent = "";
    if (!monster) {
      delete row.dataset.id;
      delete row.dataset.xp;
      return;
    }
    row.dataset.id = monster.id;
    row.dataset.xp = String(monster.xp);
    name.append(monster.name, ` · ${monster.type}`);
  }

  function readState() {
    return {
      edition: form.elements.edition.value,
      party: rowsOf(partyList).map((row) => [clampInt(row.querySelector('[name="count"]').value, 1, 20), Number(row.querySelector('[name="level"]').value)]),
      foes: rowsOf(monsterList).map((row) => {
        const cr = row.querySelector('[name="cr"]').value;
        return { count: clampInt(row.querySelector('[name="count"]').value, 1, 50), cr, xp: row.dataset.xp ? Number(row.dataset.xp) : R.xp[cr], id: row.dataset.id };
      }),
    };
  }

  // ---------------------------------------------------------------- rating

  function rate(state) {
    const size = state.party.reduce((t, [n]) => t + n, 0);
    const total = state.foes.reduce((t, f) => t + f.count * f.xp, 0);
    const count = state.foes.reduce((t, f) => t + f.count, 0);
    const perChar = size ? Math.floor(total / size) : 0;
    if (state.edition === "2024") {
      const budgets = R.names2024.map((_, i) => state.party.reduce((t, [n, level]) => t + n * R.budgets[level][i], 0));
      const band = budgets.findIndex((b) => total <= b);
      return { total, perChar, size, bands: R.names2024.map((d, i) => [d, budgets[i]]), current: band, label: band < 0 ? "Beyond High" : R.names2024[band] };
    }
    const thresholds = R.names2014.map((_, i) => state.party.reduce((t, [n, level]) => t + n * R.thresholds[level][i], 0));
    const mult = multiplier(count, size);
    const adjusted = total * mult;
    const band = thresholds.findLastIndex((t) => adjusted >= t);
    return { total, perChar, size, multiplier: mult, adjusted, bands: R.names2014.map((d, i) => [d, thresholds[i]]), current: band, label: band < 0 ? "Below Easy" : R.names2014[band] };
  }

  /** Same sentence as encSummary() in seo-tools.mjs. */
  function summary(r) {
    const who = `${r.size} ${r.size === 1 ? "character" : "characters"}`;
    if (r.total === 0) return "Add monsters to rate the encounter.";
    if (r.multiplier === undefined) {
      return r.current < 0
        ? `${num(r.total)} XP is over the High budget of ${num(r.bands[2][1])} XP for ${who}.`
        : `${num(r.total)} XP fits the ${r.label} budget of ${num(r.bands[r.current][1])} XP for ${who}.`;
    }
    return r.current < 0
      ? `${num(r.adjusted)} adjusted XP is under the Easy threshold of ${num(r.bands[0][1])} XP for ${who}.`
      : `${num(r.adjusted)} adjusted XP reaches the ${r.label} threshold of ${num(r.bands[r.current][1])} XP for ${who}.`;
  }

  function render() {
    const state = readState();
    const r = rate(state);
    const is2014 = state.edition === "2014";
    for (const el of form.querySelectorAll("[data-edition]")) el.hidden = el.dataset.edition !== state.edition;
    $("enc-band").textContent = r.total === 0 ? "—" : r.label;
    $("enc-summary").textContent = summary(r);
    $("enc-total").textContent = num(r.total);
    $("enc-per").textContent = num(r.perChar);
    if (is2014) {
      $("enc-mult").textContent = `×${r.multiplier}`;
      $("enc-adjusted").textContent = num(r.adjusted);
    }
    $("enc-bands-head").textContent = is2014 ? "Party threshold" : "Party budget";
    const body = $("enc-bands");
    body.textContent = "";
    r.bands.forEach(([name, xp], i) => {
      const tr = document.createElement("tr");
      const current = r.total > 0 && i === r.current;
      if (current) tr.className = "is-current";
      const label = document.createElement("td");
      label.textContent = name;
      if (current) {
        const here = document.createElement("span");
        here.className = "here";
        here.textContent = "this encounter";
        label.append(" ", here);
      }
      const value = document.createElement("td");
      value.className = "num";
      value.textContent = `${num(xp)} XP`;
      tr.append(label, value);
      body.append(tr);
    });
    // The last row of each list can't be removed: an encounter needs a party.
    for (const list of [partyList, monsterList]) {
      const rows = rowsOf(list);
      rows.forEach((row) => (row.querySelector(".remove").disabled = rows.length === 1));
    }
    return state;
  }

  // ------------------------------------------------------------------ hash

  const hashOf = (s) =>
    `e=${s.edition}&p=${s.party.map(([n, l]) => `${n}x${l}`).join(".")}&m=${s.foes.map((f) => `${f.count}x${f.cr}${f.id ? `:${f.id}` : ""}`).join(".")}`;

  function update() {
    const state = render();
    history.replaceState(null, "", `${location.pathname}${location.search}#${hashOf(state)}`);
  }

  async function fromHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (!params.has("p") && !params.has("m")) return;
    form.elements.edition.value = params.get("e") === "2014" ? "2014" : "2024";
    const party = (params.get("p") ?? "").split(".").map((e) => e.split("x")).filter(([n, l]) => Number(n) > 0 && R.budgets[l]);
    const foes = (params.get("m") ?? "").split(".").map((e) => /^(\d+)x([\d/]+)(?::([a-z0-9-]+))?$/.exec(e)).filter((m) => m && R.xp[m[2]] !== undefined);
    if (party.length) {
      partyList.textContent = "";
      for (const [n, l] of party) {
        const row = addRow(partyList, "enc-party-row");
        row.querySelector('[name="count"]').value = String(clampInt(n, 1, 20));
        row.querySelector('[name="level"]').value = l;
      }
    }
    monsterList.textContent = "";
    for (const [, n, cr, id] of foes) {
      const row = addRow(monsterList, "enc-monster-row");
      row.querySelector('[name="count"]').value = String(clampInt(n, 1, 50));
      row.querySelector('[name="cr"]').value = cr;
      if (id) row.dataset.id = id;
    }
    if (!monsterList.children.length) addRow(monsterList, "enc-monster-row");
    else monsterList.dataset.touched = "1";
    render();
    // Named monsters get their names (and exact XP) once the index arrives.
    const named = rowsOf(monsterList).filter((row) => row.dataset.id);
    if (named.length) {
      const index = await loadIndex();
      for (const row of named) {
        const monster = index.find((m) => m.id === row.dataset.id);
        if (monster && monster.cr === row.querySelector('[name="cr"]').value) nameRow(row, monster);
        else nameRow(row, null);
      }
      render();
    }
  }

  // ---------------------------------------------------------------- picker

  let indexPromise = null;
  function loadIndex() {
    indexPromise ??= fetch(form.dataset.index)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .catch(() => {
        indexPromise = null;
        return [];
      });
    return indexPromise;
  }

  const search = $("enc-q");
  const results = $("enc-results");
  const status = $("enc-q-status");
  let matches = [];

  async function runSearch() {
    const q = search.value.trim().toLowerCase();
    const index = await loadIndex();
    if (q !== search.value.trim().toLowerCase()) return; // typed on while loading
    results.textContent = "";
    if (!index.length) {
      status.textContent = "The monster list didn’t load. Add monsters by challenge rating instead.";
      return;
    }
    if (!q) {
      matches = [];
      status.textContent = `Searches the ${index.length} SRD monsters.`;
      return;
    }
    const starts = index.filter((m) => m.name.toLowerCase().startsWith(q));
    const contains = index.filter((m) => !m.name.toLowerCase().startsWith(q) && m.name.toLowerCase().includes(q));
    matches = [...starts, ...contains].slice(0, 8);
    const found = starts.length + contains.length;
    status.textContent = found ? `${found} ${found === 1 ? "match" : "matches"}${found > 8 ? ", showing 8" : ""}. Pick one to add it.` : "No monster by that name. Try part of the name.";
    for (const m of matches) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.id = m.id;
      const note = document.createElement("span");
      note.className = "faint";
      note.textContent = `CR ${m.cr} · ${num(m.xp)} XP · ${m.type}`;
      button.append(`Add ${m.name}`, note);
      li.append(button);
      results.append(li);
    }
  }

  function addMonster(monster) {
    // Adding the same monster again counts it up instead of adding a row.
    const existing = rowsOf(monsterList).find((row) => row.dataset.id === monster.id);
    if (existing) {
      const count = existing.querySelector('[name="count"]');
      count.value = String(clampInt(Number(count.value) + 1, 1, 50));
    } else {
      // Replace the untouched starting row rather than adding beside it.
      const rows = rowsOf(monsterList);
      const blank = rows.length === 1 && !rows[0].dataset.id && !monsterList.dataset.touched ? rows[0] : null;
      const row = blank ?? addRow(monsterList, "enc-monster-row");
      row.querySelector('[name="count"]').value = "1";
      row.querySelector('[name="cr"]').value = monster.cr;
      nameRow(row, monster);
    }
    monsterList.dataset.touched = "1";
    status.textContent = `Added ${monster.name}.`;
    update();
  }

  search.addEventListener("focus", loadIndex, { once: true });
  search.addEventListener("input", runSearch);
  search.addEventListener("keydown", (event) => {
    // Enter adds the first match rather than submitting the form.
    if (event.key === "Enter") {
      event.preventDefault();
      if (matches[0]) addMonster(matches[0]);
    }
  });
  results.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-id]");
    if (!button) return;
    const monster = (await loadIndex()).find((m) => m.id === button.dataset.id);
    if (monster) addMonster(monster);
  });

  // ---------------------------------------------------------------- wiring

  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("input", (event) => {
    if (event.target === search) return;
    if (event.target.name === "cr") nameRow(event.target.closest(".row"), null);
    if (event.target.closest("#enc-monsters")) monsterList.dataset.touched = "1";
    update();
  });
  form.addEventListener("change", (event) => {
    if (event.target === search) return;
    update();
  });
  form.addEventListener("click", (event) => {
    const remove = event.target.closest(".remove");
    if (!remove) return;
    const row = remove.closest(".row");
    const list = row.parentElement;
    if (list.children.length === 1) return;
    const next = row.nextElementSibling ?? row.previousElementSibling;
    row.remove();
    next?.querySelector(".remove")?.focus();
    update();
  });
  $("enc-add-party").addEventListener("click", () => {
    const row = addRow(partyList, "enc-party-row");
    row.querySelector("input").focus();
    update();
  });
  $("enc-add-monster").addEventListener("click", () => {
    const row = addRow(monsterList, "enc-monster-row");
    monsterList.dataset.touched = "1";
    row.querySelector("input").focus();
    update();
  });
  $("enc-copy").addEventListener("click", async () => {
    update();
    const msg = $("enc-msg");
    try {
      await navigator.clipboard.writeText(location.href);
      msg.textContent = "Link copied. Anyone who opens it sees this encounter.";
      msg.classList.add("ok");
    } catch {
      msg.textContent = "Couldn’t copy automatically: copy the page’s address to share this encounter.";
      msg.classList.remove("ok");
    }
  });
  window.addEventListener("hashchange", fromHash);

  render();
  fromHash();
})();
