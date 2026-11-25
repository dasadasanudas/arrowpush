# ArrowPush

**Reaction mechanisms from a link.** Text-only AIs can't draw, but they can write a link. ArrowPush turns a tiny script (SMILES + arrow codes + notes) into clean skeletal structures with curly electron-pushing arrows, lone pairs, charges and step-by-step explanations.

```
show: [OH-:1] + [CH3:2][Br:3] ->{H2O} [OH:1][CH3:2] + [Br-:3]
arrow: 1>2, 2-3>3
note: [1] O attacks C from the back. [2] C–Br breaks, Br⁻ leaves.
```

## Use it
1. Open the app, click **AI prompt**, copy it, paste it into your AI (ChatGPT, Gemini, Claude, Kimi, ...) once per chat or in its custom instructions.
2. Ask the AI an organic question. It answers with an ArrowPush link plus the script.
3. Click the link. If a chat app mangles it, click **Edit** and paste the script (or the whole link) into the editor.

Inside the app: **Edit** opens the live editor, **Copy link** makes a short compressed link, **Examples** shows SN2, E1, ester hydrolysis, nitration, radical bromination and resonance.

## How it works
- Static site, no server. The script lives in the URL fragment (`#...`), so nothing is sent anywhere and there is no length limit from a server.
- Structures: [RDKit.js](https://github.com/rdkit/rdkit-js) (loaded from a CDN, then cached offline by a service worker) generates 2D coordinates; ArrowPush draws everything itself as SVG so arrows can target exact atoms and bonds.
- Atoms are addressed by SMILES atom-map numbers (`[CH3:2]`), which LLMs already know from reaction SMILES.
- Full language reference: [PROMPT.md](PROMPT.md).

## Files
`index.html` · `css/style.css` · `js/chem.js` (SMILES bookkeeping, valence, electrons) · `js/script.js` (script parser) · `js/render.js` (SVG drawing, curly arrows) · `js/app.js` (URL, editor, RDKit) · `js/examples.js` · `js/prompt.js` (loads PROMPT.md) · `sw.js` (offline cache)
