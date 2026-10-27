
const D = __DATA__;
const root = document.querySelector(".sg");
const stage = root.querySelector(".sg-stage");
const svg = stage.querySelector("svg");
const readout = root.querySelector("[data-readout]");
const part = (name) => svg.querySelector(`[data-part="${name}"]`);
const still = matchMedia("(prefers-reduced-motion: reduce)");
const P = D.P;
const at = (p) => iso(p, P);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (a, b, t) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const bump = (a, b, t) => Math.sin(Math.PI * clamp01((t - a) / (b - a)));
const NS = "http://www.w3.org/2000/svg";
const LOT_N = LOT.length;
const formOf = (i) => LOT[((i % LOT_N) + LOT_N) % LOT_N];
const rejected = (form) => !FORMS[form].plant;

const belt = part("belt");
const slats = part("slats");
const rod = part("rod");
const platePart = part("plate");
const gate = part("gate");
const disc = part("disc");
const riders = { divert: part("riders-divert"), tenera: part("riders-tenera"), reject: part("riders-reject") };
const wells = [...svg.querySelectorAll("[data-well]")];
const cells = [...svg.querySelectorAll("[data-cell]")];
const fruits = Object.fromEntries(ORDER.map((f) => [f, svg.querySelector(`[data-fruit="${f}"]`)]));
const glows = Object.fromEntries(ORDER.map((f) => [f, svg.querySelector(`[data-glow="${f}"]`)]));
const lamps = Object.fromEntries(ORDER.map((f) => [f, svg.querySelector(`[data-lamp="${f}"]`)]));
const leds = Object.fromEntries(ORDER.map((f) => [f, svg.querySelector(`[data-led="${f}"]`)]));
const gateLed = svg.querySelector("[data-gate-led]");
const readLed = svg.querySelector(".sg-read");
const screen1 = svg.querySelector('[data-screen="1"]');
const screen2 = svg.querySelector('[data-screen="2"]');
const palms = [...svg.querySelectorAll("[data-palm]")];
const stat = (name) => root.querySelector(`[data-stat="${name}"]`);
const buttons = [...root.querySelectorAll("[data-plant]")];
const oil = [0, 1].map((i) => svg.querySelector(`[data-oil="${i}"]`));
const glass = [0, 1].map((i) => svg.querySelector(`[data-glass="${i}"]`));

// The route the disc takes from the punch, resampled by length for even speed.
const route = D.ROUTE;
const lengths = [0];
for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1], route[i][2] - route[i - 1][2]));
function along(share) {
  const want = share * lengths[lengths.length - 1];
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < want) i++;
  const t = (want - lengths[i - 1]) / Math.max(1e-6, lengths[i] - lengths[i - 1]);
  return route[i - 1].map((v, j) => v + (route[i][j] - v) * clamp01(t));
}

// ------------------------------------------------------------ state
// Cycle c: the belt advances, item c reaches the punch, its disc goes to well c, it is read.
// Item i sits at belt position c - i + 1 + advance; item c - 6 leaves the belt for the gate.
const START = 6;
let cycle = START;
let t = 0;
let running = false;
let stepping = false;
let frame = 0;
let last = 0;
const CYCLE = 2.8;
const items = new Map();

function makeItem(i) {
  const g = document.createElementNS(NS, "g");
  g.innerHTML = D.SEEDLINGS[((i % 4) + 4) % 4];
  g.dataset.item = i;
  return { i, g, seedling: g.querySelector(".sg-seedling"), puck: g.querySelector(".sg-puck"), home: null };
}
function place(item, parent, before = null) {
  if (item.home === parent) return;
  if (before) parent.insertBefore(item.g, before);
  else parent.appendChild(item.g);
  item.home = parent;
}
function lotStart(c) {
  return c - (((c % LOT_N) + LOT_N) % LOT_N);
}
function counted(c, t) {
  // items read in the current lot by cycle c, phase t
  const first = lotStart(c);
  const done = t >= 0.9 ? c : c - 1;
  const forms = [];
  for (let i = first; i <= done; i++) forms.push(formOf(i));
  return { screened: forms.length, counts: countsOf(forms), last: done >= first ? formOf(done) : null };
}

