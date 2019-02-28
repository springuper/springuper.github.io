// TODO find `type` to make generic type shorter
function powerAccSemigroup<MultiplicativeSemigroup extends number>(r: MultiplicativeSemigroup, n: number, a: MultiplicativeSemigroup): MultiplicativeSemigroup {
  while (true) {
    if (odd(n)) {
      r = (r * a) as MultiplicativeSemigroup;
      if (n === 1) return r;
    }
    n = half(n);
    a = (a * a) as MultiplicativeSemigroup;
  }
}

function powerSemigroup<MultiplicativeSemigroup extends number>(n: number, a: MultiplicativeSemigroup): MultiplicativeSemigroup {
  if (n === 1) return a;
  return powerAccSemigroup(a, half(n - 1), (a * a) as MultiplicativeSemigroup);
}

function odd(n: number): boolean {
  return !!(n & 0x1);
}
function half(n: number): number {
  return n >> 1;
}

console.log('powerSemigroup', powerSemigroup(3, 59));
console.log('powerSemigroup', powerSemigroup(1, 59));










function powerMonoid<MultiplicativeMonoid extends number>(n: number, a: MultiplicativeMonoid): MultiplicativeMonoid {
  // if (n === 0) return MultiplicativeMonoid(1);
  if (n === 0) return 1 as MultiplicativeMonoid;
  return powerSemigroup(n, a);
}

console.log('powerMonoid', powerMonoid(0, 59));










function powerGroup<MultiplicativeGroup extends number>(n: number, a: MultiplicativeGroup): MultiplicativeGroup {
  if (n < 0) {
    n = -n;
    // a = MultiplicativeGroup(1) / a
    a = (1 / a) as MultiplicativeGroup;
  }
  return powerMonoid(n, a);
}

console.log('powerGroup', powerGroup(-3, 59));










interface Operation<T> {
  (a: T, b: T) : T;
}
function operateAccSemigroup<Semigroup extends number>(r: Semigroup, n: number, a: Semigroup, op: Operation<Semigroup>): Semigroup {
  while (true) {
    if (odd(n)) {
      r = op(r, a);
      if (n === 1) return r;
    }
    n = half(n);
    a = op(a, a);
  }
}

function operateSemigroup<Semigroup extends number>(n: number, a: Semigroup, op: Operation<Semigroup>): Semigroup {
  if (n === 1) return a;
  return operateAccSemigroup(a, half(n - 1), op(a, a), op);
}

console.log('operateAccSemigroup', operateSemigroup(3, 59, (a: number, b: number) => a * b));
console.log('operateAccSemigroup', operateSemigroup(3, 59, (a: number, b: number) => a + b));
