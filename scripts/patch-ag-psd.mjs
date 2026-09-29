// Fixes for ag-psd 31.0.2 bugs that abort a whole ABR file.
// ponytail: string-replace patches instead of patch-package; drop each once upstream fixes it.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const resolve = createRequire(import.meta.url).resolve;

const patches = [
    {
        // Dynamics descriptors can be absent (e.g. plain stamp brushes).
        file: 'ag-psd/dist/abr.js',
        find: 'function parseDynamics(desc) {',
        replace: 'function parseDynamics(desc) {\n    if (!desc) return undefined;',
    },
    {
        // RLE-compressed indexed-color patterns (seen in "brush ko.abr").
        file: 'ag-psd/dist/psdReader.js',
        find: `            if (colorMode === 2 /* ColorMode.Indexed */) {
                // TODO:
                throw new Error('Indexed pattern color mode not implemented');
            }`,
        replace: `            if (colorMode === 2 /* ColorMode.Indexed */ && ch < 1) {
                readDataRLE(cdataReader, tempData, w, h, 8, 1, [0], false);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const color = palette[tempData.data[x + y * w]];
                        const dst = (ox + x + (y + oy) * width) * 4;
                        data[dst + 0] = color.r;
                        data[dst + 1] = color.g;
                        data[dst + 2] = color.b;
                    }
                }
            }`,
    },
];

for (const { file, find, replace } of patches) {
    const path = resolve(file);
    const src = readFileSync(path, 'utf8');
    if (src.includes(replace)) continue;
    if (!src.includes(find)) {
        console.warn(`ag-psd patch not applied (code changed upstream?): ${file}`);
        continue;
    }
    writeFileSync(path, src.replace(find, replace));
    console.log(`patched ${file}`);
}
