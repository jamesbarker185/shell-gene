import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";

const W = 800;
const H = 600;
const AZIMUTH = 58;
const ELEVATION = 36;

// ------------------------------------------------------------ layout (world units, z up, +y toward the viewer)
const BENCH = { x: -266, y: -104, w: 516, d: 178, r: 8 };
const BENCH_H = 10;
const FOOT_H = 5;

const BELT = { x: -196, y: 4, w: 252, d: 28, r: 1 };
const BELT_TOP = 20;
const YC = BELT.y + BELT.d / 2; // 18
const RAIL_TOP = 23;
const PITCH = 30;
const SLOT0 = -180;
const SLOTS = 8;
const slotX = (j) => SLOT0 + j * PITCH;
const PUNCH_SLOT = 2;
const PX = slotX(PUNCH_SLOT);

const POT = { r: 6.4, z: BELT_TOP + 2.4, h: 12 };
const SOIL_Z = POT.z + POT.h;

const LEAF0 = { angle: -Math.PI / 2, reach: 17, rise: 26, width: 3.4 };
const LEAF_T = 0.62;
const POST = [PX, -16];
const POST_TOP = 86;
const ARM_Z = 78;
const HEAD = [PX, YC - LEAF0.reach * LEAF_T];
const HEAD_Z = 70;

const PLATE_HOME = [-78, -54];
const WELL = 5;
const COLS = 6;
const ROWS = 4;
const PLATE_Z = 12;
const NOZZLE = [-78, -54];
const DNA = { x: -54, y: -76, w: 58, d: 44, r: 2 };
const DNA_H = 54;

const SHELF = { x: -196, y: -100, w: 232, d: 18, r: 1.5 };
const SHELF_Z = 98;
const SHELF_T = 7;
const FRUIT_X = [-158, -80, -2];
const FRUIT_Y = SHELF.y + SHELF.d / 2;
const CRADLE_TOP = SHELF_Z + SHELF_T + 5;

const DIVERT = { x: 58, y: 2, w: 24, d: 32, r: 2 };
const PIVOT = [80, YC];
const CHUTE = {
  tenera: { from: [84, 25, 19], to: [124, 52, 7.5] },
  reject: { from: [84, 11, 19], to: [118, -18, 7.5] },
};
const TRAY = { x: 116, y: 44, w: 52, d: 30, r: 2 };
const BIN = { x: 108, y: -40, w: 30, d: 26, r: 2 };
const INFEED = { x: -258, y: -2, w: 56, d: 40, r: 2 };

const PLOT = { x: 146, y: -78, w: 98, d: 70, r: 3 };
const COLUMNS = { x: 194, y: 36, w: 48, d: 22, r: 2 };
const GLASS = [[206, 47], [230, 47]];
const GLASS_R = 5.4;
const OIL_Z0 = 8;
const OIL_SPAN = 56; // OIL_SPAN units = 140 on the yield scale (dura = 100)
const OIL_PER = OIL_SPAN / 140;

const P = k.fitProjection(
  [...k.boxCorners(BENCH, -BENCH_H - FOOT_H, 0), [FRUIT_X[0] - 30, FRUIT_Y, 182], [FRUIT_X[2] + 30, FRUIT_Y, 182], [PX, -16, POST_TOP + 4]],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const KS = G.scaleOf(P);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const f1 = (n) => n.toFixed(1);
const poly = (pts, closed = true) => "M" + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join("L") + (closed ? "Z" : "");
const depth = (p) => G.dot3(p, V);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const { sinA, cosA, cosE } = k.cameraOf(P);
const ACROSS = [sinA, -cosA, 0]; // the floor direction that runs straight across the screen
const TOWARD = [cosA, sinA, 0];

function plate(plan, z, h, { tone = "mid", steps = 4, bevel = 0.5, crease, lit, inner } = {}) {
  return S(k.slabOf(plan, z, h, P, steps, bevel), { tone, crease, lit, inner });
}
function screws(points, z, size = 0.45) {
  return L(points.map(([x, y]) => k.ring(x, y, 1.5, z, P, 12)).join(""), { tone: "lo" }) + D(points.map(([x, y]) => at([x, y, z])), { size });
}
function labelPlate(planIn, z, lines = [0.7, 0.5, 0.6]) {
  const out = [S(k.slabOf(planIn, z, 0.8, P, 3), { tone: "lo", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(planIn, 1.4), z + 0.8, P, 3), { tone: "faint" }));
  const x0 = planIn.x + 3;
  const span = planIn.w - 6;
  lines.forEach((share, i) => {
    const y = planIn.y + 3 + i * ((planIn.d - 6) / Math.max(1, lines.length - 1));
    out.push(L(k.lineOnTop([x0, y], [x0 + span * share, y], z + 0.8, P), { tone: "lo", free: true }));
  });
  return out.join("");
}

// ------------------------------------------------------------ bench
function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, -BENCH_H - FOOT_H, BENCH_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BENCH, 24))) {
    out.push(S(k.cylinder(x, y, 8, -BENCH_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6, -BENCH_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BENCH, -BENCH_H, BENCH_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BENCH, -3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 5), 0, P), { tone: "faint" }));
  out.push(screws(k.corners(BENCH, 11), 0, 0.5));
  const strip = { x: -250, y: BENCH.y + BENCH.d - 13, w: 300, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.8, 0.6, [2, 3.8], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  out.push(labelPlate({ x: -20, y: BENCH.y + BENCH.d - 34, w: 46, d: 14, r: 1 }, 0));
  return out.join("");
}

