/* ArrowPush chem core: SMILES pre-processing, molblock parsing, valence/electron bookkeeping */
(function (G) {
  'use strict';
  const ORGANIC = new Set(['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I', 'b', 'c', 'n', 'o', 'p', 's']);
  const VALENCE = { H: [1], B: [3], C: [4], N: [3, 5], O: [2], F: [1], Si: [4], P: [3, 5], S: [2, 4, 6], Cl: [1, 3, 5, 7], Br: [1, 3, 5, 7], I: [1, 3, 5, 7], Se: [2, 4, 6] };
  const VE = { H: 1, Li: 1, Na: 1, K: 1, Be: 2, Mg: 2, B: 3, Al: 3, C: 4, Si: 4, N: 5, P: 5, O: 6, S: 6, Se: 6, F: 7, Cl: 7, Br: 7, I: 7 };
  const ATOM_RE = /^(\d+)?([A-Z][a-z]?|[a-z][a-z]?|\*)(@[^H+\-:]*)?(H\d*)?([+-]+\d*)?(?::(\d+))?$/;

  // Strip atom-map numbers (we track them ourselves, by atom order) and be lenient:
  // [C:1] / [N:2] / [c:3] with no H, charge, isotope or chirality get their Hs inferred
  // (an AI writing [C:1] almost always means "the carbon in the usual skeleton").
  // A lone bracket atom ([Br:1], [O]) keeps its exact meaning (radicals, atoms).
  function preprocess(smiIn) {
    const smi = String(smiIn).replace(/\s+/g, '');
    const atoms = [];
    let out = '';
    let i = 0;
    const plain = (el, arom) => ({ el, arom: !!arom, implicitH: true, hcount: null, charge: 0, map: 0 });
    while (i < smi.length) {
      const ch = smi[i];
      if (ch === '[') {
        const j = smi.indexOf(']', i);
        if (j < 0) throw new Error('Unclosed "[" in SMILES ' + smi);
        const inner = smi.slice(i + 1, j);
        const m = inner.match(ATOM_RE);
        if (!m) throw new Error('Cannot read bracket atom [' + inner + '] in ' + smi);
        const iso = m[1] || '', sym = m[2], chir = m[3] || '', h = m[4] || '', chg = m[5] || '';
        const map = m[6] ? parseInt(m[6], 10) : 0;
        let charge = 0;
        if (chg) {
          const sign = chg[0] === '+' ? 1 : -1;
          const num = chg.match(/\d+/);
          charge = num ? sign * parseInt(num[0], 10) : sign * chg.length;
        }
        const hcount = h ? (h.length > 1 ? parseInt(h.slice(1), 10) : 1) : 0;
        const arom = /^[a-z]/.test(sym);
        const el = arom ? sym[0].toUpperCase() + sym.slice(1) : sym;
        const lone = (i === 0 || smi[i - 1] === '.') && (j === smi.length - 1 || smi[j + 1] === '.');
        if (!iso && !chir && !h && !charge && ORGANIC.has(sym) && !lone) {
          out += sym;
          atoms.push({ el, arom, implicitH: true, hcount: null, charge: 0, map });
        } else {
          let c = '';
          if (charge) c = (charge > 0 ? '+' : '-') + (Math.abs(charge) > 1 ? Math.abs(charge) : '');
          out += '[' + iso + sym + chir + h + c + ']';
          atoms.push({ el, arom, implicitH: false, hcount, charge, map });
        }
        i = j + 1;
        continue;
      }
      if (ch === 'C' && smi[i + 1] === 'l') { out += 'Cl'; atoms.push(plain('Cl')); i += 2; continue; }
      if (ch === 'B' && smi[i + 1] === 'r') { out += 'Br'; atoms.push(plain('Br')); i += 2; continue; }
      if ('BCNOPSFI'.includes(ch)) { out += ch; atoms.push(plain(ch)); i++; continue; }
      if ('bcnops'.includes(ch)) { out += ch; atoms.push(plain(ch.toUpperCase(), true)); i++; continue; }
      if (ch === '*') { out += ch; atoms.push({ el: '*', arom: false, implicitH: false, hcount: 0, charge: 0, map: 0 }); i++; continue; }
      if (ch === '%') { out += smi.slice(i, i + 3); i += 3; continue; }
      out += ch; i++;
    }
    return { smiles: out, atoms };
  }

  function parseMolblock(mb) {
    const L = mb.split(/\r?\n/);
    const cnt = L[3] || '';
    if (cnt.includes('V3000')) return parseV3000(L);
    const na = parseInt(cnt.slice(0, 3), 10), nb = parseInt(cnt.slice(3, 6), 10);
    const atoms = [], bonds = [];
    for (let k = 0; k < na; k++) {
      const l = L[4 + k];
      atoms.push({ x: parseFloat(l.slice(0, 10)), y: parseFloat(l.slice(10, 20)), sym: l.slice(31, 34).trim() });
    }
    for (let k = 0; k < nb; k++) {
      const l = L[4 + na + k];
      bonds.push({ a: parseInt(l.slice(0, 3), 10) - 1, b: parseInt(l.slice(3, 6), 10) - 1, order: parseInt(l.slice(6, 9), 10), stereo: parseInt(l.slice(9, 12), 10) || 0 });
    }
    return { atoms, bonds };
  }
  function parseV3000(L) {
    const atoms = [], bonds = [];
    let mode = '';
    for (const raw of L) {
      if (!raw.startsWith('M  V30')) continue;
      const l = raw.slice(7).trim();
      if (l.startsWith('BEGIN ATOM')) { mode = 'a'; continue; }
      if (l.startsWith('BEGIN BOND')) { mode = 'b'; continue; }
      if (l.startsWith('END')) { mode = ''; continue; }
      const p = l.split(/\s+/);
      if (mode === 'a') atoms.push({ sym: p[1], x: parseFloat(p[2]), y: parseFloat(p[3]) });
      if (mode === 'b') {
        let stereo = 0;
        const cfg = l.match(/CFG=(\d)/);
        if (cfg) stereo = cfg[1] === '1' ? 1 : cfg[1] === '3' ? 6 : 0;
        bonds.push({ order: parseInt(p[1], 10), a: parseInt(p[2], 10) - 1, b: parseInt(p[3], 10) - 1, stereo });
      }
    }
    return { atoms, bonds };
  }

  function bondInRing(nAtoms, bonds, idx) {
    const adj = Array.from({ length: nAtoms }, () => []);
    bonds.forEach((b, k) => { if (k !== idx) { adj[b.a].push(b.b); adj[b.b].push(b.a); } });
    const s = bonds[idx].a, t = bonds[idx].b;
    const seen = new Set([s]); const q = [s];
    while (q.length) { const u = q.shift(); if (u === t) return true; for (const v of adj[u]) if (!seen.has(v)) { seen.add(v); q.push(v); } }
    return false;
  }

  // Combine our SMILES bookkeeping with RDKit's coordinates + kekulized bonds
  function buildMolecule(pre, mbData) {
    if (mbData.atoms.length !== pre.atoms.length) throw new Error('Atom count mismatch (' + mbData.atoms.length + ' vs ' + pre.atoms.length + ')');
    const atoms = pre.atoms.map((a, i) => Object.assign({}, a, { x: mbData.atoms[i].x, y: mbData.atoms[i].y, nb: [], bs: 0 }));
    const bonds = mbData.bonds.map(b => Object.assign({}, b));
    bonds.forEach((b, k) => {
      const o = b.order === 4 ? 1.5 : b.order;
      atoms[b.a].nb.push(b.b); atoms[b.b].nb.push(b.a);
      atoms[b.a].bs += o; atoms[b.b].bs += o;
      b.ring = bondInRing(atoms.length, bonds, k);
    });
    for (const a of atoms) {
      a.bs = Math.round(a.bs);
      a.deg = a.nb.length;
      if (a.implicitH) {
        const vals = VALENCE[a.el];
        if (!vals) a.h = 0;
        else { let v = vals.find(v => v >= a.bs); if (v === undefined) v = a.bs; a.h = v - a.bs; }
      } else a.h = a.hcount || 0;
    }
    return { atoms, bonds };
  }

  function electrons(a) { // -> {lp, rad}
    const ve = VE[a.el];
    if (ve === undefined) return { lp: 0, rad: 0 };
    const e = ve - a.charge - a.bs - a.h;
    if (e <= 0) return { lp: 0, rad: 0 };
    return { lp: Math.floor(e / 2), rad: e % 2 };
  }

  G.APChem = { preprocess, parseMolblock, buildMolecule, electrons, VE };
})(typeof window !== 'undefined' ? window : globalThis);
