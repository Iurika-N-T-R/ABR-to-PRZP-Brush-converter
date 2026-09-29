import { type Pattern, parseAbr, patternToPng, roundTip, strokePreviewPng, tipToPng } from './abr-reader.js';
import { writePrbr, writePrzp } from './infinite-painter.js';
import { toUniversal } from './photoshop.js';
import type { Dynamics } from './universal.js';

export interface BrushResult {
    name: string;
    fileName: string;
    status: 'converted' | 'partial' | 'failed';
    warnings: string[];
}

export interface Conversion {
    brushes: { fileName: string; data: Buffer }[];
    tips: { id: string; png: Buffer }[];
    pack: Buffer;
    report: {
        totalBrushes: number;
        converted: number;
        partial: number;
        failed: number;
        unsupported: string[];
        brushes: BrushResult[];
    };
}

const safeName = (s: string) => s.replace(/[^\w.-]+/g, '_');

export async function convertAbr(buffer: Uint8Array, packName: string): Promise<Conversion> {
    const abr = parseAbr(buffer);
    const { brushes, tips, patterns } = abr;
    const out: Conversion['brushes'] = [];
    const results: BrushResult[] = [];
    const used = new Set<string>();

    // A pattern is often shared by several brushes: encode it once.
    const textures = new Map<string, Buffer>();
    const texturePng = (p: Pattern) => textures.get(p.id) ?? textures.set(p.id, patternToPng(p)).get(p.id)!;

    for (const ps of brushes) {
        const { brush, warnings } = toUniversal(ps, abr);
        let fileName = safeName(brush.name);
        for (let i = 2; used.has(fileName); i++) fileName = `${safeName(brush.name)}_${i}`;
        used.add(fileName);

        const tip = brush.brushTip && tips.get(brush.brushTip.uuid);
        if (!tip && brush.hardness === undefined) {
            results.push({ name: brush.name, fileName, status: 'failed', warnings });
            continue;
        }
        const pattern = brush.texture && patterns.get(brush.texture.uuid);
        const head = tip && tipToPng(tip);
        const pressureMin = (d?: Dynamics) => (d?.control === 'pressure' ? d.minimum : undefined);
        const preview = strokePreviewPng(tip ?? roundTip(brush.hardness!), {
            spacing: brush.spacing,
            sizeMin: pressureMin(brush.sizeDynamics),
            opacityMin: pressureMin(brush.opacityDynamics) ?? pressureMin(brush.flowDynamics),
        });
        out.push({ fileName, data: await writePrbr(brush, head, preview, pattern && texturePng(pattern)) });
        results.push({ name: brush.name, fileName, status: warnings.length ? 'partial' : 'converted', warnings });
    }

    const count = (s: BrushResult['status']) => results.filter((r) => r.status === s).length;
    return {
        brushes: out,
        tips: [...tips.values()].map((t) => ({ id: t.id, png: tipToPng(t, true) })),
        pack: await writePrzp(packName, out),
        report: {
            totalBrushes: results.length,
            converted: count('converted'),
            partial: count('partial'),
            failed: count('failed'),
            unsupported: [...new Set(results.flatMap((r) => r.warnings))].sort(),
            brushes: results,
        },
    };
}
