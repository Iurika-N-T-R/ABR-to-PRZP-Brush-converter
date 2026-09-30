#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseAbr } from './abr-reader.js';
import { convertAbr } from './convert.js';

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        out: { type: 'string', short: 'o', default: 'output' },
        json: { type: 'boolean', default: false },
    },
});
const input = positionals[0];
if (!input) {
    console.error('Usage: abr2painter <input.abr> [-o output]');
    process.exit(1);
}

const packName = basename(input, extname(input));
const res = await convertAbr(await readFile(input), packName);
const out = values.out!;
await mkdir(join(out, 'brushes'), { recursive: true });
await mkdir(join(out, 'tips'), { recursive: true });

await Promise.all([
    ...res.brushes.map((b) => writeFile(join(out, 'brushes', `${b.fileName}.prbr`), b.data)),
    ...res.tips.map((t) => writeFile(join(out, 'tips', `${t.id}.png`), t.png)),
    writeFile(join(out, `${packName}.przp`), res.pack),
    writeFile(join(out, 'report.json'), JSON.stringify(res.report, null, 2)),
]);

if (values.json) {
    // Raw pixels would be ~200 MB as JSON; they already live in tips/<id>.png.
    const { brushes, tips, patterns } = parseAbr(await readFile(input));
    const samples = [...tips.values()].map(({ alpha, ...meta }) => meta);
    const textures = [...patterns.values()].map(({ rgba, ...meta }) => meta);
    await writeFile(join(out, 'abr.json'), JSON.stringify({ samples, patterns: textures, brushes }, null, 2));
}

for (const b of res.report.brushes) {
    // "warn" only for real losses (what makes a brush partial); approximations and minor differences are "info".
    for (const w of b.warnings) console.warn(JSON.stringify({ level: w.level === 'lost' ? 'warn' : 'info', brush: b.name, [w.level]: w.feature }));
}
const { totalBrushes, converted, partial, failed } = res.report;
console.log(JSON.stringify({ level: 'info', out, totalBrushes, converted, partial, failed }));