// ------------------------------------------------------------ seedlings
// A pre-nursery seedling in a polybag: three to four lanceolate leaves. Leaf 0 always
// arches back toward the punch, so every seedling offers the same spot to it.
function leafPoint(cx, cy, leaf, t) {
  const r = leaf.reach * t;
  const z = SOIL_Z + leaf.rise * (1.55 * t - 0.82 * t * t);
  return [cx + Math.cos(leaf.angle) * r, cy + Math.sin(leaf.angle) * r, z];
}
const PUNCH_AT = leafPoint(0, 0, LEAF0, LEAF_T); // relative to the seedling
const VARIANTS = [
  [LEAF0, { angle: 0.35, reach: 15, rise: 30, width: 3.2 }, { angle: 2.5, reach: 14, rise: 27, width: 3 }, { angle: 1.35, reach: 9, rise: 33, width: 2.6 }],
  [LEAF0, { angle: 0.75, reach: 16, rise: 28, width: 3.3 }, { angle: 2.15, reach: 15, rise: 31, width: 3.1 }],
  [LEAF0, { angle: 0.15, reach: 14, rise: 31, width: 3 }, { angle: 2.8, reach: 16, rise: 26, width: 3.3 }, { angle: 1.6, reach: 8, rise: 34, width: 2.5 }],
  [LEAF0, { angle: 0.55, reach: 15, rise: 29, width: 3.2 }, { angle: 2.35, reach: 14, rise: 30, width: 3.1 }],
];
function leafSvg(cx, cy, leaf, punched) {
  const n = 14;
  const side = [-Math.sin(leaf.angle), Math.cos(leaf.angle), 0];
  const left = [];
  const right = [];
  const mid = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = leafPoint(cx, cy, leaf, t);
    const w = leaf.width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.75) * (1 - 0.25 * t);
    left.push(at(G.add3(c, G.mul3(side, w))));
    right.push(at(G.add3(c, G.mul3(side, -w))));
    mid.push(at(c));
  }
  const blade = poly([...left, ...right.reverse()]);
  let out = `<path class="sg-leaf" d="${blade}"/>`;
  out += `<path class="iso-line sg-rib" d="${poly(mid.slice(0, n), false)}" data-free="end"/>`;
  if (punched) {
    const c = leafPoint(cx, cy, leaf, LEAF_T);
    out += `<path class="sg-hole" data-punch d="${k.ring(c[0], c[1], 1.25, c[2] + 0.1, P, 14)}"/>`;
  }
  return out;
}
function seedlingSvg(variant, { puck = true } = {}) {
  const out = [];
  const leaves = VARIANTS[variant % VARIANTS.length];
  if (puck) out.push(`<g class="sg-puck">${S(k.cylinder(0, 0, 9, BELT_TOP, 2.4, P, 32), { tone: "mid" })}${L(k.ring(0, 0, 7.6, BELT_TOP + 2.4, P, 28), { tone: "faint" })}</g>`);
  out.push(S(k.cylinder(0, 0, POT.r, POT.z, POT.h, P, 32), { tone: "hi", crease: "lo", inner: L(k.sideArc(0, 0, POT.r, POT.z + 4, P, 24), { tone: "faint" }) }));
  out.push(S(k.cylinder(0, 0, POT.r + 0.5, SOIL_Z - 1.4, 1.4, P, 32), { tone: "hi", crease: "lo" }));
  out.push(`<path class="sg-soil" d="${k.ring(0, 0, POT.r - 0.2, SOIL_Z, P, 28)}"/>`);
  const sorted = leaves.map((leaf, i) => ({ leaf, i, d: depth(leafPoint(0, 0, leaf, 0.6)) })).sort((a, b) => a.d - b.d);
  for (const { leaf, i } of sorted) out.push(leafSvg(0, 0, leaf, i === 0));
  out.push(`<path class="sg-stem" d="${k.ring(0, 0, 1.3, SOIL_Z + 0.2, P, 12)}"/>`);
  return `<g class="sg-seedling">${out.join("")}</g>`;
}

// ------------------------------------------------------------ conveyor
function conveyorBack() {
  const out = [];
  const legs = [-186, -70, 40];
  for (const x of legs) out.push(plate({ x: x - 3, y: 0, w: 6, d: 4, r: 0.8 }, 0, 8, { steps: 2 }));
  out.push(plate({ x: BELT.x - 6, y: 0, w: BELT.w + 12, d: 4, r: 1 }, 8, RAIL_TOP - 8, { bevel: 0.4 }));
  out.push(S(k.slabOf(BELT, BELT_TOP - 3, 3, P, 2), { tone: "lo", crease: "none" }));
  return out.join("");
}
function conveyorFront() {
  const out = [];
  const rail = { x: BELT.x - 6, y: 32, w: BELT.w + 12, d: 4, r: 1 };
  for (const x of [-186, -70, 40]) out.push(plate({ x: x - 3, y: 32, w: 6, d: 4, r: 0.8 }, 0, 8, { steps: 2 }));
  out.push(plate(rail, 8, RAIL_TOP - 8, { bevel: 0.4, inner: L(k.sideSeam(rail, 12, P, 4), { tone: "faint" }) }));
  // roller axle ends and rail bolts on the outer face
  for (const x of [BELT.x + 2, BELT.x + BELT.w - 2]) {
    out.push(L(k.sideRing([x, 36, 17], 2.6, "y", P, 20), { tone: "lo" }));
    out.push(D([at([x, 36, 17])], { size: 0.6 }));
  }
  out.push(D([-150, -110, -30, 10].map((x) => at([x, 36, 19.5])), { size: 0.42 }));
  // direction plate on the rail top
  out.push(L(k.lineOnTop([-60, 34], [-48, 34], RAIL_TOP, P), { tone: "mid", free: true }));
  out.push(L(k.onTop([[-51, 32.8], [-48, 34], [-51, 35.2]], RAIL_TOP, P), { tone: "mid", free: true }));
  // the infeed edge: a cross bar at the left
  out.push(plate({ x: BELT.x - 10, y: 0, w: 4, d: 36, r: 1 }, 8, RAIL_TOP - 6, { bevel: 0.4 }));
  return out.join("");
}
const slatsAt = (offset) => {
  const out = [];
  for (let x = BELT.x + ((offset % 10) + 10) % 10; x < BELT.x + BELT.w; x += 10) out.push(k.lineOnTop([x, BELT.y], [x, BELT.y + BELT.d], BELT_TOP, P));
  return out.join("");
};

