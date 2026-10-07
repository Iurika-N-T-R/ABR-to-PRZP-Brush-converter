# Pinceaux de contrôle

Un réglage change par série, tout le reste est à une valeur neutre. Pour chaque pinceau : tracer le même trait dans
Photoshop (`control.abr`) et dans Infinite Painter (`control.przp`), comparer, noter l'écart dans la dernière colonne.
La colonne IP donne ce que le convertisseur a écrit, dans les unités de l'éditeur de pinceau d'IP.

Planches de traits Photoshop : ouvrir `control-sheet.jsx` dans Photoshop (Fichier › Scripts › Parcourir). Il charge
`control.abr`, trace chaque pinceau sur un S avec pression simulée et enregistre `control-sheet-N.png` ici. Importer ces
PNG comme calque dans Infinite Painter et tracer avec le même pinceau dans la bande vide sous chaque trait.
Avant de lancer : outil Pinceau à opacité et flux 100 %, couleur de premier plan noire.

| Pinceau Photoshop | Valeurs attendues dans IP | Écart constaté |
|---|---|---|
| C01 Size 10px | Taille 10 px · Espacement 25% · Angle 0° · Douceur 0% | |
| C02 Size 56px | Taille 56 px · Espacement 25% · Angle 0° · Douceur 0% | |
| C03 Size 100px | Taille 100 px · Espacement 25% · Angle 0° · Douceur 0% | |
| C04 Size 300px | Taille 300 px · Espacement 25% · Angle 0° · Douceur 0% | |
| C05 Size 1000px | Taille 1000 px · Espacement 25% · Angle 0° · Douceur 0% | |
| C06 Hardness 0% | Taille 100 px · Espacement 25% · Angle 0° · Douceur 100% | |
| C07 Hardness 50% | Taille 100 px · Espacement 25% · Angle 0° · Douceur 50% | |
| C08 Hardness 100% | Taille 100 px · Espacement 25% · Angle 0° · Douceur 0% | |
| C09 Spacing 1% | Taille 100 px · Espacement 1% · Angle 0° · Douceur 0% | |
| C10 Spacing 25% | Taille 100 px · Espacement 25% · Angle 0° · Douceur 0% | |
| C11 Spacing 100% | Taille 100 px · Espacement 100% · Angle 0° · Douceur 0% | |
| C12 Spacing 200% | Taille 100 px · Espacement 200% · Angle 0° · Douceur 0% | |
| C13 Angle 0deg (arrow) | Taille 100 px · Espacement 150% · Angle 0° · pointe image | |
| C14 Angle 45deg (arrow) | Taille 100 px · Espacement 150% · Angle 45° · pointe image | |
| C15 Angle 90deg (arrow) | Taille 100 px · Espacement 150% · Angle 90° · pointe image | |
| C16 Angle 180deg (arrow) | Taille 100 px · Espacement 150% · Angle 180° · pointe image | |
| C17 Roundness 100% | Taille 100 px · Espacement 25% · Angle 0° · Douceur 0% | |
| C18 Roundness 50% | Taille 100 px · Espacement 25% · Angle 0° · pointe image | |
| C19 Roundness 10% | Taille 100 px · Espacement 25% · Angle 0° · pointe image | |
| C20 Roundness 0% | Taille 100 px · Espacement 25% · Angle 0° · pointe image | |
| C21 Angle follows direction (arrow) | Taille 100 px · Espacement 150% · Angle 0° · pointe image · Rotation 100 | |
| C22 Angle follows pen rotation (arrow) | Taille 100 px · Espacement 150% · Angle 0° · pointe image · Rotation du stylet | |
| C23 Size pressure min 0% | Taille 100 px · Espacement 25% · Angle 0° · Douceur 0% · Dynamique : pressure - effects size · Pression taille min 0% | |
| C24 Size pressure min 50% | Taille 100 px · Espacement 25% · Angle 0° · Douceur 0% · Dynamique : pressure - effects size · Pression taille min 50% | |
| C25 Opacity pressure | Taille 100 px · Espacement 25% · Angle 0° · Douceur 0% · Dynamique : pressure - effects flow | |
| C26 Size jitter 50% | Taille 100 px · Espacement 25% · Angle 0° · Douceur 0% · Var. taille 50% | |
| C27 Size jitter 100% | Taille 100 px · Espacement 25% · Angle 0° · Douceur 0% · Var. taille 100% | |
| C28 Angle jitter 100% (arrow) | Taille 100 px · Espacement 150% · Angle 0° · pointe image · Var. angle 360° | |
| C29 Opacity jitter 50% | Taille 100 px · Espacement 25% · Angle 0° · Douceur 0% · Var. flux 50% | |
| C30 Scatter 100% | Taille 50 px · Espacement 25% · Angle 0° · Douceur 0% · Dispersion 10% | |
| C31 Scatter 300% | Taille 50 px · Espacement 25% · Angle 0° · Douceur 0% · Dispersion 30% | |
| C32 Scatter 100% count 3 | Taille 50 px · Espacement 8% · Angle 0° · Douceur 0% · Dispersion 10% | |
| C33 Texture depth 25% | Taille 100 px · Espacement 5% · Angle 0° · Douceur 0% · Texture Profondeur 25%, Échelle 100% | |
| C34 Texture depth 100% | Taille 100 px · Espacement 5% · Angle 0° · Douceur 0% · Texture Profondeur 100%, Échelle 100% | |
| C35 Texture scale 50% | Taille 100 px · Espacement 5% · Angle 0° · Douceur 0% · Texture Profondeur 100%, Échelle 50% | |
| C36 Dual brush (dots) | Taille 100 px · Espacement 10% · Angle 0° · pointe image · Texture Profondeur 100%, Échelle 100% | |
