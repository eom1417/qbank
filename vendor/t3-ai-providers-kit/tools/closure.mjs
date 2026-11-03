// Usage: node closure.mjs <repoRoot> <seedsFile> <outJson>
import fs from "node:fs";
import path from "node:path";
const [root, seedsFile, outJson] = process.argv.slice(2);
const exts = [".ts", ".tsx", ".mts", ".js", ".mjs", ".json"];
// package name -> dir
const pkgs = {};
for (const base of ["apps", "packages"]) {
  for (const d of fs.readdirSync(path.join(root, base))) {
    const pj = path.join(root, base, d, "package.json");
    if (fs.existsSync(pj)) { const j = JSON.parse(fs.readFileSync(pj, "utf8")); pkgs[j.name] = { dir: path.join(base, d), json: j }; }
  }
}
function tryFile(p) {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  for (const e of exts) if (fs.existsSync(p + e)) return p + e;
  // .js -> .ts rewriting
  if (/\.js$/.test(p)) { const b = p.slice(0, -3); for (const e of [".ts", ".tsx"]) if (fs.existsSync(b + e)) return b + e; }
  for (const e of exts) { const i = path.join(p, "index" + e); if (fs.existsSync(i)) return i; }
  return null;
}
function resolveExport(pkg, sub) {
  const ex = pkg.json.exports;
  const key = sub ? "./" + sub : ".";
  const pick = (v) => typeof v === "string" ? v : v && (v.import || v.default || v.types || (v.node && pick(v.node)) || (v["react-native"] && pick(v["react-native"])));
  if (ex && typeof ex === "object") {
    if (ex[key]) { const t = pick(ex[key]); if (t) return tryFile(path.join(root, pkg.dir, t)); }
    for (const k of Object.keys(ex)) if (k.includes("*")) {
      const [pre, post] = k.split("*");
      if (key.startsWith(pre) && key.endsWith(post)) { const mid = key.slice(pre.length, key.length - post.length); const t = pick(ex[k]); if (t) return tryFile(path.join(root, pkg.dir, t.replace("*", mid))); }
    }
  }
  return tryFile(path.join(root, pkg.dir, sub ? sub : "src/index"));
}
const unresolved = new Set(); const externals = {};
function resolve(spec, fromFile) {
  if (spec.startsWith(".")) return tryFile(path.resolve(path.dirname(fromFile), spec));
  if (spec.startsWith("~/")) { const app = fromFile.split(path.sep).slice(0, root.split(path.sep).length + 2).join(path.sep); return tryFile(path.join(app, "src", spec.slice(2))); }
  const parts = spec.split("/"); const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  const sub = parts.slice(spec.startsWith("@") ? 2 : 1).join("/");
  if (pkgs[name]) { const r = resolveExport(pkgs[name], sub); if (!r) unresolved.add(spec + "  <- " + path.relative(root, fromFile)); return r; }
  externals[name] = (externals[name] || 0) + 1; return null;
}
const re = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)|new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/g;
const re2 = /(?:import|export)\s+((?:type\s+)?[^'";]*?)\s+from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/g;
const boundaryPrefixes = (process.env.BOUNDARY || "").split(",").filter(Boolean);
const boundaryAllow = (process.env.ALLOW || "").split(",").filter(Boolean);
const isBoundary = (rel) => boundaryPrefixes.some(p => rel.startsWith(p)) && !boundaryAllow.some(p => rel.startsWith(p));
const boundary = {};
const seeds = fs.readFileSync(seedsFile, "utf8").split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#"));
const seen = new Set(); const queue = [];
const stopPrefixes = (process.env.STOP || "").split(",").filter(Boolean);
function add(abs) { if (!abs || seen.has(abs)) return; if (/\.(test|browser\.test|bench)\.(ts|tsx)$|\.testkit\.ts$|testFixtures|\/testkit\/|\.fixture\.ts$|\/__tests__\//.test(abs)) return; seen.add(abs); queue.push(abs); }
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.name === "node_modules") continue; if (e.isDirectory()) walk(p); else add(p); } }
for (const s of seeds) { const abs = path.join(root, s); if (!fs.existsSync(abs)) { console.error("missing seed", s); continue; } fs.statSync(abs).isDirectory() ? walk(abs) : add(abs); }
const edgesInto = {};
while (queue.length) {
  const f = queue.shift();
  if (!/\.(ts|tsx|mts|js|mjs)$/.test(f)) continue;
  const rel = path.relative(root, f);
  if (stopPrefixes.some(p => rel.startsWith(p))) continue; // include file but don't expand
  const src = fs.readFileSync(f, "utf8"); let m; re2.lastIndex = 0;
  while ((m = re2.exec(src))) { const clause = m[1] || ""; const spec = m[2] || m[3] || m[4] || m[5]; const r = resolve(spec, f); if (r) { const rr = path.relative(root, r);
    if (isBoundary(rr) && !isBoundary(rel)) { const b = (boundary[rr] ||= {}); const names = clause.replace(/\s+/g," ").trim(); (b[rel] ||= new Set()).add(names || "(side-effect)"); continue; }
    if (!seen.has(r)) (edgesInto[rr] ||= rel); add(r); } }
}
const files = [...seen].map(f => path.relative(root, f)).sort();
const bOut = Object.fromEntries(Object.entries(boundary).sort().map(([t, imp]) => [t, Object.fromEntries(Object.entries(imp).map(([k, v]) => [k, [...v]]))]));
fs.writeFileSync(outJson, JSON.stringify({ boundary: bOut, files, externals, unresolved: [...unresolved], firstImporter: edgesInto }, null, 1));
console.log("files", files.length);
const byTop = {}; for (const f of files) { const k = f.split("/").slice(0, f.startsWith("apps/server/src") ? 4 : 2).join("/"); byTop[k] = (byTop[k] || 0) + 1; }
console.log(Object.entries(byTop).sort((a, b) => b[1] - a[1]).map(([k, v]) => v + "\t" + k).join("\n"));
console.log("unresolved", unresolved.size); console.log("boundary targets", Object.keys(bOut).length); for (const t of Object.keys(bOut)) console.log("  B", t, Object.keys(bOut[t]).length);
