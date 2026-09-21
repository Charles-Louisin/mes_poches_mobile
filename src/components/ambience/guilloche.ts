/**
 * Rosaces guillochées — le motif gravé des billets de banque.
 * Chemins calculés une fois au chargement du module, jamais par frame.
 */
export function rosette({
  rings,
  base,
  step,
  lobes,
  amplitude,
  samples = 140,
}: {
  rings: number;
  base: number;
  step: number;
  lobes: number;
  amplitude: number;
  samples?: number;
}): string[] {
  const out: string[] = [];
  for (let k = 0; k < rings; k++) {
    const radius = base + k * step;
    const phase = (k * Math.PI) / rings;
    let d = '';
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const r = radius * (1 + amplitude * Math.sin(lobes * t + phase));
      const x = Math.cos(t) * r;
      const y = Math.sin(t) * r;
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }
    out.push(`${d}Z`);
  }
  return out;
}

/** Trame de fond : ondes horizontales serrées, comme un fond de chèque. */
export function waveband({
  lines,
  width,
  gap,
  amplitude,
  period,
  samples = 90,
}: {
  lines: number;
  width: number;
  gap: number;
  amplitude: number;
  period: number;
  samples?: number;
}): string[] {
  const out: string[] = [];
  for (let k = 0; k < lines; k++) {
    const y0 = k * gap;
    const phase = k * 0.42;
    let d = '';
    for (let i = 0; i <= samples; i++) {
      const x = (i / samples) * width;
      const y = y0 + Math.sin((x / period) * Math.PI * 2 + phase) * amplitude;
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }
    out.push(d);
  }
  return out;
}

export const BIG_ROSETTE = rosette({ rings: 9, base: 52, step: 11, lobes: 7, amplitude: 0.075 });
export const SMALL_ROSETTE = rosette({ rings: 6, base: 30, step: 9, lobes: 11, amplitude: 0.055 });
export const WAVES = waveband({ lines: 14, width: 420, gap: 9, amplitude: 3.4, period: 150 });
