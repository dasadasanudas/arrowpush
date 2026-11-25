/* ArrowPush renderer: molecules + electron-pushing arrows -> SVG */
(function (G) {
  'use strict';
  const BL = 42;              // bond length in px
  const FS = 17;              // atom label font size
  const FONT = 'Helvetica, Arial, sans-serif';
  const PALETTE = ['#d62728', '#1f5fbf', '#2a9d3a', '#e07b00', '#8e44ad', '#00838f', '#c2185b', '#6d4c41'];
  const INK = '#151515';
  const PI = Math.PI;

  let _ctx = null;
  function textW(t, size, style) {
    if (typeof document !== 'undefined') {
      if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
      _ctx.font = (style || '') + ' ' + size + 'px ' + FONT;
      return _ctx.measureText(t).width;
    }
    let w = 0; for (const c of String(t)) w += /[A-Z]/.test(c) ? 0.68 : /[a-z0-9]/.test(c) ? 0.55 : 0.4; return w * size;
  }
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const f = n => (Math.round(n * 10) / 10).toString();
  const angDist = (a, b) => { let d = Math.abs(a - b) % (2 * PI); return d > PI ? 2 * PI - d : d; };
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const len = p => Math.hypot(p.x, p.y);
  const unit = p => { const l = len(p) || 1; return { x: p.x / l, y: p.y / l }; };
  const perp = p => ({ x: -p.y, y: p.x });
  const dirA = t => ({ x: Math.cos(t), y: Math.sin(t) });

  class BBox { constructor() { this.x0 = Infinity; this.y0 = Infinity; this.x1 = -Infinity; this.y1 = -Infinity; }
    add(x, y, r) { r = r || 0; this.x0 = Math.min(this.x0, x - r); this.y0 = Math.min(this.y0, y - r); this.x1 = Math.max(this.x1, x + r); this.y1 = Math.max(this.y1, y + r); }
    get w() { return this.x1 - this.x0; } get h() { return this.y1 - this.y0; } get ok() { return isFinite(this.x0); } }

  // ---- place one molecule in local px coordinates ----
  function layoutMol(mol, opts, scale, step) {
    const atoms = mol.atoms.map(a => Object.assign({}, a));
    const bonds = mol.bonds.map(b => Object.assign({}, b));
    let med = 1.5;
    if (bonds.length) { const ls = bonds.map(b => Math.hypot(atoms[b.a].x - atoms[b.b].x, atoms[b.a].y - atoms[b.b].y)).sort((a, b) => a - b); med = ls[Math.floor(ls.length / 2)] || 1.5; }
    const s = BL * scale * (opts.scale || 1) / med;
    const rot = (opts.rot || 0) * PI / 180, c = Math.cos(rot), sn = Math.sin(rot);
    for (const a of atoms) {
      let x = a.x * s, y = -a.y * s;
      if (opts.fx) x = -x; if (opts.fy) y = -y;
      a.x = x * c - y * sn; a.y = x * sn + y * c;
    }
    // center
    let cx = 0, cy = 0; atoms.forEach(a => { cx += a.x; cy += a.y; }); cx /= atoms.length || 1; cy /= atoms.length || 1;
    atoms.forEach(a => { a.x -= cx; a.y -= cy; });
    const heavy = atoms.filter(a => a.el !== 'H').length;
    atoms.forEach((a, i) => {
      a.i = i;
      a.occ = a.nb.map(j => Math.atan2(atoms[j].y - a.y, atoms[j].x - a.x));
      const forceC = step && (step.carbons === 'all' || (Array.isArray(step.carbons) && a.map && step.carbons.includes(a.map)));
      a.showLabel = a.el !== 'C' || a.deg === 0 || (a.deg === 1 && heavy <= 2) || forceC;
      if (a.showLabel) {
        let vx = 0; a.nb.forEach(j => { vx += atoms[j].x - a.x; });
        if (a.deg === 0) a.hLeft = ['O', 'S', 'F', 'Cl', 'Br', 'I', 'Se'].includes(a.el);
        else a.hLeft = vx > 0.15 * BL;
        a.elW = textW(a.el, FS * scale);
        a.hTxt = a.h > 0 ? ('H' + (a.h > 1 ? a.h : '')) : '';
        a.hW = a.h > 0 ? textW('H', FS * scale) + (a.h > 1 ? textW(String(a.h), FS * 0.68 * scale) : 0) : 0;
        if (a.h > 0) a.occ.push(a.hLeft ? PI : 0);
      }
    });
    return { atoms, bonds, scale };
  }

  function molBBox(L) {
    const bb = new BBox();
    for (const a of L.atoms) {
      if (a.showLabel) {
        const hw = a.elW / 2 + 2;
        bb.add(a.x - hw - (a.hLeft ? a.hW : 0), a.y - 11); bb.add(a.x + hw + (!a.hLeft ? a.hW : 0), a.y + 11);
      } else bb.add(a.x, a.y, 4);
    }
    if (!bb.ok) bb.add(0, 0, 10);
    return bb;
  }

  function allocAngle(a, prefer, extraOcc) {
    const occ = a.occ.concat(extraOcc || []);
    let best = 0, bestS = -1e9;
    for (let k = 0; k < 24; k++) {
      const t = -PI + k * PI / 12;
      let d = PI; for (const o of occ) d = Math.min(d, angDist(t, o));
      let sc = Math.min(d, 1.4);
      if (k % 6 === 0) sc += 0.08;                 // gently prefer cardinal directions
      if (prefer != null) sc -= 0.55 * angDist(t, prefer) / PI;
      else sc -= 0.02 * angDist(t, -PI / 2);       // tie-break upward
      if (sc > bestS) { bestS = sc; best = t; }
    }
    a.occ.push(best);
    return best;
  }
  function decoRadius(a, t, extra) {
    if (!a.showLabel) return 9 + (extra || 0);
    const c = Math.cos(t), sN = Math.sin(t);
    let rx = a.elW / 2 + 4.5; if ((c < 0 && a.hLeft) || (c > 0 && !a.hLeft && a.hW)) rx += a.hW;
    const ry = 11.5;
    return 1 / Math.sqrt((c * c) / (rx * rx) + (sN * sN) / (ry * ry)) + (extra || 0);
  }

  function renderStep(step, mols, doc, opts) {
    opts = opts || {};
    const scale = doc.scale || 1;
    const out = { back: [], bonds: [], atoms: [], deco: [], arrows: [], top: [] };
    const bb = new BBox();
    const placed = [];
    const maps = new Map();
    let x = 0;
    const items = step.show;
    let firstOp = items.findIndex(it => it.type === 'op' && it.op !== '+');
    // 1. layout
    const lays = items.map((it, k) => {
      if (it.type !== 'mol') return null;
      const m = mols[k];
      if (!m || m.error) return { error: (m && m.error) || 'not loaded', it };
      const L = layoutMol(m.mol, it.opts, scale, step);
      L.bb = molBBox(L);
      return L;
    });
    let maxBottom = 0, minTop = 0;
    items.forEach((it, k) => {
      if (it.type === 'mol') {
        const L = lays[k];
        if (L.error) {
          const w = Math.min(260, 40 + textW(L.error, 12)), h = 40;
          out.atoms.push(`<rect x="${f(x)}" y="${-h / 2}" width="${f(w)}" height="${h}" rx="6" fill="#fff4f4" stroke="#e57373"/><text x="${f(x + w / 2)}" y="4" font-size="12" text-anchor="middle" fill="#b71c1c" font-family="${FONT}">${esc(L.error.slice(0, 40))}</text>`);
          bb.add(x, -h / 2); bb.add(x + w, h / 2); x += w + 22; return;
        }
        const dx = x - L.bb.x0, dy = -(L.bb.y0 + L.bb.y1) / 2;
        L.atoms.forEach(a => { a.x += dx; a.y += dy; a.mol = L; });
        L.bb.x0 += dx; L.bb.x1 += dx; L.bb.y0 += dy; L.bb.y1 += dy;
        maxBottom = Math.max(maxBottom, L.bb.y1); minTop = Math.min(minTop, L.bb.y0);
        L.item = it; L.before = firstOp < 0 || k < firstOp;
        placed.push(L);
        L.atoms.forEach(a => { if (a.map && (!maps.has(a.map) || (!maps.get(a.map).mol.before && L.before))) maps.set(a.map, a); });
        bb.add(L.bb.x0, L.bb.y0); bb.add(L.bb.x1, L.bb.y1);
        x = L.bb.x1 + 26 * scale;
      } else {
        it._x = x;
        if (it.op === '+') { it._w = 22 * scale; }
        else { const tw = Math.max(textW(it.above || '', 12.5), textW(it.below || '', 12.5)); it._w = Math.max(64 * scale, tw + 22); }
        x += it._w + 26 * scale;
      }
    });
    // 2. which atoms get lone pairs drawn
    const lpSet = new Set(step.lp);
    const sourceAtoms = new Map();
    step.arrows.forEach(ar => { if (ar.from.length === 1) { const a = maps.get(ar.from[0]); if (a) sourceAtoms.set(a, ar); } });
    const radSet = new Set(step.rad);
    for (const L of placed) for (const a of L.atoms) {
      if (radSet.has(a.map) && a.implicitH && a.h > 0) { a.h -= 1; if (a.showLabel) { a.hTxt = a.h > 0 ? 'H' + (a.h > 1 ? a.h : '') : ''; a.hW = a.h > 0 ? textW('H', FS * scale) + (a.h > 1 ? textW(String(a.h), FS * 0.68 * scale) : 0) : 0; } }
      const e = G.APChem.electrons(a);
      a.lpN = e.lp; a.radN = e.rad;
      const wantAll = (step.lpAll || doc.lpAll) && (a.el !== 'C' && a.el !== 'H' || a.lpN > 0);
      a.drawLP = !step.lpNone && (wantAll || lpSet.has(a.map) || sourceAtoms.has(a));
    }
    // 3. bonds
    const tsPairs = step.ts.map(p => [maps.get(p[0]), maps.get(p[1])]).filter(p => p[0] && p[1]);
    const isTS = (a, b) => tsPairs.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
    const visualMid = new Map();
    const endPt = (a, other) => {
      if (!a.showLabel) return { x: a.x, y: a.y };
      const d = unit(sub(other, a));
      let r = 9.5 * scale;
      if (Math.abs(d.x) > Math.abs(d.y) * 1.2 && a.hW && ((d.x < 0) === a.hLeft)) r = a.elW / 2 + a.hW + 2;
      else if (Math.abs(d.x) > Math.abs(d.y)) r = Math.max(r, a.elW / 2 + 2.5);
      return add(a, mul(d, r));
    };
    for (const L of placed) {
      for (const b of L.bonds) {
        const A = L.atoms[b.a], B = L.atoms[b.b];
        const p = endPt(A, B), q = endPt(B, A);
        const d = unit(sub(B, A)), n = perp(d);
        const ts = isTS(A, B);
        const sw = 1.7;
        const line = (p1, p2, extra) => `<line x1="${f(p1.x)}" y1="${f(p1.y)}" x2="${f(p2.x)}" y2="${f(p2.y)}" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round"${extra || ''}/>`;
        const dash = ts ? ' stroke-dasharray="4 3.5"' : '';
        let mid = mul(add(A, B), 0.5);
        if (b.order === 2 || b.order === 4) {
          // side: where other neighbours are
          let side = 0;
          for (const j of A.nb) if (j !== b.b) side += Math.sign((L.atoms[j].x - A.x) * n.x + (L.atoms[j].y - A.y) * n.y);
          for (const j of B.nb) if (j !== b.a) side += Math.sign((L.atoms[j].x - B.x) * n.x + (L.atoms[j].y - B.y) * n.y);
          const off = 6 * scale;
          const centered = side === 0 || ((A.showLabel || B.showLabel) && !b.ring && (A.deg === 1 || B.deg === 1));
          if (centered && b.order === 2) {
            out.bonds.push(line(add(p, mul(n, off / 2)), add(q, mul(n, off / 2)), dash), line(add(p, mul(n, -off / 2)), add(q, mul(n, -off / 2)), dash));
          } else {
            const sg = side >= 0 ? 1 : -1;
            out.bonds.push(line(p, q, dash));
            const sh = 0.16 * BL * scale;
            const p2 = add(add(p, mul(n, off * sg)), A.showLabel ? { x: 0, y: 0 } : mul(d, sh));
            const q2 = add(add(q, mul(n, off * sg)), B.showLabel ? { x: 0, y: 0 } : mul(d, -sh));
            out.bonds.push(line(p2, q2, b.order === 4 ? ' stroke-dasharray="3 3"' : dash));
            mid = add(mid, mul(n, off * sg / 2));
          }
        } else if (b.order === 3) {
          const off = 5.5 * scale;
          out.bonds.push(line(p, q, dash), line(add(p, mul(n, off)), add(q, mul(n, off)), dash), line(add(p, mul(n, -off)), add(q, mul(n, -off)), dash));
        } else if (b.stereo === 1 && !ts) {
          const w = 3.6 * scale;
          out.bonds.push(`<polygon points="${f(p.x)},${f(p.y)} ${f(q.x + n.x * w)},${f(q.y + n.y * w)} ${f(q.x - n.x * w)},${f(q.y - n.y * w)}" fill="${INK}"/>`);
        } else if (b.stereo === 6 && !ts) {
          const k = 6;
          for (let t = 1; t <= k; t++) { const c = add(p, mul(sub(q, p), t / k)); const w = 3.6 * scale * t / k + 0.4; out.bonds.push(line(add(c, mul(n, w)), add(c, mul(n, -w)), ' stroke-width="1.2"')); }
        } else out.bonds.push(line(p, q, dash));
        visualMid.set(A.i + ':' + B.i + ':' + placed.indexOf(L), mid);
        visualMid.set(B.i + ':' + A.i + ':' + placed.indexOf(L), mid);
      }
    }
    // dashed partial bonds that do not exist yet (between any two mapped atoms)
    for (const [A, B] of tsPairs) {
      const exists = A.mol === B.mol && A.mol.bonds.some(b => (A.mol.atoms[b.a] === A && A.mol.atoms[b.b] === B) || (A.mol.atoms[b.a] === B && A.mol.atoms[b.b] === A));
      if (exists) continue;
      const p = endPt(A, B), q = endPt(B, A);
      out.bonds.push(`<line x1="${f(p.x)}" y1="${f(p.y)}" x2="${f(q.x)}" y2="${f(q.y)}" stroke="${INK}" stroke-width="1.7" stroke-dasharray="4 3.5" stroke-linecap="round"/>`);
    }
    // 4. highlights
    for (const h of step.hl) { const a = maps.get(h.map); if (!a) continue; out.back.push(`<circle cx="${f(a.x)}" cy="${f(a.y)}" r="${f(13 * scale)}" fill="${h.color || '#ffd54f'}" fill-opacity="0.45"/>`); }
    // 5. atom labels + charges
    const chargeTxt = c => (Math.abs(c) > 1 ? Math.abs(c) : '') + (c > 0 ? '+' : '−');
    const fs = FS * scale;
    for (const L of placed) for (const a of L.atoms) {
      if (a.showLabel) {
        const y = a.y + fs * 0.35;
        const col = elColor(a.el);
        out.atoms.push(`<text x="${f(a.x)}" y="${f(y)}" font-size="${f(fs)}" text-anchor="middle" fill="${col}">${esc(a.el)}</text>`);
        if (a.h > 0) {
          const subTxt = a.h > 1 ? `<tspan font-size="${f(fs * 0.68)}" dy="${f(fs * 0.25)}">${a.h}</tspan>` : '';
          if (a.hLeft) out.atoms.push(`<text x="${f(a.x - a.elW / 2 - a.hW)}" y="${f(y)}" font-size="${f(fs)}" text-anchor="start" fill="${col}">H${subTxt}</text>`);
          else out.atoms.push(`<text x="${f(a.x + a.elW / 2)}" y="${f(y)}" font-size="${f(fs)}" text-anchor="start" fill="${col}">H${subTxt}</text>`);
        }
        if (a.charge) {
          const cx = a.x + a.elW / 2 + (!a.hLeft ? a.hW : 0) + 1.5, cy = a.y - fs * 0.32;
          out.atoms.push(`<text x="${f(cx)}" y="${f(cy)}" font-size="${f(fs * 0.72)}" fill="${INK}">${chargeTxt(a.charge)}</text>`);
          a.occ.push(-PI / 4 + (a.hLeft ? 0 : 0.25));
        }
      } else if (a.charge) {
        const t = allocAngle(a, -PI / 4);
        const p = add(a, mul(dirA(t), 12 * scale));
        out.atoms.push(chargeCircle(p, a.charge, scale));
      }
    }
    // 6. lone pairs / radicals (source atoms first, aimed at their target)
    const lpPos = new Map(), radPos = new Map();
    const targetPoint = ar => {
      if (ar.to.length === 2) { const A = maps.get(ar.to[0]), B = maps.get(ar.to[1]); if (A && B) return mul(add(A, B), 0.5); }
      return maps.get(ar.to[0]) || null;
    };
    for (const L of placed) for (const a of L.atoms) {
      const ar = sourceAtoms.get(a);
      const tp = ar ? targetPoint(ar) : null;
      const prefer = tp ? Math.atan2(tp.y - a.y, tp.x - a.x) : null;
      const list = [];
      if (a.radN) {
        const t = allocAngle(a, ar && ar.fish ? prefer : null);
        const p = add(a, mul(dirA(t), decoRadius(a, t, -1)));
        radPos.set(a, { p, t });
        out.deco.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(2.1 * scale)}" fill="${INK}"/>`);
      }
      if (a.drawLP) {
        for (let k = 0; k < a.lpN; k++) {
          const t = allocAngle(a, k === 0 && ar && !ar.fish ? prefer : null);
          const r = decoRadius(a, t, -1.5);
          const c = add(a, mul(dirA(t), r));
          const pv = mul(perp(dirA(t)), 2.9 * scale);
          out.deco.push(`<circle cx="${f(c.x + pv.x)}" cy="${f(c.y + pv.y)}" r="${f(1.9 * scale)}" fill="${INK}"/><circle cx="${f(c.x - pv.x)}" cy="${f(c.y - pv.y)}" r="${f(1.9 * scale)}" fill="${INK}"/>`);
          list.push({ p: c, t });
        }
      }
      if (list.length) lpPos.set(a, list);
    }
    // partial charges + tags
    for (const pc of step.pc) { const a = maps.get(pc.map); if (!a) continue; const t = allocAngle(a, -PI / 3); const p = add(a, mul(dirA(t), decoRadius(a, t, 6))); out.deco.push(`<text x="${f(p.x)}" y="${f(p.y + 4)}" font-size="${f(12.5 * scale)}" text-anchor="middle" fill="#444" font-style="italic">δ${pc.sign}</text>`); bb.add(p.x, p.y, 8); }
    for (const tg of step.tags) { const a = maps.get(tg.map); if (!a) continue; const t = allocAngle(a, PI / 2); const p = add(a, mul(dirA(t), decoRadius(a, t, 12))); const w = textW(tg.text, 11.5); const ax = Math.cos(t) > 0.5 ? 'start' : Math.cos(t) < -0.5 ? 'end' : 'middle'; out.deco.push(`<text x="${f(p.x)}" y="${f(p.y + 4)}" font-size="11.5" text-anchor="${ax}" fill="#6a4fb3" font-style="italic">${esc(tg.text)}</text>`); const x0 = ax === 'start' ? p.x : ax === 'end' ? p.x - w : p.x - w / 2; bb.add(x0, p.y - 8); bb.add(x0 + w, p.y + 8); }
    if (doc.maps || opts.maps) for (const L of placed) for (const a of L.atoms) if (a.map) out.top.push(`<text x="${f(a.x + 7)}" y="${f(a.y + 14)}" font-size="9.5" fill="#0a7d55" font-weight="700">${a.map}</text>`);
    // include decorations in bbox
    for (const L of placed) for (const a of L.atoms) { const r = a.showLabel ? 16 : 14; if (a.drawLP || a.charge || a.radN) bb.add(a.x, a.y, r); }
    // 7. operators
    items.forEach(it => {
      if (it.type !== 'op') return;
      const x0 = it._x, w = it._w, y = 0;
      if (it.op === '+') { out.atoms.push(`<text x="${f(x0 + w / 2)}" y="${f(y + 7)}" font-size="${f(22 * scale)}" text-anchor="middle" fill="${INK}">+</text>`); bb.add(x0 + w / 2, 0, 10); return; }
      const x1 = x0 + w;
      const s = [];
      const head = (xx, yy, dir) => `<path d="M${f(xx)},${f(yy)} l${f(-9 * dir)},-4.5 l${f(2 * dir)},4.5 l${f(-2 * dir)},4.5 z" fill="${INK}"/>`;
      if (it.op === '->' || it.op === '-x>') { s.push(`<line x1="${f(x0)}" y1="0" x2="${f(x1 - 3)}" y2="0" stroke="${INK}" stroke-width="1.6"/>`, head(x1, 0, 1)); if (it.op === '-x>') s.push(`<path d="M${f((x0 + x1) / 2 - 6)},-6 l12,12 M${f((x0 + x1) / 2 + 6)},-6 l-12,12" stroke="#c62828" stroke-width="2"/>`); }
      else if (it.op === '<->') s.push(`<line x1="${f(x0 + 3)}" y1="0" x2="${f(x1 - 3)}" y2="0" stroke="${INK}" stroke-width="1.6"/>`, head(x1, 0, 1), head(x0, 0, -1));
      else if (it.op === '<=>') s.push(`<path d="M${f(x0)},-3 H${f(x1)} l-8,-5" fill="none" stroke="${INK}" stroke-width="1.5"/><path d="M${f(x1)},3 H${f(x0)} l8,5" fill="none" stroke="${INK}" stroke-width="1.5"/>`);
      else if (it.op === '=>') s.push(`<path d="M${f(x0)},-3.5 H${f(x1 - 6)} M${f(x0)},3.5 H${f(x1 - 6)} M${f(x1 - 11)},-10 L${f(x1)},0 L${f(x1 - 11)},10" fill="none" stroke="${INK}" stroke-width="1.5"/>`);
      if (it.above) { s.push(`<text x="${f((x0 + x1) / 2)}" y="-9" font-size="12.5" text-anchor="middle" fill="#333">${fmtInline(it.above)}</text>`); bb.add((x0 + x1) / 2, -24); }
      if (it.below) { s.push(`<text x="${f((x0 + x1) / 2)}" y="20" font-size="12.5" text-anchor="middle" fill="#333">${fmtInline(it.below)}</text>`); bb.add((x0 + x1) / 2, 26); }
      bb.add(x0, -10); bb.add(x1, 10);
      out.atoms.push(s.join(''));
    });
    // 8. molecule labels
    const labY = maxBottom + 20;
    for (const L of placed) if (L.item.label) { const cx = (L.bb.x0 + L.bb.x1) / 2; out.atoms.push(`<text x="${f(cx)}" y="${f(labY)}" font-size="12.5" text-anchor="middle" fill="#555" font-style="italic">${fmtInline(L.item.label)}</text>`); const w = textW(L.item.label, 12.5); bb.add(cx - w / 2, labY + 5); bb.add(cx + w / 2, labY - 10); }
    // 9. curved arrows
    const obstacles = [];
    for (const L of placed) for (const a of L.atoms) obstacles.push(a);
    step.arrows.forEach((ar, idx) => {
      const color = ar.color || PALETTE[idx % PALETTE.length];
      const r = drawCurly(ar, idx, color, maps, lpPos, radPos, visualMid, placed, obstacles, scale, doc.numbers && step.arrows.length > 1, bb);
      if (r) out.arrows.push(r); else (doc._warn || []).push('Arrow ' + (idx + 1) + ' refers to an atom number that is not in this step');
    });
    // 10. bracket
    if (step.bracket) {
      const pad = 10, x0 = bb.x0 - pad, x1 = bb.x1 + pad, y0 = bb.y0 - pad, y1 = bb.y1 + pad;
      out.top.push(`<path d="M${f(x0 + 8)},${f(y0)} H${f(x0)} V${f(y1)} H${f(x0 + 8)} M${f(x1 - 8)},${f(y0)} H${f(x1)} V${f(y1)} H${f(x1 - 8)}" fill="none" stroke="${INK}" stroke-width="1.6"/><text x="${f(x1 + 4)}" y="${f(y0 + 10)}" font-size="16" fill="${INK}">${esc(step.bracket)}</text>`);
      bb.add(x0, y0); bb.add(x1 + 16, y1);
    }
    if (!bb.ok) bb.add(0, 0, 20);
    const P = 14;
    const vx = bb.x0 - P, vy = bb.y0 - P, vw = bb.w + 2 * P, vh = bb.h + 2 * P;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vx)} ${f(vy)} ${f(vw)} ${f(vh)}" width="${f(vw)}" height="${f(vh)}" font-family="${FONT}" class="mech"><rect x="${f(vx)}" y="${f(vy)}" width="${f(vw)}" height="${f(vh)}" fill="#fff"/><g>${out.back.join('')}</g><g>${out.bonds.join('')}</g><g>${out.atoms.join('')}</g><g>${out.deco.join('')}</g><g>${out.arrows.join('')}</g><g>${out.top.join('')}</g></svg>`;
    return { svg, width: vw, height: vh };
  }

  function elColor(el) { return { O: '#c0281c', N: '#2346b5', S: '#a07a00', Cl: '#1c8a2e', F: '#1c8a2e', Br: '#8b3a1a', I: '#6a1b9a', P: '#d9661a', B: '#a8641e' }[el] || INK; }
  function chargeCircle(p, c, scale) {
    const r = 5.6 * scale, l = 3.3 * scale;
    let s = `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(r)}" fill="#fff" stroke="${INK}" stroke-width="1.1"/><line x1="${f(p.x - l)}" y1="${f(p.y)}" x2="${f(p.x + l)}" y2="${f(p.y)}" stroke="${INK}" stroke-width="1.3"/>`;
    if (c > 0) s += `<line x1="${f(p.x)}" y1="${f(p.y - l)}" x2="${f(p.x)}" y2="${f(p.y + l)}" stroke="${INK}" stroke-width="1.3"/>`;
    if (Math.abs(c) > 1) s += `<text x="${f(p.x - r - 1)}" y="${f(p.y + 4)}" font-size="10" text-anchor="end">${Math.abs(c)}</text>`;
    return s;
  }

  function bezier(S, C1, C2, T, t) { const u = 1 - t; return { x: u * u * u * S.x + 3 * u * u * t * C1.x + 3 * u * t * t * C2.x + t * t * t * T.x, y: u * u * u * S.y + 3 * u * u * t * C1.y + 3 * u * t * t * C2.y + t * t * t * T.y }; }

  function drawCurly(ar, idx, color, maps, lpPos, radPos, visualMid, placed, obstacles, scale, numbered, bb) {
    const A = maps.get(ar.from[0]); if (!A) return null;
    let src, srcAtom = null;
    if (ar.from.length === 2) {
      const B = maps.get(ar.from[1]); if (!B) return null;
      const key = A.i + ':' + B.i + ':' + placed.indexOf(A.mol);
      src = (A.mol === B.mol && visualMid.get(key)) || mul(add(A, B), 0.5);
    } else srcAtom = A;
    const T1 = maps.get(ar.to[0]); if (!T1) return null;
    let tgt, tgtAtom = null;
    if (ar.to.length === 2) {
      const T2 = maps.get(ar.to[1]); if (!T2) return null;
      const key = T1.i + ':' + T2.i + ':' + placed.indexOf(T1.mol);
      tgt = (T1.mol === T2.mol && visualMid.get(key)) || mul(add(T1, T2), 0.5);
    } else tgtAtom = T1;
    // source point for atom sources: its lone pair / radical, else the atom itself
    if (srcAtom) {
      const tp = tgt || tgtAtom;
      const want = Math.atan2(tp.y - srcAtom.y, tp.x - srcAtom.x);
      const rp = radPos.get(srcAtom), lps = lpPos.get(srcAtom);
      if (ar.fish && rp) src = rp.p;
      else if (lps && lps.length) { let best = lps[0]; for (const l of lps) if (angDist(l.t, want) < angDist(best.t, want)) best = l; src = add(best.p, mul(dirA(best.t), 2.5)); }
      else if (rp) src = rp.p;
      else src = add(srcAtom, mul(dirA(want), srcAtom.showLabel ? 11 : 6));
    }
    let T = tgt || tgtAtom;
    const D = sub(T, src); let dist = len(D);
    if (dist < 1) { T = add(T, { x: 0, y: -20 }); dist = 20; }
    const u = unit(sub(T, src)), n = perp(u);
    let h = Math.min(Math.max(dist * 0.42, 17 * scale), 58 * scale) * (ar.bend || 1);
    const ctrl = sg => [add(add(src, mul(sub(T, src), 0.1)), mul(n, h * 1.33 * sg)), add(add(src, mul(sub(T, src), 0.9)), mul(n, h * 1.33 * sg))];
    const clearance = sg => { const [c1, c2] = ctrl(sg); let m = 0; for (const t of [0.3, 0.5, 0.7]) { const p = bezier(src, c1, c2, T, t); let d = 1e9; for (const o of obstacles) d = Math.min(d, Math.hypot(o.x - p.x, o.y - p.y)); m += Math.min(d, 60); } return m; };
    let sg = clearance(1) >= clearance(-1) ? 1 : -1;
    if (ar.flip) sg = -sg;
    let [C1, C2] = ctrl(sg);
    if (tgtAtom) { const back = unit(sub(C2, tgtAtom)); T = add(tgtAtom, mul(back, tgtAtom.showLabel ? 12 * scale : 7 * scale)); [C1, C2] = ctrl(sg); }
    const tan = unit(sub(T, C2));
    const HL = 9.5, HW = 4.3;
    const E = sub(T, mul(tan, HL * 0.75));
    const C2b = sub(C2, mul(tan, 0));
    const pn = perp(tan);
    let head;
    if (ar.fish) {
      // single barb on the outside of the curve
      const out = mul(n, sg); const sgn = (pn.x * out.x + pn.y * out.y) >= 0 ? 1 : -1;
      const b1 = add(sub(T, mul(tan, HL)), mul(pn, HW * 1.15 * sgn));
      head = `<path d="M${f(T.x)},${f(T.y)} L${f(b1.x)},${f(b1.y)} L${f(E.x)},${f(E.y)} z" fill="${color}"/>`;
    } else {
      const b1 = add(sub(T, mul(tan, HL)), mul(pn, HW)), b2 = add(sub(T, mul(tan, HL)), mul(pn, -HW));
      head = `<path d="M${f(T.x)},${f(T.y)} L${f(b1.x)},${f(b1.y)} L${f(E.x)},${f(E.y)} L${f(b2.x)},${f(b2.y)} z" fill="${color}"/>`;
    }
    for (let t = 0; t <= 1; t += 0.1) { const p = bezier(src, C1, C2, T, t); bb.add(p.x, p.y, 6); }
    let s = `<g class="curly"><path d="M${f(src.x)},${f(src.y)} C${f(C1.x)},${f(C1.y)} ${f(C2b.x)},${f(C2b.y)} ${f(E.x)},${f(E.y)}" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round"/>${head}`;
    const mid = bezier(src, C1, C2, T, 0.5);
    if (numbered) {
      const p = add(mid, mul(n, 10 * sg));
      s += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="7.2" fill="#fff" stroke="${color}" stroke-width="1.4"/><text x="${f(p.x)}" y="${f(p.y + 3.8)}" font-size="10.5" font-weight="700" text-anchor="middle" fill="${color}">${idx + 1}</text>`;
      bb.add(p.x, p.y, 9);
    }
    if (ar.text) {
      const p = add(mid, mul(n, (numbered ? 24 : 12) * sg)); const w = textW(ar.text, 11);
      s += `<text x="${f(p.x)}" y="${f(p.y + 4)}" font-size="11" text-anchor="middle" fill="${color}" font-style="italic">${esc(ar.text)}</text>`;
      bb.add(p.x - w / 2, p.y - 8); bb.add(p.x + w / 2, p.y + 8);
    }
    return s + '</g>';
  }

  // inline formatting for SVG text (subscripts in formulas)
  function fmtInline(t) {
    let s = esc(t).replace(/-&gt;/g, '→').replace(/&lt;=&gt;/g, '⇌');
    s = s.replace(/_\{([^}]*)\}|_(\d+)/g, (m, a, b) => `<tspan font-size="10" dy="3">${a || b}</tspan><tspan dy="-3">\u200b</tspan>`);
    s = s.replace(/\b((?:[A-Z][a-z]?\d*){2,})\b/g, m => /\d/.test(m) && !/^(S[N]\d|E\d)/.test(m) ? m.replace(/(\d+)/g, '<tspan font-size="10" dy="3">$1</tspan><tspan dy="-3">\u200b</tspan>') : m);
    return s;
  }

  G.APRender = { renderStep, PALETTE, fmtInline, esc };
})(typeof window !== 'undefined' ? window : globalThis);
