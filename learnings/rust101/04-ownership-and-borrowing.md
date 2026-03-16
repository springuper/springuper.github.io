# 第 04 章：所有权与借用 —— Rust 的核心创新

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

**本章是 Rust 学习中最重要的一章。** 所有权系统是 Rust 区别于其他语言的标志性特性，理解它是掌握 Rust 的关键。请放慢速度，反复咀嚼每个概念。

---

## 目录

1. [为什么 GC 不够好](#1-为什么-gc-不够好)
2. [所有权三条规则](#2-所有权三条规则)
3. [Move 语义 —— 最让 TS 工程师困惑的地方](#3-move-语义--最让-ts-工程师困惑的地方)
4. [借用（Borrowing）—— 不转移所有权的访问](#4-借用borrowing--不转移所有权的访问)
5. [String vs &str —— 把所有权概念落到实处](#5-string-vs-str--把所有权概念落到实处)
6. [生命周期（Lifetime）初步](#6-生命周期lifetime初步)
7. [常见编译错误实战](#7-常见编译错误实战)
8. [小练习](#8-小练习)

---

## 1. 为什么 GC 不够好

### 概念引入（从 TS/JS 视角）

作为 Node.js 开发者，你每天都在用 V8 引擎。V8 的垃圾回收器（GC）负责自动管理内存，让你不用手动 `malloc`/`free`。但 GC 并非完美，理解它的工作方式，能让你明白 Rust 为什么要「另辟蹊径」。

### Node.js V8 GC 工作方式简述

V8 使用**分代 GC**（Generational GC），将堆分为两个区域：

| 区域 | 名称 | 存放对象 | GC 算法 | 特点 |
|------|------|----------|---------|------|
| 新生代 | Young Generation | 新创建的对象 | **Scavenge**（Minor GC）| 快，频率高，复制算法 |
| 老生代 | Old Generation | 存活较久的对象 | **Mark-Sweep**（Major GC）| 慢，频率低，全堆扫描 |

**Minor GC（Scavenge）**：
- 新生代空间小（通常几 MB），采用复制算法
- 将存活对象复制到另一半空间，清空当前半区
- 执行快，通常几毫秒

**Major GC（Mark-Sweep）**：
- 全堆标记活跃对象，然后清扫未标记的
- 需要暂停主线程（Stop-The-World）
- 堆越大，暂停时间越长，可能达到几十甚至上百毫秒

```typescript
// Node.js 中，你无法控制 GC 何时触发
const bigArray = new Array(1000000).fill({ data: "x" });
// GC 可能在某个不确定的时刻扫描并回收
```

### GC 的三大代价

#### 1. 不可预测的暂停

GC 必须暂停应用才能安全地扫描和移动对象。你**无法预知**下一次 Major GC 何时发生，暂停多久。

#### 2. 内存开销（通常 2–3x 实际使用量）

| 开销来源 | 说明 |
|----------|------|
| 对象头 | 每个对象都有类型信息、标记位等元数据 |
| 分代空间 | 复制算法需要预留另一块空间 |
| 碎片化 | 长期运行后堆可能碎片化，需要额外空间 |
| 保守估计 | V8 倾向于多分配，避免频繁触发 GC |

#### 3. 无法精确控制释放时机

```typescript
// 你想「用完就释放」？抱歉，你说了不算
function processRequest() {
  const buffer = Buffer.alloc(1024 * 1024); // 1MB
  // 用完后，buffer 何时释放？GC 决定，不是你说的
  doSomething(buffer);
  // 函数返回后，buffer 变成垃圾，但可能很久后才被回收
}
```

### 实战场景：高并发 Node.js 服务的 GC Pause

设想一个高并发的 API 服务：

```typescript
// 典型的 Express/Koa 服务
const app = express();

app.get("/api/data", async (req, res) => {
  const data = await fetchFromDB();  // 可能分配大量临时对象
  const result = transform(data);    // 又产生一批中间对象
  res.json(result);
});

// 每秒 1000 QPS，每个请求分配若干 KB 到 MB
// 堆快速增长，Major GC 被触发
// 某几个请求的 P99 延迟从 50ms 突然飙升到 300ms
// 监控图出现「毛刺」，用户体验卡顿
```

**问题的本质**：你无法在业务层面保证「这个请求的延迟不受 GC 影响」。GC 是全局的、不可控的。

### Rust 的回应

Rust 通过**所有权系统**，在编译时确定每个值的生命周期，离开作用域时**立即、确定性地**释放。无 GC，无暂停，无额外内存开销。

---

## 2. 所有权三条规则

### 核心类比：房产证

想象 Rust 中的每个值是一栋房子，所有权就是**房产证**：

- **一个房子只有一个房产证**，不能复印、不能共享
- **房产证持有人可以转移**，但转移后原持有人就没了
- **房子被拆（离开作用域）时**，必须由当前 holder 负责，不能悬空

这就是 Rust 所有权的直觉。

### 规则 1：每个值都有一个「所有者」（owner）

每个值在任意时刻都有一个明确的所有者，通常就是**创建它的变量**。

```rust
fn main() {
    let s = String::from("hello");  // s 是 "hello" 的所有者
    let n = 42;                      // n 是 42 的所有者
}
```

### 规则 2：同一时刻只能有一个所有者

一个值不能同时属于多个变量。赋值时会发生**转移**（move），原变量失效。

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;   // s1 的所有权转移给 s2
    // println!("{}", s1);  // 编译错误！s1 已失效
    println!("{}", s2);    // OK
}
```

### 规则 3：所有者离开作用域，值被丢弃（drop）

当所有者离开作用域时，Rust 自动调用 `drop`，释放其占用的资源。

```rust
fn main() {
    {
        let s = String::from("hello");
        // s 在这里有效
    }  // s 离开作用域，drop 被调用，内存释放
    // s 不再有效
}
```

### 代码示例：创建、转移、销毁

```rust
fn main() {
    // 1. 创建：s1 拥有堆上的字符串
    let s1 = String::from("hello");

    // 2. 转移：s1 的值 move 到 s2，s1 失效
    let s2 = s1;

    // 3. 使用 s2
    println!("s2 = {}", s2);

    // 4. s2 离开 main 的作用域，drop 被调用，内存释放
}
```

### TS 对比：没有所有权概念

```typescript
// TypeScript：多个变量可以指向同一个对象
const s1 = "hello";
const s2 = s1;  // 对于 string（原始类型），是值拷贝
console.log(s1, s2);  // 都有效

const obj1 = { name: "Alice" };
const obj2 = obj1;   // 引用拷贝，obj1 和 obj2 指向同一对象
obj2.name = "Bob";
console.log(obj1.name);  // "Bob"！两个引用共享同一数据
```

在 JS 中，你不知道「谁拥有」这个对象，也无法在编译时保证不会有多个地方同时修改它。

---

## 3. Move 语义 —— 最让 TS 工程师困惑的地方

### 根本性差异：引用复制 vs 所有权转移

这是 TypeScript 工程师学习 Rust 时最容易踩坑的地方。

| 操作 | TypeScript/JavaScript | Rust |
|------|------------------------|------|
| 赋值 `let b = a` | 对于对象：引用复制，a 和 b 指向同一数据 | 对于非 Copy 类型：**Move**，a 失效，b 获得所有权 |
| 修改 `b.x = 1` | a.x 也会变（共享可变状态） | a 已失效，无法使用 |

### 并排代码对比

**TypeScript：对象赋值是引用复制**

```typescript
const user = { name: "Alice", age: 30 };
const user2 = user;   // 引用复制
user2.name = "Bob";
console.log(user.name);   // "Bob" —— 两个变量指向同一对象！
```

**Rust：赋值是 Move，原变量失效**

```rust
#[derive(Debug)]
struct User {
    name: String,
    age: u32,
}

fn main() {
    let user = User {
        name: String::from("Alice"),
        age: 30,
    };
    let user2 = user;  // Move！user 的所有权转移给 user2
    // user.name = "Bob";  // 编译错误！user 已失效
    println!("{:?}", user2);  // 只能用 user2
}
```

### Copy trait：复制而非移动

Rust 中，**实现了 Copy 的类型**在赋值时是**复制**而不是 move。这类类型通常是：

- 固定大小的
- 在栈上存储的
- 不包含堆资源的

**常见的 Copy 类型**：

| 类型 | 说明 |
|------|------|
| `i32`, `u32`, `i64`, `u64`, `f32`, `f64` | 数值类型 |
| `bool` | 布尔 |
| `char` | 字符 |
| `(i32, i32)` | 元组（当其所有元素都是 Copy 时）|

**类比 TS**：类似 JavaScript 的**原始类型**（string、number、boolean、undefined、null、symbol），赋值时是值拷贝。

```rust
fn main() {
    let x = 42;
    let y = x;   // 复制，x 和 y 各自拥有一个 42
    println!("x = {}, y = {}", x, y);  // 都有效！
}
```

### Clone trait：显式深拷贝

对于**非 Copy** 类型（如 `String`、`Vec`），如果确实需要一份独立的拷贝，使用 `clone()`：

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1.clone();  // 显式深拷贝
    println!("s1 = {}, s2 = {}", s1, s2);  // 都有效
}
```

**对比 TS**：

```typescript
// TS 中「复制」对象需要显式操作
const obj1 = { name: "Alice" };
const obj2 = { ...obj1 };           // 浅拷贝
const obj3 = JSON.parse(JSON.stringify(obj1));  // 深拷贝（有局限）
```

Rust 的 `clone()` 是**显式的**，你清楚知道这里发生了分配，不会有隐式深拷贝带来的性能惊喜。

### Copy vs Clone 对比

| 特性 | Copy | Clone |
|------|------|-------|
| 赋值行为 | 自动复制 | 需要显式调用 `.clone()` |
| 典型类型 | `i32`, `bool`, `(i32, i32)` | `String`, `Vec<T>` |
| 成本 | 低（栈上复制） | 可能高（堆分配） |
| 类比 TS | 原始类型的值拷贝 | `{ ...obj }` 或深拷贝 |

---

## 4. 借用（Borrowing）—— 不转移所有权的访问

### 核心思想

如果每次使用都要 move，代码会非常难写。**借用**允许你在不转移所有权的情况下，让其他代码**临时访问**数据。

### 不可变借用 `&T`

`&T` 表示「借来读，不拿走」：

```rust
fn main() {
    let s = String::from("hello");
    let len = calculate_length(&s);  // 借给函数，不转移所有权
    println!("'{}' 的长度是 {}", s, len);  // s 仍然有效
}

fn calculate_length(s: &String) -> usize {
    s.len()
}
```

**类比**：把书借给朋友看，朋友只能读，不能在上面涂改，看完还给你。

### 可变借用 `&mut T`

`&mut T` 表示「借来修改，独占」：

```rust
fn main() {
    let mut s = String::from("hello");
    append_world(&mut s);
    println!("{}", s);  // "hello world"
}

fn append_world(s: &mut String) {
    s.push_str(" world");
}
```

**类比**：把原稿借给一个人修改，修改期间只有他能动，别人不能同时借。

### 借用规则（编译器强制）

1. **要么** 任意多个不可变借用 `&T`
2. **要么** 恰好一个可变借用 `&mut T`
3. **不能** 同时存在不可变借用和可变借用

```rust
fn main() {
    let mut s = String::from("hello");

    let r1 = &s;   // OK
    let r2 = &s;   // OK，多个不可变借用
    // let r3 = &mut s;  // 编译错误！已有不可变借用
    println!("{} {}", r1, r2);

    let r3 = &mut s;  // 在 r1、r2 不再使用后，OK
    r3.push_str("!");
}
```

### 图书馆借书类比

| 借用类型 | 类比 |
|----------|------|
| `&T` | 多人可以同时借阅**复印件**（只读），互不干扰 |
| `&mut T` | 只有一个人能借**原稿**去修改，借出期间别人不能碰 |

### 对比 TS：没有借用限制

```typescript
// TypeScript：多个引用可以随意修改同一个对象
const obj = { count: 0 };
const ref1 = obj;
const ref2 = obj;
ref1.count = 1;   // 修改了
ref2.count = 2;   // 又修改了，没有编译器阻止你
// 这就是数据竞争、意外副作用的来源！
```

Rust 的借用检查器在编译时阻止这种「多处同时修改」，从根源上消除一类 bug。

### 借用规则背后的原因

- **不可变借用**：只读不写，多个读者可以共存
- **可变借用**：写操作，如果允许多个 `&mut` 同时存在，就会发生数据竞争（data race）

Rust 的内存安全保证包括：**无数据竞争**。借用规则是实现这一保证的关键。

---

## 5. String vs &str —— 把所有权概念落到实处

### 两种字符串类型

| 类型 | 所有权 | 存储位置 | 可变性 |
|------|--------|----------|--------|
| `String` | 拥有 | 堆 | 可增长、可修改 |
| `&str` | 借用（切片） | 可能栈或堆 | 不可变 |

### String：拥有所有权的字符串

```rust
let mut s = String::from("hello");
s.push_str(" world");  // 可以修改
```

### &str：字符串切片，是借用

```rust
let s = "hello";       // &str，字面量在只读数据段
let s2: &str = &String::from("hi")[..];  // 从 String 借用的切片
```

### 函数参数应该用哪个？

**通常用 `&str`**，因为更灵活：

- 可以接收 `&str` 字面量
- 可以接收 `&String`（会自动 deref 成 `&str`）

```rust
// 推荐：接受 &str
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn main() {
    greet("Alice");                    // &str 字面量
    greet(&String::from("Bob"));       // &String 会自动用
}
```

如果写成 `fn greet(name: &String)`，调用 `greet("Alice")` 就不行，需要 `greet(&"Alice".to_string())`，不够优雅。

### 常见转换

| 操作 | 代码 |
|------|------|
| `&str` → `String` | `s.to_string()` 或 `s.to_owned()` 或 `String::from(s)` |
| `String` → `&str` | `&s` 或 `s.as_str()` |
| 字符串字面量 | `"hello"` 类型是 `&'static str` |

### 对比 TS 的 string

```typescript
// TypeScript：string 永远是不可变的
const s = "hello";
const s2 = s + " world";  // 创建新字符串，不修改 s
// 所有 string 都是不可变的，由 GC 管理，无需区分所有权
```

Rust 需要区分 `String`（拥有）和 `&str`（借用），因为涉及内存的分配与释放。

---

## 6. 生命周期（Lifetime）初步

### 什么是生命周期

**生命周期**是借用的有效范围。编译器用它来保证：**引用指向的数据在引用被使用期间始终有效**，防止悬垂引用（dangling reference）。

### 为什么需要：防止悬垂引用

```rust
// 这段代码会编译错误
fn main() {
    let r;
    {
        let x = 5;
        r = &x;   // r 借用 x
    }             // x 被 drop，r 变成悬垂引用！
    println!("r = {}", r);  // 危险！x 已不存在
}
```

编译器会报错：`x` 的生命周期不够长，`r` 不能比 `x` 活得更久。

### 大多数情况：编译器自动推断（lifetime elision）

你不需要标注生命周期，编译器会根据规则推断：

```rust
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    for (i, &item) in bytes.iter().enumerate() {
        if item == b' ' {
            return &s[0..i];
        }
    }
    &s[..]
}
// 编译器推断：返回的 &str 与参数 s 的生命周期相同
```

### 何时需要手动标注 `'a`

当**多个引用参数**或**返回引用**时，编译器无法唯一确定关系，需要你显式标注：

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
// 'a 表示：返回的引用与 x、y 中生命周期较短的那个一致
```

### 对比 TS：没有生命周期概念

```typescript
// TypeScript：有 GC，引用可以随便传
function getFirst(data: { items: string[] }) {
  return data.items[0];  // 返回引用
}
// 如果 data 被回收了怎么办？GC 会处理……通常
// 但如果设计不当，可能返回已经无效的引用，运行时才暴露
```

Rust 在编译期就拒绝这种不安全的模式，让你在写代码时就必须考虑「谁活得更久」。

---

## 7. 常见编译错误实战

### 错误 1：`value used after move`

**错误信息**：

```
error[E0382]: use of moved value: `s`
  --> src/main.rs:5:18
   |
3  |     let s = String::from("hello");
   |         - move occurs because `s` has type `String`
4  |     let s2 = s;
   |               - value moved here
5  |     println!("{}", s);
   |                    ^ value used here after move
```

**原因**：`s` 在赋值给 `s2` 时发生了 move，`s` 不再有效。

**TS 等价代码**（不会报错，但语义不同）：

```typescript
const s = { value: "hello" };
const s2 = s;   // 引用复制
console.log(s.value);   // 仍然可以访问，因为 JS 中 s 和 s2 共享
```

**Rust 修复方式**：

```rust
// 方式 1：用借用，不转移所有权
let s = String::from("hello");
let s2 = &s;
println!("{} {}", s, s2);

// 方式 2：需要两份独立数据时，clone
let s = String::from("hello");
let s2 = s.clone();
println!("{} {}", s, s2);
```

---

### 错误 2：`cannot borrow as mutable because it is also borrowed as immutable`

**错误信息**：

```
error[E0502]: cannot borrow `s` as mutable because it is also borrowed as immutable
  --> src/main.rs:6:10
   |
4  |     let r1 = &s;
   |              - immutable borrow occurs here
5  |     let r2 = &s;
6  |     let r3 = &mut s;
   |              ^^^^^^ mutable borrow occurs here
7  |     println!("{} {}", r1, r2);
   |                      ------ immutable borrow later used here
```

**原因**：在存在不可变借用 `r1`、`r2` 时，又尝试可变借用 `r3`，违反借用规则。

**TS 等价代码**（不会报错，但可能出 bug）：

```typescript
const arr = [1, 2, 3];
const ref1 = arr;   // 多个引用
const ref2 = arr;
arr.push(4);        // 修改
console.log(ref1);  // 可能产生意外
```

**Rust 修复方式**：

```rust
let mut s = String::from("hello");
let r1 = &s;
let r2 = &s;
println!("{} {}", r1, r2);  // 先用完不可变借用
let r3 = &mut s;            // 然后才能可变借用
r3.push_str("!");
```

---

### 错误 3：`does not live long enough`

**错误信息**：

```
error[E0597]: `x` does not live long enough
  --> src/main.rs:6:10
   |
4  |     let r;
   |         - borrow might be used here, when `r` is dropped
5  |     {
6  |         let x = 5;
   |             - `x` dropped here while still borrowed
7  |         r = &x;
8  |     }
9  |     println!("r = {}", r);
```

**原因**：`r` 借用了 `x`，但 `x` 在内部块结束时被 drop，`r` 变成悬垂引用。

**TS 等价代码**（可能 silently 出错）：

```typescript
let r;
{
  const x = { value: 5 };
  r = x;   // r 指向 x
}
console.log(r.value);  // x 已被 GC 回收？可能还能碰巧访问，但不可靠
```

**Rust 修复方式**：

```rust
let r;
let x = 5;   // 让 x 与 r 在同一作用域
r = &x;
println!("r = {}", r);
```

---

## 8. 小练习

### 练习 1：修复 Move 错误

下面代码无法通过编译，请修复，使 `s1` 和 `s2` 都能被打印：

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;
    println!("s1 = {}", s1);
    println!("s2 = {}", s2);
}
```

<details>
<summary>参考答案</summary>

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1.clone();  // 或 let s2 = &s1; 然后用 &s1 和 &s2
    println!("s1 = {}", s1);
    println!("s2 = {}", s2);
}
```
</details>

---

### 练习 2：借用规则

下面代码无法通过编译，请调整代码顺序或逻辑，使其通过：

```rust
fn main() {
    let mut v = vec![1, 2, 3];
    let r1 = &v;
    let r2 = &mut v;
    r2.push(4);
    println!("{:?}", r1);
}
```

<details>
<summary>参考答案</summary>

```rust
fn main() {
    let mut v = vec![1, 2, 3];
    let r1 = &v;
    println!("{:?}", r1);  // 先用完 r1
    let r2 = &mut v;      // 再可变借用
    r2.push(4);
}
```
</details>

---

### 练习 3：函数签名设计

实现一个函数 `first_word(s: &str) -> &str`，返回字符串中的第一个单词。若没有空格，返回整个字符串。思考：返回类型为什么用 `&str` 而不是 `String`？

<details>
<summary>参考答案</summary>

```rust
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    for (i, &item) in bytes.iter().enumerate() {
        if item == b' ' {
            return &s[0..i];
        }
    }
    &s[..]
}

fn main() {
    let s = String::from("hello world");
    let word = first_word(&s);
    println!("第一个单词: {}", word);  // "hello"
}
```

返回 `&str` 可以避免额外分配，且返回的切片与输入 `s` 共享底层数据，生命周期也清晰。
</details>

---

## 总结

| 主题 | 要点 |
|------|------|
| GC 的代价 | 不可预测暂停、内存开销、无法精确控制释放时机 |
| 所有权三规则 | 每值一主、同一时刻一主、离开作用域即 drop |
| Move 语义 | 赋值时转移所有权，原变量失效；Copy 类型除外 |
| 借用 | `&T` 只读共享，`&mut T` 独占写；遵守借用规则 |
| String vs &str | String 拥有，&str 借用；函数参数多用 &str |
| 生命周期 | 防止悬垂引用；多数情况可自动推断 |
| 编译错误 | value used after move、借用冲突、does not live long enough —— 都是编译器在帮你避免运行时 bug |

下一章将介绍 **错误处理**，学习 Option、Result 和 ? 操作符，告别 try/catch。
