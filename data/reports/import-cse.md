# CSE import report

## Source file

| Check | Count |
|---|---|
| Total records | 270 |
| With a real careers URL | 60 |
| Placeholder careers value | 210 |
| Other invalid careers value | 0 |
| Empty website | 118 |
| Unique careers pages | 41 |

Tech list: 28 companies, 26 with a known website.

## Tech ↔ CSE overlaps (matched by domain)

- Dialog Axiata → Dialog Axiata PLC (DIAL.N0000) via `dialog.lk`
- PickMe → Digital Mobility Solutions Lanka PLC (PickMe) (PKME.N0000) via `pickme.lk`

Ambiguous (kept separate, resolve by hand):
- Octave on `keells.com`: Asian Hotels & Properties PLC, Ceylon Cold Stores PLC, John Keells Holdings PLC, John Keells PLC, Keells Food Products PLC

## Company status

| Status | Companies |
|---|---|
| ready | 12 |
| needs-adapter | 59 |
| needs-discovery | 105 |
| needs-research | 120 |
| disabled | 0 |

`needs-discovery`: 105 companies across 87 unique website domains (discovery probes each domain once).

## Parent groups

| Group | Derived from | Members |
|---|---|---|
| ACL Group (`acl`) | shared website domain | 2: acl-cables, acl-plastics |
| Aitken Spence Group (`aitkenspence`) | shared careers domain | 3: aitken-spence, aitken-spence-hotel-holdings, aitken-spence-plantation-managements |
| Amana Takaful Group (`amanatakaful`) | shared website domain | 2: amana-takaful, amana-takaful-life |
| Ambeon Group (`ambeon`) | shared website domain | 2: ambeon-capital, ambeon-holdings |
| Richard Pieris Group (Arpico) (`arpico`) | shared website domain | 5: arpico-insurance, kegalle-plantations, maskeliya-plantations, namunukula-plantations, richard-pieris-and-company |
| Asiri Health (`asirihealth`) | shared website domain | 2: asiri-hospital-holdings, asiri-surgical-hospital |
| Browns Group (`brownsgroup`) | shared careers domain | 3: brown-and-company, browns-beach-hotels, browns-investments |
| Cargills Group (`cargillsceylon`) | shared careers domain | 2: c-t-holdings, cargills-ceylon |
| Carson Cumberbatch Group (`carsoncumberbatch`) | shared website domain | 4: bukit-darah, carson-cumberbatch, ceylon-guardian-investment-trust, ceylon-investment |
| Dialog Axiata Group (`dialog`) | shared careers domain | 2: dialog-axiata, dialog-finance |
| First Capital Group (`firstcapital`) | shared website domain | 2: first-capital-holdings, first-capital-treasuries |
| Hayleys Group (`hayleys`) | shared careers domain | 5: haycarb, hayleys, hayleys-fabric, hayleys-fibre, hayleys-leisure |
| John Keells Group (`keells`) | shared careers domain | 6: asian-hotels-and-properties, ceylon-cold-stores, john-keells, john-keells-holdings, keells-food-products, octave |
| Lanka Tiles Group (`lankatiles`) | shared website domain | 2: lanka-tiles, lanka-walltiles |
| LAUGFS Group (`laugfs`) | shared website domain | 2: laugfs-gas, laugfs-power |
| Lion Brewery Group (`lionbeer`) | shared website domain | 2: ceylon-beverage-holdings, lion-brewery-ceylon |
| LOLC Group (`lolc`) | shared careers domain | 3: lolc-finance, lolc-general-insurance, lolc-holdings |
| Renuka Group (`renukagroup`) | shared website domain | 5: renuka-agri-foods, renuka-city-hotels, renuka-foods, renuka-holdings, renuka-hotels |
| Softlogic Group (`softlogic`) | shared careers domain | 4: softlogic-capital, softlogic-finance, softlogic-holdings, softlogic-life-insurance |

## Careers page on a different domain than the website

Check whether these belong to a group that the domain rule can't see.

- asian-hotels-and-properties: website `johnkeells.com`, careers `keells.com`
- haycarb: website `haycarb.com`, careers `hayleys.com`
- hayleys-fabric: website `hayleysfabric.com`, careers `hayleys.com`
- softlogic-life-insurance: website `softlogiclife.lk`, careers `softlogic.lk`
- rootcode: website `rootcode.io`, careers `rootcode.ai`
- ascentic: website `ascentic.se`, careers `career.ascentic.se`
- lseg: website `lseg.com`, careers `lseg.wd3.myworkdayjobs.com`
- zyner-io: website `zyner.io`, careers `careers.zyner.io`
- swivel-group: website `swivelgroup.com.au`, careers `careers.smartrecruiters.com`

## Hand edits preserved over source values

- lseg.notes
- codegen.notes
- zillione.notes
- hcltech.notes

## Output

- companies.json: 296
- groups.json: 19
- crawl-targets.json: 34
