function multiplyAccV1(r, n, a) {
    while (true) {
        if (odd(n)) {
            r = r + a;
            if (n === 1)
                return r;
        }
        n = half(n);
        a = a + a;
    }
}
function multiplyV1(n, a) {
    if (n === 1)
        return a;
    return multiplyAccV1(a, half(n - 1), a + a);
}
function odd(n) {
    return !!(n & 0x1);
}
function half(n) {
    return n >> 1;
}
console.log('multiplyAccV1', multiplyV1(41, 59));
console.log('multiplyAccV1', multiplyV1(41, '59'));
// TODO find `type` to make generic type shorter
function multiplyAccSemigroup(r, n, a) {
    while (true) {
        if (odd(n)) {
            r = (r + a);
            if (n === 1)
                return r;
        }
        n = half(n);
        a = (a + a);
    }
}
function multiplySemigroup(n, a) {
    if (n === 1)
        return a;
    return multiplyAccSemigroup(a, half(n - 1), (a + a));
}
console.log('multiplySemigroup', multiplySemigroup(41, 59));
function multiplyMonoid(n, a) {
    // if (n === 0) return NonCommutativeAdditiveMonoid(0);
    if (n === 0)
        return 0;
    return multiplySemigroup(n, a);
}
console.log('multiplyMonoid', multiplyMonoid(41, 59));
console.log('multiplyMonoid', multiplyMonoid(0, 59));
function multiplyGroup(n, a) {
    if (n < 0) {
        n = -n;
        // a = NonCommutativeAdditiveGroup(0) - a;
        a = (0 - a);
    }
    return multiplyMonoid(n, a);
}
console.log('multiplyAccV4', multiplyGroup(-41, 59));
console.log('multiplyAccV4', multiplyGroup(-41, -59));
