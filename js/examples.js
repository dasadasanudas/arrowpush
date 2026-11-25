window.AP_EXAMPLES = [
{ name: 'SN2: hydroxide + bromomethane', src: `title: SN2 — hydroxide attacks bromomethane
question: Show the mechanism of CH3Br + OH⁻ → CH3OH + Br⁻.
step: One concerted step (backside attack)
show: [OH-:1] + [CH3:2][Br:3] ->{H2O|SN2} [OH:1][CH3:2] + [Br-:3]
arrow: 1>2, 2-3>3
pc: 2 δ+, 3 δ-
note: [1] A lone pair on oxygen attacks carbon from the side opposite Br (180°, backside attack).
note: [2] At the same moment the C–Br bond breaks and both electrons leave with bromine as Br⁻.
note: One step, so rate = k[CH3Br][OH⁻]; a chiral carbon would be inverted (Walden inversion).
answer: Concerted SN2: bimolecular, single transition state, inversion of configuration.` },
{ name: 'E1: acid dehydration of tert-butanol', src: `title: E1 dehydration of tert-butanol
question: Why does (CH3)3C–OH give 2-methylpropene with conc. H2SO4 and heat?
step: Protonate the OH (turn a bad leaving group into water)
show: CC(C)(C)[OH:1] + [H:2][OH2+:3]
arrow: 1>2, 2-3>3
note: [1] An O lone pair grabs the proton. [2] The H–O bond of H3O⁺ breaks back onto that oxygen.
step: Water leaves → tertiary carbocation (slow step)
show: C[C:1](C)(C)[OH2+:2] ->{rate-determining} C[C+:1](C)C + O
arrow: 1-2>2
note: [1] The C–O bond breaks heterolytically; the 3° carbocation is stabilised by hyperconjugation.
step: Loss of a β-H forms the alkene
show: C[C+:1](C)[CH2:2][H:3] + [OH2:4] -> C=C(C)C + [OH3+]
arrow: 4>3, 3-2>2-1
tag: 1 3° cation
note: [1] Water acts as a base on a β-hydrogen. [2] The C–H electrons swing in to make the C=C π bond.
answer: E1: carbocation intermediate, Zaitsev alkene, rate depends only on the substrate.` },
{ name: 'Ester hydrolysis (BAc2)', src: `title: Base hydrolysis of methyl acetate (BAc2)
step: Hydroxide adds to the carbonyl
show: [OH-:1] + C[C:2](=[O:3])OC
arrow: 1>2, 2-3>3
pc: 2 δ+
note: [1] OH⁻ attacks the electrophilic carbonyl carbon. [2] The C=O π electrons move onto oxygen.
step: Tetrahedral intermediate collapses
show: C[C:1]([O-:2])(O)[O:3]C ->{} CC(=O)O + [O-]C
arrow: 2>2-1, 1-3>3
tag: 1 tetrahedral
note: [1] An O⁻ lone pair re-forms C=O. [2] Methoxide is expelled.
step: Irreversible proton transfer
show: CC(=O)[O:1][H:2] + [O-:3]C -> CC(=O)[O-] + OC
arrow: 3>2, 2-1>1
note: The acid is deprotonated by methoxide, which drives the whole reaction forward (carboxylate is resonance-stabilised).
answer: Products: acetate + methanol. Saponification is irreversible because of the last step.` },
{ name: 'Nitration of benzene (EAS)', src: `title: Electrophilic aromatic substitution: nitration
step: Benzene π electrons attack NO2⁺
show: C1=CC=C[CH:1]=[CH:2]1 + [O:4]=[N+:3]=O{nitronium}
arrow: 1-2>3, 3-4>4
note: [1] A C=C π bond attacks nitrogen. [2] One N=O π bond moves onto oxygen so N doesn't exceed its octet.
step: Arenium ion (σ-complex) loses H⁺
show: [O-][N+](=O)[C:1]1([H:2])C=CC=C[CH+:3]1{arenium ion} + [O-:4]S(=O)(=O)O -> [O-][N+](=O)c1ccccc1 + OS(=O)(=O)O
arrow: 4>2, 2-1>1-3
note: [1] HSO4⁻ removes the proton on the sp3 carbon. [2] The C–H electrons restore the aromatic ring.
answer: Nitrobenzene. Step 1 (loss of aromaticity) is rate-determining.` },
{ name: 'Radical bromination (fishhooks)', src: `title: Free-radical bromination of methane
step: Initiation: homolysis
show: [Br:1][Br:2] ->{hν} [Br] + [Br]
arrow: 1-2~>1, 1-2~>2
note: Fishhook (half) arrows move single electrons; each Br keeps one.
step: Propagation: H-abstraction
show: [Br:1] + [H:2][CH3:3] -> [Br][H] + [CH3]
arrow: 1~>1-2, 2-3~>1-2, 2-3~>3
note: [1]+[2] one electron each forms the new H–Br bond; [3] the other C–H electron stays on carbon → methyl radical.` },
{ name: 'Resonance of the enolate', src: `title: Resonance in the acetone enolate
show: C[C:1](=[O:2])[CH2-:3] <-> CC([O-])=C
arrow: 3>3-1, 1-2>2
lp: 2
note: The carbanion lone pair forms C=C while the C=O π pair moves onto oxygen; the negative charge is shared, mostly on O (more electronegative).` }
];
