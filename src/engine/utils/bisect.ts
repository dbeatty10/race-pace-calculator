export function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  tol = 1e-9,
  maxIter = 100
): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);

  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) throw new Error("Root not bracketed");

  for (let i = 0; i < maxIter; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);

    if (Math.abs(fm) < tol || (b - a) / 2 < tol) return m;

    if (fa * fm <= 0) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }

  return 0.5 * (a + b);
}
