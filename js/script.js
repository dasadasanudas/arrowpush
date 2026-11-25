/* ArrowPush script parser: the tiny line-based language an AI writes into the link */
(function (G) {
  'use strict';
  const KEYS = {
    title: 'title', name: 'title', heading: 'title',
    question: 'question', q: 'question', problem: 'question', given: 'question',
    note: 'note', notes: 'note', text: 'note', explain: 'note', explanation: 'note', why: 'note', says: 'note', comment: 'note',
    answer: 'answer', ans: 'answer', result: 'answer', final: 'answer', conclusion: 'answer',
    step: 'step', stage: 'step',
    show: 'show', mol: 'show', mols: 'show', species: 'show', rxn: 'show', reaction: 'show', draw: 'show', smiles: 'show',
    arrow: 'arrow', arrows: 'arrow', push: 'arrow', curly: 'arrow',
    lp: 'lp', lonepairs: 'lp', lonepair: 'lp', pairs: 'lp',
    hl: 'hl', highlight: 'hl', mark: 'hl',
    ts: 'ts', partial: 'ts', dashed: 'ts', forming: 'ts',
    pc: 'pc', delta: 'pc', partialcharge: 'pc', dipole: 'pc',
    tag: 'tag', label: 'tag', labels: 'tag', tags: 'tag',
    rad: 'rad', radical: 'rad', radicals: 'rad',
    bracket: 'bracket', brackets: 'bracket',
    numbers: 'numbers', maps: 'maps', carbons: 'carbons', showc: 'carbons', scale: 'scale'
  };
  const OPS = { '+': '+', '->': '->', '-->': '->', '→': '->', '<=>': '<=>', '⇌': '<=>', '<->': '<->', '↔': '<->', '=>': '=>', '⇒': '=>', '-x>': '-x>' };

  function parseShow(str, warnings) {
    const toks = str.match(/\{[^}]*\}|[^\s{]+/g) || [];
    const items = [];
    for (const t of toks) {
      if (t[0] === '{') {
        const inner = t.slice(1, -1).trim();
        const last = items[items.length - 1];
        if (!last) continue;
        if (last.type === 'op') {
          const parts = inner.split('|');
          last.above = (parts[0] || '').trim();
          last.below = (parts.slice(1).join('|') || '').trim();
        } else {
          const lab = [];
          for (const p of inner.split(';')) {
            const s = p.trim();
            let m;
            if (/^(fx|flipx|mirror)$/i.test(s)) last.opts.fx = true;
            else if (/^(fy|flipy)$/i.test(s)) last.opts.fy = true;
            else if ((m = s.match(/^r(?:ot(?:ate)?)?\s*=?\s*(-?\d+(?:\.\d+)?)$/i))) last.opts.rot = parseFloat(m[1]);
            else if ((m = s.match(/^(?:s|size|scale)\s*=\s*(\d+(?:\.\d+)?)$/i))) last.opts.scale = parseFloat(m[1]);
            else if (s) lab.push(s);
          }
          if (lab.length) last.label = lab.join('; ');
        }
        continue;
      }
      if (OPS[t]) { items.push({ type: 'op', op: OPS[t], above: '', below: '' }); continue; }
      items.push({ type: 'mol', smiles: t, label: '', opts: {} });
    }
    return items;
  }

  const COLORS = { red: '#d62728', blue: '#1f5fbf', green: '#2a9d3a', orange: '#e07b00', purple: '#8e44ad', teal: '#00838f', black: '#111111', gray: '#777777', grey: '#777777', pink: '#d81b60', magenta: '#c2185b', brown: '#8d5a2b' };

  function parseArrows(str, warnings) {
    const out = [];
    for (let chunk of str.split(/[,;]/)) {
      chunk = chunk.trim();
      if (!chunk) continue;
      const m = chunk.match(/^(\d+)(?:\s*-\s*(\d+))?\s*(~>|->|-~>|>>|>|⇀|→)\s*(\d+)(?:\s*-\s*(\d+))?\s*(.*)$/);
      if (!m) { warnings.push('Could not read arrow "' + chunk + '" (use e.g. 1>2 or 2-3>3)'); continue; }
      const a = { from: m[2] ? [+m[1], +m[2]] : [+m[1]], to: m[5] ? [+m[4], +m[5]] : [+m[4]], fish: m[3] === '~>' || m[3] === '-~>' || m[3] === '⇀', flip: false, color: null, bend: 1, text: '' };
      const words = (m[6] || '').trim().split(/\s+/).filter(Boolean);
      const txt = [];
      for (const w of words) {
        const lw = w.toLowerCase();
        if (lw === 'flip' || lw === 'other' || lw === 'cw' || lw === 'ccw') a.flip = true;
        else if (lw === 'fish' || lw === 'fishhook' || lw === 'half' || lw === 'radical') a.fish = true;
        else if (COLORS[lw]) a.color = COLORS[lw];
        else if (/^#[0-9a-f]{3,6}$/i.test(w)) a.color = w;
        else if (lw === 'wide' || lw === 'big' || lw === 'loop') a.bend = 1.7;
        else if (lw === 'tight' || lw === 'flat' || lw === 'small') a.bend = 0.55;
        else if (/^bend=?(-?\d+(\.\d+)?)$/.test(lw)) a.bend = parseFloat(lw.replace(/^bend=?/, ''));
        else txt.push(w);
      }
      if (txt.length) a.text = txt.join(' ').replace(/^["']|["']$/g, '');
      out.push(a);
    }
    return out;
  }
  const nums = s => (s.match(/\d+/g) || []).map(Number);

  function newStep(title) { return { title: title || '', show: [], arrows: [], lp: [], lpAll: false, lpNone: false, hl: [], ts: [], pc: [], tags: [], rad: [], notes: [], bracket: '', carbons: [] }; }

  function parse(src) {
    const doc = { title: '', question: [], intro: [], steps: [], answer: [], warnings: [], numbers: true, maps: false, scale: 1, lpAll: false };
    let cur = null, lastText = null;
    let text = String(src || '').replace(/\r/g, '');
    if (!text.includes('\n') && text.includes('\\n')) text = text.replace(/\\n/g, '\n');
    const lines = text.split('\n');
    const ensureStep = () => { if (!cur) { cur = newStep(''); doc.steps.push(cur); } return cur; };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('```')) continue;
      const m = line.match(/^([A-Za-z]+)(?:\s*#?\d+)?\s*:\s?(.*)$/);
      const key = m ? KEYS[m[1].toLowerCase()] : null;
      if (!key) {
        if (lastText) { lastText.push(line); continue; }
        if (cur) { cur.show.push(...parseShow(line, doc.warnings)); continue; }
        doc.intro.push(line); lastText = doc.intro; continue;
      }
      const val = m[2].trim();
      lastText = null;
      switch (key) {
        case 'title': doc.title = val; break;
        case 'question': doc.question.push(val); lastText = doc.question; break;
        case 'answer': doc.answer.push(val); lastText = doc.answer; break;
        case 'step': cur = newStep(val); doc.steps.push(cur); break;
        case 'note': if (cur) { cur.notes.push(val); lastText = cur.notes; } else { doc.intro.push(val); lastText = doc.intro; } break;
        case 'show': { const s = ensureStep(); if (s.show.length) s.show.push({ type: 'op', op: '+', above: '', below: '' }); s.show.push(...parseShow(val, doc.warnings)); break; }
        case 'arrow': ensureStep().arrows.push(...parseArrows(val, doc.warnings)); break;
        case 'lp': {
          const lv = val.toLowerCase();
          if (!cur) { if (/all/.test(lv)) doc.lpAll = true; break; }
          if (/\ball\b/.test(lv)) cur.lpAll = true; else if (/\b(none|off|no)\b/.test(lv)) cur.lpNone = true; else cur.lp.push(...nums(val));
          break;
        }
        case 'hl': {
          const s = ensureStep();
          for (const part of val.split(/[,;]/)) {
            const ns = nums(part); if (!ns.length) continue;
            const cm = part.toLowerCase().match(/[a-z]+|#[0-9a-f]{3,6}/);
            const col = cm ? (COLORS[cm[0]] || (cm[0][0] === '#' ? cm[0] : null)) : null;
            ns.forEach(n => s.hl.push({ map: n, color: col }));
          }
          break;
        }
        case 'ts': { const s = ensureStep(); for (const p of val.split(/[,;\s]+/)) { const q = p.match(/^(\d+)\s*[-.~:]+\s*(\d+)$/); if (q) s.ts.push([+q[1], +q[2]]); } break; }
        case 'pc': {
          const s = ensureStep();
          const re = /(\d+)\s*(δ?\s*[+\-−]|delta\s*[+\-]|d[+\-])/gi; let q;
          while ((q = re.exec(val))) s.pc.push({ map: +q[1], sign: /[-−]/.test(q[2]) ? '−' : '+' });
          break;
        }
        case 'tag': {
          const s = ensureStep();
          for (const p of val.split(/[,;]/)) { const q = p.trim().match(/^(\d+)\s*[:=]?\s*(.+)$/); if (q) s.tags.push({ map: +q[1], text: q[2].trim().replace(/^["']|["']$/g, '') }); }
          break;
        }
        case 'rad': ensureStep().rad.push(...nums(val)); break;
        case 'bracket': ensureStep().bracket = val || '‡'; break;
        case 'carbons': { const s = cur; const lv = val.toLowerCase(); if (s) { if (/all/.test(lv)) s.carbons = 'all'; else s.carbons = nums(val); } break; }
        case 'numbers': doc.numbers = !/(off|no|false|0|hide)/i.test(val); break;
        case 'maps': doc.maps = /(on|yes|true|1|show)/i.test(val); break;
        case 'scale': doc.scale = Math.min(3, Math.max(0.4, parseFloat(val) || 1)); break;
      }
    }
    return doc;
  }

  G.APScript = { parse, COLORS };
})(typeof window !== 'undefined' ? window : globalThis);