// ------------------------------------------------------------ punch station
const PORT = [PX, POST[1] - 3.4, 72];
const ROUTE = G.fillet(
  [PORT, [PX, -34, 72], [-92, NOZZLE[1], 72], [NOZZLE[0] + 6, NOZZLE[1], 72], [NOZZLE[0] + 6, NOZZLE[1], 39]],
  5,
  8,
  { P, tube: 1.2 },
);
function punchBack() {
  const out = [];
  const [x, y] = POST;
  out.push(S(k.cylinder(x, y, 8, 0, 2, P, 32), { tone: "lo" }));
  out.push(screws(byDepth([[x - 5.5, y - 5.5], [x + 5.5, y - 5.5], [x - 5.5, y + 5.5], [x + 5.5, y + 5.5]]).slice(0, 3), 2, 0.4));
  out.push(S(k.cylinder(x, y, 5, 2, 4, P, 28), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 3.4, 6, POST_TOP - 6, P, 28), { tone: "mid", crease: "none", inner: L([30, 50].map((z) => k.sideArc(x, y, 3.4, z, P, 16)).join(""), { tone: "faint" }) }));
  // the vacuum port on the back of the post
  const PF = G.frameAlong([x, y - 3.2, 72], [0, -1, 0]);
  out.push(S(G.disc(0, 0.4, 2.4, PF, P), { tone: "mid" }));
  return out.join("");
}
function tube() {
  const pieces = tubePieces(ROUTE, 1.2, P, { maxLength: 20 });
  return pieces.map((piece) => tubeSvg(piece, { tone: "mid" })).join("");
}
function punchRod() {
  return S(k.cylinder(HEAD[0], HEAD[1], 1.5, HEAD_Z - 18, 18, P, 20), { tone: "hi", lit: true, crease: "none" }) + S(k.cylinder(HEAD[0], HEAD[1], 2.1, HEAD_Z - 18, 1.2, P, 20), { tone: "hi", lit: true });
}
function punchFront() {
  const out = [];
  const [x, y] = HEAD;
  out.push(S(k.cylinder(x, y, 5, HEAD_Z, ARM_Z - HEAD_Z, P, 32), { tone: "mid", inner: L(k.sideArc(x, y, 5, HEAD_Z + 3, P, 20), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, 3.2, HEAD_Z - 1.2, 1.2, P, 24), { tone: "mid" }));
  const arm = { x: x - 4, y: POST[1] - 4, w: 8, d: y - POST[1] + 9, r: 2 };
  out.push(plate(arm, ARM_Z, 6, { bevel: 0.5 }));
  out.push(D([at([x, POST[1], ARM_Z + 6]), at([x, y - 1, ARM_Z + 6])], { size: 0.45 }));
  out.push(S(k.cylinder(POST[0], POST[1], 4, POST_TOP, 2, P, 24), { tone: "mid" }));
  // air cylinder on top of the head
  out.push(S(k.cylinder(x, y, 3.6, ARM_Z + 6, 8, P, 28), { tone: "mid", inner: L(k.sideArc(x, y, 3.6, ARM_Z + 10, P, 16), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, 4.2, ARM_Z + 14, 1.4, P, 28), { tone: "mid" }));
  return out.join("");
}

// ------------------------------------------------------------ sample plate and DNA unit
const wellAt = (c, r) => [PLATE_HOME[0] + (c - (COLS - 1) / 2) * WELL, PLATE_HOME[1] + (r - (ROWS - 1) / 2) * WELL];
const WELLS = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) WELLS.push([c, r]);
function stage() {
  const out = [];
  const base = { x: -104, y: -76, w: 50, d: 44, r: 2 };
  out.push(plate(base, 0, 5, { bevel: 0.5 }));
  out.push(L(k.planOutline(k.insetPlan(base, 3), 5, P, 3), { tone: "faint" }));
  out.push(screws(byDepth(k.corners(base, 4)), 5, 0.4));
  for (const y of [-68, -40]) out.push(plate({ x: -100, y: y - 1.5, w: 42, d: 3, r: 0.8 }, 5, 2, { steps: 2, bevel: 0 }));
  return out.join("");
}
function samplePlate() {
  const out = [];
  const half = { w: COLS * WELL + 6, d: ROWS * WELL + 6 };
  const slide = { x: PLATE_HOME[0] - half.w / 2 - 2, y: PLATE_HOME[1] - half.d / 2 - 2, w: half.w + 4, d: half.d + 4, r: 1.5 };
  out.push(plate(slide, 7, 2.2, { bevel: 0.4 }));
  const body = { x: PLATE_HOME[0] - half.w / 2, y: PLATE_HOME[1] - half.d / 2, w: half.w, d: half.d, r: 1.5 };
  out.push(plate(body, 9.2, PLATE_Z - 9.2, { tone: "hi", crease: "lo", bevel: 0.4 }));
  out.push(L(WELLS.map(([c, r]) => k.ring(...wellAt(c, r), 1.8, PLATE_Z, P, 14)).join(""), { tone: "mid" }));
  out.push(WELLS.map(([c, r], i) => `<path class="sg-sample" data-well="${i}" d="${k.ring(...wellAt(c, r), 1.25, PLATE_Z, P, 12)}"/>`).join(""));
  // A1 corner notch
  out.push(L(k.lineOnTop([body.x, body.y + 3], [body.x + 3, body.y], PLATE_Z, P), { tone: "lo" }));
  return out.join("");
}
function dnaUnit() {
  const out = [];
  const seam = k.sideSeam(DNA, 8, P, 4);
  out.push(S(k.slabOf(DNA, 0, DNA_H, P, 4, 1), { tone: "mid", inner: L(seam, { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(DNA, 4), DNA_H, P, 3), { tone: "faint" }));
  // vents on the lid: closed slots
  for (let i = 0; i < 6; i++) out.push(L(k.planOutline({ x: DNA.x + 30 + i * 4, y: DNA.y + 8, w: 1.6, d: 16, r: 0.8 }, DNA_H, P, 2), { tone: "lo" }));
  out.push(screws(byDepth(k.corners(DNA, 3)), DNA_H, 0.4));
  // lid hatch over the plate path
  out.push(L(k.planOutline({ x: DNA.x + 6, y: DNA.y + 6, w: 18, d: 30, r: 1.5 }, DNA_H, P, 3), { tone: "lo" }));
  // the read-out screen, high on the right-hand face where the seedlings can't hide it
  const m = k.sideMatrix([DNA.x + DNA.w, DNA.y + DNA.d], DNA_H, P, "right");
  out.push(`<g transform="${m}">`);
  out.push(`<rect class="sg-screen" x="5" y="5" width="34" height="15" rx="1.2"/>`);
  out.push(`<rect class="iso-line" data-tone="lo" x="5" y="5" width="34" height="15" rx="1.2" fill="none"/>`);
  out.push(`<text class="sg-screen-text" data-screen="1" x="7.5" y="11" font-size="3.6">SHELL</text>`);
  out.push(`<text class="sg-screen-text" data-screen="2" x="7.5" y="17" font-size="3"> </text>`);
  ["D", "T", "P"].forEach((letter, i) => {
    out.push(`<circle class="sg-led" data-led="${["dura", "tenera", "pisifera"][i]}" cx="${9 + i * 7}" cy="26" r="1.2"/>`);
    out.push(`<text class="iso-face-text" x="${9 + i * 7}" y="31.6" font-size="2.6" text-anchor="middle">${letter}</text>`);
  });
  out.push(`<rect class="iso-line" data-tone="faint" x="27" y="23" width="12" height="6" rx="0.8" fill="none"/>`);
  out.push(`</g>`);
  // the dispensing and read arm to the nozzle over the plate
  const arm = { x: NOZZLE[0] - 4, y: NOZZLE[1] - 4, w: DNA.x - NOZZLE[0] + 4, d: 8, r: 2 };
  out.push(plate(arm, 33, 5, { bevel: 0.5 }));
  return out.join("");
}
function nozzle() {
  const [x, y] = NOZZLE;
  const out = [];
  out.push(S(k.cylinder(x, y, 3.4, 24, 9, P, 28), { tone: "mid", inner: L(k.sideArc(x, y, 3.4, 28, P, 16), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, 1.5, 19.5, 4.5, P, 18), { tone: "hi", crease: "none" }));
  out.push(`<circle class="sg-read" cx="${f1(at([x, y, 19.5])[0])}" cy="${f1(at([x, y, 19.5])[1])}" r="1.1"/>`);
  out.push(D([at([NOZZLE[0] + 6, NOZZLE[1], 38])], { size: 0.5 }));
  return out.join("");
}

// ------------------------------------------------------------ fruit shelf and cutaway fruits
// Fruit to scale at 2 units a mm: 26 mm wide, about 35 mm long. Nut sizes and shell
// thickness are typical of each form.
const FR = 26;
const FH = 36;
const V0 = -0.93;
const rOf = (v) => FR * Math.sqrt(Math.max(0, 1 - v * v)) * (1 - 0.1 * v);
const sOf = (v) => (v - V0) * FH;
const NUTS = {
  dura: { nut: [21, 28], shell: 8, kernel: [13, 20], fibre: null },
  tenera: { nut: [15, 21], shell: 3, kernel: [12, 18], fibre: [18.5, 25] },
  pisifera: { nut: null, shell: 0, kernel: [8.5, 12.5], fibre: [11.5, 16] },
};
const NUT_S = sOf(0.06);
function ellipse(cx, cy, rx, ry, n = 48) {
  return Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cy + ry * Math.sin((i / n) * Math.PI * 2)]);
}
function fruit(form, x) {
  const y = FRUIT_Y;
  const z0 = CRADLE_TOP;
  const out = [];
  const F = G.frameOf([x, y, z0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const vs = [];
  for (let i = 0; i <= 34; i++) vs.push(V0 + (1 - V0) * (1 - Math.cos((i / 34) * Math.PI)) / 2);
  const profile = vs.map((v, i) => [sOf(v), rOf(v), i > 0 && i < vs.length - 1 ? 1 : 0]);
  profile[profile.length - 1][1] = 0;
  const body = G.solidOf(profile.slice(0, -1), F, P, { smooth: true });
  // the back half that the cut leaves: its hull clips the turned body
  const pts = [];
  for (const [s, r] of profile) for (let j = 0; j <= 36; j++) {
    const phi = (j / 36) * Math.PI;
    const d = G.add3(G.mul3(ACROSS, Math.cos(phi)), G.mul3(TOWARD, -Math.sin(phi)));
    pts.push(at([x + d[0] * r, y + d[1] * r, z0 + s]));
  }
  const hull = poly(G.hullOf(pts));
  const id = `sg-cut-${form}`;
  out.push(`<clipPath id="${id}"><path d="${hull}"/></clipPath>`);
  out.push(`<g class="sg-skin" clip-path="url(#${id})">${S(body, { tone: "hi", crease: "none" })}</g>`);
  out.push(`<path class="iso-line sg-rim" data-tone="hi" d="${hull}"/>`);
  // the cut face, drawn in its own plane: u across the screen, s up the fruit axis
  const o = at([x, y, z0]);
  const m = `matrix(${f1(KS * 100) / 100} 0 0 ${(-KS * cosE).toFixed(4)} ${f1(o[0])} ${f1(o[1])})`;
  const outer = [...profile.map(([s, r]) => [r, s]), ...[...profile].reverse().map(([s, r]) => [-r, s])];
  const cs = sOf(0);
  const inner = outer.map(([u, s]) => [u * 0.93, cs + (s - cs) * 0.95]); // the exocarp is about 1 mm of skin
  const n = NUTS[form];
  const face = [];
  face.push(`<path class="sg-exo" d="${poly(outer)}"/>`);
  face.push(`<path class="sg-meso" d="${poly(inner)}"/>`);
  // mesocarp fibres: short radial strokes from the nut out through the pulp
  const fibres = [];
  const nutR = n.nut || n.fibre;
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + 0.1;
    const r0 = 1.05;
    const r1 = 1.6;
    fibres.push(poly([[Math.cos(a) * nutR[0] * r0, NUT_S + Math.sin(a) * nutR[1] * r0], [Math.cos(a) * nutR[0] * r1, NUT_S + Math.sin(a) * nutR[1] * r1]], false));
  }
  face.push(`<clipPath id="sg-pulp-${form}"><path d="${poly(inner)}"/></clipPath>`);
  face.push(`<path class="sg-fibre" clip-path="url(#sg-pulp-${form})" d="${fibres.join("")}"/>`);
  if (n.fibre) face.push(`<path class="sg-fibre-ring" d="${poly(ellipse(0, NUT_S, n.fibre[0], n.fibre[1], 60))}"/>`);
  if (n.nut) face.push(`<path class="sg-shell" d="${poly(ellipse(0, NUT_S, n.nut[0], n.nut[1], 60))}"/>`);
  face.push(`<path class="sg-testa" d="${poly(ellipse(0, NUT_S, n.kernel[0], n.kernel[1], 60))}"/>`);
  face.push(`<path class="sg-kernel" d="${poly(ellipse(0, NUT_S, n.kernel[0] - 0.9, n.kernel[1] - 0.9, 60))}"/>`);
  face.push(`<path class="sg-embryo" d="${poly(ellipse(0, NUT_S + n.kernel[1] - 3.2, 1.3, 1.9, 16))}"/>`);
  if (n.nut) {
    // germ pores at the top of the shell, and the shell's grain
    face.push(`<path class="sg-pore" d="${poly(ellipse(0, NUT_S + n.nut[1] - n.shell / 2, 1, Math.max(1, n.shell / 2 - 0.4), 12))}"/>`);
  }
  face.push(`<path class="sg-cutline" d="${poly(outer)}"/>`);
  out.push(`<g class="sg-face" transform="${m}">${face.join("")}</g>`);
  // the calyx the fruit sits on, in front of the cut base
  return `<g class="sg-fruit" data-fruit="${form}">${out.join("")}</g>`;
}
function shelf() {
  const out = [];
  const posts = [-188, -40, 28];
  for (const x of posts) {
    out.push(S(k.cylinder(x, FRUIT_Y, 6, 0, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, FRUIT_Y, 3, 2, SHELF_Z - 2, P, 24), { tone: "mid", crease: "none", inner: L([40, 70].map((z) => k.sideArc(x, FRUIT_Y, 3, z, P, 16)).join(""), { tone: "faint" }) }));
    out.push(S(k.cylinder(x, FRUIT_Y, 4.6, SHELF_Z - 4, 4, P, 24), { tone: "mid" }));
  }
  out.push(plate(SHELF, SHELF_Z, SHELF_T, { bevel: 0.6, inner: L(k.sideSeam(SHELF, SHELF_Z + 2, P, 4), { tone: "faint" }) }));
  out.push(screws(posts.map((x) => [x, FRUIT_Y]), SHELF_Z + SHELF_T, 0.45));
  M.ORDER.forEach((form, i) => {
    const x = FRUIT_X[i];
    out.push(`<path class="sg-glow" data-glow="${form}" d="${k.haloOf({ x: x - 24, y: FRUIT_Y - 10, w: 48, d: 20, r: 10 }, SHELF_Z + SHELF_T, 0.1, P)}"/>`);
    out.push(S(k.cylinder(x, FRUIT_Y, 10, SHELF_Z + SHELF_T, 2.5, P, 36), { tone: "mid" }));
    out.push(S(k.cylinder(x, FRUIT_Y, 4, SHELF_Z + SHELF_T + 2.5, 1.5, P, 24), { tone: "mid" }));
    out.push(S(k.cylinder(x, FRUIT_Y, 11.5, CRADLE_TOP - 1, 1, P, 40), { tone: "mid", crease: "lo" }));
    // genotype plate on the shelf front face
    const m = k.sideMatrix([x - 22, SHELF.y + SHELF.d], SHELF_Z + SHELF_T, P, "left");
    const g = M.FORMS[form].genotype.replace(/-/g, "−");
    out.push(`<g transform="${m}"><rect class="iso-line" data-tone="faint" x="0" y="0.9" width="44" height="5.2" rx="0.6" fill="none"/><text class="iso-face-text sg-name" x="2" y="4.8" font-size="3.4">${form.toUpperCase()}</text><text class="iso-face-text sg-geno" x="42" y="4.8" font-size="3.4" text-anchor="end">${g}</text><circle class="sg-lamp" data-lamp="${form}" cx="24.5" cy="3.5" r="0.9"/></g>`);
    out.push(fruit(form, x));
  });
  return out.join("");
}

// ------------------------------------------------------------ diverter, chutes, tray and bin
function chuteFrame(name) {
  const { from, to } = CHUTE[name];
  const a = G.unit3(G.sub3(to, from));
  const u = G.unit3(G.cross3([0, 0, 1], a));
  const v = G.cross3(a, u);
  return { F: G.frameOf(from, a, u, v), length: G.len3(G.sub3(to, from)), u };
}
function chute(name, part) {
  const { F, length } = chuteFrame(name);
  const floor = S(G.prismOf(F, [[-9, -1.4], [9, -1.4], [9, 0], [-9, 0]], 0, length, P), { tone: "mid" });
  const wall = (side) => S(G.prismOf(F, [[side * 9, 0], [side * 10.4, 0], [side * 10.4, 6], [side * 9, 6]].map(([x, y]) => [x, y]), 0, length, P), { tone: "mid" });
  const walls = [-1, 1].map((side) => ({ side, d: depth(G.pointOf(F, length / 2, 9.7, side > 0 ? 0 : Math.PI)), svg: wall(side) })).sort((p, q) => p.d - q.d);
  if (part === "back") {
    const legs = [0.55, 0.95].map((t) => {
      const p = G.add3(F.o, G.mul3(F.a, length * t));
      const top = p[2] - 1.4 - Math.abs(F.a[2]) * 0;
      return S(k.cylinder(p[0], p[1], 1.8, 0, top - 1, P, 16), { tone: "mid", crease: "none" }) + S(k.cylinder(p[0], p[1], 3.2, 0, 1.2, P, 20), { tone: "lo" });
    });
    return legs.join("") + walls[0].svg + floor;
  }
  return walls[1].svg;
}
function diverter() {
  const out = [];
  out.push(plate(DIVERT, 0, 18, { bevel: 0.6, inner: L(k.sideSeam(DIVERT, 6, P, 4), { tone: "faint" }) }));
  out.push(plate({ x: DIVERT.x + 2, y: DIVERT.y + 2, w: DIVERT.w - 2, d: DIVERT.d - 4, r: 1 }, 18, 1.2, { tone: "mid", bevel: 0.3 }));
  out.push(screws([[DIVERT.x + 4, DIVERT.y + 4], [DIVERT.x + 4, DIVERT.y + DIVERT.d - 4]], 19.2, 0.4));
  // the actuator for the gate, on the near face
  const m = k.sideMatrix([DIVERT.x, DIVERT.y + DIVERT.d], 18, P, "left");
  out.push(`<g transform="${m}"><rect class="iso-line" data-tone="lo" x="3" y="3" width="18" height="8" rx="1" fill="none"/><circle class="sg-gate-led" data-gate-led cx="6.5" cy="7" r="1.1"/><text class="iso-face-text" x="9.5" y="8.2" font-size="2.6">GATE</text></g>`);
  out.push(S(k.cylinder(PIVOT[0], PIVOT[1], 2.6, 19.2, 1.2, P, 20), { tone: "mid" }));
  return out.join("");
}
// The gate swings about a pin at the chute mouth: +1 points it to the tenera chute.
function gateAt(angle) {
  const len = 14;
  const dir = [-Math.cos(angle), Math.sin(angle)];
  const n = [-dir[1], dir[0]];
  const a = [PIVOT[0], PIVOT[1]];
  const b = [PIVOT[0] + dir[0] * len, PIVOT[1] + dir[1] * len];
  const ring = [
    [a[0] + n[0] * 0.8, a[1] + n[1] * 0.8],
    [b[0] + n[0] * 0.8, b[1] + n[1] * 0.8],
    [b[0] - n[0] * 0.8, b[1] - n[1] * 0.8],
    [a[0] - n[0] * 0.8, a[1] - n[1] * 0.8],
  ];
  return k.solidSvg(k.extrude(ring, 20.4, 7, P, { convex: true, bevel: 0.3 }), { tone: "hi", lit: true });
}
function tray() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(TRAY, 0, 6, P)}" style="filter:blur(4px)"/>`);
  out.push(plate(TRAY, 0, 5, { bevel: 0.5 }));
  out.push(L(k.planOutline(k.insetPlan(TRAY, 2), 5, P, 3), { tone: "lo" }));
  const m = k.sideMatrix([TRAY.x, TRAY.y + TRAY.d], 5, P, "left");
  out.push(`<g transform="${m}"><text class="iso-face-text sg-chute-label" data-tone="hi" x="${TRAY.w / 2}" y="3.8" font-size="3.1" text-anchor="middle">TENERA, PLANT</text></g>`);
  return out.join("");
}
const TRAY_CELLS = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) TRAY_CELLS.push([TRAY.x + 10 + c * 16, TRAY.y + 8 + r * 14]);
function bin(part) {
  const out = [];
  const wallH = 16;
  if (part === "back") {
    out.push(plate(BIN, 0, 2, { tone: "lo", bevel: 0.3 }));
    out.push(plate({ x: BIN.x, y: BIN.y, w: BIN.w, d: 2, r: 0.6 }, 2, wallH - 2, { steps: 2, bevel: 0.3 }));
    out.push(plate({ x: BIN.x, y: BIN.y, w: 2, d: BIN.d, r: 0.6 }, 2, wallH - 2, { steps: 2, bevel: 0.3 }));
    out.push(`<path class="sg-bin-floor" d="${k.planOutline(k.insetPlan(BIN, 2.5), 2, P, 2)}"/>`);
    return out.join("");
  }
  out.push(plate({ x: BIN.x + BIN.w - 2, y: BIN.y, w: 2, d: BIN.d, r: 0.6 }, 2, wallH - 2, { steps: 2, bevel: 0.3 }));
  const front = { x: BIN.x, y: BIN.y + BIN.d - 2, w: BIN.w, d: 2, r: 0.6 };
  out.push(plate(front, 2, wallH - 2, { steps: 2, bevel: 0.3 }));
  const m = k.sideMatrix([BIN.x, BIN.y + BIN.d], wallH, P, "left");
  out.push(`<g transform="${m}"><text class="iso-face-text sg-chute-label" x="${BIN.w / 2}" y="5" font-size="2.5" text-anchor="middle">DURA / PISIFERA</text><text class="iso-face-text sg-chute-label" x="${BIN.w / 2}" y="9.2" font-size="2.5" text-anchor="middle">REJECT</text></g>`);
  return out.join("");
}

