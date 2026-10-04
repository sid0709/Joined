export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (u: number) => {
  const v = clamp01(u);
  return v * v * (3 - 2 * v);
};
export const approach = (cur: number, goal: number, rate: number, dt: number) =>
  cur + (goal - cur) * (1 - Math.exp(-rate * dt));
