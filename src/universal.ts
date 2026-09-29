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
    scatter?: { amount: number; count: number };
    brushTip?: { uuid: string; width: number; height: number };
    hardness?: number; // 0..1, set for procedural round tips (no bitmap)
    color?: { hue: number; saturation: number; brightness: number; perTip: boolean }; // jitter 0..1
    wetEdges?: boolean;
    texture?: {
        uuid: string;
        scale: number; // 1 = 100%
        depth: number; // 0..1
        invert: boolean;
        depthDynamics?: Dynamics;
    };
}