// ------------------------------------------------------------ infeed tray
const INFEED_CELLS = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) INFEED_CELLS.push([INFEED.x + 10 + c * 18, INFEED.y + 10 + r * 20]);
function infeed() {
  const out = [];
  for (const [x, y] of byDepth(k.corners(INFEED, 4))) out.push(plate({ x: x - 2, y: y - 2, w: 4, d: 4, r: 0.8 }, 0, 12, { steps: 2 }));
  out.push(plate(INFEED, 12, 5, { bevel: 0.5 }));
  out.push(L(k.planOutline(k.insetPlan(INFEED, 2), 17, P, 3), { tone: "lo" }));
  for (const [i, [x, y]] of byDepth(INFEED_CELLS).entries()) {
    out.push(`<g data-infeed transform="${k.translateAlong(P, [x, y, 17 - BELT_TOP + 0.1])}">${seedlingSvg(i + 1, { puck: false })}</g>`);
  }
  return out.join("");
}

// ------------------------------------------------------------ plantation plot and oil columns
const PALMS = [];
for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) PALMS.push({ x: PLOT.x + 10 + c * 15.6, y: PLOT.y + 10 + r * 16.5, i: r * 6 + c });
function palmSvg({ x, y, i }) {
  const out = [];
  const top = 4 + 12;
  out.push(S(k.cylinder(x, y, 1.5, 4, 12, P, 14), { tone: "mid", crease: "none" }));
  const fronds = [];
  const n = 9;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2 + i * 0.7;
    const pts = [];
    for (let t = 0; t <= 6; t++) {
      const s = t / 6;
      pts.push(at([x + Math.cos(a) * 8 * s, y + Math.sin(a) * 8 * s, top + 3 * s - 6 * s * s]));
    }
    fronds.push({ d: depth([x + Math.cos(a) * 4, y + Math.sin(a) * 4, top]), path: poly(pts, false) });
  }
  fronds.sort((p, q) => p.d - q.d);
  const back = fronds.slice(0, 5).map((f) => f.path).join("");
  const front = fronds.slice(5).map((f) => f.path).join("");
  const c = at([x, y, top - 1.2]);
  out.push(`<path class="sg-frond" d="${back}" data-free="end"/>`);
  out.push(`<circle class="sg-bunch" cx="${f1(c[0])}" cy="${f1(c[1])}" r="2.2"/>`);
  out.push(`<path class="sg-frond" d="${front}" data-free="end"/>`);
  out.push(`<circle class="sg-mark" cx="${f1(at([x, y, 4])[0])}" cy="${f1(at([x, y, 4])[1])}" r="3"/>`);
  return `<g class="sg-palm" data-palm="${i}" data-form="${M.LOT[i]}">${out.join("")}</g>`;
}
function plot() {
  const out = [];
  out.push(plate(PLOT, 0, 4, { tone: "mid", bevel: 0.6 }));
  out.push(`<path class="sg-earth" d="${k.planOutline(k.insetPlan(PLOT, 2.5), 4, P, 3)}"/>`);
  for (let r = 0; r < 4; r++) out.push(L(k.lineOnTop([PLOT.x + 2.5, PLOT.y + 10 + r * 16.5], [PLOT.x + PLOT.w - 2.5, PLOT.y + 10 + r * 16.5], 4, P), { tone: "faint" }));
  for (const palm of [...PALMS].sort((a, b) => k.depthOf([a.x, a.y, 0], P) - k.depthOf([b.x, b.y, 0], P))) out.push(palmSvg(palm));
  return out.join("");
}
function columns() {
  const out = [];
  out.push(plate(COLUMNS, 0, 6, { bevel: 0.5 }));
  const panel = { x: COLUMNS.x + 2, y: COLUMNS.y + 2, w: COLUMNS.w - 4, d: 2.4, r: 0.6 };
  out.push(plate(panel, 6, OIL_SPAN + 6, { steps: 2, bevel: 0.3 }));
  // scale on the panel face: every 10 on the yield index, dura = 100 across the whole face
  const face = panel.y + panel.d;
  const ticks = [];
  for (let v = 0; v <= 140; v += 10) {
    const z = OIL_Z0 + v * OIL_PER;
    const long = v % 50 === 0;
    ticks.push(k.segment([panel.x, face, z], [panel.x + (long ? 4 : 2.4), face, z], P));
  }
  out.push(L(ticks.join(""), { tone: "lo" }));
  out.push(L(k.segment([panel.x, face, OIL_Z0 + 100 * OIL_PER], [panel.x + panel.w, face, OIL_Z0 + 100 * OIL_PER], P), { tone: "mid" }));
  const m = k.sideMatrix([panel.x, face], OIL_Z0 + 100 * OIL_PER, P, "left");
  out.push(`<g transform="${m}"><text class="iso-face-text" x="${panel.w - 1}" y="-1.2" font-size="2.4" text-anchor="end">DURA 100</text></g>`);
  out.push(plate({ x: panel.x, y: panel.y, w: panel.w, d: 7, r: 1 }, OIL_SPAN + 12, 2.5, { bevel: 0.4 }));
  GLASS.forEach(([x, y], i) => {
    out.push(S(k.cylinder(x, y, GLASS_R + 1.4, 6, 2, P, 32), { tone: "mid" }));
    out.push(`<g data-oil="${i}" class="sg-oil-g">${S(k.cylinder(x, y, GLASS_R - 0.6, OIL_Z0, 0.1, P, 32), { tone: "hi", crease: "none" })}</g>`);
    out.push(`<g class="sg-glass" data-glass="${i}">${S(k.cylinder(x, y, GLASS_R, OIL_Z0, OIL_SPAN + 4, P, 36), { tone: "mid", crease: "none" })}</g>`);
    out.push(S(k.cylinder(x, y, GLASS_R + 1.4, OIL_SPAN + 10, 2, P, 32), { tone: "mid" }));
    const mf = k.sideMatrix([x - 9, COLUMNS.y + COLUMNS.d], 6, P, "left");
    out.push(`<g transform="${mf}"><text class="iso-face-text sg-col-label" data-col="${i}" x="9" y="4" font-size="2.5" text-anchor="middle">${i ? "SCREENED" : "UNSCREENED"}</text></g>`);
  });
  return out.join("");
}

