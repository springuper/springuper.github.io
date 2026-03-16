# 第 03 章：类型系统基础 — 从 TypeScript 到 Rust

> 面向有经验的 TypeScript/Node.js 全栈工程师的 Rust 入门系列

## 目录

1. [基础类型映射](#1-基础类型映射)
2. [变量绑定](#2-变量绑定)
3. [struct vs interface/type](#3-struct-vs-interfacetype)
4. [字符串：TS 工程师最困惑的地方](#4-字符串ts-工程师最困惑的地方)
5. [类型转换](#5-类型转换)
6. [实战：用 Rust 重写一个 TS 的数据模型](#6-实战用-rust-重写一个-ts-的数据模型)

---

## 1. 基础类型映射

TypeScript 和 Rust 都是**静态类型**语言，但 Rust 的类型系统更精确、更严格。下表是两种语言的基础类型对应关系。

### 1.1 完整类型对照表

| TypeScript 类型 | Rust 类型 | 说明 |
|----------------|-----------|------|
| `string` | `String` / `&str` | Rust 区分拥有所有权的 String 和借用的字符串切片 &str（后续章节深入） |
| `number` | `i8` `i16` `i32` `i64` `i128` / `u8` `u16` `u32` `u64` `u128` / `f32` `f64` | Rust 需要明确位宽和符号，精确控制内存 |
| `boolean` | `bool` | 完全对应 |
| `null` / `undefined` | `Option<T>` | Rust 用枚举表示「可能有值/可能无值」，无 null 陷阱 |
| `any` | **不存在** | Rust 没有 any，编译期必须知道类型，这是好事 |
| `unknown` | **不存在**（有 `dyn Any`） | 可通过 `std::any::Any` trait object 实现类似「类型擦除」 |
| `void` | `()` | 单元类型 unit，表示「无返回值」 |
| `never` | `!` | Never type，表示永不返回 |
| `[T, U]` 元组 | `(T, U)` | 元组语法略有不同，见下文 |
| `object` / `Record<K,V>` | `struct` / `HashMap<K,V>` | 见第 3 节 |

### 1.2 为什么 Rust 需要这么多数值类型？

在 TypeScript 中，`number` 统一表示所有数值；在 Rust 中，必须选择具体的数值类型：

```typescript
// TypeScript: 一个 number 包打天下
let age: number = 25;
let pixels: number = 1920 * 1080;
let price: number = 99.99;
```

```rust
// Rust: 根据场景选择类型，精确控制内存
let age: u8 = 25;                    // 0-255 足够，1 字节
let pixels: u32 = 1920 * 1080;      // 2073600，4 字节
let price: f64 = 99.99;             // 浮点数，8 字节
```

**常见 Rust 数值类型：**

| Rust 类型 | 含义 | 范围（示例） | 典型用途 |
|-----------|------|-------------|----------|
| `i8` | 有符号 8 位 | -128 ~ 127 | 小整数 |
| `u8` | 无符号 8 位 | 0 ~ 255 | 字节、数组索引 |
| `i32` | 有符号 32 位 | 默认整数类型 | 一般整数 |
| `u32` | 无符号 32 位 | 0 ~ 42 亿 | 长度、计数 |
| `i64` / `u64` | 64 位 | 大数值 | 时间戳、大计数 |
| `f32` | 32 位浮点 | 单精度 | 图形、节省内存 |
| `f64` | 64 位浮点 | 双精度（默认） | 科学计算、金额 |

### 1.3 null/undefined 与 Option&lt;T&gt;

TypeScript 中 `null` 和 `undefined` 是特殊值，容易导致运行时错误；Rust 用 `Option<T>` 在**类型层面**表达「可能无值」：

```typescript
// TypeScript: null/undefined 容易遗漏检查
function getUser(id: number): User | null {
  return users.find(u => u.id === id) ?? null;
}

const user = getUser(1);
console.log(user.name);  // 💥 可能 Runtime Error: Cannot read property 'name' of null
```

```rust
// Rust: Option<T> 强制处理「无值」情况
fn get_user(id: u32) -> Option<User> {
    users.iter().find(|u| u.id == id).cloned()
}

let user = get_user(1);
// 编译不通过！必须处理 Option
// println!("{}", user.name);  // ❌ 错误：Option 没有 name 字段

// 正确写法：必须显式处理
match user {
    Some(u) => println!("{}", u.name),
    None => println!("User not found"),
}
```

### 1.4 any 与 unknown：Rust 没有「任意类型」

```typescript
// TypeScript: any 关闭类型检查，容易出 bug
function parse(data: any) {
  return data.value * 2;  // 编译通过，运行时可能 NaN
}
```

Rust **没有 `any`**。必须明确类型或使用泛型；需要「类型擦除」时，可用 `dyn Any`（高级用法，后续章节介绍）。

### 1.5 void 与 unit type `()`

```typescript
// TypeScript: void 表示无返回值
function log(msg: string): void {
  console.log(msg);
}
```

```rust
// Rust: () 是单元类型，表示「无有意义返回值」
fn log(msg: &str) -> () {
    println!("{}", msg);
}
// 通常省略，等价于：
fn log(msg: &str) {
    println!("{}", msg);
}
```

### 1.6 never 与 `!`

```typescript
// TypeScript: never 表示永不返回
function throwError(msg: string): never {
  throw new Error(msg);
}
```

```rust
// Rust: ! 表示 never type（永不返回）
fn throw_error(msg: &str) -> ! {
    panic!("{}", msg);
}
```

### 1.7 元组：TS vs Rust

```typescript
// TypeScript: 元组用方括号，可标记类型
type Point = [number, number];
const p: Point = [10, 20];
const [x, y] = p;
```

```rust
// Rust: 元组用圆括号
let p: (i32, i32) = (10, 20);
let (x, y) = p;

// 元组可以混合类型
let mixed: (i32, f64, &str) = (1, 3.14, "hello");
```

| 特性 | TypeScript | Rust |
|------|------------|------|
| 语法 | `[T, U]` | `(T, U)` |
| 解构 | `const [a, b] = t` | `let (a, b) = t` |
| 索引 | `t[0]` | `t.0`（注意：用点号！） |

---

## 2. 变量绑定

### 2.1 let 默认不可变 vs TS 的 let 可变

这是 TS 工程师最容易「踩坑」的一点：Rust 的 `let` **默认不可变**。

```typescript
// TypeScript: let 声明的变量可以重新赋值
let count = 0;
count = 1;   // ✅ 没问题
count += 1;  // ✅ 没问题
```

```rust
// Rust: let 绑定默认不可变
let count = 0;
// count = 1;   // ❌ 编译错误：cannot assign twice to immutable variable
```

### 2.2 let mut vs let（对应 TS 的 let vs const）

```typescript
// TypeScript
const PI = 3.14;        // 不可重新赋值，但对象属性可修改
let mutable = 0;        // 可重新赋值
mutable = 1;
```

```rust
// Rust
let pi = 3.14;          // 不可修改
let mut mutable = 0;    // 明确声明可变
mutable = 1;            // ✅ 可以
```

| TypeScript | Rust | 含义 |
|------------|------|------|
| `const x = 1` | `let x = 1` | 不可重新赋值/不可变 |
| `let x = 1` | `let mut x = 1` | 可修改 |

### 2.3 Shadowing（变量遮蔽）

Rust 允许用 `let` 重新绑定**同名**变量，这叫 shadowing；TypeScript 不允许在同一作用域内重复声明。

```typescript
// TypeScript: 同一作用域不能重复声明
let x = 5;
// let x = 6;  // ❌ Error: Cannot redeclare block-scoped variable 'x'
```

```rust
// Rust: shadowing 是合法且常见的
let x = 5;
let x = x + 1;      // 新变量遮蔽旧变量，类型可以不同
let x = "hello";    // 甚至可以换类型！
```

Shadowing 常用于**转换类型**或**复用变量名**而保持不可变。

### 2.4 类型推断对比

两者都有强类型推断，Rust 在某些场景下更严格（如必须能推断出具体类型）：

```typescript
// TypeScript: 推断很强大
const arr = [1, 2, 3];           // number[]
const mixed = [1, "a", true];    // (number | string | boolean)[]
```

```rust
// Rust: 同样强大，但有时需要标注
let arr = vec![1, 2, 3];        // Vec<i32>
let x = 42;                      // i32（默认整数类型）
let f = 3.14;                    // f64（默认浮点类型）
```

### 2.5 const：Rust 必须编译时确定

```typescript
// TypeScript: const 只是「不可重新赋值」
const now = Date.now();        // 运行时计算，没问题
const obj = { a: 1 };
obj.a = 2;                     // ✅ 可以修改属性
```

```rust
// Rust: const 必须是编译时常量
const PI: f64 = 3.14159;       // ✅
// const NOW: i64 = std::time::SystemTime::now();  // ❌ 编译期无法计算
```

| 特性 | TypeScript `const` | Rust `const` |
|------|-------------------|--------------|
| 赋值 | 只能赋一次 | 只能赋一次 |
| 值 | 可为运行时计算 | 必须编译时常量 |
| 类型 | 必须显式或推断 | 必须显式标注类型 |

---

## 3. struct vs interface/type

Rust 没有 `class`，用 **struct + impl + trait** 组合实现数据和行为的封装。

### 3.1 数据模型对比：User

**TypeScript：**

```typescript
// 用 interface 定义形状
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

// 用 type 也可以
type UserType = {
  id: number;
  name: string;
  email: string;
  active: boolean;
};
```

**Rust：**

```rust
struct User {
    id: u32,
    name: String,
    email: String,
    active: bool,
}
```

### 3.2 实例化

```typescript
// TypeScript
const user: User = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  active: true,
};
```

```rust
// Rust
let user = User {
    id: 1,
    name: String::from("Alice"),
    email: String::from("alice@example.com"),
    active: true,
};
```

### 3.3 方法定义：impl 块 vs class methods

**TypeScript：用 class**

```typescript
class User {
  constructor(
    public id: number,
    public name: string,
    public email: string,
    public active: boolean
  ) {}

  greet(): string {
    return `Hello, ${this.name}!`;
  }

  static create(name: string, email: string): User {
    return new User(0, name, email, true);
  }
}
```

**Rust：用 struct + impl**

```rust
struct User {
    id: u32,
    name: String,
    email: String,
    active: bool,
}

impl User {
    // 实例方法：&self 表示借用 self
    fn greet(&self) -> String {
        format!("Hello, {}!", self.name)
    }

    // 关联函数（类似 static method）：没有 self
    fn create(name: String, email: String) -> Self {
        User {
            id: 0,
            name,
            email,
            active: true,
        }
    }
}

// 使用
let user = User::create(
    String::from("Alice"),
    String::from("alice@example.com"),
);
println!("{}", user.greet());
```

### 3.4 对比小结

| 概念 | TypeScript | Rust |
|------|------------|------|
| 数据定义 | `interface` / `type` / `class` | `struct` |
| 实例方法 | `class` 中的方法 | `impl` 块中的 `fn xxx(&self, ...)` |
| 静态方法 | `static` method | 关联函数（无 `self` 参数） |
| 继承 | `extends` | 无继承，用 **trait** 组合 |
| 多态 | 接口、抽象类 | **trait** + trait object |

---

## 4. 字符串：TS 工程师最困惑的地方

### 4.1 为什么有 String 和 &str 两种？

在 TypeScript 中，`string` 是单一类型；Rust 区分：

| Rust 类型 | 类比 | 说明 |
|-----------|------|------|
| `String` | 拥有所有权的字符串（类似 TS 中「你拥有的 string 变量」） | 堆分配，可增长，可变 |
| `&str` | 字符串的引用/视图（只读切片） | 不拥有数据，通常指向 String 或字面量 |

### 4.2 简单类比

```typescript
// TypeScript: 所有 string 行为类似
const s1: string = "hello";
const s2: string = "world";
const combined = s1 + " " + s2;
```

```rust
// Rust
let s1: &str = "hello";           // 字面量是 &str
let s2: String = String::from("world");  // 拥有所有权的 String
let combined = format!("{} {}", s1, s2);  // String
```

### 4.3 常见操作对比

| 操作 | TypeScript | Rust |
|------|------------|------|
| 字面量 | `"hello"` | `"hello"` → `&str` |
| 创建可变字符串 | `let s = "a"` 或 `new String()` | `String::from("a")` 或 `"a".to_string()` |
| 拼接 | `s1 + s2` 或 `` `${s1}${s2}` `` | `format!("{}{}", s1, s2)` 或 `s1.to_string() + s2` |
| 长度 | `s.length` | `s.len()` |
| 切片 | `s.slice(0, 5)` | `&s[0..5]` |
| 是否为空 | `s.length === 0` | `s.is_empty()` |

```rust
// Rust 字符串操作示例
let s = String::from("hello world");
println!("{}", s.len());           // 11
println!("{}", &s[0..5]);         // hello
println!("{}", s.is_empty());     // false
```

**重要**：`String` 和 `&str` 的区别与 Rust 的**所有权**系统紧密相关，后续章节会深入。

---

## 5. 类型转换

### 5.1 TypeScript：隐式转换多

```typescript
// TypeScript: 隐式转换，容易产生意外
"1" + 2;        // "12"（数字变字符串）
"1" - 0;        // 1（字符串变数字）
null + 1;       // 1
undefined + 1;  // NaN
```

### 5.2 Rust：必须显式转换

```rust
// Rust: 必须显式，编译器不允许隐式数值转换
let x: i32 = 42;
let y: f64 = x as f64;     // 显式 as 转换

// let z: u32 = x;         // ❌ 错误：类型不匹配，必须显式转换
let z: u32 = x as u32;
```

### 5.3 From / Into：更优雅的转换

```rust
// 实现 From trait 后，自动获得 into()
let s: String = 42.to_string();           // 数字转字符串
let s: String = String::from("hello");    // From trait

// Into 是 From 的反向
let s: String = "hello".into();
```

### 5.4 为什么 Rust 选择显式？

| 方面 | TypeScript | Rust |
|------|------------|------|
| 隐式转换 | 常见（尤其是 `+`） | 基本不允许 |
| 安全性 | 运行时可能 NaN、意外类型 | 编译期拒绝非法转换 |
| 哲学 | 灵活、开发快 | 安全第一，宁可在编译期报错 |

---

## 6. 实战：用 Rust 重写一个 TS 的数据模型

### 6.1 TypeScript 版本：interface + class

```typescript
interface TodoItem {
  id: number;
  title: string;
  completed: boolean;
  createdAt: Date;
}

class TodoService {
  private items: TodoItem[] = [];

  add(title: string): TodoItem {
    const item: TodoItem = {
      id: Date.now(),
      title,
      completed: false,
      createdAt: new Date(),
    };
    this.items.push(item);
    return item;
  }

  complete(id: number): TodoItem | null {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.completed = true;
      return item;
    }
    return null;
  }

  list(): TodoItem[] {
    return [...this.items];
  }
}
```

### 6.2 Rust 版本：struct + impl

```rust
#[derive(Clone)]
struct TodoItem {
    id: u64,
    title: String,
    completed: bool,
    created_at: i64,  // 用 Unix 时间戳简化，或用 chrono 库
}

struct TodoService {
    items: Vec<TodoItem>,
}

impl TodoService {
    // 关联函数：创建新实例（类似 constructor）
    fn new() -> Self {
        TodoService {
            items: Vec::new(),
        }
    }

    fn add(&mut self, title: String) -> TodoItem {
        use std::time::{SystemTime, UNIX_EPOCH};
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let item = TodoItem {
            id,
            title: title.clone(),
            completed: false,
            created_at,
        };
        self.items.push(item.clone());
        item
    }

    fn complete(&mut self, id: u64) -> Option<&TodoItem> {
        if let Some(item) = self.items.iter_mut().find(|i| i.id == id) {
            item.completed = true;
            Some(item)
        } else {
            None
        }
    }

    fn list(&self) -> &[TodoItem] {
        &self.items
    }
}

fn main() {
    let mut service = TodoService::new();
    service.add(String::from("Learn Rust"));
    service.add(String::from("Learn ownership"));
    service.complete(1);
}
```

### 6.3 两种写法对比

| 方面 | TypeScript | Rust |
|------|------------|------|
| 数据定义 | `interface` + `class` | `struct` |
| 状态封装 | `private items` | `items` 在 struct 内，通过 `&mut self` 控制 |
| 空值处理 | `null` | `Option<T>` |
| 可变性 | 默认可变 | 需 `&mut self` 才能修改 |
| 构造 | `new TodoService()` | `TodoService::new()` |
| 数组 | `TodoItem[]` | `Vec<TodoItem>` |

### 6.4 关键差异总结

1. **所有权**：Rust 的 `add` 需要 `&mut self`，因为要修改 `items`。
2. **Option**：`complete` 返回 `Option<&TodoItem>`，而不是 `null`。
3. **无 class**：行为通过 `impl` 块挂在 `struct` 上，多态靠 trait 实现。

---

## 小结

本章从 TypeScript 工程师的视角，梳理了 Rust 类型系统的基础：

- **类型映射**：number → 多种数值类型，null → Option，any 不存在
- **变量**：`let` 默认不可变，`let mut` 才可变，支持 shadowing
- **结构体**：`struct` + `impl` 替代 class，用 trait 做多态
- **字符串**：`String` 与 `&str` 的区别（后续深入）
- **类型转换**：显式 `as` 和 `From/Into`，避免隐式陷阱
- **实战**：用 struct + impl 重写 TS 的 class 模型

下一章将深入 **所有权与借用**，这是从 TS 转 Rust 最需要建立新心智模型的部分。
