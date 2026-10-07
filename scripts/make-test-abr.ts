// Writes test/fixtures/test-brushes.abr: small Photoshop brushes, each aimed at a known conversion bug.
// Layout copied from real ABR v6.2 files (Photoshop CC): `samp` tips, `patt` patterns, `desc` brush settings.
// ponytail: no writeAbr in ag-psd and its descriptor writer guesses types from key names, so both are hand-written here.
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ---- Binary helpers (big-endian) ----
type Bytes = Buffer;
const u8 = (v: number) => Buffer.from([v]);
const u16 = (v: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(v); return b; };
const u32 = (v: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; };
const f64 = (v: number) => { const b = Buffer.alloc(8); b.writeDoubleBE(v); return b; };
const cat = (...b: Bytes[]) => Buffer.concat(b);
const pad4 = (b: Bytes) => cat(b, Buffer.alloc((4 - (b.length % 4)) % 4));
const pascal = (s: string) => cat(u8(s.length), Buffer.from(s, 'latin1'));
const unicode = (s: string) => { const t = s + '\0'; return cat(u32(t.length), Buffer.from(t, 'utf16le').swap16()); };
const section = (type: string, data: Bytes) => cat(Buffer.from('8BIM' + type, 'latin1'), u32(data.length), pad4(data));

// ---- Photoshop descriptors, typed explicitly ----
type Item = Bytes;
const key = (k: string) => (k.length === 4 ? cat(u32(0), Buffer.from(k, 'latin1')) : cat(u32(k.length), Buffer.from(k, 'latin1')));
const descBody = (cls: string, entries: [string, Item][]) =>
    cat(unicode(''), key(cls), u32(entries.length), ...entries.map(([k, v]) => cat(key(k), v)));
const obj = (cls: string, entries: [string, Item][]) => cat(Buffer.from('Objc'), descBody(cls, entries));
const bool = (v: boolean) => cat(Buffer.from('bool'), u8(v ? 1 : 0));
const long = (v: number) => cat(Buffer.from('long'), u32(v >>> 0));
const doub = (v: number) => cat(Buffer.from('doub'), f64(v));
const untf = (unit: '#Pxl' | '#Ang' | '#Prc', v: number) => cat(Buffer.from('UntF' + unit), f64(v));
const text = (s: string) => cat(Buffer.from('TEXT'), unicode(s));
const enm = (type: string, v: string) => cat(Buffer.from('enum'), key(type), key(v));
const list = (items: Item[]) => cat(Buffer.from('VlLs'), u32(items.length), ...items);

// ---- Images ----
interface Img { id: string; name: string; w: number; h: number; px: Uint8Array } // tip: 255 = paint; pattern: gray
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const image = (n: number, name: string, w: number, h: number, f: (x: number, y: number) => number): Img => {
    const px = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = Math.max(0, Math.min(255, Math.round(f(x, y))));
    return { id: uuid(n), name, w, h, px };
};
const dots = (n: number, name: string, size: number, count: number, r: number) => {
    const c = Array.from({ length: count }, () => [rnd() * size, rnd() * size, r * (0.5 + rnd())]);
    return image(n, name, size, size, (x, y) => (c.some(([cx, cy, cr]) => Math.hypot(x - cx!, y - cy!) < cr!) ? 255 : 0));
};

// Sampled tip, raw 8-bit: VMAL header (264 bytes) + channel rect, depth, compression, pixels, 8 zero bytes.
const samp = (t: Img) => {
    const data = cat(Buffer.from(t.px), Buffer.alloc(8));
    const rect = cat(u32(0), u32(0), u32(t.h), u32(t.w));
    const chan = data.length + 15;
    const vmal = cat(u32(0x00010000), u32(3), u32(chan + 256), rect, u32(56), Buffer.alloc(220), u32(1), u32(chan), u32(8));
    const body = cat(pascal(t.id), vmal, rect, u16(8), u8(0), data);
    return cat(u32(body.length), pad4(body));
};

