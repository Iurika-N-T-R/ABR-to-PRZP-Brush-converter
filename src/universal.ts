// Format-agnostic brush model. No Photoshop or Infinite Painter specifics here.

export type Control = 'off' | 'pressure' | 'tilt' | (string & {});

export interface Dynamics {
    control: Control;
    jitter: number; // 0..1
    minimum: number; // 0..1, value reached at control = 0
}

export interface UniversalBrush {
    name: string;
    spacing: number; // fraction of tip diameter
    angle: number; // degrees
    roundness: number; // 0..1
    sizeDynamics?: Dynamics;
    angleDynamics?: Dynamics;
    opacityDynamics?: Dynamics;
    flowDynamics?: Dynamics;
    scatter?: { amount: number; count: number; dynamics?: Dynamics };
    brushTip?: { uuid: string; width: number; height: number };
    flip?: { x: boolean; y: boolean }; // static mirror of the tip
    // Second tip multiplied into the head (dual brush when the texture slot is taken). uuid unset = round tip.
    dualHead?: { uuid?: string; hardness: number; sizeRatio: number; spacing: number };
    hardness?: number; // 0..1, set for procedural round tips (no bitmap)
    color?: { hue: number; saturation: number; brightness: number; perTip: boolean }; // jitter 0..1
    wetEdges?: boolean;
    texture?: {
        uuid: string;
        scale: number; // 1 = 100%
        depth: number; // 0..1
        invert: boolean;
        brightness: number; // -150..150, baked into the texture image
        contrast: number; // -50..100, baked into the texture image
        fromTip?: boolean; // uuid is a brush tip (dual brush stand-in), not a pattern
        depthDynamics?: Dynamics;
    };
}
