# abr2painter

Convertit des pinceaux Photoshop (`.abr`) en pinceaux Infinite Painter (`.prbr` + pack `.przp`).

## Utilisation : une seule commande

```bash
./convert.sh mes-pinceaux.abr            # un fichier
./convert.sh Samples/Photoshop           # tous les .abr d'un dossier (sous-dossiers compris)
./convert.sh a.abr b.abr -o ~/Desktop/out
```

Le script fait tout, dans l'ordre :

1. vérifie que Node.js ≥ 20.10 est installé ;
2. lance `npm install` si c'est la première fois, ou si les dépendances ou les correctifs d'ag-psd ont changé ; sinon, réapplique juste les correctifs ;
3. recompile si le code (`src/`) a changé ;
4. convertit chaque `.abr` dans `output/<nom>/`.

**Plus besoin de penser à `npm install` ni à `npm run build` : `./convert.sh` s'en charge.**

Ensuite : importer `output/<nom>/<nom>.przp` dans Infinite Painter.

## Sur une nouvelle machine (tablette Termux, autre PC)

1. Installer Node.js : `pkg install nodejs` (Termux) ou https://nodejs.org
2. Copier le dossier `Brush-converter/`, sans `node_modules/` ni `output/`
3. `./convert.sh fichier.abr` : la première fois, l'installation se lance toute seule (connexion internet nécessaire)

## Ce que contient la sortie

```text
output/<nom>/
├── <nom>.przp      # pack à importer
├── brushes/*.prbr  # pinceaux un par un
├── tips/*.png      # images des pinceaux en pleine résolution
└── report.json     # convertis / partiels / échecs + fonctionnalités non supportées
```

## Pour aller plus loin

* `npm test` : tests (les `.abr` de test vont dans `Samples/`)
* `node dist/cli.js fichier.abr -o sortie --json` : ajoute `abr.json` (dump du fichier ABR)
* Tout le reste (format, correspondances, limites, avancement) : `Projet Convertisseur ABR.md`