// ------------------------------------------------------------ assemble
const layer = (name, body) => `<g data-layer="${name}">${body}</g>`;
const LEAF_Z = PUNCH_AT[2];

const body = [
  bench(),
  layer("shelf", shelf()),
  layer("plot", plot()),
  stage(),
  `<g data-part="plate">${samplePlate()}</g>`,
  dnaUnit(),
  nozzle(),
  punchBack(),
  tube(),
  bin("back"),
  chute("reject", "back"),
  `<g data-part="riders-reject"></g>`,
  chute("reject", "front"),
  bin("front"),
  infeed(),
  conveyorBack(),
  `<path class="iso-line" data-tone="faint" data-part="slats" d="${slatsAt(0)}"/>`,
  `<g data-part="rod">${punchRod()}</g>`,
  punchFront(),
  `<g data-part="belt"></g>`,
  conveyorFront(),
  diverter(),
  `<g data-part="gate">${gateAt(-0.6)}</g>`,
  `<g data-part="riders-divert"></g>`,
  tray(),
  `<g data-part="tray-cells">${byDepth(TRAY_CELLS).map(([x, y]) => `<g data-cell transform="${k.translateAlong(P, [x, y, 5 - BELT_TOP + 0.1])}" style="opacity:0">${seedlingSvg(Math.round(x + y), { puck: false })}</g>`).join("")}</g>`,
  chute("tenera", "back"),
  `<g data-part="riders-tenera"></g>`,
  chute("tenera", "front"),
  layer("columns", columns()),
  `<circle class="sg-disc" data-part="disc" r="1.3" cx="0" cy="0" style="opacity:0"/>`,
];

