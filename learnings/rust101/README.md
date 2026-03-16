# Rust 101 — 面向 TypeScript/Node.js 工程师的 Rust 入门指南

> 从你已经掌握的 TypeScript/Node.js 出发，系统学习 Rust 的核心概念、设计哲学与实战技能。

## 设计理念

- **对比驱动**：每个概念都从 TS/JS 中你已知的部分出发，再讲 Rust 的做法和背后的 Why
- **分层递进**：先建立直觉，再深入机制，最后融会贯通
- **实战穿插**：每章都有可运行的代码示例，后半部分有完整项目实战
- **哲学先行**：不只教语法，更解释 Rust 的设计哲学，授人以渔

## 目录

### Part 1: 开始之前 — 建立正确的心智模型

| 章节 | 主题 | 核心内容 |
|------|------|----------|
| [01](./01-why-rust.md) | 为什么是 Rust | 哲学与心智转变、零成本抽象、GC vs Ownership |
| [02](./02-toolchain-and-project.md) | 工具链与项目管理 | cargo vs npm、Cargo.toml vs package.json |
| [03](./03-type-system-basics.md) | 类型系统基础 | 类型映射、变量绑定、struct vs interface |

### Part 2: 核心概念 — Rust 的灵魂

| 章节 | 主题 | 核心内容 |
|------|------|----------|
| [04](./04-ownership-and-borrowing.md) | 所有权与借用 | Move 语义、借用规则、String vs &str、生命周期 |
| [05](./05-error-handling.md) | 错误处理 | Option/Result、? 操作符、告别 try/catch |
| [06](./06-pattern-matching.md) | 模式匹配 | match vs switch、解构、穷尽性检查 |

### Part 3: 构建模块 — 把积木搭起来

| 章节 | 主题 | 核心内容 |
|------|------|----------|
| [07](./07-enums-and-traits.md) | 枚举与 Trait | 代数数据类型、Trait vs Interface、组合优于继承 |
| [08](./08-collections-and-iterators.md) | 集合与迭代器 | Vec/HashMap、惰性求值、collect() 的魔法 |
| [09](./09-closures-and-functions.md) | 闭包与函数 | Fn/FnMut/FnOnce、闭包捕获语义、中间件管道 |
| [10](./10-module-system.md) | 模块系统 | mod/use/pub、crate vs package、workspace |

### Part 4: 进阶话题 — 解锁 Rust 的全部力量

| 章节 | 主题 | 核心内容 |
|------|------|----------|
| [11](./11-generics-deep-dive.md) | 泛型深入 | 单态化、Trait Bound、静态/动态分发、生命周期 |
| [12](./12-smart-pointers.md) | 智能指针 | Box/Rc/Arc/RefCell、内部可变性、决策树 |
| [13](./13-async-and-concurrency.md) | 异步与并发 | Future vs Promise、tokio、Send+Sync、Channel |

### Part 5: 实战应用 — 融会贯通

| 章节 | 主题 | 核心内容 |
|------|------|----------|
| [14](./14-build-rest-api.md) | 实战 REST API | Axum vs Express、Serde、sqlx、完整 CRUD |
| [15](./15-testing-and-interop.md) | 测试与互操作 | cargo test、文档测试、napi-rs、渐进式迁移 |

## 每章标准结构

每一章都遵循相同的结构，保证学习体验一致：

1. **概念引入** — 从你已知的 TS/JS 概念出发
2. **Rust 的做法** — 展示 Rust 的语法和用法
3. **背后的 Why** — 解释 Rust 为什么这样设计
4. **对比表格** — TS vs Rust 的快速参考
5. **实战代码** — 可运行的完整示例
6. **常见坑与编译错误** — 新手最容易犯的错误及修复
7. **小练习** — 动手题巩固理解

## 建议学习节奏

| 阶段 | 章节 | 建议时间 | 说明 |
|------|------|----------|------|
| Part 1 | 01-03 | 1 周 | 快速上手，建立信心 |
| Part 2 | 04-06 | 2 周 | 核心概念，需要反复消化 |
| Part 3 | 07-10 | 1.5 周 | 有了基础后会快很多 |
| Part 4 | 11-13 | 2 周 | 进阶概念，需要实践 |
| Part 5 | 14-15 | 1 周 | 综合实战 |

总计约 **7-8 周**，每天 1-1.5 小时。

## 开始学习

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 验证安装
rustc --version
cargo --version

# 然后从第 01 章开始吧！
```
