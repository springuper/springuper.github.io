# 第二章：工具链与项目管理

> 本章面向有 TypeScript/Node.js 全栈经验的开发者，通过对比 TS 生态帮助你快速上手 Rust 的工具链与项目管理。

## 目录

- [1. 工具链安装与管理](#1-工具链安装与管理)
- [2. Cargo — Rust 的 npm](#2-cargo--rust-的-npm)
- [3. Cargo.toml vs package.json 逐字段对比](#3-cargotoml-vs-packagejson-逐字段对比)
- [4. 项目结构对比](#4-项目结构对比)
- [5. 开发体验工具](#5-开发体验工具)
- [6. 实战：从零创建一个 Rust 项目](#6-实战从零创建一个-rust-项目)

---

## 1. 工具链安装与管理

### rustup vs nvm：版本管理对比

| 功能           | rustup                          | nvm                               |
|----------------|----------------------------------|-----------------------------------|
| 安装多版本     | `rustup install 1.70.0`         | `nvm install 18`                  |
| 切换版本       | `rustup default 1.70.0`         | `nvm use 18`                      |
| 默认版本       | `rustup default`                | `nvm alias default 18`            |
| 列出已安装     | `rustup show`                   | `nvm list`                        |
| 升级工具链     | `rustup update`                 | `nvm install --lts`               |
| 安装路径       | `~/.rustup` / `~/.cargo`        | `~/.nvm`                          |

rustup 不仅管理 Rust 版本，还统一管理 **编译器**、**标准库**、**文档**、**分析器**、**格式化工具** 等组件，相当于 nvm + npm（全局工具）的结合体。

### 安装步骤和常用命令

**安装 rustup（macOS/Linux）：**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**验证安装：**

```bash
rustc --version   # 对应 node --version
cargo --version   # 对应 npm --version
```

**常用 rustup 命令：**

```bash
# 更新 Rust 到最新稳定版
rustup update stable

# 安装 nightly 版本（用于实验性功能）
rustup install nightly

# 切换当前目录使用 nightly
rustup override set nightly

# 查看当前使用的工具链
rustup show
```

### rustup component add（类似 npm install -g）

Rust 的「全局工具」通过 `rustup component add` 安装，或通过 `cargo install` 安装第三方二进制工具。

| Rust                         | Node.js                    |
|-----------------------------|----------------------------|
| `rustup component add rustfmt`     | （内置在 npm 生态的 formatter） |
| `rustup component add clippy`      | `npm install -g eslint`    |
| `rustup component add rust-docs`   | 文档通常随安装自带           |
| `cargo install cargo-watch`       | `npm install -g nodemon`   |
| `cargo install cargo-edit`        | `npm install -g npm-check-updates` |

```bash
# 添加代码格式化和 linter
rustup component add rustfmt clippy

# 安装 cargo-watch 实现热重载
cargo install cargo-watch

# 安装 cargo-edit 支持 cargo add
cargo install cargo-edit
```

---

## 2. Cargo — Rust 的 npm

Cargo 是 Rust 的官方包管理和构建工具，相当于 **npm + tsc + jest** 的合体。以下命令都有直接的 Node.js 对应关系。

### cargo new / cargo init vs npm init

| Rust                    | Node.js         | 说明           |
|-------------------------|-----------------|----------------|
| `cargo new my_app`      | `mkdir my_app && cd my_app && npm init -y` | 创建新项目并初始化 |
| `cargo new --lib my_lib`| `npm init -y` (库) | 创建库项目       |
| `cargo init`            | `npm init`      | 在当前目录初始化 |

```bash
# Rust：一步到位创建可执行项目
cargo new hello-world
# 生成：Cargo.toml, src/main.rs, .gitignore

# Rust：创建库项目
cargo new --lib my-utils

# Node.js：需要分步
mkdir hello-world && cd hello-world
npm init -y
# 还需要手动创建 src/index.ts、配置 tsconfig.json
```

### cargo build vs npm run build (tsc)

```bash
# Rust
cargo build           # Debug 构建（快）
cargo build --release # Release 构建（优化后，慢）

# Node.js
npm run build         # 通常调用 tsc 编译 TS
```

**输出对比：**
- Rust: `target/debug/my_app` 或 `target/release/my_app`（可执行文件）
- Node.js: `dist/index.js` 等（需通过 `node dist/index.js` 运行）

### cargo run vs npx ts-node / node dist/index.js

```bash
# Rust：编译 + 运行，一步到位
cargo run
cargo run --release   # 用优化版本运行

# Node.js：需要先编译或直接用 ts-node
npx ts-node src/index.ts
# 或
npm run build && node dist/index.js
```

### cargo test vs npm test (jest)

```bash
# Rust：内置测试框架，无需额外配置
cargo test

# 运行特定测试
cargo test test_add

# Node.js
npm test              # 通常运行 jest/vitest
```

Rust 测试写在源码中（`#[cfg(test)]` 模块）或 `tests/` 目录，无需安装 jest。

### cargo add vs npm install

```bash
# Rust（需先安装 cargo-edit）
cargo add serde serde_json
cargo add --dev tokio-test   # 开发依赖

# Node.js
npm install serde serde_json
npm install -D jest
```

### cargo publish vs npm publish

```bash
# Rust：发布到 crates.io
cargo login              # 首次需要 API token
cargo publish

# Node.js：发布到 npm registry
npm login
npm publish
```

---

## 3. Cargo.toml vs package.json 逐字段对比

### 并排对比

**Cargo.toml（Rust）:**

```toml
[package]
name = "my-app"
version = "0.1.0"
edition = "2024"           # Rust 独有：语言版本
authors = ["You <you@example.com>"]
description = "A sample Rust application"
license = "MIT"
repository = "https://github.com/you/my-app"

[dependencies]
serde = "1.0"
tokio = { version = "1.0", features = ["full"] }

[dev-dependencies]
tempfile = "3.0"

[features]
default = []
cli = ["serde"]
```

**package.json（Node.js）:**

```json
{
  "name": "my-app",
  "version": "0.1.0",
  "author": "You <you@example.com>",
  "description": "A sample Node application",
  "license": "MIT",
  "repository": "https://github.com/you/my-app",
  "dependencies": {
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 字段对应关系

| Cargo.toml              | package.json          | 说明                    |
|-------------------------|-----------------------|-------------------------|
| `[package]`             | 根级字段              | 包元信息                |
| `name`                  | `name`                | 包名                    |
| `version`               | `version`             | 语义化版本              |
| `edition`               | （无）                | Rust 语言版本（2015/2018/2021/2024） |
| `authors`               | `author`              | 作者                    |
| `description`           | `description`         | 描述                    |
| `license`               | `license`             | 许可证                  |
| `repository`            | `repository`          | 仓库地址                |
| `[dependencies]`        | `dependencies`        | 生产依赖                |
| `[dev-dependencies]`    | `devDependencies`     | 开发/测试依赖           |
| `[build-dependencies]`  | （无直接对应）        | 构建脚本依赖            |
| `[features]`            | `optionalDependencies` 等 | 可选功能/条件编译       |

### edition 的概念（Rust 独有）

`edition` 是 Rust 的语言版本，类似 ES5/ES6/ES2020，但通过配置而非编译器 flag 切换：

- **2015**：Rust 1.0 的初始版本
- **2018**：async/await、模块系统改进等
- **2021**：disjoint capture、默认 Cargo 特性等
- **2024**：最新稳定特性

在 `Cargo.toml` 中指定：

```toml
edition = "2021"
```

新项目一般用 `2021` 或 `2024`。

### features vs optional dependencies

Rust 的 `features` 用于条件编译和可选功能，比 Node 的 optional 更灵活：

```toml
[features]
default = ["std"]
std = []           # 启用标准库（no_std 项目用）
json = ["serde"]   # 启用 JSON 支持

[dependencies]
serde = { version = "1.0", optional = true }
```

使用时：`cargo build --features json` 或依赖方 `my-crate = { version = "1.0", features = ["json"] }`。

---

## 4. 项目结构对比

### 典型 Rust 项目结构

```
my-rust-app/
├── Cargo.toml           # 项目配置（类似 package.json）
├── Cargo.lock           # 锁文件（类似 package-lock.json）
├── src/
│   ├── main.rs          # 可执行程序入口（类似 src/index.ts）
│   ├── lib.rs           # 库入口（对外暴露的 API）
│   └── utils/
│       └── mod.rs       # 模块
├── tests/               # 集成测试（类似 __tests__ 的独立测试）
│   └── integration_test.rs
├── examples/            # Rust 独有：示例可执行文件
│   └── basic_usage.rs
├── benches/             # Rust 独有：内置基准测试
│   └── bench.rs
└── target/              # 构建输出（类似 dist/，但通常不提交）
    ├── debug/
    └── release/
```

### 典型 TS/Node.js 项目结构

```
my-node-app/
├── package.json
├── package-lock.json
├── tsconfig.json
├── src/
│   ├── index.ts         # 主入口
│   └── utils/
│       └── helper.ts
├── __tests__/           # 或 tests/
│   └── index.test.ts
├── dist/                # 编译输出
└── node_modules/
```

### 关键对比

| Rust                     | Node.js                    |
|--------------------------|----------------------------|
| `src/main.rs`            | `src/index.ts`             |
| `src/lib.rs`             | 库的入口（如 `src/index.ts` 导出） |
| `tests/`                 | `__tests__/` 或 `tests/`   |
| `examples/`              | 需手动建 `examples/` 或用 README 演示 |
| `benches/`               | 需用 benchmark 库（如 `benchmark`） |
| `target/`                | `dist/` + `node_modules/`  |

### src/lib.rs — 库入口点

在库项目中，`lib.rs` 定义对外公开的 API，类似 TS 中 `src/index.ts` 的 `export`：

```rust
// src/lib.rs
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

pub mod utils;
```

### examples/ — Rust 独有的好东西

`examples/` 中的每个 `.rs` 文件都是可独立运行的示例：

```bash
cargo run --example basic_usage
```

这比在 README 里贴代码更可靠，还能保证示例可编译运行。

### benches/ — 内置基准测试

```bash
cargo bench
```

Rust 标准库提供 `#[bench]`（或通过 `criterion` 等库），无需额外搭建框架。

---

## 5. 开发体验工具

| 功能         | Rust                     | Node.js                |
|--------------|--------------------------|------------------------|
| 代码检查     | `cargo clippy`           | `eslint`               |
| 代码格式化   | `cargo fmt`              | `prettier`             |
| LSP 语言服务 | rust-analyzer            | tsserver               |
| 文档生成     | `cargo doc`              | typedoc / jsdoc        |
| 热重载开发   | `cargo watch`            | nodemon                |

### cargo clippy vs ESLint

```bash
# Rust
cargo clippy

# 自动修复
cargo clippy --fix

# Node.js
npx eslint .
npm run lint
```

Clippy 内置大量 lint 规则，涵盖性能、风格、正确性等。

### cargo fmt vs Prettier

```bash
# Rust
cargo fmt           # 格式化整个项目
cargo fmt -- --check  # 仅检查不写入

# Node.js
npx prettier --write .
npx prettier --check .
```

### rust-analyzer vs tsserver

两者都是 LSP，提供：

- 代码补全
- 跳转定义
- 悬停文档
- 重构

在 VS Code 中安装 `rust-analyzer` 扩展即可，类似 TypeScript 的 IntelliSense。

### cargo doc vs typedoc

```bash
# Rust：生成 HTML 文档，默认在 target/doc/
cargo doc --open     # 构建并打开浏览器

# Node.js
npx typedoc --out docs src
```

`cargo doc` 会解析 `///` 文档注释，生成结构化 API 文档。

### cargo watch vs nodemon

```bash
# 需先安装：cargo install cargo-watch

# Rust：文件变动时自动 build + run
cargo watch -x run

# 或只 build
cargo watch -x build

# Node.js
npx nodemon --exec ts-node src/index.ts
```

---

## 6. 实战：从零创建一个 Rust 项目

### 完整步骤：Rust 版

```bash
# 1. 创建项目
cargo new my-cli-tool
cd my-cli-tool

# 2. 添加依赖（需 cargo-edit）
cargo add clap     # 命令行解析
cargo add serde serde_json
cargo add --dev tokio-test

# 3. 编写代码
# 编辑 src/main.rs ...

# 4. 构建
cargo build
# 或 release：cargo build --release

# 5. 运行
cargo run
cargo run -- --help   # 传参给程序

# 6. 测试
cargo test

# 7. 代码质量
cargo fmt
cargo clippy

# 8. 文档
cargo doc --open
```

### 对应步骤：Node.js 版

```bash
# 1. 创建项目
mkdir my-cli-tool && cd my-cli-tool
npm init -y

# 2. 添加依赖
npm install commander   # 命令行解析（对应 Rust 的 clap）
npm install -D jest @types/node typescript

# 3. 编写代码
# 编辑 src/index.ts ...
# 配置 tsconfig.json

# 4. 构建
npm run build   # 需在 package.json 配置 "build": "tsc"

# 5. 运行
node dist/index.js
# 或 npx ts-node src/index.ts

# 6. 测试
npm test

# 7. 代码质量
npx prettier --write .
npx eslint .

# 8. 文档
npx typedoc --out docs src
```

### 并排命令速查

| 操作       | Rust                     | Node.js                          |
|------------|--------------------------|----------------------------------|
| 创建项目   | `cargo new my-app`       | `mkdir my-app && npm init -y`    |
| 添加依赖   | `cargo add pkg`          | `npm install pkg`                |
| 构建       | `cargo build`            | `npm run build`                  |
| 运行       | `cargo run`              | `node dist/index.js`             |
| 测试       | `cargo test`             | `npm test`                       |
| 格式化     | `cargo fmt`              | `npx prettier --write .`         |
| 代码检查   | `cargo clippy`           | `npx eslint .`                   |
| 文档       | `cargo doc --open`       | `npx typedoc --out docs src`     |

---

## 小结

Rust 工具链围绕 **rustup**（版本与组件管理）和 **Cargo**（包管理与构建）展开，与 Node.js 的 nvm + npm 模型高度对应。掌握以下对应关系即可快速上手：

- **rustup** ≈ nvm
- **Cargo** ≈ npm + tsc + jest
- **Cargo.toml** ≈ package.json
- **src/main.rs** ≈ src/index.ts
- **tests/** ≈ __tests__/

下一章将介绍 **Rust 的类型系统基础**，从 TypeScript 的类型映射出发，学习 Rust 的基础类型、变量绑定和 struct。
