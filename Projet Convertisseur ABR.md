# Projet : Convertisseur ABR Photoshop → Infinite Painter

> Recréé le 2026-09-28 dans `Brush-converter/` (l'original était dans l'ancien dossier `myPSB-16-free-ink-brushes/`, supprimé).
> Cahier des charges d'origine + état d'avancement + analyses des samples.

## Objectif

Outil open source qui convertit des pinceaux Photoshop (`.abr`) en pinceaux Infinite Painter (`.prbr`).

Pas seulement les brush tips (bitmaps) : convertir autant que possible le comportement du pinceau (shape, tip, spacing, dynamiques de taille / angle / rondeur, scatter, transfer / opacité, texture, couleur, rotation, courbes de pression et de tilt), pour un résultat aussi proche que possible de l'original.

---

# Contexte technique

## ABR (v6+ / v10)

* Bloc `samp` : brush tips bitmap, UUID, dimensions.
* Bloc `desc` : ActionDescriptors Photoshop (paramètres, dynamiques, contrôles pression / tilt).
* Lecture avec **ag-psd** (`readAbr`).

## Infinite Painter

* `.przp` (pack) = zip : `index.json` (`version: 1`, `brush-folders[]` en `version: 3`) + `Brushes/*.prbr`.
* `.prbr` = zip non compressé : `properties.json` + `preview` (optionnel) + `head` (optionnel) + `texture` (optionnel).

---

# Architecture

| Module | Fichier | Rôle |
|---|---|---|
| 1. ABR Reader | `src/abr-reader.ts` | ABR → brushes, tips, patterns (+ rendu PNG des tips) |
| 2. Modèle universel | `src/universal.ts` | Modèle sans code Photoshop ni Infinite Painter |
| 3. Mapping PS → universel | `src/photoshop.ts` | Conversion + warnings des fonctionnalités non supportées |
| 4. Writer IP | `src/infinite-painter.ts` | Universel → `.prbr` / `.przp` |
| 5. Brush tips | `src/abr-reader.ts` | Tips → PNG 8 bits niveaux de gris, nommés par UUID |
| Orchestration | `src/convert.ts` | Conversion d'un ABR complet + rapport |
| CLI | `src/cli.ts` | Aucun code métier |

Modèle de `properties.json` : `src/template-properties.json` (un vrai pinceau IP) ; seuls les champs mappés sont modifiés.

## CLI

**Raccourci : `./convert.sh <fichier.abr | dossier>` fait tout (install si besoin, correctifs ag-psd, build, conversion). Voir `README.md`.**

```bash
npm install          # applique aussi le correctif ag-psd
npm run build
node dist/cli.js input.abr -o output [--json]
# ou, après `npm install -g .` : abr2painter input.abr -o output
```

Sortie :

```text
output/
├── brushes/*.prbr
├── tips/<uuid>.png
├── <nom>.przp        # pack complet à importer
├── report.json       # totalBrushes / converted / partial / failed / unsupported
└── abr.json          # avec --json (sans pixels : ~17 Ko au lieu de 200 Mo)
```

## Qualité

TypeScript strict, ESM, Node ≥ 20.10, tests `npm test` (node:test via tsx), logs JSON.
Dépendances : `ag-psd`, `jszip`, `pngjs`. Pas de `commander` / `fs-extra` (remplacés par `util.parseArgs` et `fs/promises`).

Samples : `Samples/Photoshop/Size Flow Gang.abr` (852 Ko, test de bout en bout) + la paire Syntetyc (voir plus bas). Les autres samples (18 ABR, 20 packs IP) ont été supprimés après analyse ; ce qu'on en a appris est dans ce document.

Sans ce fichier, le test de conversion est ignoré (les 4 autres tournent toujours).

---

# Format Infinite Painter — ce qui est confirmé

Sources : pack « Tree » (2021), « Proko Pencil », « Personnalisé - 3 », puis `Samples/` (1ʳᵉ série : 8 packs / 67 pinceaux ; 2ᵉ série : 7 packs / 208 pinceaux).

