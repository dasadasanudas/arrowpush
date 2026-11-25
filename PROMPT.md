# ArrowPush: how to show a reaction mechanism with a link

You cannot display images, but the user has **ArrowPush**, a web viewer that draws skeletal structures from SMILES, curved electron-pushing arrows, lone pairs, charges and your explanation. You write a small text **script**, put it in a link, and the user clicks it.

## What to output (every time)
1. A link: `{{BASE}}#` followed by the script, percent-encoded.
2. The same script in a code block, so the user can paste it into the app (Edit) if the link ever breaks.

Encoding: use encodeURIComponent if you can run code (Python: `urllib.parse.quote(script, safe='')`). By hand, you MUST encode at least: newline `%0A`, space `%20`, `#` `%23`, `%` `%25`, `(` `%28`, `)` `%29`, `[` `%5B`, `]` `%5D`, `{` `%7B`, `}` `%7D`, `|` `%7C`, `"` `%22`, `<` `%3C`, `>` `%3E`, `\` `%5C`. Letters, digits and `= + - : , . / @ ~ _` may stay as they are. Never put the link inside markdown `[text](url)` unless it is fully encoded; a bare link is safest.

## Script language (one instruction per line, `key: value`)
```
title: Short title
question: The problem statement (optional)
note: Text shown before the first step (optional)

step: Heading for this step
show: <species> + <species> -> <species>
arrow: <arrow>, <arrow>, ...
note: Explanation for this step (repeat note: for more paragraphs)

answer: Final answer box (optional)
```

### `show:` species are SMILES with atom-map numbers
- Write each molecule/ion as SMILES. Give every atom that an arrow touches a **map number**: `[CH3:2]`, `[OH-:1]`, `[Br:3]`, `[C:4]`.
- Separators between species (spaces around them): `+`, `->` (reaction), `<=>` (equilibrium), `<->` (resonance), `=>` (retrosynthesis).
- Reagents/conditions on an arrow: `->{above|below}` e.g. `->{H2SO4|heat}`.
- A label under a species: put `{text}` right after its SMILES: `CCO{ethanol}`. Orientation tweaks in the same braces: `{ethanol; r=90}` rotates 90°, `fx` / `fy` mirror. Use these to point a nucleophile toward its target.
- Map numbers must be unique within a step. Products may reuse the same numbers after `->`; arrows always refer to the species **before** the first `->`.
- Bracket atoms: write the H count and charge exactly (`[CH2+:3]`, `[NH3+:1]`, `[O-:2]`). `[C:5]`/`[O:5]` with nothing else get their normal H count automatically. A lone bracket atom keeps its literal meaning: `[Br]` is a bromine radical, `[H+]` a proton.
- To draw an explicit H (e.g. the H removed in E2), write it as an atom: `[H:5][CH2:4]...` or `C([H:5])...`.
- Write Kekulé SMILES (`C1=CC=CC=C1`) when arrows touch ring bonds, so the double bonds are exactly where your arrows need them.

### `arrow:` electron pushing (comma-separated, numbered 1, 2, 3 ... in the drawing)
| write | meaning |
|---|---|
| `1>2` | lone pair on atom 1 attacks atom 2 (forms bond 1–2) |
| `2-3>3` | bond 2–3 breaks, the pair goes to atom 3 |
| `2-3>3-4` | bond 2–3 electrons move to form/strengthen bond 3–4 |
| `5>5-6` | lone pair on 5 makes a π bond 5–6 |
| `1~>1-2` | fishhook (one electron), for radicals |
Optional words after an arrow: `flip` (bend to the other side), `wide`/`tight` (curvature), a colour (`red blue green orange purple teal`), or a short label.
Arrow sources that are atoms automatically get their lone pairs drawn.

### Other step keys (all optional)
- `lp: 2 5` show lone pairs on those atoms (`lp: all`, `lp: none`)
- `pc: 2 δ+, 3 δ-` partial charges
- `hl: 4 7` highlight atoms (`hl: 4 green`)
- `ts: 1-2, 2-3` dashed partial bonds (transition states) and `bracket: ‡` square brackets around the step
- `tag: 3 nucleophile` small text next to an atom
- `rad: 4` turn atom 4 into a radical (removes one H, draws the dot)
- `carbons: 2 5` write "C"/"CH2" explicitly for those carbons (`carbons: all`)

### Notes text
`**bold**`, `*italic*`, formulas auto-subscript (`H2SO4`, `CH3CH2Br`), `_{sub}`, `^{sup}`, `->` becomes →. Write `[1]`, `[2]` to show coloured badges that match arrow 1, arrow 2.

## Example
```
title: SN2 of bromomethane
step: Backside attack
show: [OH-:1] + [CH3:2][Br:3] ->{H2O} [OH:1][CH3:2] + [Br-:3]
arrow: 1>2, 2-3>3
pc: 2 δ+, 3 δ-
note: [1] The O lone pair attacks carbon opposite to Br. [2] The C–Br bond breaks; Br leaves as Br⁻.
answer: Concerted, second order, inversion of configuration.
```
Link: `{{BASE}}#title%3A%20SN2%20of%20bromomethane%0Astep%3A%20Backside%20attack%0Ashow%3A%20%5BOH-%3A1%5D%20%2B%20%5BCH3%3A2%5D%5BBr%3A3%5D%20-%3E%7BH2O%7D%20%5BOH%3A1%5D%5BCH3%3A2%5D%20%2B%20%5BBr-%3A3%5D%0Aarrow%3A%201%3E2%2C%202-3%3E3%0Apc%3A%202%20%CE%B4%2B%2C%203%20%CE%B4-%0Anote%3A%20%5B1%5D%20The%20O%20lone%20pair%20attacks%20carbon%20opposite%20to%20Br.%20%5B2%5D%20The%20C%E2%80%93Br%20bond%20breaks%3B%20Br%20leaves%20as%20Br%E2%81%BB.%0Aanswer%3A%20Concerted%2C%20second%20order%2C%20inversion%20of%20configuration.`

## Good habits
- One step per elementary step (protonation, attack, loss of leaving group...). Show the intermediate as the first species of the next step.
- Draw the species that arrows act on with their map numbers; products after `->` are for orientation only.
- Keep notes short and tie them to arrows with `[1]`, `[2]`. Explain *why* (stability, electronegativity, sterics), and why other options fail when it's an MCQ.
- Double-check: every arrow number exists in that step, H counts are right, charges balance.
