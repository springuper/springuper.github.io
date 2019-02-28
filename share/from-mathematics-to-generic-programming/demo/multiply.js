/**
 * First version
 */
function multiplyV1(n, a) {
    if (n === 1)
        return a; // 1a = a
    return multiplyV1(n - 1, a) + a; // na = (n - 1)a + a
}
console.log('multiplyV1', multiplyV1(5, 3));
/**
 * Second version
 * Egyptian multiplication: 4a = ((a + a) + a) + a = (a + a) + (a + a)
 * In further, 41 * 59 = (2^0 * 59) + (2^3 * 59) + (2^5 * 59) = 59 + 472 + 1888 = 2419
 */
function multiplyV2(n, a) {
    if (n === 1)
        return a;
    var result = multiplyV1(half(n), a + a);
    return odd(n) ? (result + a) : result;
}
function odd(n) {
    return !!(n & 0x1);
}
function half(n) {
    return n >> 1;
}
console.log('multiplyV2', multiplyV2(41, 59));
/**
 * Third version
 * Tail recursion to avoid stack costs
 */
function multiplyV3(r, n, a) {
    if (n === 1)
        return r + a;
    if (odd(n))
        r = r + a;
    return multiplyV3(r, half(n), a + a);
}
console.log('multiplyV3', multiplyV3(0, 41, 59));
/**
 * Fourth version
 * Strict tail recursion
 */
function multiplyV4(r, n, a) {
    if (odd(n)) {
        r = r + a;
        if (n === 1)
            return r;
    }
    n = half(n);
    a = a + a;
    return multiplyV4(r, n, a);
}
console.log('multiplyV4', multiplyV4(0, 41, 59));
/**
 * Fifth version
 * Non-recursion from strict tail recursion
 */
function multiplyV5(r, n, a) {
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
console.log('multiplyV5', multiplyV5(0, 41, 59));
