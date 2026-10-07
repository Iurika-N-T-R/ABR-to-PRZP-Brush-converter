# Pinceaux de contrôle

Un réglage change par série, tout le reste est à une valeur neutre. Pour chaque pinceau : tracer le même trait dans
Photoshop (`control.abr`) et dans Infinite Painter (`control.przp`), comparer, noter l'écart dans la dernière colonne.
La colonne IP donne ce que le convertisseur a écrit, dans les unités de l'éditeur de pinceau d'IP.

| # | Pinceau Photoshop | Valeurs attendues dans IP | Écart constaté |
|---|---|---|---|
| 1 | Size 10px | Taille 10 px · Espacement 13% · Angle 0° · Douceur 0% | |
| 2 | Size 56px | Taille 56 px · Espacement 13% · Angle 0° · Douceur 0% | |
| 3 | Size 100px | Taille 100 px · Espacement 13% · Angle 0° · Douceur 0% | |
| 4 | Size 300px | Taille 300 px · Espacement 13% · Angle 0° · Douceur 0% | |
| 5 | Size 1000px | Taille 1000 px · Espacement 13% · Angle 0° · Douceur 0% | |
| 6 | Hardness 0% | Taille 100 px · Espacement 13% · Angle 0° · Douceur 100% | |
| 7 | Hardness 50% | Taille 100 px · Espacement 13% · Angle 0° · Douceur 50% | |
| 8 | Hardness 100% | Taille 100 px · Espacement 13% · Angle 0° · Douceur 0% | |
| 9 | Spacing 1% | Taille 100 px · Espacement 1% · Angle 0° · Douceur 0% | |
| 10 | Spacing 25% | Taille 100 px · Espacement 13% · Angle 0° · Douceur 0% | |
| 11 | Spacing 100% | Taille 100 px · Espacement 50% · Angle 0° · Douceur 0% | |
| 12 | Spacing 200% | Taille 100 px · Espacement 100% · Angle 0° · Douceur 0% | |
| 13 | Angle 0deg (arrow) | Taille 100 px · Espacement 75% · Angle 0° · pointe image | |
| 14 | Angle 45deg (arrow) | Taille 100 px · Espacement 75% · Angle 45° · pointe image | |
| 15 | Angle 90deg (arrow) | Taille 100 px · Espacement 75% · Angle 90° · pointe image | |
| 16 | Angle 180deg (arrow) | Taille 100 px · Espacement 75% · Angle 180° · pointe image | |
| 17 | Roundness 100% | Taille 100 px · Espacement 13% · Angle 0° · Douceur 0% | |
| 18 | Roundness 50% | Taille 100 px · Espacement 13% · Angle 0° · pointe image | |
| 19 | Roundness 10% | Taille 100 px · Espacement 13% · Angle 0° · pointe image | |
| 20 | Roundness 0% | Taille 100 px · Espacement 13% · Angle 0° · pointe image | |
| 21 | Angle follows direction (arrow) | Taille 100 px · Espacement 75% · Angle 0° · pointe image · Rotation 100 | |
| 22 | Angle follows pen rotation (arrow) | Taille 100 px · Espacement 75% · Angle 0° · pointe image · Rotation du stylet | |
| 23 | Size pressure min 0% | Taille 100 px · Espacement 13% · Angle 0° · Douceur 0% · Dynamique : pressure - effects size · Pression taille min 0% | |
| 24 | Size pressure min 50% | Taille 100 px · Espacement 13% · Angle 0° · Douceur 0% · Dynamique : pressure - effects size · Pression taille min 50% | |
| 25 | Opacity pressure | Taille 100 px · Espacement 13% · Angle 0° · Douceur 0% · Dynamique : pressure - effects flow | |
| 26 | Size jitter 50% | Taille 100 px · Espacement 13% · Angle 0° · Douceur 0% · Var. taille 50% | |
| 27 | Size jitter 100% | Taille 100 px · Espacement 13% · Angle 0° · Douceur 0% · Var. taille 100% | |
| 28 | Angle jitter 100% (arrow) | Taille 100 px · Espacement 75% · Angle 0° · pointe image · Var. angle 360° | |
| 29 | Opacity jitter 50% | Taille 100 px · Espacement 13% · Angle 0° · Douceur 0% · Var. flux 50% | |
| 30 | Scatter 100% | Taille 50 px · Espacement 13% · Angle 0° · Douceur 0% · Dispersion 10% | |
| 31 | Scatter 300% | Taille 50 px · Espacement 13% · Angle 0° · Douceur 0% · Dispersion 30% | |
| 32 | Scatter 100% count 3 | Taille 50 px · Espacement 4% · Angle 0° · Douceur 0% · Dispersion 10% | |
| 33 | Texture depth 25% | Taille 100 px · Espacement 3% · Angle 0° · Douceur 0% · Texture Profondeur 25%, Échelle 100% | |
| 34 | Texture depth 100% | Taille 100 px · Espacement 3% · Angle 0° · Douceur 0% · Texture Profondeur 100%, Échelle 100% | |
| 35 | Texture scale 50% | Taille 100 px · Espacement 3% · Angle 0° · Douceur 0% · Texture Profondeur 100%, Échelle 50% | |
| 36 | Dual brush (dots) | Taille 100 px · Espacement 5% · Angle 0° · pointe image · Texture Profondeur 100%, Échelle 100% | |