* `custom-head` / `custom-stroke texture` = **BLAKE2b-512 du fichier** `head` / `texture` (230/230 cas vérifiés). Vide = pas de fichier. Les exports de 2021 utilisaient un chemin Android.
* `stroke texture` / `head` = nom d'une ressource intégrée (`texture_8`, `brush_head_proko_pencil`), vide pour un fichier personnalisé.
* **Pas de `head`** → tête ronde procédurale d'IP, réglée par `head-properties.softness`.
* `preview` : PNG RGBA **512×128** (260/260 samples), fond transparent, trait noir en S tamponné avec la tête ; **optionnel** (32/208 pinceaux sans).
  → Le convertisseur génère la même chose : tête tamponnée le long d'un S avec le spacing du pinceau, pression simulée (taille / opacité s'affinent aux extrémités si elles dépendent de la pression).
* Head : PNG opaque, noir = peinture. Texture : PNG RGB, RGBA ou L.
* Angles en **radians** (π vu).
* `head-properties.spacing` : 0,005 → 2 (plafond 2 confirmé).
* `jitter-properties.*` : 0 → 1.
* `head-properties.rotation` (curseur « Rotation », −1..1) : **suit la direction du trait** (testé : CAL 4, cercle). `head-properties.use-trajectory` = interrupteur **« Rotation du stylet »** : la tête suit le stylet (testé : CAL 5).
* Courbes : paires `[x0,y0,x1,y1,…]`, **axe Y inversé** ; `[0,1,1,0]` = linéaire, `[0,0.408,1,0]` = démarre à 59 %.
* Sections supplémentaires rencontrées, sans équivalent PS : `filter-properties`, `bleed-properties`, `particles-properties`, `pixel-properties`.
* `.hbr` = format **HiPaint** (pas IP), chiffré : non pris en charge.

---

# Correspondances actuelles

| Photoshop | Infinite Painter |
|---|---|
| name | display-name |
| tip bitmap (sampled) | `head` + `custom-head` (hash) |
| tip computed (rond) | pas de `head`, `softness = 1 − dureté`, `parent = 2` |
| tip erodible / bristle | approximé en rond (warning) |
| shape.size (diamètre px) | stroke-properties.paint-size = taille ÷ (3,74 × size-maximum) (CAL 6 : 47 × 4,4 → 773 px ; à recalibrer) |
| shape.spacing | head-properties.spacing = PS × 0.5, borné 0.005..2 (calibré sur la paire Syntetyc) |
| shape.angle | head-properties.angle (radians) |
| angle control « direction » | head-properties.rotation = 1 (suit le trait, testé) |
| angle control « rotation » (stylet) / « pen tilt » | head-properties.use-trajectory = true (« Rotation du stylet », testé) |
| sizeDynamics.jitter | jitter-properties.size |
| angleDynamics.jitter | jitter-properties.angle |
| opacityDynamics.jitter | jitter-properties.flow |
| scatter.scatterDynamics.jitter | jitter-properties.scatter = PS × 0.1, plafonné à 1 (3 points de la paire) |
| taille / opacité / flow contrôlés par pression ou tilt | « pressure/tilt - effects size/flow » |
| minimum (Minimum Diameter pour la taille) | profil `[0, 1−m, 1, 0]` |
| colorDynamics hue / saturation / brightness | jitter-properties.color-* (par tip) ou color-start * (par trait, supposé) |
| wetEdges | stroke-properties.wet-edges = 0.15 (médiane des valeurs vues : 0.07 / 0.15 / 0.40) |
| texture (pattern) | entrée `texture` + `custom-stroke texture` (hash) |
| texture.scale / invert | texture-properties.scale / invert |
| texture.depth | texture-properties.pressure (non vérifié) |
| texture.depthDynamics pression/tilt | « pressure/tilt - effects texture » |

Non supportés (warnings) : dualBrush, scatter count / countDynamics / bothAxes, roundness < 1 et roundnessDynamics, flip, noise, mode de fusion et luminosité/contraste de la texture, colorDynamics avant-plan/arrière-plan et purity, contrôles autres que pression / tilt / direction (fade, initial direction, rotation…), outils mixer / smudge.