// The rod's rest tip is HEAD_Z - 18 + 14 above the leaf; it strokes down to the leaf.
const ROD_REST = 14;
const ROD_STROKE = HEAD_Z - 18 + ROD_REST - (LEAF_Z + 0.6);

const LABEL =
  "A nursery seed-screening bench for oil palm seedlings. Seedlings in polybags ride a conveyor from an infeed tray. At a punch station a rod comes down on the same leaf of each seedling and takes a disc, which travels by a vacuum tube to a nozzle over a sample plate beside a compact DNA test unit. The unit reads the SHELL genotype, and a gate at the end of the belt sends each seedling down one of two chutes: tenera to a planting tray, dura and pisifera to a reject bin. On a shelf above, three cutaway fruits show dura with a thick shell, tenera with a thin shell and a fibre ring, and shell-less pisifera, each against the orange oil-rich mesocarp. At the right, a plot of 24 palms and two oil columns compare a block planted without screening with one planted with it.";

const svg = k.figureSvg({ width: W, height: H, label: LABEL, body });

const DATA = {
  P,
  SLOT0,
  PITCH,
  SLOTS,
  PUNCH_SLOT,
  BELT_TOP,
  YC,
  ROD_REST,
  ROD_STROKE,
  PUNCH_TIP: [HEAD[0], HEAD[1], LEAF_Z + 0.6],
  ROUTE,
  NOZZLE_TIP: [NOZZLE[0], NOZZLE[1], 19.5],
  WELLS: WELLS.map(([c, r]) => wellAt(c, r)),
  PLATE_HOME,
  PLATE_Z,
  CHUTE,
  DIVERT_AT: [70, YC, 19.2 - BELT_TOP],
  PIVOT,
  OIL: { glass: GLASS, r: GLASS_R - 0.6, z0: OIL_Z0, per: OIL_PER },
  SEEDLINGS: VARIANTS.map((_, i) => seedlingSvg(i)),
  RIDERS: VARIANTS.map((_, i) => seedlingSvg(i, { puck: false })),
};

