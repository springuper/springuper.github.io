# 第 09 章：闭包与函数 —— 从「一切皆对象」到「一切皆表达式」

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

**函数和闭包是 Rust 与 TypeScript 差异最鲜明的领域之一。** 在 TS/JS 中，函数是「一等公民」，闭包靠 GC 自动管理引用；在 Rust 中，函数需要显式类型，闭包则是「匿名 struct + trait 实现」，由编译器根据捕获方式自动推断 `Fn`/`FnMut`/`FnOnce`。理解这套体系，你才能真正驾驭 Rust 的高阶抽象和异步编程。本章将带你从 TS 视角平滑过渡到 Rust 的函数与闭包世界。

---

## 目录

1. [函数基础](#1-函数基础)
2. [闭包（Closures）](#2-闭包closures)
3. [闭包捕获语义 —— Fn / FnMut / FnOnce](#3-闭包捕获语义--fn--fnmut--fnonce)
4. [move 关键字](#4-move-关键字)
5. [函数作为参数（高阶函数）](#5-函数作为参数高阶函数)
6. [函数作为返回值](#6-函数作为返回值)
7. [实战：实现一个简单的中间件管道](#7-实战实现一个简单的中间件管道)
8. [常见坑](#8-常见坑)
9. [小练习](#9-小练习)

---

## 1. 函数基础

### fn 语法 vs function / 箭头函数

#### 概念引入（从 TS/JS 视角）

在 TypeScript/JavaScript 中，函数有多种定义方式：

```typescript
// 函数声明
function add(a: number, b: number): number {
  return a + b;
}

// 箭头函数（表达式）
const add2 = (a: number, b: number): number => a + b;

// 函数作为值传递
const fn: (x: number) => number = (x) => x * 2;
```

#### Rust 的做法

Rust 使用 `fn` 关键字，语法更统一：

```rust
// 函数定义：fn 函数名(参数: 类型, ...) -> 返回类型
fn add(a: i32, b: i32) -> i32 {
    a + b  // 最后一个表达式自动返回，注意：没有分号！
}

fn add_with_return(a: i32, b: i32) -> i32 {
    return a + b;  // 显式 return 也可以
}
```

#### 参数类型必须标注

与 TypeScript 不同，Rust 函数参数**必须**标注类型，没有隐式 `any`：

```typescript
// TypeScript: 可以省略类型（隐式 any）
function greet(name) {
  return `Hello, ${name}`;
}
```

```rust
// Rust: 参数类型必须写清楚，编译器不会替你猜
fn greet(name: &str) -> String {
    format!("Hello, {}", name)
}
```

#### 返回值：表达式 vs 语句

**这是 Rust 与 TS 的核心差异之一。** Rust 中「一切皆表达式」，块 `{}` 的最后一个表达式（无分号）自动成为返回值：

```typescript
// TypeScript: return 是语句，必须显式写
function double(x: number): number {
  return x * 2;  // 必须 return
}
```

```rust
// Rust: 最后一个表达式自动返回（没有分号）
fn double(x: i32) -> i32 {
    x * 2   // 这是表达式，自动返回
}

// 加分号就变成语句了，返回 ()
fn wrong(x: i32) -> i32 {
    x * 2;  // 分号！这是语句，块返回 ()
}           // 编译错误：期待 i32，得到 ()
```

#### 表达式 vs 语句的区别

| 概念 | TypeScript/JavaScript | Rust |
|------|------------------------|------|
| 表达式 | 产生值（如 `1+2`、`x`、箭头函数体） | **几乎一切都是表达式**：`if`、`match`、`loop`、块 `{}` 都产生值 |
| 语句 | 执行操作，不返回值 | 只有少数是纯语句：`let`、`;` 结尾的表达式 |
| 返回值 | 必须 `return` | 最后表达式无分号即返回 |
| `if` 作为表达式 | `condition ? a : b`（三元） | `if cond { a } else { b }` 整个是表达式 |

```rust
// Rust: if 是表达式
let y = if x > 0 { 1 } else { -1 };

// match 也是表达式
let msg = match status {
    200 => "OK",
    404 => "Not Found",
    _ => "Unknown",
};
```

#### 代码对比表格

| 特性 | TypeScript | Rust |
|------|------------|------|
| 函数关键字 | `function` / `=>` | `fn` |
| 参数类型 | 可选，可隐式 any | **必须**标注 |
| 返回值 | `return value` | 最后表达式无分号，或 `return value` |
| 块 `{}` | 不自动返回值 | 最后一个表达式即返回值 |
| `if` 返回值 | 需三元运算符 | `if/else` 块本身就是表达式 |

---

## 2. 闭包（Closures）

### 语法对比

#### 概念引入（从 TS/JS 视角）

在 TypeScript 中，闭包就是「能捕获外部变量的函数」：

```typescript
const multiplier = (factor: number) => (x: number) => x * factor;

const double = multiplier(2);
const triple = multiplier(3);
console.log(double(5));  // 10
console.log(triple(5));  // 15
```

#### Rust 的做法

Rust 闭包语法：`|参数| 表达式` 或 `|参数| { 语句; 表达式 }`：

```rust
// |x| x + 1  —— 类似 TS 的 (x) => x + 1
let add_one = |x| x + 1;
let result = add_one(5);  // 6

// 多参数
let add = |a, b| a + b;

// 多行体
let greet = |name: &str| {
    let msg = format!("Hello, {}!", name);
    println!("{}", msg);
    msg
};
```

#### 类型推断：闭包参数可省略类型

**关键差异**：普通函数参数必须标注类型，但**闭包参数可以省略**，编译器会从首次调用推断：

```rust
fn add(a: i32, b: i32) -> i32 { a + b }  // 必须写类型

let closure_add = |a, b| a + b;  // 可以省略！
let x = closure_add(1i32, 2);    // 编译器推断 a, b 为 i32
```

#### 闭包本质上是什么？

在 Rust 中，**每个闭包都是一个独特的匿名类型**，该类型实现了 `Fn`、`FnMut` 或 `FnOnce` 之一（或多个）。可以粗略理解为：

- **闭包 ≈ 匿名 struct + trait 实现**
- 闭包捕获的变量成为这个 struct 的字段
- 调用闭包就是调用 trait 的 `call` 方法

```rust
// 概念上等价于（伪代码）：
struct MyClosure {
    captured_var: i32,
}
impl FnOnce<(i32,)> for MyClosure {
    type Output = i32;
    fn call_once(self, x: i32) -> i32 {
        x + self.captured_var
    }
}
```

#### 对比 JS：简单粗暴 vs 精细控制

| 方面 | JavaScript | Rust |
|------|------------|------|
| 捕获方式 | 总是捕获「引用」，可随意读改 | 分三种：`Fn`（只读）、`FnMut`（可改）、`FnOnce`（消费） |
| 类型 | 闭包都是 `Function` | 每个闭包是**不同的类型** |
| 内存管理 | GC 管理，不用管生命周期 | 编译器根据捕获推断，需 `move` 时显式写 |
| 多线程 | 需小心共享可变状态 | `move` + `'static` 才能跨线程 |

---

## 3. 闭包捕获语义 —— Fn / FnMut / FnOnce

**这是 Rust 独有的概念，是理解闭包的关键。** 在 JS 中，闭包一律捕获引用，想改就改；Rust 根据「你怎么用捕获的变量」来区分三种 trait。

### 三种 Trait 的含义

| Trait | 捕获方式 | 能否多次调用 | 典型场景 |
|-------|----------|--------------|----------|
| **Fn** | 不可变借用 `&T` | 可多次 | 只读外部变量 |
| **FnMut** | 可变借用 `&mut T` | 可多次 | 修改外部变量（如累加器） |
| **FnOnce** | 获取所有权 `T` | **只能调用一次** | 消费掉某个值（如 `Option::take()`） |

### Fn：只读捕获

```rust
let x = 10;
let read_only = |a| a + x;  // 只读 x，实现 Fn
println!("{}", read_only(1));  // 11
println!("{}", read_only(2));  // 12，可多次调用
```

### FnMut：可变捕获

```rust
let mut counter = 0;
let mut inc = || {
    counter += 1;  // 修改捕获的变量，实现 FnMut
    counter
};
println!("{}", inc());  // 1
println!("{}", inc());  // 2
```

### FnOnce：消费捕获

```rust
let s = String::from("hello");
let consume = || {
    println!("{}", s);  // 消费 s（所有权转移进闭包）
    // s 在此之后不能再被使用
};
consume();
// consume();  // 编译错误：FnOnce 只能调用一次！
```

### 为什么需要这三种？回到所有权和借用！

Rust 没有 GC，必须明确：
- 谁可以**读**（`&T`）→ `Fn`
- 谁可以**写**（`&mut T`）→ `FnMut`
- 谁**拥有**（`T`）→ `FnOnce`

JS 闭包总是捕获引用，可以随意修改——方便但不安全，共享可变状态容易出 bug。Rust 通过类型系统把「捕获语义」编码进去，编译期就帮你排除数据竞争。

### 包含关系：FnOnce > FnMut > Fn

```
Fn  ⊂  FnMut  ⊂  FnOnce
```

- 实现了 `Fn` 的闭包，一定也实现了 `FnMut` 和 `FnOnce`
- 实现了 `FnMut` 的闭包，一定也实现了 `FnOnce`
- 接受 `FnOnce` 的函数最宽松，可接受三种闭包
- 接受 `Fn` 的函数最严格，只接受「只读」闭包

---

## 4. move 关键字

### 强制闭包获取所有权

默认情况下，编译器会根据闭包体中的使用方式推断捕获方式。但有时你需要**强制**闭包拿走变量的所有权，这时用 `move`：

```rust
let s = String::from("hello");
let closure = move || println!("{}", s);
// s 的所有权已移入 closure，此处不能再使用 s
closure();
```

### 最常见场景：多线程和异步

```rust
use std::thread;

let data = vec![1, 2, 3];
// 必须 move！否则 data 的引用可能在线程启动后才被借用，生命周期对不上
let handle = thread::spawn(move || {
    println!("{:?}", data);  // 线程需要拥有 data
});
handle.join().unwrap();
```

在异步和 `thread::spawn` 中，闭包往往需要 `'static` 生命周期——即不能持有临时引用，只能持有所有权。`move` 把捕获的变量「搬进」闭包，满足 `'static` 要求。

### 对比 JS：不需要 move

JS 有 GC，闭包持有引用时，只要还有闭包活着，变量就不会被回收。Rust 没有 GC，必须显式通过 `move` 表示「我要把这个值移进闭包」。

---

## 5. 函数作为参数（高阶函数）

#### 概念引入（从 TS/JS 视角）

```typescript
function map<T, U>(arr: T[], callback: (x: T) => U): U[] {
  return arr.map(callback);
}
```

#### Rust 的做法

接受闭包时，用 `impl Fn`（静态分发）或 `dyn Fn`（动态分发）：

```rust
fn apply_twice<F>(f: F, x: i32) -> i32
where
    F: Fn(i32) -> i32,  // F 是「实现 Fn(i32) -> i32 的类型」
{
    f(f(x))
}

let result = apply_twice(|x| x * 2, 5);  // 20
```

**impl Fn vs dyn Fn**（简要）：

| 写法 | 分发方式 | 特点 |
|------|----------|------|
| `impl Fn(i32) -> i32` | 静态分发（单态化） | 零成本，编译期确定类型，可内联 |
| `dyn Fn(i32) -> i32` | 动态分发（虚表） | 需要 `Box` 或引用，有少量运行时开销 |
| `&dyn Fn(...)` | 动态分发 | 借用一个 trait object |

```rust
// 静态分发：每个不同的 F 会生成不同版本的函数
fn static_dispatch(f: impl Fn(i32) -> i32, x: i32) -> i32 {
    f(x)
}

// 动态分发：统一用 trait object
fn dynamic_dispatch(f: &dyn Fn(i32) -> i32, x: i32) -> i32 {
    f(x)
}
```

---

## 6. 函数作为返回值

### 为什么不能直接返回闭包？

在 Rust 中，**每个闭包都是不同的类型**。函数返回类型必须固定，所以不能直接写「返回某个闭包」—— 编译器不知道具体类型。

```rust
// 错误！每个闭包类型不同
fn make_adder(n: i32) -> ??? {
    |x| x + n
}
```

### 正确方式：Box&lt;dyn Fn&gt; 或 impl Fn

```rust
// 方式 1：Box<dyn Fn> —— 堆分配，动态分发
fn make_adder(n: i32) -> Box<dyn Fn(i32) -> i32> {
    Box::new(move |x| x + n)
}

// 方式 2：impl Fn —— 静态分发，零成本
fn make_adder_impl(n: i32) -> impl Fn(i32) -> i32 {
    move |x| x + n
}

let add5 = make_adder(5);
println!("{}", add5(10));  // 15
```

### 对比 TS：轻松返回函数

```typescript
function makeAdder(n: number) {
  return (x: number) => x + n;  // 直接返回，无需 Box
}
```

Rust 需要 `Box` 或 `impl Trait`，是因为类型系统要求返回类型在编译期可知；闭包是匿名类型，必须通过 trait 抽象或装箱才能作为返回类型。

---

## 7. 实战：实现一个简单的中间件管道

类似 Express 的 `middleware` 链：每个中间件是一个函数，接收「下一层」并返回新的处理逻辑。

### TypeScript 版本

```typescript
type Next = () => void;
type Middleware = (next: Next) => Next;

const logger: Middleware = (next) => () => {
  console.log("Request started");
  next();
  console.log("Request ended");
};

const timer: Middleware = (next) => () => {
  const start = Date.now();
  next();
  console.log(`Took ${Date.now() - start}ms`);
};

function compose(middlewares: Middleware[]): Next {
  return middlewares.reduceRight<Next>(
    (next, mw) => mw(next),
    () => {}
  );
}

const pipeline = compose([logger, timer]);
pipeline();  // Request started / Took Xms / Request ended
```

### Rust 版本

```rust
type Next = Box<dyn Fn()>;
type Middleware = Box<dyn Fn(Next) -> Next>;

fn logger(next: Next) -> Next {
    Box::new(move || {
        println!("Request started");
        next();
        println!("Request ended");
    })
}

fn timer(next: Next) -> Next {
    Box::new(move || {
        let start = std::time::Instant::now();
        next();
        println!("Took {:?}", start.elapsed());
    })
}

fn compose(middlewares: Vec<Middleware>) -> Next {
    middlewares
        .into_iter()
        .rfold(Box::new(|| {}) as Next, |acc, mw| mw(acc))
}

fn main() {
    let pipeline = compose(vec![
        Box::new(logger),
        Box::new(timer),
    ]);
    pipeline();  // Request started / Took Xms / Request ended
}
```

这里用 `Box<dyn Fn>` 是因为：
1. 每个中间件返回的闭包类型不同，需要 trait object 统一
2. `Next` 是「无参无返回」的闭包，`Box<dyn Fn()>` 表示堆上分配的闭包
3. `move` 确保闭包捕获的 `next` 所有权正确转移

---

## 8. 常见坑

### 坑 1：最后一个表达式加了分号

```rust
fn bad() -> i32 {
    42;  // 分号让它变成语句，块返回 ()
}
// error: expected `i32`, found `()`
```

### 坑 2：闭包推断出 FnOnce，却需要多次调用

```rust
let s = String::from("hi");
let f = || s;  // 消费 s，FnOnce
f();           // OK
f();           // error: use of moved value
```

需要多次调用时，应让闭包只借用电非消费，或 clone。

### 坑 3：在线程中捕获引用忘记 move

```rust
let x = 1;
std::thread::spawn(|| println!("{}", x));
// error: closure may outlive `x`
// 正确：std::thread::spawn(move || println!("{}", x));
```

### 坑 4：返回闭包时捕获的变量生命周期

```rust
fn bad() -> impl Fn(i32) -> i32 {
    let n = 1;
    move |x| x + n  // n 被 move 进闭包，OK
}
// 若返回 &n 或借用了局部变量，则生命周期错误
```

---

## 9. 小练习

### 练习 1：实现一个 `filter_map`

写一个函数 `filter_map<T, U, F>(v: Vec<T>, f: F) -> Vec<U>`，其中 `f: impl Fn(T) -> Option<U>`。对 `v` 中每个元素调用 `f`，若返回 `Some(u)` 则收集 `u`，若 `None` 则跳过。等价于 `iter.filter_map(f).collect()` 的手动实现。

<details>
<summary>参考答案</summary>

```rust
fn filter_map<T, U, F>(v: Vec<T>, f: F) -> Vec<U>
where
    F: Fn(T) -> Option<U>,
{
    v.into_iter().filter_map(f).collect()
}
```

</details>

### 练习 2：闭包类型推断

下面代码是否能编译？为什么？

```rust
let f = |x| x + 1;
let a = f(1);
let b = f(1.0);
```

<details>
<summary>参考答案</summary>

不能。闭包在**首次调用**时确定参数类型。`f(1)` 推断出 `x: i32`，则 `f` 的类型固定为 `Fn(i32) -> i32`，再调用 `f(1.0)` 会类型不匹配。

</details>

### 练习 3：写出 Fn / FnMut / FnOnce

分别写三个闭包：一个只读 `Vec` 长度，一个向 `Vec` 推入元素，一个消费 `Vec` 并返回其长度。体会三种 trait 的差异。

<details>
<summary>参考答案</summary>

```rust
let v = vec![1, 2, 3];

// Fn: 只读
let read_len = || v.len();

// FnMut: 可修改（需要 mut v）
let mut v2 = vec![1, 2, 3];
let mut push = || v2.push(4);

// FnOnce: 消费
let consume = || {
    let v3 = vec![1, 2, 3];
    v3.len()
};
```

</details>

---

*下一章预告：第 10 章——生命周期与引用，深入理解 Rust 的借用检查与 `'a` 语法。*
