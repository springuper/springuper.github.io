# 第 11 章：泛型深入 — 从 TS Generics 到 Rust Generics

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

在 TypeScript 中，泛型让我们写出可复用的类型安全代码：`function identity<T>(x: T): T`。Rust 的泛型语法乍看类似，但**编译后的行为完全不同**：TS 泛型在编译后被擦除，而 Rust 泛型会**单态化**为具体类型，实现零运行时开销。本章深入对比两种语言泛型的设计哲学，并掌握 Rust 的生命周期、trait bound、静态/动态分发等进阶概念。

---

## 目录

1. [泛型基础对比](#1-泛型基础对比)
2. [Trait Bound vs TS extends](#2-trait-bound-vs-ts-extends)
3. [impl Trait — 简化的泛型](#3-impl-trait--简化的泛型)
4. [静态分发 vs 动态分发](#4-静态分发-vs-动态分发)
5. [生命周期标注（深入）](#5-生命周期标注深入)
6. [泛型的高级用法](#6-泛型的高级用法)
7. [实战：实现一个泛型缓存结构](#7-实战实现一个泛型缓存结构)
8. [常见坑](#8-常见坑)
9. [小练习](#9-小练习)

---

## 1. 泛型基础对比

### 概念引入（从 TS/JS 视角）

TypeScript 的泛型语法与 Rust 几乎一样：用 `<T>` 声明类型参数。编译后的 JavaScript 会**擦除**泛型信息，运行时只看到普通函数：

```typescript
// TypeScript：泛型函数
function identity<T>(x: T): T {
  return x;
}

function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

// 使用
const n = identity(42);       // T 推断为 number
const s = identity("hello");  // T 推断为 string
const f = first([1, 2, 3]);  // T 推断为 number
```

```javascript
// 编译后的 JavaScript：泛型信息完全消失
function identity(x) {
  return x;
}
function first(arr) {
  return arr[0];
}
```

### Rust 的做法

Rust 泛型语法相同，但**本质不同**：编译器会为每种具体类型**单态化（monomorphization）**，即生成一份专门的机器码：

```rust
fn identity<T>(x: T) -> T {
    x
}

fn first<T>(arr: &[T]) -> Option<&T> {
    arr.first()
}

fn main() {
    let n = identity(42);        // 编译器生成 identity::<i32>
    let s = identity("hello");   // 编译器生成 identity::<&str>
    let f = first(&[1, 2, 3]);   // 编译器生成 first::<i32>
}
```

### 背后的 Why

| 对比项 | TypeScript 泛型 | Rust 泛型 |
|--------|-----------------|-----------|
| 编译后 | **类型擦除**：泛型消失，同一份 JS 代码 | **单态化**：为每种 `T` 生成一份机器码 |
| 运行时 | 所有类型走同一逻辑，无额外开销 | 零抽象开销，等价于手写多份函数 |
| 代码膨胀 | 无 | 可能增大 binary 体积（每种类型一份） |

**单态化** = 为每种具体类型生成专门的代码 = **零运行时开销**。Rust 在编译期「展开」泛型，运行时没有任何虚函数调用或类型检查。

### 代码对比表

```typescript
// TypeScript：一份代码，运行时统一处理
function wrap<T>(value: T): { value: T } {
  return { value };
}
const a = wrap(1);    // { value: 1 }
const b = wrap("hi"); // { value: "hi" }
```

```rust
// Rust：编译后 wrap::<i32> 和 wrap::<&str> 是两份不同的函数
fn wrap<T>(value: T) -> (T,) {
    (value,)
}
let a = wrap(1);    // 调用 wrap::<i32>
let b = wrap("hi"); // 调用 wrap::<&str>
```

---

## 2. Trait Bound vs TS extends

### 概念引入（从 TS/JS 视角）

在 TypeScript 中，用 `extends` 约束泛型类型，表示「T 必须满足某种形状」：

```typescript
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(item: T): void {
  console.log(item.length);
}

logLength("hello");      // ✅ string 有 length
logLength([1, 2, 3]);   // ✅ array 有 length
logLength(42);           // ❌ number 没有 length
```

多个约束用交叉类型 `&`：

```typescript
interface Printable {
  toString(): string;
}

function process<T extends HasLength & Printable>(item: T): void {
  console.log(item.length, item.toString());
}
```

### Rust 的做法

Rust 用 **trait bound** 表达约束：`<T: Trait>` 或 `where T: Trait`：

```rust
use std::fmt::Display;

fn log_length<T: std::fmt::Display>(item: &T) {
    println!("{}", item);
}

// 多个约束用 +
fn compare_and_print<T: Display + Clone>(a: &T, b: &T) {
    let a_clone = a.clone();
    println!("{} vs {}", a_clone, b);
}

// where 子句：复杂约束时更清晰
fn process<T, E>(result: Result<T, E>) -> Option<T>
where
    T: Display + Clone,
    E: std::fmt::Debug,
{
    result.ok()
}
```

### 语法对比

| TypeScript | Rust |
|------------|------|
| `<T extends HasLength>` | `<T: HasLength>` 或 `where T: HasLength` |
| `<T extends A & B>` | `<T: A + B>` |
| 复杂约束 | `where T: A, U: B, T: Clone` |

### 代码对比

```typescript
// TS：extends 约束
function pick<K extends keyof T, T extends object>(obj: T, key: K): T[K] {
  return obj[key];
}
```

```rust
// Rust：where 子句更易读
fn get_field<K, T>(obj: &T, key: K) -> Option<&T::Output>
where
    T: std::ops::Index<K>,
{
    Some(&obj[key])
}
```

---

## 3. impl Trait — 简化的泛型

### 参数位置：匿名泛型

`impl Trait` 是泛型的语法糖，让签名更简洁：

```rust
use std::fmt::Display;

// 等价于 fn print<T: Display>(item: T)
fn print(item: impl Display) {
    println!("{}", item);
}

// 多个参数用 impl Trait 时，每个是独立类型（不能要求相同）
fn print_two(a: impl Display, b: impl Display) {
    println!("{} {}", a, b);
}
```

**注意**：`fn f(a: impl Display, b: impl Display)` 中 `a` 和 `b` 可以是不同类型；若需同类型，必须用泛型 `fn f<T: Display>(a: T, b: T)`。

### 返回位置：隐藏具体类型

```rust
fn make_default() -> impl Display {
    42  // 返回 i32，但调用者只知道「实现了 Display」
}

// 常用于闭包、迭代器等难以写出的类型
fn numbers() -> impl Iterator<Item = i32> {
    (0..10).map(|x| x * 2)
}
```

### 对比 TypeScript

TypeScript **没有**完全对应的语法。`implements` 用于 class，不能用于函数返回。最接近的是返回 `interface`，但 TS 的 interface 是结构化类型，不隐藏具体类型：

```typescript
interface Displayable {
  toString(): string;
}

function makeDefault(): Displayable {
  return 42;  // 可以，number 有 toString
}
// 调用者仍可通过 typeof 等窥探具体类型
```

Rust 的 `impl Trait` 在返回位置**真正隐藏**了具体类型，调用者无法获知是 `i32` 还是别的。

---

## 4. 静态分发 vs 动态分发

### 概念引入（从 TS/JS 视角）

在 TypeScript 中，所有基于 interface 的「多态」都是**动态**的：运行时通过对象的方法表查找，V8 会用 inline cache 优化，但本质仍是间接调用。TS 编译后没有类型信息，无法做编译期静态决议。

### Rust 的两种分发方式

| 方式 | 语法 | 时机 | 开销 |
|------|------|------|------|
| **静态分发** | `impl Trait` / `<T: Trait>` | 编译时 | 零（内联、单态化） |
| **动态分发** | `dyn Trait` | 运行时（vtable） | 一次指针间接 + vtable 查找 |

### 静态分发：零开销抽象

```rust
fn static_dispatch<T: Display>(x: T) {
    println!("{}", x);  // 编译时已确定具体类型，直接调用
}
```

### 动态分发：运行时多态

当需要「同一容器里存多种实现同一 trait 的类型」时，必须用 `dyn Trait`：

```rust
fn dynamic_dispatch(x: &dyn Display) {
    println!("{}", x);  // 通过 vtable 在运行时查找方法
}

// 典型用法：Box<dyn Trait> 在堆上存储 trait object
let shapes: Vec<Box<dyn Display>> = vec![
    Box::new(42),
    Box::new("hello".to_string()),
];
for s in shapes {
    println!("{}", s);
}
```

### 决策指南

| 场景 | 推荐 |
|------|------|
| 单一具体类型、性能敏感 | `impl Trait` / 泛型 |
| 需要 `Vec<多种类型>`、`HashMap<K, 多种 V>` | `Box<dyn Trait>` |
| 递归/自引用结构中的 trait | `Box<dyn Trait>` |
| 异步 trait、闭包返回 | 常需 `Box<dyn>` |

### 对比 TS

TS 中所有 interface 都是「动态」的：运行时通过对象属性查找。但 JS 引擎的优化（如 hidden class、inline cache）使得常见场景性能很好。Rust 给你**选择权**：要零开销就用静态分发，要灵活就用动态分发。

---

## 5. 生命周期标注（深入）

### 为什么生命周期也是泛型的一种

生命周期参数 `'a` 和泛型 `T` 一样，都是**编译期的类型级信息**，用于让编译器验证引用有效性。`'a` 读作「tick a」，表示「某段存活期」。

```rust
// 生命周期和泛型一起出现
fn longest<'a, T>(x: &'a T, y: &'a T) -> &'a T
where
    T: Ord,
{
    if x > y { x } else { y }
}
```

### 函数中的生命周期标注

当返回引用且引用来自参数时，必须显式标注，否则编译器无法推断：

```rust
fn first_of_two<'a>(x: &'a str, _y: &str) -> &'a str {
    x
}

// 多个生命周期
fn mix<'a, 'b>(x: &'a str, y: &'b str) -> &'a str {
    x
}
```

### 结构体中的生命周期标注

当结构体持有引用时，必须声明引用与结构体存活的关联：

```rust
struct Excerpt<'a> {
    text: &'a str,
}

impl<'a> Excerpt<'a> {
    fn new(s: &'a str) -> Self {
        Excerpt { text: s }
    }
}

fn main() {
    let novel = String::from("Call me Ishmael...");
    let excerpt = Excerpt::new(&novel);
    println!("{}", excerpt.text);
}
```

### 生命周期省略规则（Elision Rules）

编译器会根据三条规则自动推断生命周期，只有推断不出时才需手写：

1. **规则 1**：每个引用参数各自获得一个生命周期。  
   `fn f(x: &i32, y: &i32)` → `fn f<'a, 'b>(x: &'a i32, y: &'b i32)`
2. **规则 2**：若只有一个引用参数，其生命周期赋给所有输出。  
   `fn f(x: &i32) -> &i32` → `fn f<'a>(x: &'a i32) -> &'a i32`
3. **规则 3**：若有多个引用参数，但其中一个是 `&self` 或 `&mut self`，则 self 的生命周期赋给所有输出。  
   `fn f(&self, x: &str) -> &str` → `fn f<'a, 'b>(&'a self, x: &'b str) -> &'a str`

### 'static 生命周期

`'static` 表示「活在整个程序期间」，如字符串字面量、全局变量：

```rust
let s: &'static str = "hello";  // 字面量存在二进制中，永远有效
```

### 对比 TypeScript

TypeScript **完全不需要**生命周期：JS 的 GC 管理所有对象的存活，引用不会悬垂。Rust 无 GC，必须由编译器在编译期验证引用的有效性，因此需要生命周期标注。

---

## 6. 泛型的高级用法

### 关联类型 vs 泛型参数

| 关联类型 `type Item` | 泛型参数 `<T>` |
|---------------------|----------------|
| 一个实现对应一种类型 | 一个实现可对应多种类型 |
| 使用简单：`Iterator` 而非 `Iterator<T>` | 使用时必须指定：`Add<i32, Output=i32>` |
| 例：`Iterator::Item` | 例：`Add<Rhs>` |

```rust
// 关联类型：每个类型实现一次，Item 唯一
trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
}

// 泛型参数：可为不同 Rhs 实现多次
trait Add<Rhs = Self> {
    type Output;
    fn add(self, rhs: Rhs) -> Self::Output;
}

impl Add for i32 {
    type Output = i32;
    fn add(self, rhs: i32) -> i32 {
        self + rhs
    }
}

impl Add<f64> for i32 {
    type Output = f64;
    fn add(self, rhs: f64) -> f64 {
        self as f64 + rhs
    }
}
```

### PhantomData — 类型级别的标记

当需要在类型上「携带」一个类型信息，但不实际存储该类型的值时，用 `PhantomData`：

```rust
use std::marker::PhantomData;

struct Container<T> {
    // 不实际持有 T，但让 Container 在类型上「依赖」T
    _marker: PhantomData<T>,
}

impl<T> Container<T> {
    fn new() -> Self {
        Container {
            _marker: PhantomData,
        }
    }
}
```

常见于：未使用但需要满足 trait、协变/逆变标记、单位类型等。

### Turbofish `::<>` 语法

当编译器无法推断泛型参数时，用 `::<...>` 显式指定：

```rust
let v = vec![1, 2, 3];
let chunks: Vec<Vec<i32>> = v.chunks(2).map(|c| c.to_vec()).collect();

// turbofish：指定 collect 的目标类型
let nums: Vec<i32> = (0..5).collect::<Vec<_>>();
let _: Option<i32> = "123".parse::<i32>().ok();
```

---

## 7. 实战：实现一个泛型缓存结构

实现一个支持 TTL（过期时间）的泛型缓存 `Cache<K, V>`，对比 TS 与 Rust 实现。

### TypeScript 版本

```typescript
interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

class Cache<K, V> {
  private store = new Map<K, CacheEntry<V>>();
  private defaultTTL: number;

  constructor(defaultTTLMs: number = 60000) {
    this.defaultTTL = defaultTTLMs;
  }

  set(key: K, value: V, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  clear(): void {
    this.store.clear();
  }
}

const cache = new Cache<string, number>(5000);
cache.set("a", 1);
console.log(cache.get("a")); // 1
```

### Rust 版本

```rust
use std::collections::HashMap;
use std::hash::Hash;
use std::time::{Duration, Instant};

struct CacheEntry<V> {
    value: V,
    expires_at: Instant,
}

pub struct Cache<K, V> {
    store: HashMap<K, CacheEntry<V>>,
    default_ttl: Duration,
}

impl<K, V> Cache<K, V>
where
    K: Eq + Hash + Clone,
{
    pub fn new(default_ttl: Duration) -> Self {
        Cache {
            store: HashMap::new(),
            default_ttl,
        }
    }

    pub fn set(&mut self, key: K, value: V, ttl: Option<Duration>) {
        let ttl = ttl.unwrap_or(self.default_ttl);
        self.store.insert(key, CacheEntry {
            value,
            expires_at: Instant::now() + ttl,
        });
    }

    pub fn get(&mut self, key: &K) -> Option<&V> {
        let entry = self.store.get(key)?;
        if Instant::now() > entry.expires_at {
            self.store.remove(key);
            return None;
        }
        Some(&entry.value)
    }

    pub fn clear(&mut self) {
        self.store.clear();
    }
}

fn main() {
    let mut cache = Cache::new(Duration::from_secs(5));
    cache.set("a".to_string(), 42, None);
    println!("{:?}", cache.get(&"a".to_string())); // Some(42)
}
```

### 对比要点

| 对比项 | TypeScript | Rust |
|--------|------------|------|
| 泛型约束 | `K` 通常可任意，Map 内部处理 | `K: Eq + Hash` 必须满足 HashMap 要求 |
| TTL | `Date.now()` | `Instant::now()` + `Duration` |
| 过期清理 | 惰性删除（get 时检查） | 同样方式，也可加后台清理 |
| 类型安全 | 编译期检查 | 编译期 + 无 null/undefined |

---

## 8. 常见坑

### 坑 1：impl Trait 参数不能要求两个参数同类型

```rust
// ❌ 这样写 a 和 b 可以是不同类型
fn same_type_bad(a: impl Display, b: impl Display) { ... }

// ✅ 需要同类型时用泛型
fn same_type_ok<T: Display>(a: T, b: T) { ... }
```

### 坑 2：dyn Trait 有 trait 对象安全限制

不是所有 trait 都能做 `dyn Trait`。例如：
- 返回 `Self` 的方法不行（sizeof 未知）
- 泛型方法太多会让 vtable 爆炸

```rust
trait Bad {
    fn clone_me(&self) -> Self;  // 不能做 dyn Bad
}
```

### 坑 3：生命周期省略猜错

编译器按规则推断，有时推断结果不符合预期，需要显式标注：

```rust
// 若编译器报错，试着加生命周期
fn problematic<'a>(x: &'a str, y: &str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

### 坑 4：单态化导致代码膨胀

泛型用得过多会显著增大二进制体积。对冷路径或不敏感部分，可考虑 `dyn Trait` 减少单态化。

### 坑 5：where 子句顺序

`where` 中的约束顺序一般不影响语义，但可读性上建议：先生命周期，再 trait bound，最后类型约束。

---

## 9. 小练习

### 练习 1：泛型 pair 交换

实现泛型函数 `swap<T>(a: T, b: T) -> (T, T)`，返回 `(b, a)`。在 TS 和 Rust 中各实现一次，体会单态化与类型擦除的差异。

<details>
<summary>参考实现（Rust）</summary>

```rust
fn swap<T>(a: T, b: T) -> (T, T) {
    (b, a)
}

fn main() {
    let (x, y) = swap(1, 2);
    println!("{} {}", x, y);  // 2 1
}
```
</details>

### 练习 2：带 trait bound 的泛型 min

实现 `fn min_by_length<T>(a: T, b: T) -> T where T: AsRef<str>`，返回 `AsRef<str>` 后长度更短的那个。思考：为什么用 `AsRef<str>` 而不是 `&str`？

<details>
<summary>参考实现</summary>

```rust
fn min_by_length<T>(a: T, b: T) -> T
where
    T: AsRef<str>,
{
    if a.as_ref().len() <= b.as_ref().len() {
        a
    } else {
        b
    }
}

fn main() {
    let s1 = String::from("hi");
    let s2 = String::from("hello");
    println!("{}", min_by_length(s1, s2));  // hi
}
```

用 `AsRef<str>` 可以接受 `String`、`&str`、`Cow<str>` 等，更通用。
</details>

### 练习 3：Cache 扩展 — 支持 get_or_insert

为上面的 `Cache<K, V>` 添加方法 `get_or_insert(&mut self, key: K, f: impl FnOnce() -> V) -> &V`，当 key 不存在或已过期时用 `f()` 计算并插入。注意 Rust 中借用的处理。

<details>
<summary>参考实现</summary>

```rust
pub fn get_or_insert(&mut self, key: K, f: impl FnOnce() -> V) -> &V
where
    K: Eq + Hash + Clone,
{
    if self.get(&key).is_none() {
        self.set(key.clone(), f(), None);
    }
    // 需要再查一次才能返回引用；实际项目中可用 entry API 优化
    self.store.get(&key).map(|e| &e.value).unwrap()
}
```

更优写法可用 `HashMap::entry` 避免两次查找，读者可自行尝试。
</details>

---

**下一章预告**：第 12 章将介绍 **智能指针**，学习 Box、Rc、Arc、RefCell 等，理解 Rust 在堆分配和共享所有权上的精细控制。
