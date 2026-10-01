/**
 * Gradient boosting with regression trees, small enough to read in one go —
 * the same idea XGBoost implements at scale (XGBoost adds second-order
 * gradients, regularisation and clever split finding).
 *
 *   F₀(u)   = mean(y)
 *   for m = 1 … M:
 *     rᵢ    = yᵢ − F_{m−1}(uᵢ)            residuals = negative gradient of ½(y−F)²
 *     h_m   = regression tree fitted to (uᵢ, rᵢ)
 *     F_m   = F_{m−1} + η · h_m          η = learning rate (shrinkage)
 *
 * Toy problem: predict a V236's power [MW] from wind speed [m/s].
 */

export interface Sample {
  u: number;
  p: number;
}

export interface TreeNode {
  /** Leaf value (residual mean) or split threshold on u. */
  leaf?: number;
  split?: number;
  left?: TreeNode;
  right?: TreeNode;
}

/** Deterministic PRNG (mulberry32) so the lesson always shows the same data. */
export function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** V236 power curve [MW] (cubic to rated 11.1 m/s, flat to cut-out). */
export const powerCurve = (u: number) => (u < 3 || u > 31 ? 0 : Math.min(15, 15 * (u / 11.1) ** 3));

/** Noisy "SCADA" samples: wind 0–25 m/s, Gaussian noise σ [MW], 0 ≤ P ≤ 15. */
export function makeData(n: number, seed: number, sigma = 0.9): Sample[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const u = r() * 25;
    // Box–Muller
    const g = Math.sqrt(-2 * Math.log(Math.max(r(), 1e-9))) * Math.cos(2 * Math.PI * r());
    return { u, p: Math.min(15, Math.max(0, powerCurve(u) + sigma * g)) };
  });
}

function fitTree(us: number[], rs: number[], depth: number, minLeaf = 4): TreeNode {
  const mean = rs.reduce((a, b) => a + b, 0) / Math.max(rs.length, 1);
  if (depth === 0 || us.length < 2 * minLeaf) return { leaf: mean };
  // best threshold by squared error, scanning sorted values
  const idx = us.map((_, i) => i).sort((a, b) => us[a] - us[b]);
  const n = idx.length;
  const total = rs.reduce((a, b) => a + b, 0);
  let leftSum = 0;
  let best = { sse: Infinity, k: -1 };
  for (let k = 0; k < n - 1; k++) {
    leftSum += rs[idx[k]];
    const nl = k + 1;
    const nr = n - nl;
    if (nl < minLeaf || nr < minLeaf || us[idx[k]] === us[idx[k + 1]]) continue;
    // SSE = Σr² − (Σl)²/nl − (Σr)²/nr ; Σr² is constant, so maximise the rest
    const score = -(leftSum * leftSum) / nl - ((total - leftSum) * (total - leftSum)) / nr;
    if (score < best.sse) best = { sse: score, k };
  }
  if (best.k < 0) return { leaf: mean };
  const split = (us[idx[best.k]] + us[idx[best.k + 1]]) / 2;
  const L = idx.slice(0, best.k + 1);
  const R = idx.slice(best.k + 1);
  return {
    split,
    left: fitTree(L.map((i) => us[i]), L.map((i) => rs[i]), depth - 1, minLeaf),
    right: fitTree(R.map((i) => us[i]), R.map((i) => rs[i]), depth - 1, minLeaf),
  };
}

export function predictTree(t: TreeNode, u: number): number {
  let node = t;
  while (node.leaf === undefined) node = u < (node.split as number) ? node.left! : node.right!;
  return node.leaf;
}

export interface BoostedModel {
  base: number;
  trees: TreeNode[];
  eta: number;
}

/** Train M trees; returns the model and the train/test MSE after each tree. */
export function boost(train: Sample[], test: Sample[], M: number, eta: number, depth: number) {
  const base = train.reduce((a, s) => a + s.p, 0) / train.length;
  const F = train.map(() => base);
  const Ft = test.map(() => base);
  const trees: TreeNode[] = [];
  const mse = (y: Sample[], f: number[]) => y.reduce((a, s, i) => a + (s.p - f[i]) ** 2, 0) / y.length;
  const history = [{ train: mse(train, F), test: mse(test, Ft) }];
  const us = train.map((s) => s.u);
  for (let m = 0; m < M; m++) {
    const r = train.map((s, i) => s.p - F[i]);
    const tree = fitTree(us, r, depth);
    trees.push(tree);
    train.forEach((s, i) => (F[i] += eta * predictTree(tree, s.u)));
    test.forEach((s, i) => (Ft[i] += eta * predictTree(tree, s.u)));
    history.push({ train: mse(train, F), test: mse(test, Ft) });
  }
  return { model: { base, trees, eta } as BoostedModel, history };
}

/** Prediction of the first k trees. */
export function predictBoosted(m: BoostedModel, u: number, k = m.trees.length): number {
  let f = m.base;
  for (let i = 0; i < k; i++) f += m.eta * predictTree(m.trees[i], u);
  return f;
}

/** Human-readable rules of one tree ("u < 8.4 m/s → +1.20 MW"). */
export function treeRules(t: TreeNode, eta: number, path = ""): string[] {
  if (t.leaf !== undefined) return [`${path || "all u"} → ${eta * t.leaf >= 0 ? "+" : ""}${(eta * t.leaf).toFixed(2)} MW`];
  const s = (t.split as number).toFixed(1);
  const and = path ? `${path} & ` : "";
  return [...treeRules(t.left!, eta, `${and}u < ${s}`), ...treeRules(t.right!, eta, `${and}u ≥ ${s}`)];
}