// Grayscale pattern, raw: header, VMAL with 24 + 2 channel slots, only the first written.
const patt = (p: Img) => {
    const rect = cat(u32(0), u32(0), u32(p.h), u32(p.w));
    const chan = cat(u32(1), u32(p.px.length + 23), u32(8), rect, u16(8), u8(0), Buffer.from(p.px));
    const vmalBody = cat(rect, u32(24), chan, Buffer.alloc(25 * 4));
    const body = cat(u32(1), u32(1), u16(p.h), u16(p.w), unicode(p.name), pascal(p.id), u32(3), u32(vmalBody.length), vmalBody);
    return cat(u32(body.length), pad4(body));
};

// ---- Brush settings ----
type Ctl = 'off' | 'pressure';
const dyn = (control: Ctl = 'off', minimum = 0, jitter = 0, steps = 25) =>
    obj('brVr', [['bVTy', long(control === 'pressure' ? 2 : 0)], ['fStp', long(steps)], ['jitter', untf('#Prc', jitter)], ['Mnm ', untf('#Prc', minimum)]]);

interface Shape { size: number; tip?: Img; hardness?: number; angle?: number; roundness?: number; spacing?: number }
const shape = (s: Shape) => obj(s.tip ? 'sampledBrush' : 'computedBrush', [
    ['Dmtr', untf('#Pxl', s.size)],
    ...(s.tip ? [] : [['Hrdn', untf('#Prc', (s.hardness ?? 1) * 100)] as [string, Item]]),
    ['Angl', untf('#Ang', s.angle ?? 0)],
    ['Rndn', untf('#Prc', (s.roundness ?? 1) * 100)],
    ...(s.tip ? [['Nm  ', text(s.tip.name)] as [string, Item]] : []),
    ['Spcn', untf('#Prc', (s.spacing ?? 0.25) * 100)],
    ['Intr', bool(true)], ['flipX', bool(false)], ['flipY', bool(false)],
    ...(s.tip ? [['sampledData', text(s.tip.id)] as [string, Item]] : []),
]);

interface BrushSpec {
    name: string;
    shape: Shape;
    sizePressure?: number; // Minimum Diameter, 0..1
    opacityPressure?: boolean;
    dual?: { shape: Shape; scatter: number };
    texture?: { pattern: Img; depth: number; scale: number };
}
const brushDesc = (b: BrushSpec) => obj('brushPreset', [
    ['Nm  ', text(b.name)],
    ['Brsh', shape(b.shape)],
    ['useTipDynamics', bool(true)], ['flipX', bool(false)], ['flipY', bool(false)], ['brushProjection', bool(false)],
    ['minimumDiameter', untf('#Prc', (b.sizePressure ?? 0) * 100)], ['minimumRoundness', untf('#Prc', 25)], ['tiltScale', untf('#Prc', 200)],
    ['szVr', dyn(b.sizePressure === undefined ? 'off' : 'pressure')], ['angleDynamics', dyn()], ['roundnessDynamics', dyn()],
    ['useScatter', bool(false)],
    ['dualBrush', obj('dualBrush', b.dual ? [
        ['useDualBrush', bool(true)], ['Flip', bool(false)], ['Brsh', shape(b.dual.shape)], ['BlnM', enm('BlnM', 'Mltp')],
        ['useScatter', bool(true)], ['Spcn', untf('#Prc', 100)], ['Cnt ', doub(1)], ['bothAxes', bool(true)],
        ['countDynamics', dyn('off', 0, 0, 1)], ['scatterDynamics', dyn('off', 0, b.dual.scatter * 100)],
    ] : [['useDualBrush', bool(false)]])],
    ['brushGroup', obj('brushGroup', [['useBrushGroup', bool(false)]])],
    ['useTexture', bool(!!b.texture)],
    ...(b.texture ? [
        ['TxtC', bool(false)], ['interpretation', bool(true)], ['textureBlendMode', enm('BlnM', 'Mltp')],
        ['textureDepth', untf('#Prc', b.texture.depth * 100)], ['minimumDepth', untf('#Prc', 0)], ['textureDepthDynamics', dyn('off', 0, 0, 1)],
        ['Txtr', obj('Ptrn', [['Nm  ', text(b.texture.pattern.name)], ['Idnt', text(b.texture.pattern.id)]])],
        ['textureScale', untf('#Prc', b.texture.scale * 100)], ['InvT', bool(false)], ['protectTexture', bool(false)],
        ['textureBrightness', long(0)], ['textureContrast', long(0)],
    ] as [string, Item][] : []),
    ['usePaintDynamics', bool(true)],
    ['prVr', dyn()], ['opVr', dyn(b.opacityPressure ? 'pressure' : 'off')], ['wtVr', dyn()], ['mxVr', dyn()],
    ['useColorDynamics', bool(false)], ['Wtdg', bool(false)], ['Nose', bool(false)], ['Rpt ', bool(false)],
    ['useBrushSize', bool(true)], ['useBrushPose', bool(false)],
]);

