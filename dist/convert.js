import { maskWithTip, parseAbr, patternToPng, roundTip, strokePreviewPng, tipAsPattern, tipToPng, transformTip } from './abr-reader.js';
import { writePrbr, writePrzp } from './infinite-painter.js';
import { toUniversal } from './photoshop.js';
const safeName = (s) => s.replace(/[^\w.-]+/g, '_');
export async function convertAbr(buffer, packName) {
    const abr = parseAbr(buffer);
    const { brushes, tips, patterns } = abr;
    const out = [];
    const results = [];
    const used = new Set();
    // A pattern is often shared by several brushes: encode each (pattern, adjustment) once.
    const textures = new Map();
    const texturePng = (t) => {
        const key = `${t.uuid}|${t.brightness}|${t.contrast}|${t.invert}|${!!t.fromTip}`;
        if (!textures.has(key)) {
            const pattern = t.fromTip ? tipAsPattern(tips.get(t.uuid)) : patterns.get(t.uuid);
            textures.set(key, patternToPng(pattern, t.brightness, t.contrast, t.invert));
        }
        return textures.get(key);
    };
    for (const ps of brushes) {
        const { brush, warnings } = toUniversal(ps, abr);
        let fileName = safeName(brush.name);
        for (let i = 2; used.has(fileName); i++)
            fileName = `${safeName(brush.name)}_${i}`;
        used.add(fileName);
        const tip = brush.brushTip && tips.get(brush.brushTip.uuid);
        if (!tip && brush.hardness === undefined) {
            results.push({ name: brush.name, fileName, status: 'failed', warnings });
            continue;
        }
        // Bitmap tips get roundness/flip baked in; a squashed round tip needs a real head (IP's own is always round).
        let headTip = tip
            ? transformTip(tip, brush.roundness, brush.flip)
            : brush.roundness < 1 ? roundTip(brush.hardness, 256, brush.roundness) : undefined;
        const dual = brush.dualHead;
        if (dual) {
            const mask = dual.uuid ? tips.get(dual.uuid) : roundTip(dual.hardness, 128);
            headTip = maskWithTip(headTip ?? roundTip(brush.hardness, 256), mask, dual.sizeRatio, dual.spacing);
        }
        const head = headTip && tipToPng(headTip);
        const pressureMin = (d) => (d?.control === 'pressure' ? d.minimum : undefined);
        const preview = strokePreviewPng(headTip ?? roundTip(brush.hardness), {
            spacing: brush.spacing,
            sizeMin: pressureMin(brush.sizeDynamics),
            opacityMin: pressureMin(brush.opacityDynamics) ?? pressureMin(brush.flowDynamics),
        });
        out.push({ fileName, data: await writePrbr(brush, head, preview, brush.texture && texturePng(brush.texture)) });
        results.push({ name: brush.name, fileName, status: warnings.some((w) => w.level === 'lost') ? 'partial' : 'converted', warnings });
    }
    const count = (s) => results.filter((r) => r.status === s).length;
    const features = (level) => [...new Set(results.flatMap((r) => r.warnings.filter((w) => w.level === level).map((w) => w.feature)))].sort();
    return {
        brushes: out,
        tips: [...tips.values()].map((t) => ({ id: t.id, png: tipToPng(t, true) })),
        pack: await writePrzp(packName, out),
        report: {
            totalBrushes: results.length,
            converted: count('converted'),
            partial: count('partial'),
            failed: count('failed'),
            unsupported: features('lost'),
            approximated: features('approximated'),
            minor: features('minor'),
            brushes: results,
        },
    };
}
