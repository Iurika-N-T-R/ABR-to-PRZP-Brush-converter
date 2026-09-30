#!/usr/bin/env bash
# One command does everything: checks Node, installs/updates dependencies (and the ag-psd fixes),
# rebuilds when the code changed, then converts every .abr given (files or folders, searched recursively).
#
#   ./convert.sh brushes.abr
#   ./convert.sh Samples/Photoshop            # every .abr inside
#   ./convert.sh a.abr b.abr -o ~/Desktop/out # custom output folder (default: ./output)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="output"
INPUTS=()
while [ $# -gt 0 ]; do
    case "$1" in
        -o) OUT="$2"; shift 2 ;;
        *) INPUTS+=("$1"); shift ;;
    esac
done
if [ ${#INPUTS[@]} -eq 0 ]; then
    sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
fi

# 1. Node >= 20.10
if ! command -v node >/dev/null; then
    echo "✗ Node.js missing. Termux: pkg install nodejs — elsewhere: https://nodejs.org" >&2
    exit 1
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>20||(a===20&&b>=10)?0:1)'; then
    echo "✗ Node $(node -v) is too old, 20.10 or newer is needed." >&2
    exit 1
fi

# 2. Dependencies: full install when missing or when package files changed, otherwise just re-apply the ag-psd fixes.
STAMP="$ROOT/node_modules/.package-lock.json"
if [ ! -f "$STAMP" ] || [ "$ROOT/package.json" -nt "$STAMP" ] || [ "$ROOT/package-lock.json" -nt "$STAMP" ] || [ "$ROOT/scripts/patch-ag-psd.mjs" -nt "$STAMP" ]; then
    echo "→ npm install"
    (cd "$ROOT" && npm install --no-fund --no-audit)
    touch "$STAMP"
else
    node "$ROOT/scripts/patch-ag-psd.mjs"
fi

# 3. Build when dist/ is missing or older than any source file.
if [ ! -f "$ROOT/dist/cli.js" ] || [ -n "$(find "$ROOT/src" -newer "$ROOT/dist/cli.js" -print -quit)" ]; then
    echo "→ build"
    # Run tsc through node: copied files often lose their exec bit on Android, so node_modules/.bin/tsc can't run.
    node "$ROOT/node_modules/typescript/bin/tsc" -p "$ROOT"
fi

# 4. Convert: one output folder per .abr.
FILES=()
for input in "${INPUTS[@]}"; do
    if [ -d "$input" ]; then
        while IFS= read -r -d '' f; do FILES+=("$f"); done < <(find "$input" -type f -iname '*.abr' -print0 | sort -z)
    elif [ -f "$input" ]; then
        FILES+=("$input")
    else
        echo "✗ Not found: $input" >&2
    fi
done
[ ${#FILES[@]} -gt 0 ] || { echo "✗ No .abr file found." >&2; exit 1; }

ok=0; ko=0
for f in "${FILES[@]}"; do
    name="$(basename "${f%.*}")"
    echo "→ $name"
    mkdir -p "$OUT"
    log="$OUT/$name.log"   # warnings + errors; kept so a failure can be read
    if node "$ROOT/dist/cli.js" "$f" -o "$OUT/$name" 2>"$log" | tail -1; then
        ok=$((ok + 1))
    else
        ko=$((ko + 1))
        echo "  ✗ failed: $f" >&2
        grep -v '"level":"\(warn\|info\)"' "$log" | tail -8 >&2
    fi
done
echo "✓ $ok file(s) converted, $ko failed → $OUT/ (import the .przp of each folder into Infinite Painter)"
