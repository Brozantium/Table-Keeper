// Dice roller (/tools/dice-roller). Reads dice notation (2d6+3, 1d20-1,
// 4d6kh3, 4d6dl1, 2d20kl1, d%, 1d8+1d6+2), rolls with crypto.getRandomValues
// and keeps the last 20 rolls. Advantage or disadvantage turns every lone d20
// into 2d20 keep highest or lowest. The form is static HTML from
// scripts/seo-tools.mjs.
(() => {
  const form = document.getElementById("dr");
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const MAX_DICE = 100;
  const MAX_SIDES = 1000;
  const MAX_TERMS = 20;
  const HISTORY = 20;

  /** A fair integer from 1 to sides: values past the last whole multiple of `sides` are thrown away, so no face is favored. */
  const buffer = new Uint32Array(1);
  function die(sides) {
    const limit = Math.floor(2 ** 32 / sides) * sides;
    let x;
    do {
      crypto.getRandomValues(buffer);
      x = buffer[0];
    } while (x >= limit);
    return (x % sides) + 1;
  }

  class NotationError extends Error {}

  /** Terms of a roll: { sign, count, sides, keep: { how: "kh"|"kl"|"dh"|"dl", n } } or { sign, value }. */
  function parse(text) {
    const src = text.replace(/\s+/g, "").toLowerCase();
    if (!src) throw new NotationError("Type some dice to roll, like 2d6+3.");
    const term = /([+-]?)(?:(\d*)d(\d+|%)(?:(kh|kl|dh|dl|k|d)(\d+))?|(\d+))/y;
    const terms = [];
    let at = 0;
    while (at < src.length) {
      term.lastIndex = at;
      const m = term.exec(src);
      if (!m || (terms.length > 0 && !m[1])) throw new NotationError(`Couldn’t read “${src.slice(at)}”. Try something like 2d6+3 or 4d6kh3.`);
      at = term.lastIndex;
      const sign = m[1] === "-" ? -1 : 1;
      if (m[6] !== undefined) {
        const value = Number(m[6]);
        if (value > 100000) throw new NotationError("That number is too big.");
        terms.push({ sign, value });
        continue;
      }
      const count = m[2] === "" ? 1 : Number(m[2]);
      const sides = m[3] === "%" ? 100 : Number(m[3]);
      if (count < 1 || count > MAX_DICE) throw new NotationError(`Roll between 1 and ${MAX_DICE} dice at a time.`);
      if (sides < 2 || sides > MAX_SIDES) throw new NotationError(`Dice need between 2 and ${MAX_SIDES.toLocaleString("en-US")} sides.`);
      let keep = null;
      if (m[4]) {
        const how = m[4] === "k" ? "kh" : m[4] === "d" ? "dl" : m[4];
        const n = Number(m[5]);
        const keeping = how[0] === "k";
        if (keeping ? n < 1 || n > count : n < 1 || n >= count) {
          throw new NotationError(keeping ? `Keep between 1 and ${count} of ${count} dice.` : `Drop fewer than the ${count} dice rolled.`);
        }
        keep = { how, n };
      }
      terms.push({ sign, count, sides, keep });
    }
    if (terms.length > MAX_TERMS) throw new NotationError(`Use at most ${MAX_TERMS} terms.`);
    return terms;
  }

  /** Advantage or disadvantage: every lone d20 becomes two, keeping the higher or lower. */
  function withMode(terms, mode) {
    if (mode === "normal") return terms;
    return terms.map((t) => (t.sides === 20 && t.count === 1 && !t.keep ? { ...t, count: 2, keep: { how: mode === "adv" ? "kh" : "kl", n: 1 } } : t));
  }

  const notation = (terms) =>
    terms
      .map((t, i) => {
        const sign = t.sign < 0 ? "-" : i ? "+" : "";
        if (t.value !== undefined) return `${sign}${t.value}`;
        return `${sign}${t.count}d${t.sides}${t.keep ? `${t.keep.how}${t.keep.n}` : ""}`;
      })
      .join("");

  /** Roll every term: each dice term gets its dice and which of them count. */
  function roll(terms) {
    let total = 0;
    const parts = terms.map((t) => {
      if (t.value !== undefined) {
        total += t.sign * t.value;
        return { term: t, value: t.value };
      }
      const dice = Array.from({ length: t.count }, () => die(t.sides));
      let kept = dice.map(() => true);
      if (t.keep) {
        // Rank dice low to high (earlier dice first on ties), then keep the right slice.
        const order = dice.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, i]) => i);
        const { how, n } = t.keep;
        const keepIdx = how === "kh" ? order.slice(-n) : how === "kl" ? order.slice(0, n) : how === "dl" ? order.slice(n) : order.slice(0, t.count - n);
        const set = new Set(keepIdx);
        kept = dice.map((_, i) => set.has(i));
      }
      const value = dice.reduce((s, v, i) => s + (kept[i] ? v : 0), 0);
      total += t.sign * value;
      return { term: t, dice, kept, value };
    });
    return { total, parts };
  }

  /** The breakdown as DOM nodes: "[14, ~~6~~] + 5", dropped dice struck through (and announced as dropped). */
  function breakdown(result) {
    const frag = document.createDocumentFragment();
    result.parts.forEach((p, i) => {
      if (i || p.term.sign < 0) frag.append(i ? (p.term.sign < 0 ? " − " : " + ") : "−");
      if (!p.dice) {
        frag.append(String(p.value));
        return;
      }
      frag.append("[");
      p.dice.forEach((v, j) => {
        if (j) frag.append(", ");
        if (p.kept[j]) frag.append(String(v));
        else {
          const s = document.createElement("s");
          s.className = "drop";
          const said = document.createElement("span");
          said.className = "sr-only";
          said.textContent = "dropped ";
          s.append(said, String(v));
          frag.append(s);
        }
      });
      frag.append("]");
    });
    return frag;
  }

  const total = $("dr-total");
  const detail = $("dr-detail");
  const history = $("dr-history");
  const empty = $("dr-empty");

  function run(text) {
    let terms;
    try {
      terms = withMode(parse(text), form.elements.mode.value);
    } catch (error) {
      if (!(error instanceof NotationError)) throw error;
      total.textContent = "—";
      detail.className = "dr-detail error";
      detail.textContent = error.message;
      return;
    }
    const result = roll(terms);
    const shown = notation(terms);
    total.textContent = result.total.toLocaleString("en-US");
    detail.className = "dr-detail";
    detail.textContent = `${shown}: `;
    detail.append(breakdown(result));

    const li = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = shown;
    const strong = document.createElement("strong");
    strong.textContent = result.total.toLocaleString("en-US");
    const parts = document.createElement("span");
    parts.className = "faint";
    parts.append(breakdown(result));
    li.append(code, strong, parts);
    history.prepend(li);
    while (history.children.length > HISTORY) history.lastElementChild.remove();
    empty.hidden = true;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(form.elements.expr.value);
  });
  form.querySelector(".dr-quick").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-roll]");
    if (!button) return;
    form.elements.expr.value = button.dataset.roll;
    run(button.dataset.roll);
  });
  $("dr-clear").addEventListener("click", () => {
    history.textContent = "";
    empty.hidden = false;
  });
})();