function gateFor(c) {
  return rejected(formOf(c - 6)) ? 0.55 : -0.55;
}
let gateAngle = gateFor(START);

function draw() {
  const adv = ease(0, 0.3, t);
  // belt slats and seedlings on the belt
  slats.setAttribute("d", slatsAtLive(adv * D.PITCH + cycle * D.PITCH));
  const alive = new Set();
  for (let i = cycle - 6; i <= cycle + 2; i++) {
    const pos = cycle - i + 1 + adv;
    if (pos < -1) continue;
    let item = items.get(i);
    if (!item) {
      item = makeItem(i);
      items.set(i, item);
    }
    alive.add(i);
    const punched = i < cycle || (i === cycle && t > 0.43);
    item.seedling.toggleAttribute("data-punched", punched);
    if (i === cycle - 6) leave(item);
    else {
      const x = D.SLOT0 + pos * D.PITCH;
      place(item, belt, belt.firstChild && i > cycle - 5 ? null : null);
      item.g.setAttribute("transform", translateAlong(P, [x, D.YC, 0]));
      item.g.style.opacity = pos < 0 ? String(clamp01(pos + 1)) : "1";
      if (item.puck) item.puck.style.opacity = "1";
    }
  }
  // keep belt children in depth order: farthest (smallest x, highest i) first
  const onBelt = [...items.values()].filter((it) => it.home === belt).sort((a, b) => b.i - a.i);
  onBelt.forEach((it, n) => {
    if (belt.children[n] !== it.g) belt.insertBefore(it.g, belt.children[n] || null);
  });
  for (const [i, item] of items) if (!alive.has(i)) {
    item.g.remove();
    items.delete(i);
  }

  // punch rod
  const down = bump(0.34, 0.52, t);
  rod.setAttribute("transform", translateAlong(P, [0, 0, D.ROD_REST - D.ROD_STROKE * down]));

  // sample plate indexes so well (cycle mod 24) sits under the nozzle
  const wellOf = (c) => D.WELLS[((c % LOT_N) + LOT_N) % LOT_N];
  const from = wellOf(cycle - 1);
  const to = wellOf(cycle);
  const share = lotStart(cycle) === cycle ? ease(0.02, 0.3, t) : ease(0.05, 0.3, t);
  const wx = from[0] + (to[0] - from[0]) * share;
  const wy = from[1] + (to[1] - from[1]) * share;
  platePart.setAttribute("transform", translateAlong(P, [D.PLATE_HOME[0] - wx, D.PLATE_HOME[1] - wy, 0]));
  const first = lotStart(cycle);
  wells.forEach((w, n) => {
    const i = first + n;
    const filled = i < cycle || (i === cycle && t >= 0.83);
    w.toggleAttribute("data-filled", filled);
    const read = i < cycle || (i === cycle && t >= 0.9);
    if (read) w.dataset.form = formOf(i);
    else delete w.dataset.form;
  });

  // the disc: flash at the leaf, up into the head, along the tube, down into the well
  let dp = null;
  let da = 0;
  if (t > 0.42 && t < 0.52) {
    const lift = D.ROD_REST - D.ROD_STROKE * down;
    dp = [D.PUNCH_TIP[0], D.PUNCH_TIP[1], D.PUNCH_TIP[2] + lift - (D.ROD_REST - D.ROD_STROKE) - 0.4];
    da = 1 - ease(0.48, 0.52, t);
  } else if (t >= 0.55 && t < 0.75) {
    dp = along(ease(0.55, 0.75, t));
    da = ease(0.55, 0.57, t) * (1 - ease(0.73, 0.75, t));
  } else if (t >= 0.76 && t < 0.84) {
    const s = ease(0.76, 0.84, t);
    dp = [D.NOZZLE_TIP[0], D.NOZZLE_TIP[1], D.NOZZLE_TIP[2] + (D.PLATE_Z + 0.3 - D.NOZZLE_TIP[2]) * s];
    da = ease(0.76, 0.78, t) * (1 - ease(0.82, 0.84, t));
  }
  if (dp) {
    const [sx, sy] = at(dp);
    disc.setAttribute("cx", sx.toFixed(1));
    disc.setAttribute("cy", sy.toFixed(1));
  }
  disc.style.opacity = da.toFixed(3);
  readLed.toggleAttribute("data-on", t > 0.84 && t < 0.97);

  // the reading: screen, LEDs, the matching fruit
  const seen = counted(cycle, t);
  const form = seen.last;
  for (const f of ORDER) {
    const on = f === form;
    fruits[f].toggleAttribute("data-on", on);
    glows[f].toggleAttribute("data-on", on);
    lamps[f].toggleAttribute("data-on", on);
    leds[f].toggleAttribute("data-on", on);
  }
  screen1.textContent = form ? `SHELL ${FORMS[form].genotype.replace(/-/g, "−")}` : "SHELL";
  screen2.textContent = form ? `${form.toUpperCase()} · ${rejected(form) ? "REJECT" : "PLANT"}` : "READY";
  const text = readoutOf(seen);
  if (readout.textContent !== text) readout.textContent = text;
  stat("screened").textContent = String(seen.screened);
  stat("counts").textContent = `${seen.counts.tenera} / ${seen.counts.dura} / ${seen.counts.pisifera}`;

  // the gate swings for the seedling arriving this cycle
  const target = gateFor(cycle);
  const g = gateAngle + (target - gateAngle) * ease(0, 0.22, t);
  gate.innerHTML = gateSvg(g);
  if (t >= 0.22) gateAngle = target;
  gateLed.dataset.state = rejected(formOf(cycle - 6)) ? "reject" : "tenera";

  // the planting tray fills with the tenera that have arrived in this lot
  let arrived = 0;
  for (let i = lotStart(cycle - 6); i <= cycle - 6; i++) if (!rejected(formOf(i)) && (i < cycle - 6 || t >= 0.86)) arrived++;
  const shown = arrived === 0 ? 0 : ((arrived - 1) % cells.length) + 1;
  cells.forEach((cell, n) => (cell.style.opacity = n < shown ? "1" : "0"));
}

