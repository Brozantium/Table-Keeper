// Ability score roller (/tools/ability-score-roller). Rolls six scores with
// 4d6 drop lowest, 3d6 or 4d6 rerolling 1s (crypto.getRandomValues), shows
// every die and the one dropped, and prices the set with the extended point
// buy costs from data-costs. The page's static HTML shows an example set in the
// same layout; a fresh set replaces it as soon as this loads.
(() => {
  const form = document.getElementById("asr");
  if (!form) return;
  const COST = JSON.parse(form.dataset.costs);
  const $ = (id) => document.getElementById(id);
  const signed = (n) => (n < 0 ? `−${-n}` : `+${n}`);
  const minus = (n) => (n < 0 ? `−${-n}` : String(n));
  const mod = (score) => Math.floor((score - 10) / 2);

  const buffer = new Uint32Array(1);
  function d6() {
    const limit = Math.floor(2 ** 32 / 6) * 6;
    let x;
    do {
      crypto.getRandomValues(buffer);
      x = buffer[0];
    } while (x >= limit);
    return (x % 6) + 1;
  }

  /** One score: its dice, the index of the dropped die (or -1) and the total. */
  function rollScore(method) {
    const count = method === "3d6" ? 3 : 4;
    const dice = Array.from({ length: count }, () => {
      let v = d6();
      if (method === "4d6r1") while (v === 1) v = d6();
      return v;
    });
    const drop = count === 4 ? dice.indexOf(Math.min(...dice)) : -1;
    return { dice, drop, total: dice.reduce((s, v, i) => s + (i === drop ? 0 : v), 0) };
  }

  function row(score) {
    const li = document.createElement("li");
    const dice = document.createElement("span");
    dice.className = "asr-dice";
    score.dice.forEach((v, i) => {
      const d = document.createElement("span");
      d.className = i === score.drop ? "die dropped" : "die";
      if (i === score.drop) {
        const said = document.createElement("span");
        said.className = "sr-only";
        said.textContent = "dropped ";
        d.append(said);
      }
      d.append(String(v));
      dice.append(d);
    });
    const total = document.createElement("span");
    total.className = "asr-score";
    total.textContent = String(score.total);
    const m = document.createElement("span");
    m.className = "asr-mod";
    m.textContent = signed(mod(score.total));
    li.append(dice, total, m);
    return li;
  }

  function rollAll(announce = true) {
    const method = form.elements.method.value;
    const scores = Array.from({ length: 6 }, () => rollScore(method));
    $("asr-list").replaceChildren(...scores.map(row));
    const totals = scores.map((s) => s.total);
    const sum = totals.reduce((a, b) => a + b, 0);
    const mods = totals.reduce((a, s) => a + mod(s), 0);
    const points = totals.reduce((a, s) => a + COST[s], 0);
    $("asr-total").textContent = String(sum);
    $("asr-mods").textContent = signed(mods);
    $("asr-points").textContent = minus(points);
    if (announce) $("asr-live").textContent = `Rolled ${totals.join(", ")}. Total ${sum}, modifiers ${signed(mods)}, worth ${minus(points)} points.`;
  }

  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("change", (event) => {
    if (event.target.name === "method") rollAll();
  });
  $("asr-roll").addEventListener("click", () => rollAll());
  rollAll(false);
})();
