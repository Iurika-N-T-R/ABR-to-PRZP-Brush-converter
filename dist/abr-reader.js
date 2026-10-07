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
// PS texture brightness (-150..150) and contrast (-50..100) as a linear pixel adjustment around mid-gray.
const adjust = (v, brightness, contrast) => Math.min(255, Math.max(0, Math.round((v - 128) * (1 + contrast / 100) + 128 + brightness)));
// Stroke texture as a plain image, like the textures Infinite Painter imports; grayscale patterns stay 8-bit gray.
export function patternToPng(p, brightness = 0, contrast = 0) {
    const { data: src, width, height } = shrink(p.rgba, p.width, p.height, 4);
    const data = brightness || contrast ? src.map((v, i) => (i % 4 === 3 ? v : adjust(v, brightness, contrast))) : src;
    let gray = true;
    for (let i = 0; gray && i < data.length; i += 4)
        gray = data[i] === data[i + 1] && data[i] === data[i + 2];
    const png = new PNG({ width, height });
    png.data = Buffer.from(data);
    return PNG.sync.write(png, { colorType: gray ? 0 : 2 });
}
// Round (or, with roundness < 1, elliptical) tip. Round ones only feed previews, IP draws its own round head;
// elliptical ones become a real head since IP's procedural head can't be squashed.
export function roundTip(hardness, size = 64, roundness = 1) {
    const r = size / 2;
    const h = Math.max(1, Math.round(size * roundness));
    const edge = Math.max(1e-3, 1 - hardness);
    const alpha = new Uint8Array(size * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < size; x++) {
            // Normalised by the real height: PS roundness 0% gives a 1 px line, not 0/0.
            const d = Math.hypot(x + 0.5 - r, ((y + 0.5 - h / 2) * size) / h) / r;
            alpha[y * size + x] = Math.round(255 * Math.min(1, Math.max(0, (1 - d) / edge)));
        }
    }
    return { id: 'round', width: size, height: h, alpha };
}
// PS tip roundness squashes the tip vertically (before the angle rotates it), flips mirror it.
export function transformTip(tip, roundness = 1, flip) {
    const w = tip.width, h = Math.max(1, Math.round(tip.height * roundness));
    const alpha = new Uint8Array(w * h);
    for (let Y = 0; Y < h; Y++) {
        const y0 = Math.floor((Y * tip.height) / h), y1 = Math.max(y0 + 1, Math.floor(((Y + 1) * tip.height) / h));
        const dy = flip?.y ? h - 1 - Y : Y;
        for (let x = 0; x < w; x++) {
            let sum = 0;
            for (let y = y0; y < y1; y++)
                sum += tip.alpha[y * w + x];
            alpha[dy * w + (flip?.x ? w - 1 - x : x)] = Math.round(sum / (y1 - y0));
        }
    }
    return { id: tip.id, width: w, height: h, alpha };
}
// Bilinear read of a tip's alpha at fractional pixel (u, v); 0 outside.
function sample(t, u, v) {
    if (u < -0.5 || v < -0.5 || u > t.width - 0.5 || v > t.height - 0.5)
        return 0;
    const x = Math.min(t.width - 1, Math.max(0, u)), y = Math.min(t.height - 1, Math.max(0, v));
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(t.width - 1, x0 + 1), y1 = Math.min(t.height - 1, y0 + 1);
    const fx = x - x0, fy = y - y0, a = (xx, yy) => t.alpha[yy * t.width + xx];
    return (a(x0, y0) * (1 - fx) + a(x1, y0) * fx) * (1 - fy) + (a(x0, y1) * (1 - fx) + a(x1, y1) * fx) * fy;
}
// Dual brush baked into the head. Like Photoshop, the second tip (sized `ratio` × the head) is stamped along its
// spacing with jitter; the union of those stamps masks the head. Static where PS re-scatters it on every stamp.
export function maskWithTip(head, mask, ratio, spacing = 1) {
    const W = head.width, H = head.height;
    const mw = Math.max(2, W * ratio), mh = Math.max(2, (mw * mask.height) / mask.width);
    const cover = new Float32Array(W * H);
    const stamp = (ox, oy) => {
        const left = ox - mw / 2, top = oy - mh / 2;
        for (let y = Math.max(0, Math.floor(top)); y < Math.min(H, Math.ceil(top + mh)); y++) {
            for (let x = Math.max(0, Math.floor(left)); x < Math.min(W, Math.ceil(left + mw)); x++) {
                const m = sample(mask, ((x + 0.5 - left) / mw) * mask.width - 0.5, ((y + 0.5 - top) / mh) * mask.height - 0.5) / 255;
                if (m > cover[y * W + x])
                    cover[y * W + x] = m;
            }
        }
    };
    // Like a horizontal PS stroke: the second tip is swept across the head at its own spacing, so its stamps pile up
    // into streaks. A single stamp of a sparse second tip times a sparse head would leave the head empty (white).
    let seed = 12345; // fixed seed: the same ABR always gives the same brush
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
    // ponytail: spacing floored at 5% to bound the work; denser PS spacing looks the same once stamps overlap.
    const sx = mw * Math.min(1, Math.max(0.05, spacing));
    for (let cy = Math.min(H, mh) / 2; cy < H; cy += mh * 0.75) {
        for (let cx = -mw / 2; cx < W + mw / 2; cx += sx)
            stamp(cx, cy + rnd() * mh * 0.25);
    }
    // A static head can't rebuild what PS's overlapping stamps do: keep at least half the ink so the tip shape
    // always shows, with the second tip as a modulation (alpha × (1 - k + k × cover)).
    let ink = 0, kept = 0;
    head.alpha.forEach((a, i) => { ink += a; kept += a * cover[i]; });
    const r = ink ? kept / ink : 1, k = r >= 0.5 ? 1 : 0.5 / (1 - r);
    return { ...head, alpha: head.alpha.map((a, i) => Math.round(a * (1 - k + k * cover[i]))) };
}
// A tip used as a texture (dual brush stand-in): painted areas white, like the high points of a PS height texture.
export function tipAsPattern(tip) {
    const rgba = new Uint8Array(tip.width * tip.height * 4);
    tip.alpha.forEach((a, i) => rgba.set([a, a, a, 255], i * 4));
    return { id: tip.id, width: tip.width, height: tip.height, rgba };
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
