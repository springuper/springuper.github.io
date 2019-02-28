// function multiplyAccV1<A>(r: A, n: number, a: A): A
function multiplyAccV1(r: number, n: number, a: number): number
function multiplyAccV1(r: string, n: number, a: string): string
function multiplyAccV1(r: any, n: number, a: any): any {
  while (true) {
    if (odd(n)) {
      r = r + a;
      if (n === 1) return r;
    }
    n = half(n);
    a = a + a;
  }
}

function multiplyV1(n: number, a: number): number
function multiplyV1(n: number, a: string): string
function multiplyV1(n: number, a: any): any {
  if (n === 1) return a;
  return multiplyAccV1(a, half(n - 1), a + a);
}

function odd(n: number): boolean {
  return !!(n & 0x1);
}
function half(n: number): number {
  return n >> 1;
}

console.log('multiplyAccV1', multiplyV1(41, 59));
console.log('multiplyAccV1', multiplyV1(41, '59'));










// TODO find `type` to make generic type shorter
function multiplyAccSemigroup<NonCommutativeAdditiveSemigroup extends number>(r: NonCommutativeAdditiveSemigroup, n: number, a: NonCommutativeAdditiveSemigroup): NonCommutativeAdditiveSemigroup {
  while (true) {
    if (odd(n)) {
      r = (r + a) as NonCommutativeAdditiveSemigroup;
      if (n === 1) return r;
    }
    n = half(n);
    a = (a + a) as NonCommutativeAdditiveSemigroup;
  }
}

function multiplySemigroup<NonCommutativeAdditiveSemigroup extends number>(n: number, a: NonCommutativeAdditiveSemigroup): NonCommutativeAdditiveSemigroup {
  if (n === 1) return a;
  return multiplyAccSemigroup(a, half(n - 1), (a + a)  as NonCommutativeAdditiveSemigroup);
}

console.log('multiplySemigroup', multiplySemigroup(41, 59));










function multiplyMonoid<NonCommutativeAdditiveMonoid extends number>(n: number, a: NonCommutativeAdditiveMonoid): NonCommutativeAdditiveMonoid {
  // if (n === 0) return NonCommutativeAdditiveMonoid(0);
  if (n === 0) return 0 as NonCommutativeAdditiveMonoid;
  return multiplySemigroup(n, a);
}

console.log('multiplyMonoid', multiplyMonoid(41, 59));
console.log('multiplyMonoid', multiplyMonoid(0, 59));










function multiplyGroup<NonCommutativeAdditiveGroup extends number>(n: number, a: NonCommutativeAdditiveGroup): NonCommutativeAdditiveGroup {
  if (n < 0) {
    n = -n as NonCommutativeAdditiveGroup;
    // a = NonCommutativeAdditiveGroup(0) - a;
    a = (0 - a) as NonCommutativeAdditiveGroup;
  }
  return multiplyMonoid(n, a);
}

console.log('multiplyAccV4', multiplyGroup(-41, 59));
console.log('multiplyAccV4', multiplyGroup(-41, -59));