const caption = `In 2013 the Malaysian Palm Oil Board (Singh et al., Nature 500, 340–344) found SHELL, a MADS-box gene that sets the oil palm fruit's form. Two normal copies (Sh+/Sh+) give dura, with a 2–8 mm shell; two mutant copies (sh−/sh−) give pisifera, with no shell and usually female-sterile; one of each gives tenera, with a 0.5–4 mm shell and a fibre ring, and about ${Math.round(M.UPLIFT * 100)}% more oil per hectare than dura. Commercial tenera seed comes from dura × pisifera crosses, but stray pollen lets dura and pisifera through, and until a palm fruits, up to ${M.YEARS_TO_FRUIT} years after planting, nobody can tell. The SHELL test reads the genotype from a leaf disc in the nursery. The lot drawn is illustrative: 24 seedlings with ${M.countsOf(M.LOT).dura} dura and ${M.countsOf(M.LOT).pisifera} pisifera. Planted unscreened, its block yields ${Math.round(M.UNSCREENED)} on a scale where an all-dura block is 100; screened, all tenera, it yields ${Math.round(M.SCREENED)}. Fruits are drawn to typical proportions at about 2× life size; the assay is compressed to a few seconds.`;

const stats = `<div class="sg-panel">
  <div class="sg-toggle" role="group" aria-label="Plantation">
    <button type="button" data-plant="unscreened" aria-pressed="false">Planted without screening</button>
    <button type="button" data-plant="screened" aria-pressed="true">Planted with screening</button>
  </div>
  <dl class="sg-stats">
    <div><dt>Seedlings screened</dt><dd data-stat="screened">0</dd></div>
    <div><dt>Tenera / dura / pisifera</dt><dd data-stat="counts">0 / 0 / 0</dd></div>
    <div><dt>Years saved per seedling</dt><dd>up to ${M.YEARS_TO_FRUIT}</dd></div>
    <div><dt>Oil per ha, tenera vs dura</dt><dd>+${Math.round(M.UPLIFT * 100)}%</dd></div>
    <div><dt>Block oil (dura = 100)</dt><dd data-stat="block">${Math.round(M.SCREENED)}</dd></div>
  </dl>
</div>`;