export function writeAbr(brushes: BrushSpec[]): Buffer {
    const tips = new Map<string, Img>(), patterns = new Map<string, Img>();
    for (const b of brushes) {
        for (const t of [b.shape.tip, b.dual?.shape.tip]) if (t) tips.set(t.id, t);
        if (b.texture) patterns.set(b.texture.pattern.id, b.texture.pattern);
    }
    const desc = cat(u32(16), descBody('null', [['Brsh', list(brushes.map(brushDesc))]]));
    return cat(u16(6), u16(2),
        section('samp', cat(...[...tips.values()].map(samp))),
        section('patt', cat(...[...patterns.values()].map(patt))),
        section('desc', desc));
}

// ---- The test set ----
const square = image(1, 'Test square 64', 64, 64, () => 255);
const sparse = dots(2, 'Test sparse dots', 96, 40, 4);
const sparse2 = dots(3, 'Test sparse dots 2', 80, 25, 3);
const leaf = image(4, 'Test leaf', 120, 200, (x, y) => {
    const t = y / 200, half = 55 * Math.sin(Math.PI * t);
    return Math.abs(x - 60) < half ? 255 * Math.min(1, (half - Math.abs(x - 60)) / 6) : Math.abs(x - 60) < 2 ? 255 : 0;
});
const arrow = image(5, 'Test arrow up', 100, 100, (x, y) => (y < 50 ? Math.abs(x - 50) < y : Math.abs(x - 50) < 12) ? 255 : 0);
const paper = image(6, 'Test paper', 128, 128, () => 90 + rnd() * 165);

export const TEST_BRUSHES: BrushSpec[] = [
    { name: 'T01 Round 56px hard', shape: { size: 56, hardness: 1 } },
    { name: 'T02 Round 300px soft', shape: { size: 300, hardness: 0 } },
    { name: 'T03 Roundness 0 (line)', shape: { size: 175, hardness: 1, roundness: 0, angle: 45 } },
    { name: 'T04 Roundness 30 sampled', shape: { size: 120, tip: leaf, roundness: 0.3 } },
    { name: 'T05 Arrow 100px angle 90', shape: { size: 100, tip: arrow, angle: 90, spacing: 1.5 } },
    { name: 'T06 Solid square + texture', shape: { size: 64, tip: square, spacing: 0.05 }, texture: { pattern: paper, depth: 0.5, scale: 1 } },
    { name: 'T07 Sparse tip + dual', shape: { size: 96, tip: sparse, spacing: 0.1 }, dual: { shape: { size: 80, tip: sparse2, spacing: 0.1 }, scatter: 0.5 } },
    { name: 'T08 Sparse dual + texture', shape: { size: 96, tip: sparse, spacing: 0.1 },
        dual: { shape: { size: 80, tip: sparse2, spacing: 0.1 }, scatter: 0.5 }, texture: { pattern: paper, depth: 0.3, scale: 0.5 } },
    { name: 'T09 Leaf pressure size+opacity', shape: { size: 150, tip: leaf, spacing: 0.15 }, sizePressure: 0.2, opacityPressure: true },
];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    mkdirSync('test/fixtures', { recursive: true });
    writeFileSync('test/fixtures/test-brushes.abr', writeAbr(TEST_BRUSHES));
    console.log('test/fixtures/test-brushes.abr');
}
