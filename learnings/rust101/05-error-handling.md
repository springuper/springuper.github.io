# 第 05 章：错误处理 — 告别 try/catch

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

**Rust 没有 null、undefined，也没有 exception。** 错误被编码进类型系统，编译器强制你在编译期处理所有可能的失败。本章将带你从 TS/JS 的 try/catch 思维过渡到 Rust 的错误处理哲学。

---

## 目录

1. [Rust 的错误处理哲学](#1-rust-的错误处理哲学)
2. [Option&lt;T&gt; — 取代 null/undefined](#2-optiont--取代-nullundefined)
3. [Result&lt;T, E&gt; — 取代 try/catch](#3-resultt-e--取代-trycatch)
4. [? 操作符 — 优雅的错误传播](#4--操作符--优雅的错误传播)
5. [自定义错误类型](#5-自定义错误类型)
6. [实战：完整的错误处理链](#6-实战完整的错误处理链)
7. [panic! — Rust 的「真异常」](#7-panic--rust-的真异常)
8. [常见坑](#8-常见坑)
9. [小练习](#9-小练习)

---

## 1. Rust 的错误处理哲学

### 概念引入（从 TS/JS 视角）

在 TypeScript/Node.js 中，错误处理主要依赖：

- **null / undefined**：表示「没有值」
- **try / catch / throw**：表示「可能出错」

```typescript
// TS/JS 的典型错误处理
function getUser(id: string): User | null {
  const user = database.find(u => u.id === id);
  return user ?? null;  // 可能返回 null，调用者容易忘记检查
}

async function fetchData(url: string): Promise<Data> {
  const res = await fetch(url);  // 可能抛错，但签名看不出来
  return res.json();             // 也可能抛错
}
```

### try/catch 的三大问题

| 问题 | 说明 |
|------|------|
| **不知道会抛什么错** | 函数签名不声明可能抛出的异常类型，调用者只能猜或读文档 |
| **容易忘记 catch** | 没有编译期强制，漏写 catch 就变成未捕获异常 |
| **error 类型是 unknown** | `catch (e)` 中 `e` 是 `unknown`，需要手动类型收窄 |

```typescript
try {
  const data = await riskyOperation();
  process(data);
} catch (e) {
  // e 是 unknown！你根本不知道会接到什么
  if (e instanceof Error) {
    console.error(e.message);
  } else {
    throw e;  // 可能是字符串、对象、任何东西
  }
}
```

### Rust 的思路：错误是值，类型系统告诉你所有可能失败

- **没有 null / undefined** → 用 `Option<T>` 表达「可能有 / 可能没有」
- **没有 exception** → 用 `Result<T, E>` 表达「可能成功 / 可能失败」
- **编译器强制处理** → 不处理 `Option`/`Result` 就无法编译通过

---

## 2. Option&lt;T&gt; — 取代 null/undefined

### 概念引入（从 TS/JS 视角）

```typescript
// TS: 三种「无值」状态
let a: string | null = null;
let b: string | undefined = undefined;
let c: string | null | undefined = obj[key];  // 可能是 undefined
```

### Rust 的做法：Some(T) 和 None

```rust
enum Option<T> {
    Some(T),
    None,
}
```

`Option<T>` 只有两种状态：`Some(值)` 或 `None`，没有 `null` 和 `undefined` 的歧义。

### 为什么 Option 更好

| 对比项 | TS: T \| null \| undefined | Rust: Option&lt;T&gt; |
|--------|----------------------------|------------------------|
| 歧义 | null 和 undefined 语义重叠 | 只有 None，语义清晰 |
| 编译器检查 | 容易忘记判空，运行时崩溃 | 必须显式处理 None |
| 链式操作 | 需可选链 ?. 配合 | map、and_then 等组合子 |

### 常用方法

| 方法 | 作用 |
|------|------|
| `unwrap()` | 取出 Some 中的值，None 时 panic |
| `expect(msg)` | 同 unwrap，panic 时输出自定义信息 |
| `map(f)` | Some(x) → Some(f(x))，None → None |
| `and_then(f)` | 类似 flatMap，用于链式 Option 操作 |
| `unwrap_or(default)` | None 时返回默认值 |
| `unwrap_or_else(f)` | None 时调用闭包计算默认值 |
| `is_some()` / `is_none()` | 判断是否有值 |

### 实战：从 HashMap 中取值

**TypeScript 版本：**

```typescript
const cache: Record<string, User> = {};
const user = cache["user-123"];  // 可能是 undefined！
if (user) {
  console.log(user.name);
}
// 忘记判空 → 运行时 TypeError
```

**Rust 版本：**

```rust
use std::collections::HashMap;

#[derive(Clone)]
struct User { name: String }

let mut cache: HashMap<String, User> = HashMap::new();
let user = cache.get("user-123");  // 返回 Option<&User>

// 必须处理 None，否则编译不过
match user {
    Some(u) => println!("{}", u.name),
    None => println!("User not found"),
}

// 或用 if let
if let Some(u) = cache.get("user-123") {
    println!("{}", u.name);
}

// 链式处理
let name = cache
    .get("user-123")
    .map(|u| u.name.clone())
    .unwrap_or_else(|| "Unknown".to_string());
```

---

## 3. Result&lt;T, E&gt; — 取代 try/catch

### 概念引入（从 TS/JS 视角）

```typescript
// TS: 错误通过 throw 传播
function readFile(path: string): string {
  const content = fs.readFileSync(path, 'utf-8');  // 可能抛错
  return content;  // 调用者看不到「可能失败」的声明
}
```

### Rust 的做法：Ok(T) 和 Err(E)

```rust
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

成功时返回 `Ok(值)`，失败时返回 `Err(错误)`。错误类型 `E` 是签名的一部分。

### 为什么 Result 更好

| 对比项 | TS: try/catch | Rust: Result&lt;T, E&gt; |
|--------|---------------|--------------------------|
| 错误在签名中 | 否 | 是，一眼能看到 |
| 强制处理 | 否 | 是 |
| 错误类型 | unknown | 具体类型 E |

### 常用方法

| 方法 | 作用 |
|------|------|
| `unwrap()` | Ok 时返回值，Err 时 panic |
| `expect(msg)` | 同 unwrap，panic 时输出 msg |
| `map(f)` | Ok(x) → Ok(f(x))，Err 保持不变 |
| `map_err(f)` | Err(e) → Err(f(e))，Ok 保持不变 |
| `and_then(f)` | 链式处理，f 返回新的 Result |
| `ok()` | 转为 Option，Ok(x) → Some(x)，Err → None |
| `err()` | 转为 Option，Ok → None，Err(e) → Some(e) |

### 实战：文件读取

**TypeScript 版本：**

```typescript
import fs from 'fs';

function readConfig(path: string): string {
  try {
    return fs.readFileSync(path, 'utf-8');
  } catch (e) {
    // e 类型未知，需要类型收窄
    throw new Error(`Failed to read config: ${e}`);
  }
}
```

**Rust 版本：**

```rust
use std::fs;
use std::io;

fn read_config(path: &str) -> Result<String, io::Error> {
    fs::read_to_string(path)
}

// 调用者必须处理错误
fn main() {
    match read_config("config.json") {
        Ok(content) => println!("Config: {}", content),
        Err(e) => eprintln!("Error: {}", e),
    }
}
```

---

## 4. ? 操作符 — 优雅的错误传播

### 概念引入：与 TS 的 ?. 不同

```typescript
// TS 可选链 ?.：属性可能 undefined 时短路返回 undefined
const name = user?.profile?.name;  // 任一为 undefined 则整个为 undefined
```

Rust 的 `?` 完全不是这回事：**它是「错误传播」**。遇到 `Err` 时提前返回，遇到 `Ok` 时解包取值。

### ? 的展开等价代码

```rust
// 使用 ?
fn read_and_parse(path: &str) -> Result<Config, io::Error> {
    let content = fs::read_to_string(path)?;  // Err 时提前 return
    let config = parse_config(&content)?;     // Err 时提前 return
    Ok(config)
}

// 等价于
fn read_and_parse_manual(path: &str) -> Result<Config, io::Error> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => return Err(e.into()),
    };
    let config = match parse_config(&content) {
        Ok(c) => c,
        Err(e) => return Err(e.into()),
    };
    Ok(config)
}
```

### 链式使用 ?：一条链路的错误处理

**TypeScript 版本：**

```typescript
function loadUserEmail(path: string): string {
  const content = fs.readFileSync(path, 'utf-8');  // 可能抛
  const json = JSON.parse(content);                // 可能抛
  return json.user.email;                          // 可能 undefined
}
```

**Rust 版本：**

```rust
use std::fs;
use std::io;

fn load_user_email(path: &str) -> Result<String, Box<dyn std::error::Error>> {
    let content = fs::read_to_string(path)?;
    let json: serde_json::Value = serde_json::from_str(&content)?;
    let email = json["user"]["email"]
        .as_str()
        .ok_or_else(|| format!("missing email field").into())?
        .to_string();
    Ok(email)
}
```

`?` 让错误从每一层自动向上传播，代码简洁且类型安全。

---

## 5. 自定义错误类型

### 概念引入（从 TS 视角）

```typescript
// TS: 通常用 class extends Error
class ConfigError extends Error {
  constructor(message: string, public readonly path: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
```

### Rust：用 enum 定义错误

```rust
#[derive(Debug)]
enum ConfigError {
    FileNotFound { path: String },
    ParseError { line: u32, message: String },
    ValidationError { field: String, reason: String },
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::FileNotFound { path } => write!(f, "File not found: {}", path),
            ConfigError::ParseError { line, message } => write!(f, "Parse error at line {}: {}", line, message),
            ConfigError::ValidationError { field, reason } => write!(f, "Invalid {}: {}", field, reason),
        }
    }
}

impl std::error::Error for ConfigError {}
```

### thiserror：简化错误定义

```rust
use thiserror::Error;

#[derive(Error, Debug)]
enum ConfigError {
    #[error("File not found: {path}")]
    FileNotFound { path: String },

    #[error("Parse error at line {line}: {message}")]
    ParseError { line: u32, message: String },

    #[error("Invalid {field}: {reason}")]
    ValidationError { field: String, reason: String },
}
```

### anyhow：应用层错误处理

当你不关心具体错误类型，只需要「随便什么错误」时，用 `anyhow`：

```rust
use anyhow::{Context, Result};

fn load_config(path: &str) -> Result<Config> {
    let content = fs::read_to_string(path)
        .context("Failed to read config file")?;
    let config = parse_config(&content)
        .context("Failed to parse config")?;
    Ok(config)
}
```

### 对比：何时用 thiserror，何时用 anyhow

| 场景 | 推荐 | 原因 |
|------|------|------|
| 库（library） | thiserror | 暴露具体错误类型给调用者 |
| 应用（binary） | anyhow | 只关心「成功/失败」，不关心细节 |
| 需要区分错误类型做分支 | thiserror | 可以 `match err` 做不同处理 |
| 快速写个 CLI 工具 | anyhow | 省事，错误信息足够 |

---

## 6. 实战：完整的错误处理链

一个完整的「配置文件读取 → 解析 → 验证」示例。

**TypeScript 版本：**

```typescript
interface Config {
  port: number;
  host: string;
}

function loadConfig(path: string): Config {
  let content: string;
  try {
    content = fs.readFileSync(path, 'utf-8');
  } catch (e) {
    throw new Error(`Cannot read ${path}: ${e}`);
  }

  let json: any;
  try {
    json = JSON.parse(content);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (typeof json.port !== 'number' || json.port < 1 || json.port > 65535) {
    throw new Error('Invalid port');
  }
  if (typeof json.host !== 'string') {
    throw new Error('Invalid host');
  }

  return { port: json.port, host: json.host };
}
```

**Rust 版本：**

```rust
use anyhow::{Context, Result};
use serde::Deserialize;
use std::fs;

#[derive(Debug, Deserialize)]
struct Config {
    port: u16,
    host: String,
}

fn load_config(path: &str) -> Result<Config> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Cannot read config: {}", path))?;

    let config: Config = serde_json::from_str(&content)
        .context("Invalid JSON")?;

    validate_config(&config)?;
    Ok(config)
}

fn validate_config(config: &Config) -> Result<()> {
    if config.port == 0 {
        anyhow::bail!("Port must be between 1 and 65535");
    }
    Ok(())
}

fn main() {
    match load_config("config.json") {
        Ok(config) => println!("Loaded: {:?}", config),
        Err(e) => eprintln!("Error: {:#}", e),
    }
}
```

错误从 `fs::read_to_string` → `serde_json::from_str` → `validate_config` 一路用 `?` 传播到 `main`，调用者只需一次 `match`。

---

## 7. panic! — Rust 的「真异常」

### panic vs Result 的使用场景

| 场景 | 用 Result | 用 panic! |
|------|-----------|-----------|
| 可恢复错误（文件不存在、网络超时） | ✓ | |
| 不可恢复错误（数组越界、契约违反） | | ✓ |
| 程序逻辑 bug | | ✓ |
| 快速原型/示例代码 | | ✓（省事） |

### 不可恢复的错误才用 panic

```rust
// 合理使用 panic：契约被违反
fn get_first(items: &[i32]) -> i32 {
    items.first().copied().expect("get_first called with empty slice")
}

// 合理使用 Result：可恢复
fn safe_get_first(items: &[i32]) -> Option<i32> {
    items.first().copied()
}
```

### 对比 Node.js

| Node.js | Rust |
|---------|------|
| `process.exit(1)` | `std::process::exit(1)` |
| `throw new Error()` | `panic!("...")` |
| `uncaughtException` | panic 会展开调用栈并终止 |
| `process.on('uncaughtException', ...)` | 可以用 `catch_unwind` 捕获（不推荐） |

---

## 8. 常见坑

### 坑 1：滥用 unwrap()

```rust
// 不好：生产代码中 unwrap 会在出错时直接 panic
let user = cache.get("id").unwrap();

// 好：显式处理或传播
let user = cache.get("id").ok_or("User not found")?;
```

### 坑 2：? 只能在返回 Result/Option 的函数里用

```rust
fn wrong() {
    let x = some_result()?;  // 编译错误！? 需要返回 Result/Option
}

fn correct() -> Result<(), Error> {
    let x = some_result()?;  // OK
    Ok(())
}
```

### 坑 3：混用 Option 和 Result

```rust
// Option 转 Result
let val = some_option.ok_or("missing value")?;

// Result 转 Option
let val = some_result.ok();  // Err 变 None
```

### 坑 4：Error 类型不兼容时用 .into()

```rust
fn foo() -> Result<(), Box<dyn std::error::Error>> {
    let _ = std::fs::read_to_string("x")?;  // io::Error
    let _ = serde_json::from_str::<()>("")?; // serde_json::Error
    // ? 会自动 .into() 到 Box<dyn Error>
    Ok(())
}
```

---

## 9. 小练习

### 练习 1：Option 链式取值

实现一个函数 `get_nested_value(map: HashMap<String, HashMap<String, i32>>, outer: &str, inner: &str) -> Option<i32>`，安全地取出 `map[outer][inner]`，任一键不存在时返回 `None`。

<details>
<summary>参考答案</summary>

```rust
use std::collections::HashMap;

fn get_nested_value(
    map: &HashMap<String, HashMap<String, i32>>,
    outer: &str,
    inner: &str,
) -> Option<i32> {
    map.get(outer).and_then(|m| m.get(inner).copied())
}
```
</details>

### 练习 2：Result 与 ? 组合

编写 `read_config_port(path: &str) -> Result<u16, Box<dyn std::error::Error>>`，读取 JSON 文件并解析出 `port` 字段，用 `?` 传播所有错误。

<details>
<summary>参考答案</summary>

```rust
use std::fs;
use std::error::Error;

fn read_config_port(path: &str) -> Result<u16, Box<dyn Error>> {
    let content = fs::read_to_string(path)?;
    let json: serde_json::Value = serde_json::from_str(&content)?;
    let port = json["port"]
        .as_u64()
        .and_then(|p| if p <= 65535 { Some(p as u16) } else { None })
        .ok_or("Invalid or missing port")?;
    Ok(port)
}
```
</details>

### 练习 3：自定义错误类型

用 `thiserror` 定义一个 `AppError`，包含 `Io`、`Parse`、`Validation` 三种变体，并实现一个会返回其中一种错误的函数。

<details>
<summary>参考答案</summary>

```rust
use thiserror::Error;

#[derive(Error, Debug)]
enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Validation error: {0}")]
    Validation(String),
}

fn might_fail(choice: u32) -> Result<String, AppError> {
    match choice {
        0 => Err(AppError::Parse("invalid input".into())),
        1 => Err(AppError::Validation("value out of range".into())),
        _ => Ok("ok".into()),
    }
}
```
</details>

---

**下一章预告：** 第 06 章将介绍 Rust 的模块系统与工程组织，如何用 `mod` 和 `use` 组织大型项目。
