# 第 10 章：模块系统与代码组织

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

在 TypeScript/Node.js 中，我们用 ESM 的 `import/export` 组织代码，一个文件就是一个模块。Rust 的模块系统有相似的目标，但设计哲学截然不同：**默认私有**、**模块不一定对应文件**、**显式的 crate 边界**。本章从 TS/JS 工程师的视角出发，系统梳理 Rust 的模块系统，助你写出结构清晰、易于维护的 Rust 项目。

---

## 目录

1. [模块系统对比概览](#1-模块系统对比概览)
2. [mod 关键字](#2-mod-关键字)
3. [pub 可见性](#3-pub-可见性)
4. [use 与路径](#4-use-与路径)
5. [crate vs npm package](#5-crate-vs-npm-package)
6. [workspace vs monorepo](#6-workspace-vs-monorepo)
7. [实战：将前面的代码重构为多模块项目](#7-实战将前面的代码重构为多模块项目)
8. [常见坑](#8-常见坑)
9. [小练习](#9-小练习)

---

## 1. 模块系统对比概览

### 概念引入（从 TS/JS 视角）

TypeScript/JavaScript 的 ESM 以**文件为模块边界**：只要有 `export`，其他文件通过 `import` 即可使用。没有 `export` 的符号对模块外不可见。

```typescript
// utils.ts
export function add(a: number, b: number) {
  return a + b;
}
function internalHelper() {
  // 未 export，模块外不可见
}

// main.ts
import { add } from './utils';
add(1, 2);  // ✓
// internalHelper();  // ✗ 无法导入
```

### Rust 的做法

Rust 的模块系统有三个核心概念：

1. **mod**：声明/定义模块
2. **pub**：控制可见性（默认私有）
3. **use**：将路径引入当前作用域

与 TS 的关键差异：**Rust 默认私有**——不写 `pub` 的项，只在当前模块及子模块内可见。TS 则是「有 export 才可见」。

```rust
// lib.rs 或 main.rs
mod utils {
    pub fn add(a: i32, b: i32) -> i32 {
        a + b
    }
    fn internal_helper() {
        // 未 pub，模块外不可见
    }
}

fn main() {
    utils::add(1, 2);  // ✓
    // utils::internal_helper();  // ✗ 编译错误：私有
}
```

### 背后的 Why

Rust 的「默认私有」鼓励**最小暴露原则**：只把真正需要对外使用的 API 标记为 `pub`，其余实现细节隐藏。这减少了耦合、便于重构，也避免了 TS 中常见的「意外导出」问题。

### 对比表格

| 特性 | TypeScript/ESM | Rust |
|------|----------------|------|
| 模块边界 | 文件即模块 | `mod` 声明，不一定对应文件 |
| 导出方式 | `export` 显式导出 | `pub` 控制可见性 |
| 默认可见性 | 不 export 即私有 | 不 pub 即私有 |
| 导入方式 | `import { x } from '...'` | `use crate::module::x` 或直接 `module::x` |
| 顶层入口 | `index.ts` / `main.ts` | `lib.rs` / `main.rs` / `mod.rs` |

---

## 2. mod 关键字

### 内联模块（mod foo { ... }）

模块可以直接内联写在当前文件中，适合小规模组织：

```rust
mod math {
    pub fn add(a: i32, b: i32) -> i32 {
        a + b
    }
    pub fn mul(a: i32, b: i32) -> i32 {
        a * b
    }
}

fn main() {
    println!("{}", math::add(2, 3));
}
```

### 文件模块（mod foo;）

`mod foo;` 告诉编译器：模块 `foo` 的内容在**另一个文件**中。

**Rust 2018+ 风格**有两种对应关系：

| 声明 | 对应文件 | 说明 |
|------|----------|------|
| `mod foo;` | `foo.rs` | 与当前文件同目录 |
| `mod foo;` | `foo/mod.rs` | `foo` 是目录，入口为 `foo/mod.rs` |

```rust
// 假设项目结构：
// src/
//   main.rs
//   math.rs
//   http/
//     mod.rs
//     client.rs

// main.rs
mod math;      // 对应 src/math.rs
mod http;      // 对应 src/http/mod.rs

fn main() {
    math::add(1, 2);
    http::client::request();
}
```

```rust
// math.rs
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

```rust
// http/mod.rs
mod client;
pub use client::request;

// http/client.rs
pub fn request() { println!("request"); }
```

### 对比 TS：文件即模块

TS 中每个 `.ts` 文件自动是模块；Rust 则必须在入口（`main.rs` / `lib.rs`）显式 `mod xxx` 才能纳入编译。

---

## 3. pub 可见性

### 可见性层级

| 修饰符 | 可见范围 | 类比 |
|--------|----------|------|
| （无） | 当前模块及子模块 | TS 不 export |
| `pub` | 整个 crate 及依赖者 | `export` |
| `pub(crate)` | 当前 crate 内 | 类似 internal / package-private |
| `pub(super)` | 父模块 | 仅父模块可见 |
| `pub(in path)` | 指定路径内的模块 | 更细粒度 |

```rust
mod parent {
    fn private_fn() {}            // 仅 parent 及子模块
    pub(crate) fn crate_fn() {}   // 整个 crate
    pub(super) fn super_fn() {}   // 仅父模块
    pub fn public_fn() {}         // 对外可见
}
```

TS 只有 `export` 才可见，没有 crate-internal 概念。Rust 的 `pub(crate)` 类似 internal / package-private。

### struct 字段默认私有（重要！）

即使 struct 是 `pub` 的，其**字段默认仍然私有**。这与 TS 的 `interface` 不同：TS 的接口成员都是「公开」的。

```typescript
// TypeScript：接口成员都是公开的
interface User {
  id: number;
  name: string;
}
const u: User = { id: 1, name: "Alice" };
console.log(u.name);  // 可直接访问
```

```rust
// Rust：pub struct 的字段默认私有
pub struct User {
    pub id: u32,      // 必须显式 pub 才可访问
    name: String,     // 私有！外部无法 u.name
}

fn main() {
    let u = User { id: 1, name: "Alice".into() };
    println!("{}", u.id);   // ✓
    // println!("{}", u.name);  // ✗ 私有字段
}
```

要允许外部构造，需所有字段 `pub`，或提供 `pub fn new(...)` 等构造函数。

---

## 4. use 与路径

### use vs import

`use` 将路径**引入当前作用域**，之后可直接用短名，而不必写完整路径。

```typescript
// TypeScript
import { Item } from './module';
import { fn as myFn } from './other';
import * as mod from './module';  // 不推荐
```

```rust
// Rust
use crate::module::Item;
use crate::other::fn as my_fn;
use crate::module::*;  // 不推荐
```

### 绝对路径 vs 相对路径

| 路径类型 | 写法 | 说明 |
|----------|------|------|
| 绝对路径 | `crate::module::Item` | 从 crate 根开始 |
| 相对路径 | `self::sub::Item` | 从当前模块 |
| 相对路径 | `super::parent_item` | 从父模块 |
| 相对路径 | `super::super::grandparent` | 多级父模块 |

```rust
mod a { pub fn a_fn() {} }
mod b {
    fn b_fn() {
        crate::a::a_fn();   // 绝对路径
        super::a::a_fn();   // 相对路径，到父模块
    }
}
```

### 嵌套导入

```rust
// 嵌套导入
use std::{io, fs, collections::HashMap};
// 重命名
use std::collections::HashMap as Map;
```

### 对比表：路径与导入

| 操作 | TypeScript | Rust |
|------|------------|------|
| 导入单次 | `import { X } from './m'` | `use crate::m::X` |
| 导入多项 | `import { a, b } from './m'` | `use crate::m::{a, b}` |
| 重命名 | `import { x as y } from './m'` | `use crate::m::x as y` |
| 通配符 | `import * as m from './m'` | `use crate::m::*` |
| 默认导出 | `import X from './m'` | 无直接对应，用 `use crate::m::X` |

---

## 5. crate vs npm package

### crate 是 Rust 的编译单元

一个 **crate** 是 Rust 的独立编译单元，相当于「一个库或一个可执行程序」。

| 类型 | 入口文件 | 用途 |
|------|----------|------|
| bin crate | `src/main.rs` | 可执行程序 |
| lib crate | `src/lib.rs` | 库，供其他 crate 依赖 |
| 两者兼有 | `main.rs` + `lib.rs` | 常见：lib 放逻辑，main 只负责启动 |

### Cargo.toml vs package.json

```toml
# Cargo.toml
[package]
name = "my-rust-app"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = "1.0"           # 类似 npm i serde
tokio = { version = "1", features = ["full"] }
```

```json
// package.json
{
  "name": "my-ts-app",
  "version": "1.0.0",
  "dependencies": {
    "lodash": "^4.17.21"
  }
}
```

### crates.io vs npmjs.com

- **crates.io**：Rust 官方包仓库，相当于 npm registry
- 依赖写在 `Cargo.toml` 的 `[dependencies]`，`cargo build` 自动下载

```toml
[dependencies]
serde = "1.0.192"
serde_json = "1.0"
```

---

## 6. workspace vs monorepo

### Cargo workspace

**Workspace** 是多个 crate 的集合，共享 `target/` 和依赖解析，类似 npm/pnpm workspace、turborepo。

```toml
# 根目录 Cargo.toml
[workspace]
members = [
    "crates/backend",
    "crates/frontend",
    "crates/shared",
]
```

### 对比 TS 生态

| 概念 | TypeScript/Node | Rust |
|------|-----------------|------|
| 多包管理 | npm workspace / pnpm / turborepo | Cargo workspace |
| 共享依赖 | 根 package.json + hoisting | 根 Cargo.toml 统一解析 |
| 本地依赖 | `"shared": "workspace:*"` | `shared = { path = "../shared" }` |

```toml
# crates/backend/Cargo.toml
[dependencies]
shared = { path = "../shared" }
```

---

## 7. 实战：将前面的代码重构为多模块项目

假设我们要把之前章节的示例（数学、HTTP、错误处理）组织成多模块结构：

```
my_project/
├── Cargo.toml
└── src/
    ├── main.rs
    ├── lib.rs          # 库入口，对外暴露公共 API
    ├── math.rs
    ├── http/
    │   ├── mod.rs
    │   └── client.rs
    └── error.rs
```

```rust
// src/lib.rs
pub mod math;
pub mod http;
pub mod error;
pub use math::{add, mul};
pub use http::request;
pub use error::AppError;

// src/math.rs
pub fn add(a: i32, b: i32) -> i32 { a + b }
pub fn mul(a: i32, b: i32) -> i32 { a * b }

// src/http/mod.rs
mod client;
pub use client::request;
// src/http/client.rs
pub fn request() { println!("HTTP request"); }

// src/error.rs
#[derive(Debug)]
pub struct AppError(String);
impl AppError {
    pub fn new(msg: impl Into<String>) -> Self { Self(msg.into()) }
}

// src/main.rs
use my_project::{add, mul, request, AppError};
fn main() {
    println!("{}", add(1, 2));
    request();
}
```

引用关系：`main` → `lib` 导出项 ← `math` / `http` / `error` 子模块。

---

## 8. 常见坑

### 坑 1：模块路径搞错

忘记 `crate::` 前缀或 `super`/`self` 写错，易导致「cannot find」。建议用绝对路径 `crate::xxx`。

### 坑 2：忘记加 pub

对外需使用的函数、struct、enum 等必须加 `pub`，否则会报私有错误。

### 坑 3：循环依赖

Rust 不允许循环 `mod` 依赖。若 A 依赖 B，B 又依赖 A，需通过提取公共逻辑到第三个模块 C 来打破环。

```
✗  A ──→ B
    ↑     │
    └─────┘

✓  A ──→ C ←── B
```

### 坑 4：mod.rs 与目录结构混淆

- `mod foo;` + `foo.rs`：同目录下的 `foo.rs`
- `mod foo;` + `foo/mod.rs`：`foo` 目录下的 `mod.rs`

两者二选一，不要同时存在 `foo.rs` 和 `foo/mod.rs`，否则编译器会报错。

---

## 9. 小练习

### 练习 1：搭建模块结构

创建如下结构，并在 `main` 中调用 `greet`：

```
src/
  main.rs
  greetings/
    mod.rs
    english.rs   # 含 pub fn greet() -> String
    chinese.rs   # 含 pub fn greet() -> String
```

要求：通过 `greetings::english::greet()` 和 `greetings::chinese::greet()` 调用，且 `chinese` 模块使用 `pub(crate)` 限制为 crate 内可见。

<details>
<summary>参考答案</summary>

```rust
// main.rs: mod greetings; fn main() { greetings::english::greet(); greetings::chinese::greet(); }
// greetings/mod.rs: pub mod english; pub(crate) mod chinese;
// english.rs: pub fn greet() -> String { "Hello!".to_string() }
// chinese.rs: pub fn greet() -> String { "你好！".to_string() }
```

</details>

### 练习 2：use 重写

将以下多次重复的路径调用改为 `use` 引入：

```rust
fn main() {
    let m = std::collections::HashMap::<i32, i32>::new();
    let v = std::vec::Vec::<i32>::new();
    let s = std::string::String::from("hi");
    // ... 多处使用
}
```

<details>
<summary>参考答案</summary>

```rust
use std::{collections::HashMap, vec::Vec, string::String};
fn main() {
    let m = HashMap::<i32, i32>::new();
    let v = Vec::<i32>::new();
    let s = String::from("hi");
}
```

</details>

### 练习 3：pub struct 字段可见性

定义一个 `pub struct Config`，包含 `pub host: String` 和私有字段 `api_key: String`。实现 `Config::new(host, api_key)` 构造函数，并实现一个 `pub fn api_key(&self) -> &str` 的 getter，而不直接暴露字段。

<details>
<summary>参考答案</summary>

```rust
pub struct Config { pub host: String, api_key: String }
impl Config {
    pub fn new(host: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self { host: host.into(), api_key: api_key.into() }
    }
    pub fn api_key(&self) -> &str { &self.api_key }
}
```

</details>

---

**下一章预告：** 第 11 章将深入 **泛型**，学习 Trait Bound、静态/动态分发以及生命周期标注。
