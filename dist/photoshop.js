const CONTROLS = {
    off: 'off', 'pen pressure': 'pressure', 'pen tilt': 'tilt', direction: 'direction', rotation: 'pen rotation',
};
export function toUniversal(ps, { tips, patterns }) {
    const warnings = [];
    const warn = (feature, when) => when && warnings.push(feature);
    const dyn = (d, what) => {
        if (!d)
            return undefined;
        const control = CONTROLS[d.control] ?? d.control;
        warn(`${what} control "${d.control}"`, !(d.control in CONTROLS));
        return { control, jitter: d.jitter, minimum: d.minimum };
    };
    const shape = ps.shape;
    const tip = shape.type === 'sampled' ? tips.get(shape.sampledData) : undefined;
    warn('sampled tip missing', shape.type === 'sampled' && !tip);
    // Bitmap-less PS tips become a procedural round head; erodible/bristle ones only approximately.
    const hardness = shape.type === 'computed' ? shape.hardness : shape.type === 'tips' ? shape.tipsHardness : shape.type === 'dynamic' ? 1 : undefined;
    warn(`${shape.type} tip approximated as round`, shape.type === 'tips' || shape.type === 'dynamic');
    warn('roundness', shape.type === 'computed' && shape.roundness < 1);
    const sd = ps.shapeDynamics;
    warn('roundnessDynamics', sd && (sd.roundnessDynamics?.jitter || sd.roundnessDynamics?.control !== 'off'));
    warn('flip', shape.flipX || shape.flipY || sd?.flipX || sd?.flipY);
    warn('scatter bothAxes', ps.scatter?.bothAxes);
    warn('scatter count', ps.scatter && ps.scatter.count > 1);
    warn('scatter countDynamics', ps.scatter?.countDynamics?.jitter);
    warn('noise', ps.noise);
    const tex = ps.texture;
    const pattern = tex && patterns.get(tex.id);
    warn('texture pattern missing', tex && !pattern);
    warn(`texture blendMode "${tex?.blendMode}"`, tex);
    warn('texture brightness/contrast', tex?.brightness || tex?.contrast);
    warn('texture depthMinimum', tex?.depthMinimum);
    warn('dualBrush', ps.dualBrush);
    const cd = ps.colorDynamics;
    warn('colorDynamics foreground/background', cd && (cd.foregroundBackground.control !== 'off' || cd.foregroundBackground.jitter));
    warn('colorDynamics purity', cd?.purity);
    warn('brushPose', ps.brushPose);
    warn(`${ps.toolOptions?.type} tool`, ps.toolOptions && ps.toolOptions.type !== 'brush');
    warn('wetnessDynamics', ps.transfer?.wetnessDynamics && ps.transfer.wetnessDynamics.control !== 'off');
    warn('mixDynamics', ps.transfer?.mixDynamics && ps.transfer.mixDynamics.control !== 'off');
    // PS keeps the size minimum outside the dynamics block ("Minimum Diameter").
    const size = dyn(sd?.sizeDynamics, 'sizeDynamics');
    const brush = {
        name: ps.name,
        spacing: shape.spacing,
        angle: shape.angle ?? 0,
        roundness: 'roundness' in shape ? shape.roundness : 1,
        sizeDynamics: size && { ...size, minimum: sd.minimumDiameter },
        angleDynamics: dyn(sd?.angleDynamics, 'angleDynamics'),
        opacityDynamics: dyn(ps.transfer?.opacityDynamics, 'opacityDynamics'),
        flowDynamics: dyn(ps.transfer?.flowDynamics, 'flowDynamics'),
        scatter: ps.scatter && { amount: ps.scatter.scatterDynamics.jitter, count: ps.scatter.count },
        brushTip: tip && { uuid: tip.id, width: tip.width, height: tip.height },
        hardness,
        color: cd && { hue: cd.hue, saturation: cd.saturation, brightness: cd.brightness, perTip: cd.perTip },
        wetEdges: ps.wetEdges,
        texture: tex && pattern && {
            uuid: pattern.id,
            scale: tex.scale,
            depth: tex.depth,
            invert: tex.invert,
            depthDynamics: dyn(tex.depthDynamics, 'texture depthDynamics'),
        },
    };
    return { brush, warnings };
}