## Limites de lecture (ag-psd 31.0.2)

* ABR v1/v2 (Photoshop ≤ 6) : non lus.
* Tips 16 bits compressés RLE : non lus.
* Groupes de pinceaux : non gérés (`// TODO: brushGroup`), résultat inconnu faute de sample.
* Bugs corrigés au `npm install` par `scripts/patch-ag-psd.mjs` : `parseDynamics` sur dynamiques absentes ; patterns indexés compressés RLE.

---

# État d'avancement

## Fait

* Phases 1 à 3 : lecture ABR, modèle universel, génération `.prbr` / `.przp`, tips PNG, rapport, CLI.
* Phase 4 (partiel) : textures, courbes de pression, rotation suivant le trait, pinceaux ronds sans head.
* Phase 5 (partiel) : couleur, wet edges, approximations erodible / bristle.
* Résultats : `brush.abr` 16/16 (14 convertis, 2 partiels) ; `Pinceaux sans titre.abr` 1 partiel (texture OK, dualBrush non supporté).

## Validation sur `Samples/Photoshop/` (2026-09-28)

11 ABR (v6 et v10), **389 pinceaux, 0 échec de lecture, 0 pinceau en échec**.

* Poids : heads et textures plafonnés à **2048 px** (taille max vue dans les 208 pinceaux IP), textures en niveaux de gris quand le pattern l'est, preview réduite à 256 px, pattern encodé une seule fois. Total des packs : **563 Mo → 177 Mo** (Plants : 167 → 67 Mo ; Micron : 81 → 16 Mo).
* Fonctionnalités non supportées les plus fréquentes (nombre de fichiers sur 11) :
  * dualBrush : 9
  * texture blendMode « height » (mode par défaut des PS récents) : 7
  * texture brightness/contrast : 7
  * roundnessDynamics : 6
  * scatter count / countDynamics, flip, texture depthMinimum : 4
* Priorités qui en découlent : approximation du **dual brush** (ex. 2ᵉ tip → texture ?), correspondance du mode **height** vers `texture-properties.style`.

## Validation sur `Samples/Photoshop/0/` (2026-09-28)

7 ABR : Ghibli, Qbrush, REAL Papers & Pencils, MB Smudger, MB Perspective, brush ko, my brush 2023. **210 pinceaux, 0 en échec.**

* **Qbrush : 9 échecs → 0**, **Ghibli : 2 → 0** (pinceaux computed / erodible convertis en tête ronde).
* `brush ko.abr` plantait entièrement (« Indexed pattern color mode not implemented ») : pattern en couleurs indexées compressé RLE, non géré par ag-psd. Corrigé par un 2ᵉ patch dans `scripts/patch-ag-psd.mjs` (décodage RLE + palette). → 87 pinceaux, 13 textures vérifiées visuellement.
* Nouveaux warnings rencontrés : contrôles `fade` / `rotation` / `initial direction`, `brushPose`, modes de texture `linear height`, `linear burn`, `multiply`, `subtraction`.
* `hatch.przp` (dans ce dossier) : pack IP normal, pas la paire d'un ABR.

## Samples IP `Samples/1/` (2026-09-28)

12 packs `.przp` (74 pinceaux) + 1 `.hbr` (ignoré) + 2 `.clrs` (palettes, hors sujet).