// Leaving the belt: onto the gate deck, down a chute, into the tray or the bin.
function leave(item) {
  const form = formOf(item.i);
  const chute = rejected(form) ? D.CHUTE.reject : D.CHUTE.tenera;
  const out = rejected(form) ? riders.reject : riders.tenera;
  const x0 = D.SLOT0 + 7 * D.PITCH;
  let p;
  let alpha = 1;
  if (t < 0.3) {
    const s = ease(0, 0.3, t);
    const x = x0 + (D.DIVERT_AT[0] - x0) * s;
    p = [x, D.YC, x > 50 ? D.DIVERT_AT[2] * ease(50, 58, x) : 0];
    place(item, x > 52 ? riders.divert : belt);
    if (item.puck) item.puck.style.opacity = String(1 - ease(38, 52, x));
  } else {
    if (item.puck) item.puck.style.opacity = "0";
    const s = ease(0.3, 0.72, t);
    const a = [D.DIVERT_AT[0], D.YC, D.DIVERT_AT[2]];
    const start = [chute.from[0], chute.from[1], chute.from[2] - D.BELT_TOP];
    const end = [chute.to[0], chute.to[1], chute.to[2] - D.BELT_TOP];
    if (s < 0.15) {
      const u = s / 0.15;
      p = a.map((v, j) => v + (start[j] - v) * u);
      place(item, riders.divert);
    } else {
      const u = (s - 0.15) / 0.85;
      p = start.map((v, j) => v + (end[j] - v) * u);
      place(item, out);
    }
    alpha = 1 - ease(0.74, 0.86, t);
    if (rejected(form)) p[2] -= 6 * ease(0.72, 0.86, t);
  }
  item.g.setAttribute("transform", translateAlong(P, p));
  item.g.style.opacity = alpha.toFixed(3);
}

