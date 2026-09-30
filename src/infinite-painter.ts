import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import template from './template-properties.json' with { type: 'json' };
import type { Dynamics, UniversalBrush } from './universal.js';

// Uncompressed entries, like Infinite Painter's own exports.
const ZIP_OPTS = { type: 'nodebuffer', compression: 'STORE' } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Unknown fields keep the template value (a working Infinite Painter brush), so the app never sees a missing key.
const blake = (data: Buffer) => createHash('blake2b512').update(data).digest('hex');

// headPng undefined = IP's procedural round head (30/67 sample brushes ship no `head`).
export function toProperties(b: UniversalBrush, headPng: Buffer | undefined, texturePng?: Buffer): typeof template {
    const p: typeof template = structuredClone(template);
    p['display-name'] = b.name;
    // Current IP references `head` / `texture` entries by their BLAKE2b-512 (older exports used a device path).
    const src = p['source-properties'];
    src['custom-head'] = headPng ? blake(headPng) : '';
    if (!headPng) {
        p['head-properties'].softness = 1 - (b.hardness ?? 1);
        // ponytail: parent 2 is what the headless round sample brushes use; meaning of `parent` unknown.
        p.parent = 2;
    }
    if (texturePng && b.texture) {
        src['custom-stroke texture'] = blake(texturePng);
        src['stroke texture'] = '';
        const t = p['texture-properties'];
        // PS goes to 1000%; 2 is the highest IP value seen in samples (slider max).
        t.scale = clamp(b.texture.scale, 0.01, 2);
        t.invert = b.texture.invert;
        // CAL 6: the app's texture "Profondeur" slider shows 1 - pressure (pressure 0.55 -> Profondeur 45).
        t.pressure = 1 - b.texture.depth;
        // A dual brush's second tip scales with the brush, as in Photoshop.
        if (b.texture.fromTip) t['scale-size'] = true;
    }

    // Paired pack (Syntetyc Environment, same author for PS and IP): PS 1% (its minimum) became IP 0.005 (its minimum)
    // in 8/10 brushes, the overall median ratio is 0.5. IP range 0.005..2.
    // IP stamps once per step; PS "Count" stamps n times, so n× tighter spacing keeps the same density.
    p['head-properties'].spacing = clamp((b.spacing * 0.5) / Math.max(1, b.scatter?.count ?? 1), 0.005, 2);
    // Radians: the stock Proko Pencil brush stores exactly π.
    p['head-properties'].angle = (b.angle * Math.PI) / 180;
    // Calibration pack, tested with a stylus: `rotation` = 1 turns the head with the stroke direction (CAL 4, circle),
    // `use-trajectory` is the "Rotation du stylet" toggle, the head follows the pen (CAL 5).
    // ponytail: PS "pen tilt" angle is sent to the pen toggle too; IP has no separate tilt-azimuth option.
    const angleControl = b.angleDynamics?.control;
    p['head-properties'].rotation = angleControl === 'direction' ? 1 : 0;
    p['head-properties']['use-trajectory'] = angleControl === 'pen rotation' || angleControl === 'tilt';

    // ponytail: PS wet edges is on/off; IP samples use 0.07 / 0.15 / 0.40, the median is taken. Calibrate in the app.
    p['stroke-properties']['wet-edges'] = b.wetEdges ? 0.15 : 0;

    const j = p['jitter-properties'];
    j.size = b.sizeDynamics?.jitter ?? 0;
    j.angle = b.angleDynamics?.jitter ?? 0;
    j.flow = b.opacityDynamics?.jitter ?? 0;
    // ponytail: paired pack gives 0.43→0.029, 0.67→0.30, 3→0.32 (median ratio 0.1); only 3 points, calibrate in the app.
    j.scatter = clamp((b.scatter?.amount ?? 0) * 0.1, 0, 1);
    if (b.color) {
        // ponytail: IP "color-start *" read as per-stroke jitter, plain "color-*" as per-stamp (PS "Apply Per Tip").
        const pre = b.color.perTip ? 'color-' : 'color-start ';
        const c = j as Record<string, number>;
        c[`${pre}hue`] = b.color.hue;
        c[`${pre}saturation`] = b.color.saturation;
        c[`${pre}brightness`] = b.color.brightness;
    }

    const d = p['dynamics-properties'] as Record<string, unknown>;
    for (const k of Object.keys(d)) if (k.includes(' - effects ')) d[k] = false;
    const drive = (dyn: Dynamics | undefined, target: 'size' | 'flow' | 'texture' | 'scatter') => {
        if (dyn?.control !== 'pressure' && dyn?.control !== 'tilt') return;
        d[`${dyn.control} - effects ${target}`] = true;
        // IP profiles are [x0,y0,x1,y1…] with Y inverted: [0, 1-m, 1, 0] rises linearly from m to 100%.
        // ponytail: tilt profiles assumed to share the pressure layout; only pressure is backed by samples.
        d[`${dyn.control} profile - ${target}`] = [0, 1 - dyn.minimum, 1, 0];
    };
    drive(b.sizeDynamics, 'size');
    drive(b.opacityDynamics, 'flow');
    drive(b.flowDynamics, 'flow');
    drive(b.texture?.depthDynamics, 'texture');
    drive(b.scatter?.dynamics, 'scatter');
    return p;
}

export async function writePrbr(b: UniversalBrush, headPng: Buffer | undefined, previewPng: Buffer, texturePng?: Buffer): Promise<Buffer> {
    const zip = new JSZip();
    zip.file('properties.json', JSON.stringify(toProperties(b, headPng, texturePng)));
    zip.file('preview', previewPng);
    if (headPng) zip.file('head', headPng);
    if (texturePng && b.texture) zip.file('texture', texturePng);
    return zip.generateAsync(ZIP_OPTS);
}

export async function writePrzp(packName: string, brushes: { fileName: string; data: Buffer }[]): Promise<Buffer> {
    const zip = new JSZip();
    const index = {
        version: 1,
        'brush-folders': [{
            version: 3,
            brushes: brushes.map((b) => ({ name: b.fileName, id: 0, hidden: false })),
            selected: 0,
            name: packName,
        }],
    };
    zip.file('index.json', JSON.stringify(index));
    for (const b of brushes) zip.file(`Brushes/${b.fileName}.prbr`, b.data);
    return zip.generateAsync(ZIP_OPTS);
}