* Règle du hash confirmée 77/77, aucune clé nouvelle.
* Heads jusqu'à **3072 px** acceptés par IP (pack Heartstopper) : 2048 n'est pas une limite de l'app, juste notre choix pour le poids.
* `texture-properties.scale` monte jusqu'à **2** → l'échelle de texture PS (jusqu'à 10) est maintenant plafonnée à 2.
* `head-properties.angle` jusqu'à 6,27 (≈ 2π) : radians confirmés.

## Analyse finale et nettoyage de `Samples/` (2026-09-28)

**Nettoyage** : `Samples/1/` (zips) → packs extraits dans `InfinitePainter/` (vérifiés à l'octet près) ; `Photoshop/0/` fusionné dans `Photoshop/`. Supprimés : `Copy of cool_smears.przp` (doublon exact), les zips et leur contenu hors sujet (`.hbr` HiPaint, `.clrs` palettes), le dossier déjà extrait `curls braids free/`, `__MACOSX`. Les deux Micron 300/600 ppi sont différents : gardés.

**Photoshop (18 ABR)** : **599 pinceaux, 0 échec** (179 convertis, 420 partiels). Non supportés les plus fréquents (fichiers sur 18) : dualBrush 13, texture brightness/contrast 12, roundnessDynamics 9, texture depthMinimum 9, texture blendMode « height » 8, flip 8, scatter count 8.

**Infinite Painter (20 packs, 290 pinceaux)** :

* Hash BLAKE2b : 251/251 ; aucune clé absente du modèle.
* Preview : 257/257 en 512×128.
* Tailles max : head 3072 px, texture 2732 px.
* `wet-edges` : seulement 3 pinceaux sur 290 (0.07, 0.15, 0.40) → notre valeur passe de 0.03 à 0.15.
* `texture-properties.style` : 0 / 1 / 2 (29 / 13 / 13 sur les textures perso) → piste pour les modes de fusion de texture.

## Paire de référence Syntetyc Environment v2 (2026-09-28)

Même pack, même auteur, en `.abr` (19 pinceaux) et `.przp` (19 pinceaux, mêmes noms, même ordre). Version IP réglée à l'œil par l'artiste : on retient les tendances.

**Confirmé :**
* Rond computed → pas de `head` ; `softness = 1 − dureté` (dureté 0 → 0.97, dureté 1 → 0).
* Opacité / flow à la pression → « pressure - effects flow ».
* Courbes : minimum PS 0 → profil qui démarre à y = 1 (axe Y inversé).
* Jitter d'angle ≈ 1:1 (0.52 → 0.5, 0.6 → 0.5).

**Corrigé :**
* Spacing : IP ≈ PS × 0.5 (PS 1 % → IP 0.005 dans 8 cas sur 10).
* Scatter : IP ≈ PS × 0.1 (0.43 → 0.029, 0.67 → 0.30, 3 → 0.32).

**Découvert, pas encore appliqué :**
* Heads des IP récents : **dans l'alpha**, fond transparent, **carrés** (padding), `head - conversion format = 0`. Nos heads opaques noir-sur-blanc (`conversion format = 1`) suivent le pack Tree de 2021.
* Avec ces heads alpha, les pinceaux orientés (arbres, pin, nuage) ont **angle PS 0° → IP 180°**, pour une image orientée pareil : l'app les dessinerait à l'envers à 0°. Non observé avec les heads opaques (Tree 2021 : arbre droit à 0°). **Premier point à vérifier dans l'app** (lien possible avec le ±90° / l'orientation constatés).
* Dual brush : l'artiste le remplace par une **texture** (Tree Top Textured : texture perso ; Hard Textured : texture intégrée `texture_16`). C'est la piste d'approximation.
* Échelle et profondeur de texture, jitter de taille et de flow : aucune correspondance stable (choix de l'artiste).
* JSZip ne lit pas ce `.przp` (« expected 20 records, got 0 ») alors que Python et `unzip` y arrivent. Sans effet sur le convertisseur, qui écrit les zip sans en lire.

Samples gardés : `Syntetyc-Environment-v2.abr` + `syntetyc-environment-2-infinitepainter.przp` (la paire) et `Syntetyc_brushes.abr` (123 pinceaux, 0 échec).

## Même pack en Krita et Procreate (2026-09-28)

`Samples/` contient aussi `Environment_Brushes_2_Syntetyc_Krita.bundle` et `Syntetyc_-_Environment_Brushes_v2.brushset` (Procreate), soit 4 versions du même pack.

* **Orientation des images** : Photoshop, Krita, Procreate **et** Infinite Painter stockent l'image dans le même sens. Pourtant, dans IP, l'artiste met 180° sur les 5 pinceaux orientés (arbres, pin, nuage) → IP semble dessiner ces heads à l'envers.
* **Encodage des heads IP récents** = convention Procreate : **blanc = peinture sur fond noir**, bordure transparente pour faire un carré, `head - conversion format = 0`. Nos heads : noir = peinture sur blanc opaque, `conversion format = 1` (comme le pack Tree 2021, où l'arbre est droit à 0°).
* **Procreate `shapeRotation = 1`** (suit le trait) sur Flat et Cloud Soft, qui ont « direction » dans Photoshop → confirme notre correspondance direction → `rotation = 1`.
* Pistes pour plus tard : Krita (`.kpp` XML) et Procreate (`Brush.archive` plist) sont lisibles → le modèle universel pourrait un jour exporter vers eux.

## Pack de calibration (orientation)

`output/calibration/calibration.przp` : un « F » avec une flèche vers le haut (`reference-shape.png`), en 4 variantes, spacing 2 (tampons séparés) :

| Pinceau | Ce qu'il teste | Attendu si tout va bien |
|---|---|---|
| CAL 1 – format1 angle 0 | Notre format, angle 0 | F droit, flèche en haut, lisible (pas en miroir) |
| CAL 2 – format1 angle 90 | Sens de l'angle | F tourné de 90° ; noter si c'est vers la gauche ou vers la droite |
| CAL 3 – format0 angle 0 | Format des packs récents | Comparer avec CAL 1 : à l'envers ? en miroir ? |
| CAL 4 – format1 suit le trait | `rotation = 1` | Le F tourne en suivant la direction du trait |

→ Tracer un trait horizontal de gauche à droite avec chacun, puis envoyer une capture.

**Résultats dans l'app (2026-09-28) :**

* CAL 1 et CAL 3 : F droit → **pas de retournement**, quel que soit le format de head (0 ou 1). Les 180° de l'artiste Syntetyc sont un choix, pas une correction.
* CAL 2 : flèche à gauche → **angle positif = sens antihoraire, comme Photoshop** : la conversion degrés → radians sans changement de signe est correcte.
* CAL 4 : grand cercle lent → la flèche pointe toujours vers le centre → **`rotation = 1` = suit la direction du trait**, comme « Direction » dans Photoshop. (Au premier essai, les mouvements de survol donnaient une impression d'aléatoire.)
* CAL 5 : `use-trajectory = true` s'affiche **« Rotation du stylet » activé** dans l'app ; escargot : les têtes suivent le stylet, pas le trait.

→ Orientation et sens de l'angle validés. Correspondances finales : « Direction » PS → `rotation = 1` ; angle en « Rotation » (stylet) ou « Pen Tilt » PS → `use-trajectory` (Rotation du stylet). Le ±90° vu vendredi : ancienne version, qui ignorait « direction ».

## Réglages de l'app ↔ champs du fichier (CAL 6, 2026-09-28)

Pinceau CAL 6 : chaque champ a une valeur unique (0,11, 0,12…, voir `output/calibration/CAL6-valeurs.md`), lue dans l'app onglet par onglet. « ×100 » = la valeur 0,24 s'affiche 24.

**Trait**

| Réglage | Champ | Échelle |
|---|---|---|
| Taille (px) | `stroke-properties.paint-size` (+ `size-maximum`) | 47 et 4,4× → 773 px (non linéaire, à étudier) |
| Opacité | `paint-opacity` | ×100 |
| Lissage | `lazy-stroke` | ×100 |
| Adhérence | `adhesion` | ×100 |
| Gamme de taille | `size-maximum` | tel quel (4,4×) |
| Bords humides | `wet-edges` | 0,53 → 100 (plafonné) : environ ×200, **0,5 = 100 %** |
| Vernis du trait | `glaze-strokes` | ×100 |
| Mode dégradé | `blendmode` | 0 = Normal |
| Dynamique taille : Pression / Rapidité / Inclinaison | `pressure / velocity / tilt - effects size` | boutons |
| Décalage (inclinaison) | `dynamics-properties.tilt - offset` | ×100 |
| Variation du trait › Taille | `jitter-properties.size` | ×100 |
| Profils Taille / Flux | `has-size-profile` / `has-flow-profile` (+ `size-profile` / `flow-profile`) | boutons |

**Pointe**

| Réglage | Champ | Échelle |
|---|---|---|
| Source › Inverser | `source-properties.head - conversion format` = 1 | 1 = inversé (noir = peinture) ; 0 = blanc = peinture |
| Source › Couleur / Quantité de couleurs | `head - color` / `head - colorize` | bouton / ×100 |
| Style | `head-properties.style` | 0 = Normal |
| Flux | `head-properties.flow` | ×100 |
| Espacement | `head-properties.spacing` | ×100 % (**même unité que Photoshop**) |
| Structure / Douceur / Profondeur | `structure` / `softness` / `depth` | ×100 |
| Angle | `head-properties.angle` | radians → degrés |
| Rotation | `head-properties.rotation` | ×100 (−100..100) : suit la direction du trait |
| Rotation du stylet | `use-trajectory` | interrupteur |
| Orienter d'après l'écran | `screen-aligned` | interrupteur |
| Dynamique Flux / Dispersion / Profondeur | `… - effects flow / scatter / head depth` | boutons |
| Variation de l'origine › Angle | `jitter-properties.start-angle` | **1 = 360°** |
| Variation du trait › Dispersion / Angle / Flux | `jitter-properties.scatter` / `angle` / `flow` | ×100 / **1 = 360°** / ×100 |

**Texture**

| Réglage | Champ | Échelle |
|---|---|---|
| Style | `texture-properties.style` | 1 = « Tourner » |
| Profondeur | `texture-properties.pressure` | **inversé : Profondeur = 1 − pressure** |
| Échelle | `scale` | ×100 % |
| Étirer / Structure | `structure` / `stretch` (apparemment croisés) | Étirer ≥ 1× ; Structure ×100 |
| Douceur | `softness` | ×100 |
| Angle | `angle` | radians → degrés |
| Échelle d'après la taille | `scale-size` | interrupteur |
| Dynamique Profondeur : Pression / Rapidité / Inclinaison | `… - effects texture` | boutons |
| Gradation (inclinaison) | `dynamics-properties.tilt - gradation` | ×100 |
| Variation de l'origine › Position | `jitter-properties.texture-start-position` | ×100 |
| Variation du trait › Position / Échelle / Angle | `texture-position` / `texture-scale` / `texture-angle` | ×100 (l'angle aussi, pas en degrés) |
| Source › Inverser | ? (`texture-properties.invert` = true n'allume **pas** le bouton) | à éclaircir |

**Peindre**

| Réglage | Champ | Échelle |
|---|---|---|
| Incorporer / Dilution | `blend-properties.mix-in` / `mix-in dilution` | ×100 |
| Peinture fraîche | `mix-wet` | interrupteur |
| Mélange › Flou | `smudge-amount` | **inversé : Flou = 1 − smudge-amount** |
| Mélange › Tirer / Flux | `strength` / `blend-properties.flow` | ×100 |
| Dynamique Dilution | `… - effects dilution` | boutons |
| Variation de l'origine › Nuance / Saturation / Luminosité | `color-start hue / saturation / brightness` | **nuance : 1 = 360°** ; ×100 |
| Variation du trait › Nuance / Saturation / Luminosité | `color-hue / saturation / brightness` | **nuance : 1 = 360°** ; ×100 |

**Spécial** : Aquarelle, Trame, Filtres → sections `bleed-properties`, `pixel-properties`, `filter-properties` (absentes du modèle).

Non affichés (réglages des modes gomme / mélangeur) : `blend-size`, `blend-opacity`, `erase-size`, `erase-opacity`, `blendmode-intensity`.

**Conséquences pour le convertisseur :**
* **Bug corrigé** : profondeur de texture PS → `pressure = 1 − profondeur` (avant : écrite telle quelle, donc à l'envers).
* Confirmé : jitter d'angle 1:1 (1 = 360° des deux côtés), variations de couleur, radians, `rotation`, `use-trajectory`, format de head (Inverser).
* Espacement : même unité que Photoshop ; le ×0,5 vient seulement des choix de l'artiste Syntetyc → à revalider à l'œil.
* Bords humides : 0,15 = environ 30 % dans l'app.

## Partiels → complets (2026-09-30)

Chaque avertissement a maintenant un **niveau** ; seul « perdu » rend un pinceau partiel :

* **exact** : rondeur statique (tête écrasée, ou tête ovale générée pour les ronds), flip fixe (image miroir), luminosité/contraste de texture (appliqués à l'image), profondeur minimum de texture (début de la courbe), dispersion à la pression (« Dispersion › Pression »).
* **approximé** : dual brush → texture (ou cuit dans la tête si la texture est déjà prise : tampons du 2ᵉ tip avec jitter, interpolation bilinéaire), nombre de tampons → espacement ÷ n, rondeur à la pression → taille à la pression, variation de rondeur → variation de taille, tips erodible/bristle → rond, modes de fusion de texture, dispersion deux axes, « Initial Direction » → Rotation, « Stylus Wheel » → Rotation du stylet.
* **mineur** (log seulement) : flip aléatoire par tampon, variation du nombre, bruit, pureté, brush pose.
* **perdu** : contrôles « Fade », couleur avant-plan/arrière-plan, outils mélangeur/doigt.

Bugs corrigés au passage : « roundnessDynamics » signalé quand le réglage était absent ; « scatter bothAxes » signalé avec une dispersion à 0 ; « texture depthMinimum » signalé sans dynamique de profondeur ; rondeur des pinceaux image ignorée sans avertissement.

Résultat sur 156 pinceaux (Size Flow Gang, Syntetyc x2) : **34 → 154 complets**, 122 → 2 partiels (« Fade »), 0 échec. Tests : 9/9.

## Taille et têtes blanches (2026-10-07)

* **Taille** : jamais écrite → tous les pinceaux à ~500 px. Maintenant `paint-size = diamètre PS ÷ (3,74 × size-maximum)`.
* **Têtes blanches** (pointe vide alors que Photoshop montre une image) :
  * Rondeur PS 0 % (Hard Elliptical) : division 0/0 → tête vide. Corrigé (ligne de 1 px).
  * Dual brush cuit dans la tête : pointe éparse × un seul tampon du 2ᵉ tip éparse = presque rien (Pastel : 0 % d'encre). Le 2ᵉ tip est maintenant balayé le long du trait (comme PS), et le masque garde au moins la moitié de l'encre de la pointe.

## ABR de test (2026-10-07)

`npm run test-abr` → `test/fixtures/test-brushes.abr` (9 pinceaux générés, sans licence), écrit par `scripts/make-test-abr.ts`. En-tête des tips identique octet par octet à un vrai ABR Photoshop (hors longueurs et dimensions). Le test `npm test` génère le même fichier en mémoire et vérifie : aucune tête blanche, taille IP = taille PS.

| Pinceau | Cible |
|---|---|
| T01 / T02 | taille 56 px / 300 px (rond dur / doux) |
| T03 | rondeur 0 % (ex-tête blanche) |
| T04 / T05 | rondeur 30 % sur image ; angle 90° (flèche) |
| T06 | carré plein + texture (cas Rectangle Soft) |
| T07 / T08 | dual brush épars, sans / avec texture (ex-tête blanche) |
| T09 | taille et opacité à la pression |

À ouvrir dans Photoshop pour confirmer qu'il accepte le fichier, puis convertir et comparer dans IP.

## À vérifier dans l'app

* [ ] Import de `output/*.przp` dans Infinite Painter.
* [x] Orientation / sens de l'angle : validés (CAL 1-3).
* [x] `rotation` = direction du trait (CAL 4) ; `use-trajectory` = Rotation du stylet (CAL 5).
* [ ] Taille fixe constatée : quel pinceau ? au stylet ou au doigt ?
* [ ] Calibrer spacing, scatter, profondeur de texture (`pressure`), `parent = 2`, `color-start *`.
* [ ] Courbes de tilt (format supposé identique à la pression).
* [ ] Poids des `.prbr` : head en niveaux de gris ? (preview : faite, 512×128)

## Reste à faire

* Valider sur d'autres ABR (Qbrush, Ghibli…) et sur un ABR avec groupes (→ un dossier IP par groupe).
* Tests de régression sur les samples IP.
