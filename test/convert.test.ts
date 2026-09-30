import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { convertAbr } from '../src/convert.js';
import { maskWithTip, patternToPng, roundTip, shrink, strokePreviewPng, transformTip } from '../src/abr-reader.js';
import { toProperties } from '../src/infinite-painter.js';
import { toUniversal } from '../src/photoshop.js';
import type { ParsedBrush } from '../src/abr-reader.js';

test('toProperties maps universal fields onto the IP template', () => {
    const p = toProperties({
        name: 'ink', spacing: 5, angle: 0, roundness: 1,
        sizeDynamics: { control: 'pressure', jitter: 0.3, minimum: 0 },
        opacityDynamics: { control: 'tilt', jitter: 0, minimum: 0 },
        scatter: { amount: 2, count: 1 },
    }, Buffer.from('abc'));
    const d = p['dynamics-properties'];
    assert.equal(p['display-name'], 'ink');
    assert.equal(p['source-properties']['custom-head'].slice(0, 16), 'ba80a53f981c4d0d'); // blake2b512('abc')
    assert.equal(p['head-properties'].spacing, 2);
    assert.equal(p['jitter-properties'].size, 0.3);
    assert.equal(p['jitter-properties'].scatter, 0.2); // PS 200% × 0.1
    assert.equal(d['pressure - effects size'], true);
    assert.equal(d['tilt - effects flow'], true);
    assert.equal(d['pressure - effects flow'], false); // template had it on
    assert.equal(d['tilt - effects size'], false);
});

test('toProperties: round head, pressure curve, color, wet edges', () => {
    const p = toProperties({
        name: 'round', spacing: 0.25, angle: 0, roundness: 1, hardness: 0.25, wetEdges: true,
        sizeDynamics: { control: 'pressure', jitter: 0, minimum: 0.4 },
        color: { hue: 0.2, saturation: 0.1, brightness: 0.05, perTip: true },
        angleDynamics: { control: 'direction', jitter: 0, minimum: 0 },
    }, undefined);
    assert.equal(p['source-properties']['custom-head'], '');
    assert.equal(p['head-properties'].softness, 0.75);
    assert.deepEqual(p['dynamics-properties']['pressure profile - size'], [0, 0.6, 1, 0]);
    assert.equal(p['jitter-properties']['color-hue'], 0.2);
    assert.equal(p['jitter-properties']['color-start hue'], 0);
    assert.equal(p['stroke-properties']['wet-edges'], 0.15);
    assert.equal(p['head-properties'].rotation, 1); // PS "direction" -> head follows the stroke
    assert.equal(p['head-properties']['use-trajectory'], false);
});

test('shrink caps the longest side with area averaging; gray patterns stay gray', () => {
    const r = shrink(new Uint8Array([0, 255, 255, 255, 100, 100, 100, 100]), 4, 2, 1, 2);
    assert.deepEqual([r.width, r.height, ...r.data], [2, 1, 114, 178]); // 2x2 block averages
    assert.equal(shrink(new Uint8Array(4), 2, 2, 1, 2).width, 2);

    const rgba = new Uint8Array(3000 * 10 * 4).map((_, i) => (i % 4 === 3 ? 255 : 77));
    const png = PNG.sync.read(patternToPng({ id: 'p', width: 3000, height: 10, rgba }));
    assert.equal(png.width, 2048);
    assert.deepEqual([...png.data.subarray(0, 4)], [77, 77, 77, 255]);
});

test('stroke preview matches IP format: 512x128, transparent, black stroke, tapered by pressure', () => {
    const png = PNG.sync.read(strokePreviewPng(roundTip(1), { spacing: 0.1, sizeMin: 0 }));
    assert.deepEqual([png.width, png.height], [512, 128]);
    const alpha = (x: number, y: number) => png.data[(y * 512 + x) * 4 + 3]!;
    assert.equal(alpha(0, 0), 0);
    assert.equal(alpha(256, 64), 255); // mid-stroke, full pressure
    assert.deepEqual([...png.data.subarray((64 * 512 + 256) * 4, (64 * 512 + 256) * 4 + 3)], [0, 0, 0]);
    let start = 0, mid = 0; // column coverage near the start vs the middle
    for (let y = 0; y < 128; y++) { start += alpha(40, y) > 0 ? 1 : 0; mid += alpha(256, y) > 0 ? 1 : 0; }
    assert.ok(start < mid / 2, `start ${start} should be thinner than middle ${mid}`);
});