const stageHtml = `<div class="sg-stage" tabindex="0" role="group" aria-label="Seed-screening bench. Hover, focus or tap to run the bench; press Space to screen one seedling.">${svg}</div>`;
const card = k.plateHtml({
  fig: "Fig 1",
  title: "The SHELL gene, MPOB, Nature 2013",
  hint: "Hover to run the bench · Space steps",
  readout: M.readoutOf({ screened: 0, counts: { tenera: 0, dura: 0, pisifera: 0 } }),
  keys: [
    { mark: "lit", label: "Punch rod and diverter gate" },
    { mark: "raised", label: "Bench, conveyor, punch, DNA unit, chutes" },
    { mark: "flat", label: "Cutaway fruits: shell against the orange mesocarp" },
  ],
  caption,
  body: `<span class="sg-credit">Rajinder Singh, Ravigadevi Sambanthamurthi &amp; the MPOB team</span>${stageHtml}${stats}`,
});

const CSS = readFileSync(join(HERE, "shell.css"), "utf8");
const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "The SHELL gene", theme, body: `<style>${CSS}</style><div class="sg">${card}</div>`, script: kitScript() + MODEL + LIVE, width: 860 });
const name = theme === "light" ? "shell-gene.html" : "shell-gene-dark.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, "scale", KS.toFixed(3), "rod stroke", ROD_STROKE.toFixed(1));
