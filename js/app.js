/* ArrowPush app shell: URL <-> script, RDKit loading, page rendering, editor */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const view = $('#view'), src = $('#src'), editor = $('#editor'), statusEl = $('#status');
  const CDNS = ['https://unpkg.com/@rdkit/rdkit/dist/', 'https://cdn.jsdelivr.net/npm/@rdkit/rdkit/dist/'];
  let RD = null, rdPromise = null;
  const molCache = new Map();

  function loadScript(url) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function getRDKit() {
    if (rdPromise) return rdPromise;
    rdPromise = (async () => {
      for (const base of CDNS) {
        try {
          if (!window.initRDKitModule) await loadScript(base + 'RDKit_minimal.js');
          const m = await window.initRDKitModule({ locateFile: () => base + 'RDKit_minimal.wasm' });
          RD = m; return m;
        } catch (e) { console.warn('RDKit load failed from', base, e); delete window.initRDKitModule; }
      }
      throw new Error('Could not load the chemistry engine (needs internet the first time).');
    })();
    return rdPromise;
  }

  function prepMol(smiles) {
    if (molCache.has(smiles)) return molCache.get(smiles);
    let res;
    try {
      const pre = APChem.preprocess(smiles);
      let mol = null;
      const tries = [JSON.stringify({ removeHs: false, setAromaticity: false }), JSON.stringify({ removeHs: false }), null];
      for (const t of tries) {
        try { mol = t ? RD.get_mol(pre.smiles, t) : RD.get_mol(pre.smiles); } catch (e) { mol = null; }
        if (mol && (!mol.is_valid || mol.is_valid())) break;
        if (mol && mol.delete) mol.delete();
        mol = null;
      }
      if (!mol) throw new Error('Bad SMILES: ' + smiles);
      try { mol.set_new_coords(true); } catch (e) { try { mol.set_new_coords(); } catch (e2) { } }
      try { if (mol.straighten_depiction) mol.straighten_depiction(); } catch (e) { }
      const mb = mol.get_molblock();
      mol.delete();
      res = { mol: APChem.buildMolecule(pre, APChem.parseMolblock(mb)) };
    } catch (e) { res = { error: e.message || String(e) }; }
    molCache.set(smiles, res);
    return res;
  }

  // ---------- text formatting for notes ----------
  function fmt(t) {
    let s = APRender.esc(t);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
    s = s.replace(/\[(\d{1,2})\]/g, (m, n) => { const c = APRender.PALETTE[(n - 1) % APRender.PALETTE.length]; return `<span class="badge" style="--c:${c}">${n}</span>`; });
    s = s.replace(/&lt;=&gt;/g, '⇌').replace(/&lt;-&gt;/g, '↔').replace(/-&gt;/g, '→').replace(/=&gt;/g, '⇒');
    s = s.replace(/_\{([^}]*)\}/g, '<sub>$1</sub>').replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/\^([+\-−]|\d+[+\-−]?)/g, '<sup>$1</sup>');
    s = s.replace(/\b((?:[A-Z][a-z]?\d*){2,})(?![^<]*>)/g, m => (/\d/.test(m) && !/^(S[N]\d|E\d)/.test(m)) ? m.replace(/(\d+)/g, '<sub>$1</sub>') : m);
    return s;
  }
  const paras = arr => arr.map(p => p.startsWith('- ') ? `<li>${fmt(p.slice(2))}</li>` : `<p>${fmt(p)}</p>`).join('').replace(/(<li>.*?<\/li>)+/g, m => `<ul>${m}</ul>`);

  // ---------- rendering ----------
  let renderToken = 0;
  async function render(text) {
    const tok = ++renderToken;
    const doc = APScript.parse(text);
    doc._warn = doc.warnings;
    if (!RD) {
      view.innerHTML = '<div class="loading"><div class="spin"></div>Loading chemistry engine…</div>';
      try { await getRDKit(); } catch (e) { view.innerHTML = `<div class="err big">${APRender.esc(e.message)}</div>`; return; }
      if (tok !== renderToken) return;
    }
    const h = [];
    if (doc.title) { h.push(`<h1>${fmt(doc.title)}</h1>`); document.title = doc.title + ' · ArrowPush'; }
    if (doc.question.length) h.push(`<div class="question"><div class="tagline">Question</div>${paras(doc.question)}</div>`);
    if (doc.intro.length) h.push(`<div class="intro">${paras(doc.intro)}</div>`);
    const showMaps = $('#chkMaps') && $('#chkMaps').checked && !editor.hidden;
    doc.steps.forEach((st, i) => {
      const mols = st.show.map(it => it.type === 'mol' ? prepMol(it.smiles) : null);
      let svg = '';
      if (st.show.length) {
        try { svg = APRender.renderStep(st, mols, doc, { maps: showMaps }).svg; }
        catch (e) { console.error(e); svg = `<div class="err">Drawing failed: ${APRender.esc(e.message)}</div>`; }
      }
      mols.forEach((m, k) => { if (m && m.error) doc.warnings.push('Step ' + (i + 1) + ': ' + m.error); });
      const n = doc.steps.length > 1 ? `<span class="num">Step ${i + 1}</span>` : '';
      h.push(`<section class="step">${(n || st.title) ? `<h2>${n}${st.title ? `<span>${fmt(st.title)}</span>` : ''}</h2>` : ''}${svg ? `<div class="fig">${svg}<button class="dl" title="Download PNG" data-i="${i}">⤓</button></div>` : ''}${st.notes.length ? `<div class="notes">${paras(st.notes)}</div>` : ''}</section>`);
    });
    if (doc.answer.length) h.push(`<div class="answer"><div class="tagline">Answer</div>${paras(doc.answer)}</div>`);
    if (!doc.steps.length && !doc.title && !doc.question.length) h.push('<div class="empty">Nothing to draw yet. Write a script in the editor or open a link made by an AI.</div>');
    view.innerHTML = h.join('');
    const w = [...new Set(doc.warnings)];
    statusEl.textContent = w.length ? '⚠ ' + w.length : '✓';
    statusEl.title = w.join('\n');
    $('#warnings').innerHTML = w.map(x => `<div>${APRender.esc(x)}</div>`).join('');
  }

  // ---------- URL encoding ----------
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function deflate(str) { const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(new TextEncoder().encode(str)); w.close(); return b64u(await new Response(cs.readable).arrayBuffer()); }
  async function inflate(s) { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(unb64u(s)); w.close(); return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer()); }
  function lenientDecode(s) {
    try { return decodeURIComponent(s); } catch (e) {
      return s.replace(/(%[0-9a-fA-F]{2})+/g, m => { try { return decodeURIComponent(m); } catch (e2) { return m.replace(/%([0-9a-fA-F]{2})/g, (x, hh) => String.fromCharCode(parseInt(hh, 16))); } });
    }
  }
  async function readURL() {
    const hash = location.hash.slice(1), q = location.search.slice(1);
    if (hash.startsWith('z=')) { try { return await inflate(hash.slice(2)); } catch (e) { return 'title: This compressed link is damaged'; } }
    let raw = hash || q;
    if (!raw) return null;
    raw = raw.replace(/^(?:m|s|script|q|d|mech)?=/, '');
    return lenientDecode(raw);
  }
  const base = () => location.origin + location.pathname;
  async function shareLink(text) { return base() + '#z=' + await deflate(text); }
  const plainLink = text => base() + '#' + encodeURIComponent(text).replace(/[()'!*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

  // ---------- UI ----------
  let suppressHash = false, deb = null;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 1800); }
  async function copy(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true; } }
  function setEditor(open) { editor.hidden = !open; document.body.classList.toggle('editing', open); $('#btnEdit').classList.toggle('on', open); }

  src.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(async () => {
      let t = src.value;
      const mm = t.trim().match(/^https?:\/\/\S+?#(.+)$/s);
      if (mm && !t.trim().includes('\n')) { t = mm[1].startsWith('z=') ? await inflate(mm[1].slice(2)) : lenientDecode(mm[1].replace(/^m=/, '')); src.value = t; }
      render(t);
      suppressHash = true; history.replaceState(null, '', '#z=' + await deflate(t)); setTimeout(() => suppressHash = false, 50);
    }, 350);
  });
  $('#btnEdit').onclick = () => { setEditor(editor.hidden); if (!editor.hidden) src.focus(); render(src.value); };
  $('#btnLink').onclick = async () => { await copy(await shareLink(src.value)); toast('Short link copied'); };
  $('#btnPlain').onclick = async () => { await copy(plainLink(src.value)); toast('Readable link copied'); };
  $('#chkMaps').onchange = () => render(src.value);
  const exSel = $('#examples');
  AP_EXAMPLES.forEach((e, i) => { const o = document.createElement('option'); o.value = i; o.textContent = e.name; exSel.appendChild(o); });
  exSel.onchange = () => { if (exSel.value === '') return; src.value = AP_EXAMPLES[+exSel.value].src; src.dispatchEvent(new Event('input')); exSel.value = ''; };
  $('#btnPrompt').onclick = () => { $('#promptText').value = AP_PROMPT.replace(/\{\{BASE\}\}/g, base()); $('#promptDlg').showModal(); };
  $('#copyPrompt').onclick = async () => { await copy($('#promptText').value); toast('AI instructions copied'); };
  $('#closePrompt').onclick = () => $('#promptDlg').close();
  view.addEventListener('click', e => {
    const b = e.target.closest('.dl'); if (!b) return;
    const svg = b.parentElement.querySelector('svg'); if (!svg) return;
    const w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = w * 3; c.height = h * 3; const x = c.getContext('2d'); x.scale(3, 3); x.drawImage(img, 0, 0, w, h); const a = document.createElement('a'); a.download = 'arrowpush-step-' + (+b.dataset.i + 1) + '.png'; a.href = c.toDataURL('image/png'); a.click(); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML);
  });
  window.addEventListener('hashchange', async () => { if (suppressHash) return; const t = await readURL(); if (t != null) { src.value = t; render(t); } });

  (async () => {
    const t = await readURL();
    if (t != null) { src.value = t; setEditor(false); }
    else { src.value = AP_EXAMPLES[0].src; setEditor(true); }
    render(src.value);
  })();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
})();
