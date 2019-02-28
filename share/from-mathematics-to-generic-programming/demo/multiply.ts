/**
 * First version
 * Recursion
 */
function multiplyV1(n: number, a: number): number {
  if (n === 1) return a; // 1a = a
  return multiplyV1(n - 1, a) + a; // na = (n - 1)a + a
}

console.log('multiplyV1', multiplyV1(5, 3));










/**
 * Second version
 * Egyptian multiplication: 4a = ((a + a) + a) + a = (a + a) + (a + a)
 * In further, 41 * 59 = (2^0 * 59) + (2^3 * 59) + (2^5 * 59) = 59 + 472 + 1888 = 2419
 */
function multiplyV2(n: number, a: number): number {
  if (n === 1) return a;
  const result = multiplyV2(half(n), a + a);
  return odd(n) ? (result + a) : result;
}

function odd(n: number): boolean {
  return !!(n & 0x1);
}
function half(n: number): number {
  return n >> 1;
}

console.log('multiplyV2', multiplyV2(41, 59));










/**
 * Third version
 * Tail recursive
 */
function multiplyAccV3(r: number, n: number, a: number): number {
  if (n === 1) return r + a;
  if (odd(n)) r = r + a;
  return multiplyV3(r, half(n), a + a); // r + na
}

function multiplyV3(n: number, a: number): number {
  return multiplyAccV3(0, n, a);
}

console.log('multiplyV3', multiplyV3(41, 59));










/**
 * Fourth version
 * Strict tail recursion
 */
function multiplyAccV4(r: number, n: number, a: number): number {
  if (odd(n)) {
    r = r + a;
    if (n === 1) return r;
  }
  n = half(n);
  a = a + a;
  return multiplyAccV4(r, n, a);
}

function multiplyV4(n: number, a: number): number {
  return multiplyAccV4(0, n, a);
}

console.log('multiplyV4', multiplyV4(41, 59));










/**
 * Fifth version
 * Non-recursion from strict tail recursion to avoid stack costs
 */
function multiplyAccV5(r: number, n: number, a: number): number {
  while (true) {
    if (odd(n)) {
      r = r + a;
      if (n === 1) return r;
    }
    n = half(n);
    a = a + a;
  }
}

function multiplyV5(n: number, a: number): number {
  return multiplyAccV5(0, n, a);
}

console.log('multiplyV5', multiplyV5(41, 59));
