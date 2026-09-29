import { readAbr } from 'ag-psd';
import { PNG } from 'pngjs';
export function parseAbr(buffer) {
    const abr = readAbr(buffer);
    const tips = new Map();
    for (const s of abr.samples)
        tips.set(s.id, { id: s.id, width: s.bounds.w, height: s.bounds.h, alpha: s.alpha });
    const patterns = new Map();
    for (const p of abr.patterns)
        patterns.set(p.id, { id: p.id, width: p.bounds.w, height: p.bounds.h, rgba: p.data });
    return { brushes: abr.brushes, tips, patterns };
}
// ponytail: IP accepts heads up to at least 3072 px (seen in samples); 2048 keeps packs light. Raise if detail suffers.
export const MAX_SIDE = 2048;
// Area-average downscale so the longest side fits `max`; returns the input untouched when it already fits.
export function shrink(data, w, h, ch, max = MAX_SIDE) {
    const k = Math.max(w, h) / max;
    if (k <= 1)
        return { data, width: w, height: h };
    const W = Math.max(1, Math.round(w / k)), H = Math.max(1, Math.round(h / k));
    const out = new Uint8Array(W * H * ch);
    for (let Y = 0; Y < H; Y++) {
        const y0 = Math.floor((Y * h) / H), y1 = Math.max(y0 + 1, Math.floor(((Y + 1) * h) / H));
        for (let X = 0; X < W; X++) {
            const x0 = Math.floor((X * w) / W), x1 = Math.max(x0 + 1, Math.floor(((X + 1) * w) / W));
            for (let c = 0; c < ch; c++) {
                let sum = 0;
                for (let y = y0; y < y1; y++)
                    for (let x = x0; x < x1; x++)
                        sum += data[(y * w + x) * ch + c];
                out[(Y * W + X) * ch + c] = Math.round(sum / ((y1 - y0) * (x1 - x0)));
            }
        }
    }
    return { data: out, width: W, height: H };
}
// Stroke texture as a plain image, like the textures Infinite Painter imports; grayscale patterns stay 8-bit gray.
export function patternToPng(p) {
    const { data, width, height } = shrink(p.rgba, p.width, p.height, 4);
    let gray = true;
    for (let i = 0; gray && i < data.length; i += 4)
        gray = data[i] === data[i + 1] && data[i] === data[i + 2];
    const png = new PNG({ width, height });
    png.data = Buffer.from(data);
    return PNG.sync.write(png, { colorType: gray ? 0 : 2 });
}
// Procedural round tip (IP draws the real one itself); used to render previews of headless brushes.
export function roundTip(hardness, size = 64) {
    const r = size / 2;
    const edge = Math.max(1e-3, 1 - hardness);
    const alpha = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
            alpha[y * size + x] = Math.round(255 * Math.min(1, Math.max(0, (1 - d) / edge)));
        }
    }
    return { id: 'round', width: size, height: size, alpha };
}
// Stroke preview like Infinite Painter's own: 512x128, transparent, black, tip stamped along an S-curve.
// Simulated pressure rises then falls, so pressure-driven brushes taper at both ends.
export function strokePreviewPng(tip, o) {
    const W = 512, H = 128, D = 40;
    const stamp = shrink(tip.alpha, tip.width, tip.height, 1, D);
    const acc = new Float32Array(W * H);
    const put = (cx, cy, k, f) => {
        const sw = Math.max(1, Math.round(stamp.width * k)), sh = Math.max(1, Math.round(stamp.height * k));
        const x0 = Math.round(cx - sw / 2), y0 = Math.round(cy - sh / 2);
        for (let dy = 0; dy < sh; dy++) {
            const y = y0 + dy;
            if (y < 0 || y >= H)
                continue;
            const row = Math.min(stamp.height - 1, Math.floor(dy / k)) * stamp.width;
            for (let dx = 0; dx < sw; dx++) {
                const x = x0 + dx;
                if (x < 0 || x >= W)
                    continue;
                const a = (stamp.data[row + Math.min(stamp.width - 1, Math.floor(dx / k))] / 255) * f;
                acc[y * W + x] = acc[y * W + x] + a * (1 - acc[y * W + x]);
            }
        }
    };
    const at = (t) => [36 + t * (W - 72), H / 2 + 26 * Math.sin(t * 2 * Math.PI)];
    // ponytail: stamps can't be closer than 0.5 px, so very dense brushes look slightly lighter than in the app.
    const step = Math.max(0.5, o.spacing * D);
    let [px, py] = at(0);
    let dist = step;
    for (let i = 0; i <= 4000; i++) {
        const t = i / 4000;
        const [x, y] = at(t);
        dist += Math.hypot(x - px, y - py);
        [px, py] = [x, y];
        if (dist < step)
            continue;
        dist = 0;
        const pressure = Math.sin(Math.PI * t);
        const ramp = (min) => (min === undefined ? 1 : min + (1 - min) * pressure);
        put(x, y, Math.max(0.05, ramp(o.sizeMin)), ramp(o.opacityMin));
    }
    const png = new PNG({ width: W, height: H });
    for (let i = 0; i < W * H; i++)
        png.data[i * 4 + 3] = Math.round(acc[i] * 255); // RGB stays 0 = black
    return PNG.sync.write(png);
}
// Ink tip as black-on-white, which is how Infinite Painter stores custom heads.
export function tipToPng(tip, grayscale = false, maxSide = MAX_SIDE) {
    if (grayscale) {
        const png = new PNG({ width: tip.width, height: tip.height, colorType: 0, inputColorType: 0, inputHasAlpha: false });
        png.data = Buffer.from(tip.alpha.map((a) => 255 - a));
        return PNG.sync.write(png, { colorType: 0, inputColorType: 0, inputHasAlpha: false });
    }
    // Heads are capped at the app's size; the full-resolution tip still goes to tips/.
    const { data: alpha, width, height } = shrink(tip.alpha, tip.width, tip.height, 1, maxSide);
    const png = new PNG({ width, height });
    for (let i = 0; i < width * height; i++) {
        const v = 255 - alpha[i];
        png.data.writeUInt32BE(((v << 24) | (v << 16) | (v << 8) | 0xff) >>> 0, i * 4);
    }
    return PNG.sync.write(png);
}
