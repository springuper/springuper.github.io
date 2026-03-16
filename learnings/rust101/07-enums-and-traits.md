# 第 07 章：枚举与 Trait — Rust 的多态之道

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

在 TypeScript 中，我们用 `interface` 和 `type` 来表达多态与抽象；用 `enum` 表示一组常量。Rust 的 `enum` 和 `trait` 与 TS 的概念有交集，但设计哲学和表达能力完全不同。本章带你理解 Rust 的**代数数据类型**和 **Trait 系统**，掌握 Rust 式的多态与代码复用。

---

## 目录

1. [Rust enum vs TS enum —— 完全不同的东西](#1-rust-enum-vs-ts-enum--完全不同的东西)
2. [enum 的强大用法](#2-enum-的强大用法)
3. [Trait —— Rust 的 Interface（但更强大）](#3-trait--rust-的-interface但更强大)
4. [Trait 的进阶用法](#4-trait-的进阶用法)
5. [derive 宏 —— 自动实现 Trait](#5-derive-宏--自动实现-trait)
6. [impl 块详解](#6-impl-块详解)
7. [实战：用 enum + trait 建模支付系统](#7-实战用-enum--trait-建模支付系统)
8. [常见坑](#8-常见坑)
9. [小练习](#9-小练习)

---

## 1. Rust enum vs TS enum —— 完全不同的东西

### 概念引入（从 TS/JS 视角）

在 TypeScript 中，`enum` 本质是**数字或字符串常量**的集合，编译后通常是普通对象或 IIFE：

```typescript
// TS enum：编译后就是对象
enum Color {
  Red,      // 0
  Green,    // 1
  Blue = 2,
}

enum HttpMethod {
  Get = "GET",
  Post = "POST",
}

// 使用
const c: Color = Color.Red;  // 本质是数字 0
const m: HttpMethod = HttpMethod.Get;  // 本质是字符串 "GET"
```

TS 的 `enum` **不能**为不同变体携带不同类型的数据。如果你想表达「不同形状有不同的字段」，需要用 **discriminated union（可辨识联合）** 或 **tagged union**：

```typescript
// 这才是 Rust enum 真正对应的 TS 概念！
type Circle = { kind: "circle"; radius: number };
type Rectangle = { kind: "rect"; width: number; height: number };
type Triangle = { kind: "triangle"; a: number; b: number; c: number };

type Shape = Circle | Rectangle | Triangle;

function area(s: Shape): number {
  switch (s.kind) {
    case "circle":
      return Math.PI * s.radius ** 2;  // TS 能 narrowing 出 radius
    case "rect":
      return s.width * s.height;
    case "triangle":
      const { a, b, c } = s;
      const p = (a + b + c) / 2;
      return Math.sqrt(p * (p - a) * (p - b) * (p - c));
  }
}
```

### Rust 的做法

Rust 的 `enum` 是**代数数据类型（ADT）**：每个变体可以携带不同类型、不同数量的数据。不需要额外的 `kind` 字段，变体本身就是「标签」：

```rust
enum Shape {
    Circle(f64),                    // 一个 f64：半径
    Rectangle(f64, f64),            // 两个 f64：宽、高
    Triangle(f64, f64, f64),        // 三个 f64：三边
}

fn area(s: Shape) -> f64 {
    match s {
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Rectangle(w, h) => w * h,
        Shape::Triangle(a, b, c) => {
            let p = (a + b + c) / 2.0;
            (p * (p - a) * (p - b) * (p - c)).sqrt()
        }
    }
}

fn main() {
    let c = Shape::Circle(3.0);
    let r = Shape::Rectangle(4.0, 5.0);
    println!("{}", area(c));   // 28.27...
    println!("{}", area(r));   // 20.0
}
```

### 背后的 Why

| 对比项 | TypeScript enum | TypeScript Discriminated Union | Rust enum |
|--------|-----------------|--------------------------------|-----------|
| 本质 | 数字/字符串常量 | `{ kind, ...data }` 的对象联合 | ADT，变体即标签+数据 |
| 数据携带 | ❌ 不能 | ✅ 需要手动加 kind 字段 | ✅ 变体直接带数据 |
| 穷尽性检查 | ❌ 无 | ⚠️ switch 可漏 case | ✅ match 必须穷尽 |
| 内存布局 | 分散（对象） | 分散（对象） | 单一块内存，tag + 最大变体 |

**Rust 的 enum 内存布局**：编译器为 enum 分配一块内存，包含一个「tag」区分变体，加上**最大变体**所需的空间。所以 `Shape` 的大小 = tag + `Triangle` 的 3 个 f64。

### 对比表格

| 概念 | TypeScript | Rust |
|------|------------|------|
| 常量枚举 | `enum Color { Red, Green }` | 用 `enum` 无数据变体 |
| 带数据联合 | `type Shape = Circle \| Rect \| ...` + kind | `enum Shape { Circle(f64), ... }` |
| 模式匹配 | `switch (s.kind) { case "circle": ... }` | `match s { Shape::Circle(r) => ... }` |

---

## 2. enum 的强大用法

### 变体的三种形式

Rust enum 的变体可以是：

```rust
enum Message {
    Quit,                           // 无数据（类似 unit type）
    Move { x: i32, y: i32 },        // 结构体型，命名字段
    Write(String),                  // 元组型， positional
    ChangeColor(i32, i32, i32),     // 元组型，多个值
}
```

| 形式 | 语法 | TS 类比 |
|------|------|---------|
| 无数据 | `Quit` | `{ kind: "quit" }` |
| 元组型 | `Write(String)` | `{ kind: "write"; 0: string }` |
| 结构体型 | `Move { x, y }` | `{ kind: "move"; x: number; y: number }` |

### Option<T> 和 Result<T, E> 本身就是 enum

你每天都在用的两个类型，本质就是 enum：

```rust
// 标准库的 Option
enum Option<T> {
    Some(T),
    None,
}

// 标准库的 Result
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

### 用 enum 建模状态机

在 TS 中，我们常用字符串字面量联合表示状态：

```typescript
type State = 'loading' | 'success' | 'error';

// 问题：success 和 error 需要携带数据，但 type 只能做到这一步
type StateWithData =
  | { status: 'loading' }
  | { status: 'success'; data: User }
  | { status: 'error'; message: string };
```

Rust 可以更自然地用 enum 建模，每个变体自带数据：

```rust
enum ApiState {
    Loading,
    Success { data: String },
    Error { message: String },
}

fn handle_state(s: ApiState) {
    match s {
        ApiState::Loading => println!("Loading..."),
        ApiState::Success { data } => println!("Got: {}", data),
        ApiState::Error { message } => eprintln!("Error: {}", message),
    }
}
```

### 实战：用 enum 建模 HTTP 响应

```rust
enum HttpResponse {
    Ok { status: u16, body: String },
    Redirect { status: u16, location: String },
    ClientError { status: u16, message: String },
    ServerError { status: u16, message: String },
}

impl HttpResponse {
    fn status_code(&self) -> u16 {
        match self {
            Self::Ok { status, .. } => *status,
            Self::Redirect { status, .. } => *status,
            Self::ClientError { status, .. } => *status,
            Self::ServerError { status, .. } => *status,
        }
    }

    fn is_success(&self) -> bool {
        match self {
            Self::Ok { .. } => true,
            _ => false,
        }
    }
}
```

---

## 3. Trait —— Rust 的 Interface（但更强大）

### 基本语法：trait 定义 vs TS interface 定义

```typescript
// TS interface：定义「形状」
interface Drawable {
  draw(): void;
}

class Circle implements Drawable {
  draw() {
    console.log("Drawing circle");
  }
}
```

```rust
// Rust trait：定义「能力」
trait Drawable {
    fn draw(&self);
}

struct Circle;

impl Drawable for Circle {
    fn draw(&self) {
        println!("Drawing circle");
    }
}
```

### 没有 class！struct + trait 就是 Rust 的面向对象

Rust 没有 `class`、`extends`、`implements`。你定义 `struct` 存数据，用 `impl Trait for Struct` 赋能力：

```rust
struct Rectangle {
    width: f64,
    height: f64,
}

impl Drawable for Rectangle {
    fn draw(&self) {
        println!("Drawing {}x{} rect", self.width, self.height);
    }
}
```

### Rust 的哲学：组合优于继承

| TypeScript/Java | Rust |
|-----------------|------|
| class A extends B | 无继承，用组合 |
| 多继承困难 | 一个类型可以 impl 多个 trait |
| 菱形继承问题 | 不存在 |

```rust
// 一个 struct 可以实现任意多个 trait
struct Square {
    side: f64,
}

impl Drawable for Square { ... }
impl PartialEq for Square { ... }
impl Debug for Square { ... }
```

---

## 4. Trait 的进阶用法

### 默认实现（default methods）

TS 的 interface **不能**有方法实现（只有 TS 4.2+ 的 `interface { method() { ... } }` 支持有限）。Rust 的 trait 可以有默认实现：

```rust
trait Greet {
    fn greet(&self) -> String;  // 必须实现

    fn greet_loud(&self) -> String {  // 默认实现，可 override
        format!("{}!!!", self.greet().to_uppercase())
    }
}

struct Person(String);

impl Greet for Person {
    fn greet(&self) -> String {
        format!("Hello, I'm {}", self.0)
    }
    // greet_loud 不写也可以，用默认的
}
```

### 关联类型（Associated Types）

比泛型更简洁，表示「这个 trait 和某种类型绑定」：

```rust
trait Iterator {
    type Item;  // 关联类型，每个 impl 确定一个具体类型

    fn next(&mut self) -> Option<Self::Item>;
}

// 使用时不需要写成 Iterator<Item = i32>
impl Iterator for MyIter {
    type Item = i32;
    fn next(&mut self) -> Option<i32> { ... }
}
```

### Trait 作为参数：impl Trait 语法

```rust
fn print_drawable(d: impl Drawable) {
    d.draw();
}
```

等价于泛型 + trait bound：

```rust
fn print_drawable<T: Drawable>(d: T) {
    d.draw();
}
```

### Trait bound（泛型约束）

```rust
fn compare_and_print<T: PartialEq + std::fmt::Display>(a: T, b: T) {
    if a == b {
        println!("Equal: {}", a);
    }
}
```

多重约束用 `+`，复杂时可用 `where`：

```rust
fn process<T, E>(result: Result<T, E>) -> Option<T>
where
    T: Clone + Display,
    E: Debug,
{
    result.ok()
}
```

### 常见的标准库 Trait

| Trait | 用途 | TS 类比 |
|-------|------|---------|
| `Display` | 用户可读的打印 `{}` | `toString()` |
| `Debug` | 调试打印 `{:?}` | `console.log` 对象 |
| `Clone` | 显式克隆 | `{ ...obj }` 浅拷贝 |
| `PartialEq` / `Eq` | `==` / `!=` | 手动写 equals |
| `Default` | 默认值 | 无直接对应 |
| `From` / `Into` | 类型转换 | 构造函数/工厂 |

```rust
use std::fmt::{Display, Debug};

#[derive(Debug, Clone, PartialEq)]
struct User {
    id: u64,
    name: String,
}

impl Display for User {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "User#{} ({})", self.id, self.name)
    }
}

impl Default for User {
    fn default() -> Self {
        User { id: 0, name: "Anonymous".into() }
    }
}
```

---

## 5. derive 宏 —— 自动实现 Trait

### 一行搞定常见 Trait

```rust
#[derive(Debug, Clone, PartialEq, Default)]
struct Config {
    host: String,
    port: u16,
}
```

编译器会自动生成 `Debug`、`Clone`、`PartialEq`、`Default` 的实现。你不需要手写 `toString()`、`equals()`、`clone()`。

### 对比 TS

```typescript
// TS：通常要手写或引库
class Config {
  constructor(public host: string, public port: number) {}
  toString() { return `Config(${this.host}:${this.port})`; }
  equals(other: Config) { return this.host === other.host && this.port === other.port; }
}
// 或用 lodash isEqual、或自己实现
```

### 常用的 derive 列表

| derive | 作用 |
|--------|------|
| `Debug` | `{:?}` 格式化 |
| `Clone` | `.clone()` 深拷贝 |
| `Copy` | 实现 Copy 语义（仅适合简单类型） |
| `PartialEq` | `==` / `!=` |
| `Eq` | 完善等价关系（无浮点） |
| `PartialOrd` / `Ord` | 比较、排序 |
| `Hash` | 用于 HashMap key |
| `Default` | `T::default()` |
| `Serialize` / `Deserialize` | serde 序列化 |

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash, Default)]
struct Id(u64);
```

---

## 6. impl 块详解

### 方法 vs 关联函数

| Rust | TypeScript |
|------|------------|
| `fn method(&self)` | `method() { }` 实例方法 |
| `fn static_method()` 无 self | `static method() { }` 静态方法 |

```rust
struct Counter {
    value: i32,
}

impl Counter {
    // 关联函数（无 self）—— 类似 static method
    fn new() -> Self {
        Counter { value: 0 }
    }

    // 实例方法（有 &self）
    fn get(&self) -> i32 {
        self.value
    }

    fn inc(&mut self) {
        self.value += 1;
    }
}

fn main() {
    let mut c = Counter::new();  // 关联函数调用
    c.inc();
    println!("{}", c.get());     // 实例方法调用
}
```

```typescript
class Counter {
  value = 0;
  static new() { return new Counter(); }
  get() { return this.value; }
  inc() { this.value++; }
}
```

### 多个 impl 块

Rust 允许为同一类型写多个 `impl` 块，便于组织代码：

```rust
impl User {
    fn new(id: u64, name: &str) -> Self {
        User { id, name: name.into() }
    }
}

impl User {
    fn display_name(&self) -> &str {
        &self.name
    }
}
```

### 孤儿规则（Orphan Rule）

可以为「我们的类型」实现「我们定义的 trait」，也可以为「外部类型」实现「我们的 trait」，但**不能**为「外部类型」实现「外部 trait」：

```rust
// ✅ 我们的 struct + 我们的 trait
struct MyType;
trait MyTrait {}
impl MyTrait for MyType {}

// ✅ 我们的 struct + 标准库 trait
impl Display for MyType { ... }

// ✅ 标准库类型 + 我们的 trait
impl MyTrait for String { ... }

// ❌ 标准库类型 + 标准库 trait —— 不允许！
// impl Display for String { ... }  // 编译器报错
```

这样避免多个 crate 对同一类型实现同一 trait 产生冲突。

---

## 7. 实战：用 enum + trait 建模支付系统

```rust
use std::fmt;

// ============ Enum: 支付方式 ============
#[derive(Debug, Clone)]
enum PaymentMethod {
    CreditCard { number: String, expiry: String, cvv: String },
    BankTransfer { account: String, routing: String },
    Crypto { wallet_address: String, network: String },
}

// ============ Trait: 可支付 ============
trait Payable {
    fn pay(&self, amount: f64) -> Result<String, String>;
    fn method_name(&self) -> &str;
}

// ============ 为每种支付方式实现 Payable ============
impl Payable for PaymentMethod {
    fn pay(&self, amount: f64) -> Result<String, String> {
        match self {
            PaymentMethod::CreditCard { number, .. } => {
                if number.len() < 16 {
                    return Err("Invalid card number".into());
                }
                Ok(format!("Charged {} via credit card ***{}", amount, &number[number.len()-4..]))
            }
            PaymentMethod::BankTransfer { account, .. } => {
                Ok(format!("Transferred {} to account {}", amount, account))
            }
            PaymentMethod::Crypto { wallet_address, network } => {
                Ok(format!("Sent {} {} to {}", amount, network, &wallet_address[..8]))
            }
        }
    }

    fn method_name(&self) -> &str {
        match self {
            PaymentMethod::CreditCard { .. } => "CreditCard",
            PaymentMethod::BankTransfer { .. } => "BankTransfer",
            PaymentMethod::Crypto { .. } => "Crypto",
        }
    }
}

impl fmt::Display for PaymentMethod {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.method_name())
    }
}

// ============ 使用 ============
fn process_payment(method: &impl Payable, amount: f64) {
    println!("Processing payment of ${} via {}", amount, method.method_name());
    match method.pay(amount) {
        Ok(msg) => println!("Success: {}", msg),
        Err(e) => eprintln!("Failed: {}", e),
    }
}

fn main() {
    let card = PaymentMethod::CreditCard {
        number: "4111111111111111".into(),
        expiry: "12/25".into(),
        cvv: "123".into(),
    };

    let bank = PaymentMethod::BankTransfer {
        account: "1234567890".into(),
        routing: "021000021".into(),
    };

    let crypto = PaymentMethod::Crypto {
        wallet_address: "0x1234567890abcdef".into(),
        network: "ETH".into(),
    };

    process_payment(&card, 99.99);
    process_payment(&bank, 500.0);
    process_payment(&crypto, 0.05);

    // 无效卡号
    let bad_card = PaymentMethod::CreditCard {
        number: "123".into(),
        expiry: "12/25".into(),
        cvv: "123".into(),
    };
    process_payment(&bad_card, 10.0);
}
```

**输出示例**：
```
Processing payment of $99.99 via CreditCard
Success: Charged 99.99 via credit card ***1111
Processing payment of $500 via BankTransfer
Success: Transferred 500 to account 1234567890
Processing payment of $0.05 via Crypto
Success: Sent 0.05 ETH to 0x123456
Processing payment of $10 via CreditCard
Failed: Invalid card number
```

---

## 8. 常见坑

### 坑 1：混淆 TS enum 和 Rust enum 的语义

```rust
// ❌ 别想着像 TS 一样「enum 就是个数字」
enum Color { Red, Green, Blue }
// let x: i32 = Color::Red;  // 错误！不能隐式转数字
```

Rust 的 enum 是类型安全的，不会隐式转换为整数。

### 坑 2：match 漏掉变体

```rust
enum Direction { Up, Down, Left, Right }

match d {
    Direction::Up => {},
    Direction::Down => {},
    // 漏了 Left, Right —— 编译报错！必须穷尽
}
```

这是好事：编译器逼你处理所有情况。

### 坑 3：trait 对象 vs impl Trait

```rust
// 动态分发：运行时多态，有 vtable 开销
fn take_trait_object(d: &dyn Drawable) { d.draw(); }

// 静态分发：编译时单态化，无额外开销
fn take_impl_trait(d: impl Drawable) { d.draw(); }
```

需要「同一函数里存多种类型」时用 `dyn Trait`；否则 `impl Trait` 更高效。

### 坑 4：Clone vs Copy

```rust
#[derive(Clone, Copy)]  // Copy 包含 Clone 的语义
struct Point { x: i32, y: i32 }

// 含 String 等堆分配类型不能 Copy！
#[derive(Clone)]
// #[derive(Copy)]  // ❌ 编译错误
struct Person { name: String }
```

### 坑 5：孤儿规则导致的「想实现实现不了」

想给 `Vec<T>` 实现 `Display`？不行，Vec 和 Display 都是标准库的。解决办法：用 newtype 包一层：

```rust
struct MyVec(Vec<i32>);
impl fmt::Display for MyVec { ... }
```

---

## 9. 小练习

### 练习 1：用 enum 建模文件操作结果

定义一个 enum `FileOpResult`，变体包括：`Success`（携带读到的字节数）、`NotFound`、`PermissionDenied`（携带路径）。实现一个方法 `is_ok(&self) -> bool`。

<details>
<summary>参考实现</summary>

```rust
enum FileOpResult {
    Success(usize),
    NotFound,
    PermissionDenied(String),
}

impl FileOpResult {
    fn is_ok(&self) -> bool {
        matches!(self, FileOpResult::Success(_))
    }
}
```
</details>

### 练习 2：为自定义类型实现 From

定义 `struct Celsius(f64)` 和 `struct Fahrenheit(f64)`，实现 `From<Fahrenheit> for Celsius`，公式：`C = (F - 32) * 5/9`。然后通过 `Celsius::from(f)` 或 `f.into()` 做转换。

<details>
<summary>参考实现</summary>

```rust
struct Celsius(f64);
struct Fahrenheit(f64);

impl From<Fahrenheit> for Celsius {
    fn from(f: Fahrenheit) -> Self {
        Celsius((f.0 - 32.0) * 5.0 / 9.0)
    }
}

fn main() {
    let f = Fahrenheit(212.0);
    let c: Celsius = f.into();
    println!("{} F = {} C", 212.0, c.0);  // 212 F = 100 C
}
```
</details>

### 练习 3：enum + trait 实现可序列化的配置

定义 `ConfigValue` enum：`String(String)`、`Int(i64)`、`Bool(bool)`、`List(Vec<ConfigValue>)`。实现 `trait Configurable`，要求有方法 `fn to_json(&self) -> String`。用递归处理 `List`。

<details>
<summary>参考实现</summary>

```rust
use std::fmt;

enum ConfigValue {
    String(String),
    Int(i64),
    Bool(bool),
    List(Vec<ConfigValue>),
}

trait Configurable {
    fn to_json(&self) -> String;
}

impl Configurable for ConfigValue {
    fn to_json(&self) -> String {
        match self {
            ConfigValue::String(s) => format!("\"{}\"", s.replace('"', "\\\"")),
            ConfigValue::Int(n) => n.to_string(),
            ConfigValue::Bool(b) => b.to_string(),
            ConfigValue::List(v) => {
                let inner: Vec<String> = v.iter().map(|x| x.to_json()).collect();
                format!("[{}]", inner.join(", "))
            }
        }
    }
}

fn main() {
    let cfg = ConfigValue::List(vec![
        ConfigValue::String("hello".into()),
        ConfigValue::Int(42),
        ConfigValue::Bool(true),
    ]);
    println!("{}", cfg.to_json());  // ["hello", 42, true]
}
```
</details>

---

**下一章预告**：第 08 章将介绍 **集合与迭代器**，学习 Vec、HashMap 以及 Rust 强大的惰性迭代器链，体验零成本抽象的实际威力。