test('tip transforms: roundness squashes, flip mirrors, dual mask only removes paint', () => {
    // 2x2 tip: left column painted
    const tip = { id: 't', width: 2, height: 2, alpha: new Uint8Array([255, 0, 255, 0]) };
    const squashed = transformTip(tip, 0.5);
    assert.deepEqual([squashed.width, squashed.height, ...squashed.alpha], [2, 1, 255, 0]);
    assert.deepEqual([...transformTip(tip, 1, { x: true, y: false }).alpha], [0, 255, 0, 255]);

    const ellipse = roundTip(1, 64, 0.5);
    assert.deepEqual([ellipse.width, ellipse.height], [64, 32]);

    const head = roundTip(1, 64);
    const solid = { id: 'm', width: 4, height: 4, alpha: new Uint8Array(16).fill(255) };
    assert.deepEqual([...maskWithTip(head, solid, 2).alpha], [...head.alpha], 'a solid mask keeps the head');
    const holed = maskWithTip(head, roundTip(1, 16), 0.25);
    assert.ok(holed.alpha.every((a, i) => a <= head.alpha[i]!), 'masking never adds paint');
    assert.ok(holed.alpha.some((a, i) => a < head.alpha[i]!), 'gaps between second-tip stamps remove paint');
});

test('texture brightness/contrast are baked into the texture image', () => {
    const rgba = new Uint8Array([100, 100, 100, 255]);
    const px = (b: number, c: number) => PNG.sync.read(patternToPng({ id: 'p', width: 1, height: 1, rgba }, b, c)).data[0];
    assert.equal(px(0, 0), 100);
    assert.equal(px(50, 0), 150);
    assert.equal(px(0, 100), 72); // (100 - 128) * 2 + 128
});

// Minimal Photoshop brush for mapping tests.
const psBrush = (extra: object) => ({
    name: 'b', spacing: 0.25, noise: false, wetEdges: false, useBrushSize: false,
    shape: { type: 'sampled', sampledData: 'tip', size: 100, angle: 0, roundness: 1, spacing: 0.25, spacingOn: true, flipX: false, flipY: false, name: 'b' },
    ...extra,
}) as unknown as ParsedBrush;
const off = { control: 'off', steps: 25, jitter: 0, minimum: 0 };
const abr = {
    tips: new Map([['tip', { id: 'tip', width: 4, height: 4, alpha: new Uint8Array(16).fill(255) }],
        ['dual', { id: 'dual', width: 4, height: 4, alpha: new Uint8Array(16).fill(255) }]]),
    patterns: new Map([['pat', { id: 'pat', width: 1, height: 1, rgba: new Uint8Array([9, 9, 9, 255]) }]]),
};

