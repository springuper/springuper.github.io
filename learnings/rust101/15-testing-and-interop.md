# 第 15 章：测试、工具链与 Node.js 互操作

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

在 TypeScript/Node.js 中，测试需要 Jest/Vitest、ESLint、Prettier 等一整套工具链配置；与 Node.js 的互操作通常依赖 WASM 或 native addon。Rust 则将**测试内置到语言**、提供零配置的文档测试，并用 napi-rs 让 Node.js 直接调用 Rust 代码。本章从 TS/JS 工程师的视角出发，系统梳理 Rust 的测试体系、开发工具链，以及如何把 Rust 作为 Node.js 的高性能模块，实现渐进式迁移。

---

## 目录

1. [内置测试 vs Jest](#1-内置测试-vs-jest)
2. [集成测试](#2-集成测试)
3. [文档测试 — Rust 的杀手特性](#3-文档测试--rust-的杀手特性)
4. [测试技巧](#4-测试技巧)
5. [基准测试](#5-基准测试)
6. [开发工具链总结](#6-开发工具链总结)
7. [napi-rs：在 Node.js 中调用 Rust](#7-napi-rs在-nodejs-中调用-rust)
8. [实战：为 Node.js 项目写一个 Rust 性能模块](#8-实战为-nodejs-项目写一个-rust-性能模块)
9. [学习路线总结与推荐资源](#9-学习路线总结与推荐资源)
10. [常见坑和小练习](#10-常见坑和小练习)

---

## 1. 内置测试 vs Jest

### 概念引入（从 TS/JS 视角）

在 TypeScript/Node.js 项目中，写测试需要：

1. 安装测试框架：Jest、Vitest、Mocha 等
2. 配置 ts-jest 或 vitest 以支持 TypeScript
3. 在 `package.json` 中配置 `test` 脚本
4. 约定测试文件命名：`*.test.ts`、`*.spec.ts` 或 `__tests__/`

```typescript
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

```typescript
// math.test.ts
import { add, mul } from './math';

describe('math', () => {
  it('adds two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
  it('multiplies two numbers', () => {
    expect(mul(2, 3)).toBe(6);
  });
});
```

### Rust 的做法

**Rust 的测试内置在语言中**，无需安装任何测试框架。只需：

1. 用 `#[test]` 标记测试函数
2. 运行 `cargo test`

```rust
// src/lib.rs 或 src/main.rs
fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(1, 2), 3);
    }

    #[test]
    fn test_add_negative() {
        assert_eq!(add(-1, 1), 0);
    }
}
```

```bash
$ cargo test
   Compiling my_project v0.1.0
    Finished test [unoptimized + debuginfo] target(s)
     Running unittests src/lib.rs

running 2 tests
test tests::test_add ... ok
test tests::test_add_negative ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

### 背后的 Why

Rust 将测试作为**语言一级公民**，基于以下考虑：

1. **降低入门门槛**：新项目 `cargo new` 后即可写测试，无配置负担
2. **编译器参与**：`#[test]` 由编译器识别，`cargo test` 默认用 `--no-run` 编译，再运行测试二进制
3. **零依赖**：不依赖第三方 crate，保证任何 Rust 项目都能测试
4. **一致性**：全生态统一的测试约定，无需在不同框架间选择

### 对比表格

| 特性 | TypeScript/Node.js (Jest) | Rust |
|------|---------------------------|------|
| 测试框架 | 需安装 jest/vitest | 内置，无需安装 |
| 配置 | jest.config.js、ts-jest 等 | 零配置 |
| 运行命令 | `npm test` / `npm run test` | `cargo test` |
| 测试标记 | `it()`, `test()` | `#[test]` |
| 断言 | `expect(x).toBe(y)` | `assert_eq!(x, y)` |
| 测试组织 | `describe()` 嵌套 | `mod tests { ... }` |

### 断言宏

| Rust 宏 | 用途 | Jest 等价 |
|---------|------|-----------|
| `assert!(expr)` | 断言为 true | `expect(expr).toBe(true)` |
| `assert_eq!(a, b)` | 断言相等（显示 diff） | `expect(a).toBe(b)` |
| `assert_ne!(a, b)` | 断言不相等 | `expect(a).not.toBe(b)` |
| `assert!(expr, "msg")` | 带自定义失败信息 | `expect(expr).toBeTruthy()` + 注释 |

```rust
#[test]
fn demo_assertions() {
    assert!(1 + 1 == 2);
    assert_eq!(2 + 2, 4);
    assert_ne!(1, 2);
    assert!(true, "custom message on failure");
}
```

---

## 2. 集成测试

### 概念引入（从 TS/JS 视角）

在 TS 中，集成测试通常放在 `__tests__/` 目录或与源码同级的 `*.test.ts` 中，测试「多个模块协作」或「对外 API」：

```
src/
  math.ts
  utils.ts
__tests__/
  integration.test.ts
```

### Rust 的做法

Rust 的集成测试放在项目根目录的 **`tests/`** 下，**每个 `.rs` 文件是一个独立的 crate**，只能通过 `pub` API 访问你的库。

```
my_project/
  src/
    lib.rs
  tests/
    integration_test.rs
    api_test.rs
```

```rust
// tests/integration_test.rs
use my_project::add;  // 只能访问 lib.rs 中 pub 的项

#[test]
fn test_add_integration() {
    assert_eq!(add(1, 2), 3);
}
```

- `cargo test` 会自动发现 `tests/` 下的所有文件
- 每个测试文件编译为独立的 crate，不共享内部实现
- 适合测试公开 API 的端到端行为

### 对比表格

| 特性 | TypeScript (Jest) | Rust |
|------|-------------------|------|
| 目录约定 | `__tests__/` 或 `*.test.ts` | `tests/` |
| 发现方式 | 配置文件指定 | 自动发现 |
| 测试范围 | 可访问任意 import | 仅能访问 `pub` API |
| 隔离 | 同一进程 | 每个文件独立 crate |

---

## 3. 文档测试 — Rust 的杀手特性

### 概念引入（从 TS/JS 视角）

在 TS/JS 中，文档（README、JSDoc、typedoc 生成的页面）和代码往往是**脱节**的：文档里的示例可能已经过时，没人会专门去跑一遍。TypeDoc 只负责从注释生成文档，不验证示例可执行。

### Rust 的做法

Rust 的 **文档注释 `///` 中的代码块会自动被当作测试运行**！`cargo test` 会编译并执行文档中的示例，确保文档永远与代码同步。

```rust
/// 计算两个整数的和。
///
/// # Examples
///
/// ```
/// use my_crate::add;
/// assert_eq!(add(2, 3), 5);
/// ```
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

运行 `cargo test` 时，上述 `assert_eq!` 会被执行。若你修改了 `add` 的实现但忘了更新文档示例，测试会失败。

### 背后的 Why

「文档即可执行示例」是 Rust 设计哲学的一部分：减少人为维护成本，让文档成为活生生的契约。许多 Rust 文档都包含可直接复制的代码，且保证能跑。

### 实战示例

```rust
/// 解析 JSON 字符串为数字（简化示例）
///
/// # Examples
///
/// ```
/// # use my_crate::parse_number;
/// assert_eq!(parse_number("42"), Some(42));
/// assert_eq!(parse_number("abc"), None);
/// ```
pub fn parse_number(s: &str) -> Option<i32> {
    s.parse().ok()
}
```

若要在文档测试中省略 `main` 等样板代码，可用 `#` 开头隐藏：

```rust
/// ```
/// # fn main() {
/// let x = 42;
/// println!("{}", x);
/// # }
/// ```
```

### 对比表格

| 特性 | TypeScript/typedoc | Rust doc tests |
|------|-------------------|----------------|
| 文档示例 | 仅展示，不执行 | 自动编译并执行 |
| 过时检测 | 无 | 示例过时则测试失败 |
| 维护成本 | 需人工同步 | 编译器强制同步 |

---

## 4. 测试技巧

### #[should_panic] — 测试预期 panic

有时你需要确保某些输入会触发 panic（如非法参数）：

```rust
#[test]
#[should_panic(expected = "divisor cannot be zero")]
fn test_divide_by_zero() {
    divide(10, 0);
}
```

对应 Jest：`expect(() => fn()).toThrow()`。

### #[ignore] — 忽略慢测试

```rust
#[test]
#[ignore]
fn expensive_integration_test() {
    // 耗时测试，默认不跑
}
```

运行被忽略的测试：`cargo test -- --ignored`。

### 参数化测试

Rust 标准库没有内建参数化，通常用循环或第三方 crate（如 `rstest`）：

```rust
#[test]
fn test_add_multiple() {
    let cases = [(1, 2, 3), (0, 0, 0), (-1, 1, 0)];
    for (a, b, expected) in cases {
        assert_eq!(add(a, b), expected);
    }
}
```

### Mock：mockall crate

复杂依赖需要 mock 时，可用 [mockall](https://docs.rs/mockall)：

```rust
// Cargo.toml
// [dev-dependencies]
// mockall = "0.12"

use mockall::predicate::*;
use mockall::*;

#[automock]
trait MyService {
    fn fetch(&self, id: i32) -> String;
}

#[test]
fn test_with_mock() {
    let mut mock = MockMyService::new();
    mock.expect_fetch()
        .with(eq(1))
        .returning(|_| "data".to_string());
    assert_eq!(mock.fetch(1), "data");
}
```

对比 Jest 的 `jest.fn()`、`jest.mock()`。

### 对比 describe/it/beforeEach

| Jest 模式 | Rust 等价 |
|-----------|-----------|
| `describe` | `mod tests { }` 嵌套 `mod` |
| `it` | 多个 `#[test]` 函数 |
| `beforeEach` | 每个测试中手动构造，或用 `Drop` 做 teardown |

---

## 5. 基准测试

### 概念引入（从 TS/JS 视角）

Node.js 中常用 `benchmark.js` 或手写 `console.time` 做性能测试，需单独配置和运行。

### Rust 的做法

- **cargo bench**：运行 `#[bench]` 标记的函数（nightly）或 criterion 等 crate
- **criterion**：稳定的基准测试框架

```rust
// Cargo.toml
// [dev-dependencies]
// criterion = "0.5"

use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn benchmark_add(c: &mut Criterion) {
    c.bench_function("add", |b| b.iter(|| add(black_box(1), black_box(2))));
}

criterion_group!(benches, benchmark_add);
criterion_main!(benches);
```

```bash
$ cargo bench
add   time:   [0.5 ns 0.5 ns 0.5 ns]
```

### 对比表格

| 特性 | Node.js (benchmark.js) | Rust (criterion) |
|------|------------------------|------------------|
| 配置 | 手动引入 | dev-dependency |
| 运行 | 单独脚本 | `cargo bench` |
| 统计 | 基础 | 方差、迭代数等 |
| 与测试集成 | 分离 | 同一 cargo 生态 |

---

## 6. 开发工具链总结

| Rust 工具 | 命令 | TypeScript/Node.js 等价 | 用途 |
|-----------|------|-------------------------|------|
| **Clippy** | `cargo clippy` | ESLint | 代码检查、改进建议 |
| **rustfmt** | `cargo fmt` | Prettier | 代码格式化 |
| **rust-analyzer** | IDE 插件 | tsserver | LSP、补全、跳转 |
| **cargo doc** | `cargo doc --open` | TypeDoc | 生成并打开文档 |
| **cargo watch** | `cargo install cargo-watch` + `cargo watch` | nodemon | 文件变更自动执行 |
| **cargo audit** | `cargo install cargo-audit` + `cargo audit` | npm audit | 依赖安全审计 |
| **cargo outdated** | `cargo install cargo-outdated` | npm outdated | 检查过时依赖 |

### 推荐工作流

```bash
cargo fmt          # 格式化
cargo clippy       # 静态检查
cargo test        # 测试
cargo build --release  # 发布构建
cargo audit       # 安全审计
```

---

## 7. napi-rs：在 Node.js 中调用 Rust

### 概念引入（从 TS/JS 视角）

Node.js 性能瓶颈常出现在：JSON 解析、字符串处理、加密、图片处理等 CPU 密集场景。可选方案：

1. **WASM**：通用，但 FFI 有成本，多线程支持有限
2. **Native Addon**：C/C++ 写，N-API 暴露给 Node，性能最优
3. **napi-rs**：用 **Rust** 写 Native Addon，类型安全、内存安全、生态好

### 渐进式迁移策略

不必一次性重写整个项目。典型做法：

1. 用 profiler 找出热点函数
2. 用 Rust 重写这些函数
3. 通过 napi-rs 暴露给 Node.js
4. 在 TS 中调用，逐步替换

### napi-rs 简介和基本用法

[napi-rs](https://napi.rs/) 让你用 Rust 写 N-API 兼容的 Node addon，自动生成 `.node` 二进制和 TypeScript 类型。

**初始化项目**：

```bash
npm init -y
npm install -D @napi-rs/cli
npx napi new
# 选择 project name、package name 等
```

**目录结构**：

```
my-addon/
  Cargo.toml
  src/
    lib.rs
  package.json
  napi.config.json
```

### 创建一个 Node.js native addon

```rust
// src/lib.rs
#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[napi]
pub fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}
```

**编译**：`npm run build` 或 `napi build`，生成 `index.js`、`index.d.ts` 和 `.node` 二进制。

### 从 TS 调用 Rust 函数

```typescript
// index.ts
import { add, greet } from './index';

console.log(add(1, 2));        // 3
console.log(greet('Rust'));    // "Hello, Rust!"
```

### 实际使用案例

| 场景 | Rust 优势 | 典型 crate |
|------|-----------|------------|
| 图片处理 | 无 GC、SIMD | image, imageproc |
| JSON 解析 | simd-json 等 | simd-json |
| 加密 | 无侧信道风险 | ring, rustls |
| 正则 | 一次编译，多次复用 | regex |
| 字符串处理 | 零拷贝、高性能 | 标准库 + 算法 |

### 对比 WASM

| 特性 | napi-rs (Native) | WASM (wasm-pack) |
|------|------------------|------------------|
| 性能 | 最优，无 FFI 边界 | 有 JS↔WASM 边界成本 |
| 启动 | 需编译 .node | 需加载 .wasm |
| 多线程 | 支持 | 有限制 |
| 生态 | 全 Rust 生态 | 需 WASM 兼容 |
| 适用 | Node 环境、性能关键 | 跨平台、同构 |

---

## 8. 实战：为 Node.js 项目写一个 Rust 性能模块

### 场景：重复字符去重

假设我们有一个高频调用的函数：把连续重复字符压缩，如 `"aaabbc"` → `"abc"`。在 Node 中纯 JS 实现较慢，我们用 Rust 重写并暴露给 TS。

### Rust 实现

```rust
// src/lib.rs
#![deny(clippy::all)]
use napi_derive::napi;

#[napi]
pub fn dedupe_chars(s: String) -> String {
    let mut result = String::with_capacity(s.len());
    let mut prev: Option<char> = None;
    for c in s.chars() {
        if prev != Some(c) {
            result.push(c);
            prev = Some(c);
        }
    }
    result
}
```

### napi-rs 绑定（已在上面）

### TS 调用与性能对比

```typescript
// benchmark.ts
import { dedupe_chars } from './index';

function dedupeJs(s: string): string {
  let result = '';
  let prev = '';
  for (const c of s) {
    if (c !== prev) {
      result += c;
      prev = c;
    }
  }
  return result;
}

const input = 'a'.repeat(10000) + 'b'.repeat(10000) + 'c';

console.time('JS');
for (let i = 0; i < 10000; i++) dedupeJs(input);
console.timeEnd('JS');

console.time('Rust');
for (let i = 0; i < 10000; i++) dedupe_chars(input);
console.timeEnd('Rust');
```

典型结果：Rust 版本可达到 JS 的 **5–20x** 加速（视输入大小而定）。

---

## 9. 学习路线总结与推荐资源

### 官方资源

| 资源 | 说明 |
|------|------|
| [The Rust Book](https://doc.rust-lang.org/book/) | 官方入门书，系统全面 |
| [Rustlings](https://github.com/rust-lang/rustlings) | 小练习，手把手改代码 |
| [Rust by Example](https://doc.rust-lang.org/rust-by-example/) | 示例驱动学习 |

### 进阶资源

| 资源 | 说明 |
|------|------|
| [Rust for Rustaceans](https://rust-for-rustaceans.com/) | 深入所有权、并发、FFI |
| [Too Many Linked Lists](https://rust-unofficial.github.io/too-many-lists/) | 用链表学 unsafe、指针 |

### 社区

- **r/rust**：Reddit 社区
- **Rust Discord**：实时交流
- **Rust 中文社区**：论坛、公众号

### 从这个教程出发，下一步学什么

1. **异步实战**：用 tokio 写一个 CLI 或小服务
2. **Web 开发**：Axum、Actix-web 做 API
3. **与 Node 互操作**：napi-rs 项目实战
4. **WASM**：wasm-pack 做浏览器端 Rust
5. **系统编程**：写一个自己的小工具

---

## 10. 常见坑和小练习

### 常见坑

1. **`#[cfg(test)]` 忘记写**：单元测试的 `mod tests` 必须放在 `#[cfg(test)]` 下，否则会打进 release 二进制。
2. **集成测试访问不到私有项**：`tests/` 下只能 `use crate::pub_fn`，不能访问 `pub(crate)` 或私有。
3. **文档测试中的隐藏代码**：用 `# ` 开头的行不会出现在文档中，但会参与编译，可用于补全 `main` 等。
4. **napi-rs 类型转换**：`String`/`&str` 与 JS  string 对应；大数组考虑 `Buffer` 或 `TypedArray` 避免复制。
5. **cargo test 默认不跑 bench**：`#[bench]` 需要 `cargo bench`，或 nightly 下 `cargo test` 可包含。

### 小练习

1. **基础**：为你之前写过的 `add`、`parse_number` 等函数补充单元测试和文档测试。
2. **集成**：在 `tests/` 下写一个集成测试，调用你库的公开 API 完成一个完整流程。
3. **should_panic**：写一个 `divide(a, b)` 在 `b == 0` 时 panic，并用 `#[should_panic]` 测试。
4. **napi-rs**：用 napi-rs 创建一个项目，暴露一个 `fib(n: u32) -> u64` 函数，在 TS 中调用并对比纯 JS 实现的性能。
5. **工具链**：在项目中运行 `cargo fmt`、`cargo clippy`，修掉 Clippy 提出的所有建议。

---

*本系列完结。恭喜你走完了从 TypeScript 到 Rust 的入门之旅！推荐接下来阅读 [The Rust Book](https://doc.rust-lang.org/book/) 和 [Rust by Example](https://doc.rust-lang.org/rust-by-example/) 继续深入。*
