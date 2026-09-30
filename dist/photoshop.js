const CONTROLS = {
    off: 'off', 'pen pressure': 'pressure', 'pen tilt': 'tilt', direction: 'direction', rotation: 'pen rotation',
};
// Closest IP behaviour for controls IP doesn't have.
const APPROX_CONTROLS = { 'initial direction': 'direction', 'stylus wheel': 'pen rotation' };
export function toUniversal(ps, { tips, patterns }) {
    const warnings = [];
    const warn = (level, feature, when) => when && warnings.push({ feature, level });
    const dyn = (d, what) => {
        if (!d)
            return undefined;
        const exact = CONTROLS[d.control], approx = APPROX_CONTROLS[d.control];
        warn('approximated', `${what} control "${d.control}"`, !exact && approx);
        warn('lost', `${what} control "${d.control}"`, !exact && !approx);
        return { control: exact ?? approx ?? d.control, jitter: d.jitter, minimum: d.minimum };
    };
    const shape = ps.shape;
    const tip = shape.type === 'sampled' ? tips.get(shape.sampledData) : undefined;
    warn('lost', 'sampled tip missing', shape.type === 'sampled' && !tip);
    // Bitmap-less PS tips become a procedural round head; erodible/bristle ones only approximately.
    const hardness = shape.type === 'computed' ? shape.hardness : shape.type === 'tips' ? shape.tipsHardness : shape.type === 'dynamic' ? 1 : undefined;
    warn('approximated', `${shape.type} tip as round head`, shape.type === 'tips' || shape.type === 'dynamic');
    // Roundness varying per stamp has no IP setting; its visible effect (thinner marks) is carried by size.
    const sd = ps.shapeDynamics;
    const rd = sd?.roundnessDynamics;
    const roundPressure = rd?.control === 'pen pressure' && sd.minimumRoundness < 1;
    const roundJitter = rd?.jitter ?? 0;
    warn('approximated', 'roundness by pressure as size by pressure', roundPressure);
    warn('approximated', 'roundness jitter as size jitter', roundJitter > 0);
    warn('lost', `roundnessDynamics control "${rd?.control}"`, rd && rd.control !== 'off' && rd.control !== 'pen pressure');
    warn('minor', 'random flip per stamp', sd?.flipX || sd?.flipY);
    const sc = ps.scatter;
    warn('approximated', 'scatter on both axes', sc && sc.scatterDynamics.jitter > 0 && sc.bothAxes);
    warn('approximated', 'scatter count as tighter spacing', sc && sc.count > 1);
    warn('minor', 'scatter count jitter', sc && sc.count > 1 && sc.countDynamics.jitter > 0);
    warn('minor', 'noise', ps.noise);
    const tex = ps.texture;
    const pattern = tex && patterns.get(tex.id);
    warn('lost', 'texture pattern missing', tex && !pattern);
    warn('approximated', `texture blendMode "${tex?.blendMode}"`, pattern);
    // A dual brush's second tip, used as the stroke texture, is how artists port dual brushes to IP by hand.
    const dual = ps.dualBrush;
    const dualTip = dual?.shape.type === 'sampled' ? tips.get(dual.shape.sampledData) : undefined;
    const dualAsTexture = dualTip && !pattern;
    // Texture slot already taken: multiply the second tip into the head instead (static, where PS scatters it).
    const dualInHead = dual && !dualAsTexture && (dualTip || dual.shape.type === 'computed');
    warn('approximated', 'dual brush as texture', dualAsTexture);
    warn('approximated', 'dual brush baked into head', dualInHead);
    warn('lost', 'dualBrush', dual && !dualAsTexture && !dualInHead);
    const cd = ps.colorDynamics;
    warn('lost', 'colorDynamics foreground/background', cd && (cd.foregroundBackground.control !== 'off' || cd.foregroundBackground.jitter));
    warn('minor', 'colorDynamics purity', cd?.purity);
    warn('minor', 'brushPose', ps.brushPose);
    warn('lost', `${ps.toolOptions?.type} tool`, ps.toolOptions && ps.toolOptions.type !== 'brush');
    warn('minor', 'wetnessDynamics', ps.transfer?.wetnessDynamics && ps.transfer.wetnessDynamics.control !== 'off');
    warn('minor', 'mixDynamics', ps.transfer?.mixDynamics && ps.transfer.mixDynamics.control !== 'off');
    // PS keeps the size minimum outside the dynamics block ("Minimum Diameter").
    let size = dyn(sd?.sizeDynamics, 'sizeDynamics');
    if (size)
        size = { ...size, minimum: sd.minimumDiameter };
    if (roundPressure && size?.control !== 'pressure')
        size = { control: 'pressure', jitter: size?.jitter ?? 0, minimum: sd.minimumRoundness };
    if (roundJitter > 0) {
        const base = size ?? { control: 'off', jitter: 0, minimum: 0 };
        size = { ...base, jitter: Math.min(1, base.jitter + roundJitter * (1 - sd.minimumRoundness)) };
    }
    const depth = dyn(tex?.depthDynamics, 'texture depthDynamics');
    const brush = {
        name: ps.name,
        spacing: shape.spacing,
        angle: shape.angle ?? 0,
        roundness: 'roundness' in shape ? shape.roundness : 1,
        flip: (shape.flipX || shape.flipY) ? { x: shape.flipX, y: shape.flipY } : undefined,
        dualHead: dualInHead ? {
            uuid: dualTip?.id,
            hardness: dual.shape.type === 'computed' ? dual.shape.hardness : 1,
            sizeRatio: dual.shape.size / shape.size,
            spacing: dual.spacing,
        } : undefined,
        sizeDynamics: size,
        angleDynamics: dyn(sd?.angleDynamics, 'angleDynamics'),
        opacityDynamics: dyn(ps.transfer?.opacityDynamics, 'opacityDynamics'),
        flowDynamics: dyn(ps.transfer?.flowDynamics, 'flowDynamics'),
        scatter: sc && { amount: sc.scatterDynamics.jitter, count: sc.count, dynamics: dyn(sc.scatterDynamics, 'scatter') },
        brushTip: tip && { uuid: tip.id, width: tip.width, height: tip.height },
        hardness,
        color: cd && { hue: cd.hue, saturation: cd.saturation, brightness: cd.brightness, perTip: cd.perTip },
        wetEdges: ps.wetEdges,
        texture: pattern ? {
            uuid: pattern.id,
            scale: tex.scale,
            depth: tex.depth,
            invert: tex.invert,
            brightness: tex.brightness,
            contrast: tex.contrast,
            // PS "Minimum Depth" sits outside the dynamics block, like Minimum Diameter.
            depthDynamics: depth && { ...depth, minimum: tex.depthMinimum },
        } : dualAsTexture ? {
            uuid: dualTip.id, fromTip: true, scale: 1, depth: 1, invert: false, brightness: 0, contrast: 0,
        } : undefined,
    };
    return { brush, warnings };
}