test('mapping: only real losses count, approximations carry the effect', () => {
    const levels = (b: ParsedBrush) => toUniversal(b, abr).warnings.map((w) => w.level);

    // Roundness driven by pressure -> size driven by pressure, not a loss.
    const round = toUniversal(psBrush({
        shapeDynamics: { sizeDynamics: off, angleDynamics: off, roundnessDynamics: { ...off, control: 'pen pressure' },
            minimumDiameter: 0, minimumRoundness: 0.2, tiltScale: 1, flipX: false, flipY: false },
    }), abr);
    assert.deepEqual(round.brush.sizeDynamics, { control: 'pressure', jitter: 0, minimum: 0.2 });
    assert.ok(!round.warnings.some((w) => w.level === 'lost'));

    // Dual brush: becomes the texture when free, is baked into the head when the brush already has a texture.
    const dual = { shape: { type: 'sampled', sampledData: 'dual', size: 50 }, spacing: 0.5 };
    const asTexture = toUniversal(psBrush({ dualBrush: dual }), abr).brush;
    assert.equal(asTexture.texture?.fromTip, true);
    const texture = { id: 'pat', scale: 1, depth: 1, depthMinimum: 0.3, invert: false, brightness: 0, contrast: 0, blendMode: 'multiply',
        depthDynamics: { ...off, control: 'pen pressure' } };
    const baked = toUniversal(psBrush({ dualBrush: dual, texture }), abr).brush;
    assert.deepEqual(baked.dualHead, { uuid: 'dual', hardness: 1, sizeRatio: 0.5, spacing: 0.5 });
    assert.equal(baked.texture?.depthDynamics?.minimum, 0.3, 'PS Minimum Depth feeds the pressure curve');

    assert.deepEqual(levels(psBrush({ transfer: { opacityDynamics: { ...off, control: 'fade' } } })), ['lost']);
});

test('toProperties: scatter count tightens spacing, scatter pressure, dual texture follows size', () => {
    const p = toProperties({
        name: 's', spacing: 0.4, angle: 0, roundness: 1,
        scatter: { amount: 1, count: 4, dynamics: { control: 'pressure', jitter: 1, minimum: 0 } },
        texture: { uuid: 't', fromTip: true, scale: 1, depth: 1, invert: false, brightness: 0, contrast: 0 },
    }, Buffer.from('h'), Buffer.from('t'));
    assert.equal(p['head-properties'].spacing, 0.05); // 0.4 × 0.5 / 4
    assert.equal(p['dynamics-properties']['pressure - effects scatter'], true);
    assert.equal(p['texture-properties']['scale-size'], true);
});

// Sample files are licensed no-redistribution: kept in Samples/ locally, tests skip without them.
const ABR = 'Samples/Photoshop/Size Flow Gang.abr';
test('converts Size Flow Gang: sampled + round brushes, textures, pack', { skip: !existsSync(ABR) }, async () => {
    const res = await convertAbr(readFileSync(ABR), 'sfg');
    assert.equal(res.report.totalBrushes, 14);
    assert.equal(res.report.failed, 0);
    assert.equal(res.report.partial, 0, `still partial: ${res.report.unsupported}`);
    assert.equal(res.brushes.length, 14);

    const open = async (i: number) => {
        const zip = await JSZip.loadAsync(res.brushes[i]!.data);
        return { zip, props: JSON.parse(await zip.file('properties.json')!.async('string')) };
    };
    const results = res.report.brushes;

    // Bitmap + textured brush: head and pattern embedded, each referenced by its hash.
    const gritty = await open(results.findIndex((b) => b.name === '06 Gritty'));
    const hash = (data: Buffer) => createHash('blake2b512').update(data).digest('hex');
    const head = await gritty.zip.file('head')!.async('nodebuffer');
    const texture = await gritty.zip.file('texture')!.async('nodebuffer');
    assert.equal(gritty.props['source-properties']['custom-head'], hash(head));
    assert.equal(gritty.props['source-properties']['custom-stroke texture'], hash(texture));
    assert.equal(PNG.sync.read(head).data[0], 255, 'corner should be white (no paint)');
    assert.equal(gritty.props['texture-properties'].scale, 0.68);
    assert.equal(gritty.props['texture-properties'].pressure, 0); // PS depth 1 -> app "Profondeur" 100
    const preview = PNG.sync.read(await gritty.zip.file('preview')!.async('nodebuffer'));
    assert.deepEqual([preview.width, preview.height], [512, 128]);

    // Round (computed) brush: no head file, IP's procedural head.
    const round = await open(results.findIndex((b) => b.name.startsWith('00 Ol')));
    assert.equal(round.zip.file('head'), null);
    assert.equal(round.props['source-properties']['custom-head'], '');

    const pack = await JSZip.loadAsync(res.pack);
    const index = JSON.parse(await pack.file('index.json')!.async('string'));
    assert.equal(index['brush-folders'][0].brushes.length, 14);
});
