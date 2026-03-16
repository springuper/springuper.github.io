# 第 06 章：模式匹配 —— 超级加强版的 switch

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

**模式匹配是 Rust 最强大的特性之一。** 从 TypeScript/JavaScript 的 `switch` 出发，你会发现 Rust 的 `match` 不仅能做更多事，还能让编译器帮你「查漏补缺」，从根源上避免许多运行时 bug。

---

## 目录

1. [match vs switch —— 全面对比](#1-match-vs-switch--全面对比)
2. [模式的种类](#2-模式的种类)
3. [解构赋值](#3-解构赋值)
4. [if let 和 while let](#4-if-let-和-while-let)
5. [match 守卫（guard）](#5-match-守卫guard)
6. [let-else（Rust 1.65+）](#6-let-elserust-165)
7. [模式匹配与 Option/Result 的结合](#7-模式匹配与-optionresult-的结合)
8. [实战：用 match 实现一个简单的命令行工具](#8-实战用-match-实现一个简单的命令行工具)
9. [常见坑](#9-常见坑)
10. [小练习](#10-小练习)

---

## 1. match vs switch —— 全面对比

### 概念引入（从 TS/JS 视角）

在 TypeScript/JavaScript 中，`switch` 是最常用的多分支选择结构：

```typescript
function getStatusMessage(status: number): string {
  switch (status) {
    case 200:
      return "OK";
    case 404:
      return "Not Found";
    case 500:
      return "Server Error";
    default:
      return "Unknown";
  }
}
```

你可能遇到过这些问题：
- **忘记 `break`** —— 导致 fall-through，执行了不该执行的 case
- **忘记处理 `default`** —— 新增状态码时容易漏掉
- **`switch` 是语句** —— 不能直接当作表达式返回值，需要重复 `return`

### Rust 的做法

```rust
fn get_status_message(status: u16) -> &'static str {
    match status {
        200 => "OK",
        404 => "Not Found",
        500 => "Server Error",
        _ => "Unknown",
    }
}
```

### 背后的 Why

Rust 的 `match` 设计哲学：**让编译器帮你思考**。通过穷尽性检查和表达式语义，把运行时错误前置到编译期。

### 对比表格

| 特性 | TypeScript `switch` | Rust `match` |
|------|---------------------|--------------|
| **语法** | `switch (x) { case a: ... break; }` | `match x { a => ..., }` |
| **类型** | 语句（statement） | 表达式（expression） |
| **返回值** | 需在每个分支 `return` | 整个 match 求值为最后一个表达式的值 |
| **fall-through** | 默认 fall-through，需手动 `break` | **不存在** fall-through |
| **穷尽性** | `default` 可选，易遗漏 | **编译器强制**处理所有情况 |
| **模式能力** | 仅等值比较 | 字面量、解构、范围、守卫、组合 |

### 基本语法对比

**TypeScript：**
```typescript
switch (command) {
  case "start":
    startServer();
    break;
  case "stop":
    stopServer();
    break;
  case "restart":
    restartServer();
    break;
  default:
    console.log("Unknown command");
}
```

**Rust：**
```rust
match command {
    "start" => start_server(),
    "stop" => stop_server(),
    "restart" => restart_server(),
    _ => println!("Unknown command"),
}
```

### match 是表达式！

`match` 的每个分支都会求值，整个 `match` 的结果就是匹配到的分支的值。**类型必须一致**：

```rust
fn example() {
    let x = 5;
    let description = match x {
        1 => "one",
        2 => "two",
        3..=5 => "three to five",
        _ => "other",
    };  // 注意分号：let 语句需要结尾
    println!("{}", description);
}
```

对比 TypeScript，你不需要每个分支都写 `return`：

```typescript
// TS: 每个分支都要 return
const description = (() => {
  switch (x) {
    case 1: return "one";
    case 2: return "two";
    default: return "other";
  }
})();
```

### 穷尽性检查（Exhaustive Matching）

Rust 编译器会**强制**你处理所有可能的情况。遗漏一个枚举变体？编译直接报错：

```rust
enum Direction {
    North,
    South,
    East,
    West,
}

fn move_toward(d: Direction) -> &'static str {
    match d {
        Direction::North => "up",
        Direction::South => "down",
        Direction::East => "right",
        // 忘记 West？编译错误：
        // error[E0004]: non-exhaustive pattern: `West` not covered
    }
}
```

**修复：** 必须加上 `Direction::West` 或使用 `_` 通配符。

### 没有 fall-through bug

JavaScript 的经典陷阱：

```typescript
// TS/JS: 忘记 break 导致 bug
function getMonthDays(month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
      return 31;  // 如果这里忘了 return，会继续执行到 30
    case 4:
    case 6:
      return 30;
    default:
      return 0;
  }
}
```

Rust 的 `match` 每个分支天然隔离，**不可能** fall-through。多 case 合并用 `|`：

```rust
fn get_month_days(month: u8) -> u8 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => 28,  // 简化，不考虑闰年
        _ => 0,
    }
}
```

---

## 2. 模式的种类

### 字面量匹配

```rust
match 42 {
    0 => println!("zero"),
    1 | 2 => println!("one or two"),
    3..=10 => println!("three to ten"),
    _ => println!("something else"),
}
```

### 变量绑定

匹配的同时**绑定**到变量，可在分支中使用：

```rust
let x = Some(7);
match x {
    Some(value) => println!("Got {}", value),  // value 被绑定为 7
    None => println!("Nothing"),
}
```

### 通配符 `_`

表示「其他所有情况」，不绑定值：

```rust
match (1, 2) {
    (0, 0) => println!("origin"),
    (0, y) => println!("y axis at {}", y),
    (x, 0) => println!("x axis at {}", x),
    (_, _) => println!("somewhere else"),  // 不关心具体值
}
```

### 元组解构

```rust
let point = (0, 5);
match point {
    (0, 0) => println!("origin"),
    (0, y) => println!("on y-axis at {}", y),
    (x, 0) => println!("on x-axis at {}", x),
    (x, y) => println!("({}, {})", x, y),
}
```

### struct 解构

```rust
struct Point {
    x: i32,
    y: i32,
}

let p = Point { x: 0, y: 7 };
match p {
    Point { x: 0, y } => println!("on y-axis at {}", y),
    Point { x, y: 0 } => println!("on x-axis at {}", x),
    Point { x, y } => println!("({}, {})", x, y),
}
```

### enum 解构（配合 Option 和 Result）

```rust
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
}

let msg = Message::Move { x: 3, y: 4 };
match msg {
    Message::Quit => println!("quit"),
    Message::Move { x, y } => println!("move to ({}, {})", x, y),
    Message::Write(text) => println!("write: {}", text),
}
```

**Option：**
```rust
match Some(3) {
    Some(x) => println!("Got {}", x),
    None => println!("Got nothing"),
}
```

**Result：**
```rust
match std::fs::File::open("foo.txt") {
    Ok(file) => { /* 使用 file */ }
    Err(e) => eprintln!("Error: {}", e),
}
```

### 范围匹配 `1..=5`

```rust
match 3 {
    1..=5 => println!("one through five"),
    6..=10 => println!("six through ten"),
    _ => println!("other"),
}
```

### 多个模式 `|`（类似 switch 的多个 case）

```rust
match c {
    'a' | 'e' | 'i' | 'o' | 'u' => println!("vowel"),
    '0'..='9' => println!("digit"),
    _ => println!("consonant or other"),
}
```

---

## 3. 解构赋值

### 概念引入（从 TS/JS 视角）

TypeScript 的解构已经很强大：

```typescript
const [a, b] = [1, 2];
const { name, age } = user;
const { x: px, y: py } = point;
```

### Rust vs TS 解构对比

**元组解构：**

| TypeScript | Rust |
|------------|------|
| `const [a, b] = [1, 2]` | `let (a, b) = (1, 2)` |
| `const [first, ...rest] = arr` | `let (first, rest @ ..) = ...`（slice 模式） |

**对象/struct 解构：**

```typescript
// TypeScript
interface User {
  name: string;
  age: number;
  email?: string;
}
const { name, age, email = "default@mail.com" } = user;
```

```rust
// Rust
struct User {
    name: String,
    age: u32,
    email: Option<String>,
}
let User { name, age, email } = user;
let email = email.unwrap_or_else(|| "default@mail.com".to_string());
```

### struct 解构

```rust
struct Config {
    host: String,
    port: u16,
    debug: bool,
}

let config = Config {
    host: "localhost".into(),
    port: 8080,
    debug: true,
};

let Config { host, port, debug } = config;
println!("{}:{}", host, port);
```

### tuple 解构

```rust
let (x, y, z) = (1, 2, 3);
let (head, .., tail) = (1, 2, 3, 4, 5);  // head=1, tail=5
```

### 嵌套解构

```rust
enum Shape {
    Circle { center: (f64, f64), radius: f64 },
    Rectangle { top_left: (f64, f64), bottom_right: (f64, f64) },
}

let shape = Shape::Circle {
    center: (0.0, 0.0),
    radius: 1.0,
};

match shape {
    Shape::Circle { center: (cx, cy), radius } => {
        println!("center: ({}, {}), radius: {}", cx, cy, radius);
    }
    Shape::Rectangle { top_left: (x1, y1), bottom_right: (x2, y2) } => {
        println!("rect: ({},{}) to ({},{})", x1, y1, x2, y2);
    }
}
```

### 代码对比

**TypeScript 嵌套解构：**
```typescript
const { address: { city, zip } } = user;
```

**Rust 嵌套解构：**
```rust
struct Address { city: String, zip: String }
struct User { name: String, address: Address }
let User { address: Address { city, zip }, .. } = user;
```

---

## 4. if let 和 while let

### 概念引入（从 TS/JS 视角）

当只关心一种情况时，TS 里常见写法：

```typescript
if (result !== null && result !== undefined) {
  console.log(result);
}
// 或
if ('ok' in response && response.ok) {
  handleSuccess(response.data);
}
```

### if let —— 只关心一种情况时的简写

`match` 要写完整，但有时你只想处理 `Some`，忽略 `None`：

```rust
// 用 match 写起来啰嗦
let some_value = Some(7);
match some_value {
    Some(x) => println!("Got {}", x),
    None => {},  // 什么都不做，但要写
}

// if let 简写
if let Some(x) = some_value {
    println!("Got {}", x);
}
```

**对比 TS 的 `if (x !== null)`：**

```typescript
// TypeScript
const value: number | null = getValue();
if (value !== null) {
  console.log(value);
}
```

```rust
// Rust
let value: Option<i32> = get_value();
if let Some(v) = value {
    println!("{}", v);
}
```

### while let —— 循环中的模式匹配

适用于「一直取到 None 为止」的迭代器模式：

```rust
let mut stack = vec![1, 2, 3];
while let Some(top) = stack.pop() {
    println!("{}", top);
}
```

**对比 TS：**
```typescript
let item: number | undefined;
while ((item = stack.pop()) !== undefined) {
  console.log(item);
}
```

### 配合 `in` 的 if let（匹配枚举）

```rust
enum Event {
    Click { x: i32, y: i32 },
    KeyPress(char),
}

let event = Event::Click { x: 10, y: 20 };
if let Event::Click { x, y } = event {
    println!("clicked at ({}, {})", x, y);
}
```

---

## 5. match 守卫（guard）

### match 中使用 if 条件

有时模式匹配还不够，需要额外条件。用 `if` 守卫：

```rust
let num = Some(4);
match num {
    Some(x) if x < 5 => println!("less than 5: {}", x),
    Some(x) if x % 2 == 0 => println!("even: {}", x),
    Some(x) => println!("{}", x),
    None => {},
}
```

### 实战示例

**解析 HTTP 状态码 + 消息体：**

```rust
fn handle_response(status: u16, has_body: bool) -> &'static str {
    match (status, has_body) {
        (200, true) => "OK with body",
        (200, false) => "OK no body",
        (404, _) => "Not Found",
        (s, _) if s >= 500 && s < 600 => "Server Error",  // 守卫：范围匹配
        _ => "Unknown",
    }
}
```

更实用的例子 —— 范围守卫：

```rust
match value {
    x if x < 0 => println!("negative"),
    x if x == 0 => println!("zero"),
    x if x <= 100 => println!("small positive"),
    _ => println!("large"),
}
```

---

## 6. let-else（Rust 1.65+）

### `let ... else { }` 语法

当 `let` 绑定的模式不匹配时，执行 `else` 块（必须 diverge，即 `return`、`break`、`panic!` 等）：

```rust
struct Config { host: String, port: u16 }

fn get_config() -> Option<Config> {
    Some(Config { host: "localhost".into(), port: 8080 })
}

fn main() {
    let Some(config) = get_config() else {
        eprintln!("Failed to load config");
        return;
    };
    println!("Config: {}:{}", config.host, config.port);
}
```

### 对比 TS 的 early return 模式

**TypeScript：**
```typescript
function main() {
  const config = getConfig();
  if (config === null) {
    console.error("Failed to load config");
    return;
  }
  console.log(`Config: ${config.host}:${config.port}`);
}
```

**Rust let-else：**
```rust
let Some(config) = get_config() else {
    eprintln!("Failed to load config");
    return;
};
// config 在这里一定是 Some 解构出来的值，类型窄化
```

**优势：** 减少嵌套，`config` 在后续代码中类型已窄化，不需要再处理 `Option`。

---

## 7. 模式匹配与 Option/Result 的结合

### match Option

```rust
fn divide(a: f64, b: f64) -> Option<f64> {
    if b == 0.0 {
        None
    } else {
        Some(a / b)
    }
}

fn main() {
    match divide(10.0, 2.0) {
        Some(result) => println!("Result: {}", result),
        None => println!("Cannot divide by zero"),
    }
}
```

### match Result

```rust
use std::fs::File;

fn main() {
    match File::open("config.json") {
        Ok(file) => { /* 使用 file */ }
        Err(e) => eprintln!("Failed to open file: {}", e),
    }
}
```

### 嵌套匹配

```rust
fn parse_http_request(header: Option<&str>, body: Result<&str, &str>) -> String {
    match (header, body) {
        (Some("application/json"), Ok(data)) => format!("JSON: {}", data),
        (Some(h), Ok(data)) => format!("{}: {}", h, data),
        (_, Err(e)) => format!("Error: {}", e),
        (None, _) => "No header".to_string(),
    }
}
```

### 实战：解析 HTTP 请求

```rust
enum HttpMethod {
    Get,
    Post,
    Put,
    Delete,
}

struct HttpRequest {
    method: HttpMethod,
    path: String,
    version: String,
}

fn parse_request(line: &str) -> Option<HttpRequest> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    match parts.as_slice() {
        ["GET", path, "HTTP/1.1"] | ["GET", path, "HTTP/1.0"] => Some(HttpRequest {
            method: HttpMethod::Get,
            path: path.to_string(),
            version: parts[2].to_string(),
        }),
        ["POST", path, version] => Some(HttpRequest {
            method: HttpMethod::Post,
            path: path.to_string(),
            version: version.to_string(),
        }),
        _ => None,
    }
}

fn main() {
    let req = parse_request("GET /api/users HTTP/1.1");
    match req {
        Some(r) => println!("{} {}", match r.method {
            HttpMethod::Get => "GET",
            HttpMethod::Post => "POST",
            _ => "other",
        }, r.path),
        None => println!("Invalid request"),
    }
}
```

---

## 8. 实战：用 match 实现一个简单的命令行工具

```rust
use std::env;

enum Command {
    Help,
    Version,
    Run { config: String },
    Build { target: Option<String> },
    Unknown(String),
}

fn parse_args() -> Command {
    let args: Vec<String> = env::args().collect();
    match args.get(1).map(|s| s.as_str()) {
        None | Some("help") | Some("-h") | Some("--help") => Command::Help,
        Some("version") | Some("-v") | Some("--version") => Command::Version,
        Some("run") => Command::Run {
            config: args.get(2).cloned().unwrap_or_else(|| "default".into()),
        },
        Some("build") => Command::Build {
            target: args.get(2).cloned(),
        },
        Some(cmd) => Command::Unknown(cmd.to_string()),
    }
}

fn handle_command(cmd: Command) {
    match cmd {
        Command::Help => println!("Usage: myapp <command> [options]"),
        Command::Version => println!("myapp v1.0.0"),
        Command::Run { config } => println!("Running with config: {}", config),
        Command::Build { target } => match target {
            Some(t) => println!("Building for target: {}", t),
            None => println!("Building for default target"),
        },
        Command::Unknown(c) => eprintln!("Unknown command: {}", c),
    }
}

fn main() {
    let cmd = parse_args();
    handle_command(cmd);
}
```

**运行示例：**
```bash
$ ./myapp help
Usage: myapp <command> [options]
$ ./myapp run
Running with config: default
$ ./myapp build wasm32
Building for target: wasm32
```

---

## 9. 常见坑

### 坑 1：match 分支末尾用了分号

```rust
// 错误：match 是表达式，分支不能以分号结尾（除非返回 ()）
let x = match y {
    1 => 10;   // 错误！应该是 10, 或 10 => ...
    _ => 0,
};
```

**正确：** 用逗号分隔分支，分支末尾不加分号（除非是语句块 `{ }`）。

### 坑 2：移动语义与匹配

```rust
let v = vec![1, 2, 3];
match v {
    vec if vec.len() > 0 => println!("{:?}", vec),  // v 被 move
    _ => {}
}
// println!("{:?}", v);  // 错误：v 已被移动
```

**解决：** 用 `ref` 或 `&` 做借用匹配。

### 坑 3：`_` 会忽略但不绑定

```rust
let opt = Some(7);
match opt {
    Some(_) => println!("got something"),  // 不绑定，无法使用内部值
    Some(x) => println!("{}", x),          // 绑定，可用
    None => {}
}
```

### 坑 4：if let 的 else

```rust
// if let 可以带 else，等价于 match 的两分支
let x = Some(5);
if let Some(n) = x {
    println!("{}", n);
} else {
    println!("none");
}
```

---

## 10. 小练习

### 练习 1：实现 `parse_status`

编写一个函数 `parse_status(s: &str) -> Option<u16>`，将字符串 `"200"`、`"404"` 等解析为 `u16`。对非数字字符串返回 `None`。用 `match` 处理个位数、两位数、三位数（可选）。

<details>
<summary>参考答案</summary>

```rust
fn parse_status(s: &str) -> Option<u16> {
    match s.len() {
        1 => s.chars().next().and_then(|c| c.to_digit(10)).map(|n| n as u16),
        2 | 3 => s.parse().ok(),
        _ => None,
    }
}
```

</details>

### 练习 2：用 match 实现简单的表达式求值

给定 `enum Expr { Num(i32), Add(Box<Expr>, Box<Expr>), Sub(Box<Expr>, Box<Expr>) }`，用 `match` 实现 `eval(expr: &Expr) -> i32`。

<details>
<summary>参考答案</summary>

```rust
enum Expr {
    Num(i32),
    Add(Box<Expr>, Box<Expr>),
    Sub(Box<Expr>, Box<Expr>),
}

fn eval(expr: &Expr) -> i32 {
    match expr {
        Expr::Num(n) => *n,
        Expr::Add(a, b) => eval(a) + eval(b),
        Expr::Sub(a, b) => eval(a) - eval(b),
    }
}

fn main() {
    let e = Expr::Add(Box::new(Expr::Num(1)), Box::new(Expr::Num(2)));
    println!("{}", eval(&e));  // 3
}
```

</details>

### 练习 3：let-else 重构

将以下代码用 `let-else` 重构，减少嵌套：

```rust
fn get_user_name() -> Option<String> {
    Some("Alice".to_string())
}

fn main() {
    let name = match get_user_name() {
        Some(n) => n,
        None => {
            eprintln!("No user");
            return;
        }
    };
    println!("Hello, {}", name);
}
```

<details>
<summary>参考答案</summary>

```rust
fn main() {
    let Some(name) = get_user_name() else {
        eprintln!("No user");
        return;
    };
    println!("Hello, {}", name);
}
```

</details>

---

**下一章预告：** 第 07 章将介绍 **枚举与 Trait**，学习 Rust 的代数数据类型和多态机制，理解"组合优于继承"的极致体现。