function slatsAtLive(offset) {
  const out = [];
  const x0 = -196;
  const w = 252;
  const step = 10;
  for (let x = x0 + (((offset % step) + step) % step); x < x0 + w; x += step) out.push(lineOnTop([x, 4], [x, 32], D.BELT_TOP, P));
  return out.join("");
}
function gateSvg(angle) {
  const len = 14;
  const dir = [-Math.cos(angle), Math.sin(angle)];
  const n = [-dir[1], dir[0]];
  const a = D.PIVOT;
  const b = [a[0] + dir[0] * len, a[1] + dir[1] * len];
  const ring = [
    [a[0] + n[0] * 0.8, a[1] + n[1] * 0.8],
    [b[0] + n[0] * 0.8, b[1] + n[1] * 0.8],
    [b[0] - n[0] * 0.8, b[1] - n[1] * 0.8],
    [a[0] - n[0] * 0.8, a[1] - n[1] * 0.8],
  ];
  return solidSvg(extrude(ring, 20.4, 7, P, { convex: true, bevel: 0.3 }), { tone: "hi", lit: true });
}

// ------------------------------------------------------------ plantation toggle
let mode = "screened";
const level = { 0: UNSCREENED, 1: SCREENED };
const shownLevel = { 0: UNSCREENED, 1: SCREENED };
let fill = null;
function oilSvg(i, value) {
  const [x, y] = D.OIL.glass[i];
  const h = Math.max(0.1, value * D.OIL.per);
  return solidSvg(cylinder(x, y, D.OIL.r, D.OIL.z0, h, P, 32), { tone: "hi", crease: "none" });
}
function drawOil() {
  for (const i of [0, 1]) oil[i].innerHTML = oilSvg(i, shownLevel[i]);
}
function setMode(next, animate = true) {
  mode = next;
  buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.plant === mode)));
  const i = mode === "screened" ? 1 : 0;
  glass.forEach((g, n) => g.toggleAttribute("data-on", n === i));
  palms.forEach((palm, n) => (palm.dataset.form = mode === "screened" ? "tenera" : LOT[n]));
  stat("block").textContent = String(Math.round(level[i]));
  if (animate && !still.matches) {
    shownLevel[i] = 0;
    fill = { i, start: performance.now() };
    requestAnimationFrame(fillTick);
  } else {
    shownLevel[i] = level[i];
    drawOil();
  }
}
function fillTick(now) {
  if (!fill) return;
  const s = clamp01((now - fill.start) / 1400);
  shownLevel[fill.i] = level[fill.i] * (1 - Math.pow(1 - s, 3));
  drawOil();
  if (s < 1) requestAnimationFrame(fillTick);
  else fill = null;
}
buttons.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.plant)));

// ------------------------------------------------------------ running
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  t += dt / CYCLE;
  if (t >= 1) {
    t = 0;
    cycle++;
    if (stepping || !running) {
      stepping = false;
      draw();
      frame = 0;
      return;
    }
  }
  draw();
  frame = requestAnimationFrame(tick);
}
function run() {
  if (still.matches) {
    // one seedling at a time, no tweening
    t = 0;
    cycle++;
    draw();
    return;
  }
  if (!frame) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
let stillTimer = 0;
function start() {
  running = true;
  if (still.matches) {
    clearInterval(stillTimer);
    run();
    stillTimer = setInterval(run, 1600);
  } else run();
}
function stop() {
  running = false;
  clearInterval(stillTimer);
}
stage.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && start());
stage.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && stop());
stage.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse") running ? stop() : start();
});
stage.addEventListener("focus", start);
stage.addEventListener("blur", stop);
stage.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    stop();
    stepping = true;
    run();
  }
});

setMode("screened", false);
draw();
window.__sg = { setMode, start, stop, get state() { return { cycle, t, running }; }, jump(c, phase = 0) { cycle = c; t = phase; draw(); } };
