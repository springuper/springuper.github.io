// TODO find `type` to make generic type shorter
function powerAccSemigroup(r, n, a) {
    while (true) {
        if (odd(n)) {
            r = (r * a);
            if (n === 1)
                return r;
        }
        n = half(n);
        a = (a * a);
    }
}
function powerSemigroup(n, a) {
    if (n === 1)
        return a;
    return powerAccSemigroup(a, half(n - 1), (a * a));
}
function odd(n) {
    return !!(n & 0x1);
}
function half(n) {
    return n >> 1;
}
console.log('powerSemigroup', powerSemigroup(3, 59));
console.log('powerSemigroup', powerSemigroup(1, 59));
function powerMonoid(n, a) {
    // if (n === 0) return MultiplicativeMonoid(1);
    if (n === 0)
        return 1;
    return powerSemigroup(n, a);
}
console.log('powerMonoid', powerMonoid(0, 59));
function powerGroup(n, a) {
    if (n < 0) {
        n = -n;
        // a = MultiplicativeGroup(1) / a
        a = (1 / a);
    }
    return powerMonoid(n, a);
}
console.log('powerGroup', powerGroup(-3, 59));
function operateAccSemigroup(r, n, a, op) {
    while (true) {
        if (odd(n)) {
            r = op(r, a);
            if (n === 1)
                return r;
        }
        n = half(n);
        a = op(a, a);
    }
}
function operateSemigroup(n, a, op) {
    if (n === 1)
        return a;
    return operateAccSemigroup(a, half(n - 1), op(a, a), op);
}
console.log('operateAccSemigroup', operateSemigroup(3, 59, function (a, b) { return a * b; }));
console.log('operateAccSemigroup', operateSemigroup(3, 59, function (a, b) { return a + b; }));
