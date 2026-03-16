# 第 12 章：智能指针 — 手动挡的精细控制

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

在 TypeScript/Node.js 中，所有对象都在堆上，由 GC 自动管理，你几乎不用关心内存。Rust 则不同：值默认在栈上，需要堆分配时要用**智能指针**。智能指针是 Rust 中「手动挡」的精髓——既有精细的控制力，又通过 `Deref` 和 `Drop` trait 提供类似引用的使用体验。本章从 TS/JS 工程师的视角出发，系统梳理 Rust 的智能指针家族，助你在单线程与多线程场景下做出正确选择。

---

## 目录

1. [为什么需要智能指针](#1-为什么需要智能指针)
2. [Box\<T\> — 最简单的堆分配](#2-boxt--最简单的堆分配)
3. [Rc\<T\> — 引用计数（单线程）](#3-rct--引用计数单线程)
4. [Arc\<T\> — 原子引用计数（多线程安全）](#4-arct--原子引用计数多线程安全)
5. [RefCell\<T\> — 运行时借用检查](#5-refcellt--运行时借用检查)
6. [Cell\<T\> — 简单值的内部可变性](#6-cellt--简单值的内部可变性)
7. [Mutex\<T\> 和 RwLock\<T\>（简要介绍）](#7-mutext-和-rwlockt简要介绍)
8. [决策树：何时用哪个？](#8-决策树何时用哪个)
9. [实战：用 Arc + Mutex 实现线程安全计数器](#9-实战用-arc--mutex-实现线程安全计数器)
10. [常见坑和小练习](#10-常见坑和小练习)

---

## 1. 为什么需要智能指针

### 概念引入（从 TS/JS 视角）

在 TypeScript/JavaScript 中：

```typescript
const obj = { name: "hello" };  // 对象在堆上，obj 存的是引用
const arr = [1, 2, 3];          // 数组在堆上
// GC 自动回收，你完全不关心何时释放
```

所有「对象」类型的值都在堆上，变量持有的是「引用」。GC 负责在合适时机回收不再使用的内存。你**不需要**也没有 API 来显式控制「谁拥有这块内存」。

### Rust 的做法

Rust 的值**默认在栈上**。需要堆分配时，使用**智能指针**：

- 智能指针 = 拥有数据的「智能」引用
- 实现了 `Deref` trait（让你像用引用一样访问内部数据）
- 实现了 `Drop` trait（离开作用域时自动释放）

### 背后的 Why

- **栈 vs 堆**：栈上分配/释放极快，但大小固定、生命周期与帧绑定；堆可以动态增长，但需要显式管理。
- **无 GC**：Rust 不依赖 GC，通过所有权 + 智能指针在编译期/运行时精确控制生命周期。
- **零成本抽象**：智能指针的「智能」在编译期展开，运行时几乎无额外开销。

### 对比表格

| 特性 | JS/TS | Rust |
|------|-------|------|
| 对象/复杂数据存放 | 堆上（隐式） | 默认栈；堆需 `Box`/`Rc`/`Arc` 等 |
| 内存管理 | GC 自动 | 所有权 + Drop |
| 多所有者 | 天然支持（引用语义） | 需 `Rc`/`Arc` 显式表达 |
| 类比 C++ | — | `Box`≈`unique_ptr`，`Rc`/`Arc`≈`shared_ptr` |

---

## 2. Box\<T\> — 最简单的堆分配

### 概念引入（从 TS/JS 视角）

JS 中所有对象天然在堆上，不需要 `Box`：

```typescript
const list = { value: 1, next: { value: 2, next: null } };  // 天然在堆上
```

### Rust 的做法

`Box<T>` 把值从栈移到堆上，拥有唯一所有权。

**使用场景**：
- 递归类型（链表、树）
- 大数据避免栈溢出
- trait object（`dyn Trait`）

```rust
// 用 Box 定义链表
#[derive(Debug)]
enum List {
    Cons(i32, Box<List>),
    Nil,
}

use List::{Cons, Nil};

fn main() {
    let list = Cons(1, Box::new(Cons(2, Box::new(Cons(3, Box::new(Nil))))));
    println!("{:?}", list);  // Cons(1, Cons(2, Cons(3, Nil)))
}
```

### 背后的 Why

递归类型无法在编译期确定大小（`List` 包含 `List`），必须用 `Box` 把「下一段」放在堆上，使类型有固定大小。

### 对比表格

| 场景 | JS/TS | Rust |
|------|-------|------|
| 链表/树 | 直接写，对象在堆 | 必须用 `Box<List>` 打破无限大小 |
| trait object | 对象多态天然支持 | `Box<dyn Trait>` |

---

## 3. Rc\<T\> — 引用计数（单线程）

### 概念引入（从 TS/JS 视角）

JS 中多个变量引用同一个对象，就是「多所有者」：

```typescript
const a = { x: 42 };
const b = a;   // a、b 都指向同一对象
const c = a;   // a、b、c 三个引用
// GC 内部用引用计数+标记清除判断何时回收
```

### Rust 的做法

`Rc<T>` = Reference Counted，多个所有者共享同一块数据。

- `Rc::clone(&rc)` 增加引用计数（不复制数据）
- `drop` 时减少计数；计数归零时释放
- **只读**：`Rc<T>` 不允许修改内部数据

```rust
use std::rc::Rc;

fn main() {
    let a = Rc::new(String::from("hello"));
    let b = Rc::clone(&a);
    let c = Rc::clone(&a);

    println!("strong_count: {}", Rc::strong_count(&a));  // 3
}
```

### 背后的 Why

Rust 默认单一所有权。多所有者需要显式用 `Rc` 表达，并在编译期保证**单线程**使用（`Rc` 非 `Send`，不能跨线程）。

---

## 4. Arc\<T\> — 原子引用计数（多线程安全）

### 概念引入（从 TS/JS 视角）

Node.js 主线程是单线程；Worker Threads 间共享数据需要 `SharedArrayBuffer` 或消息传递。Rust 的 `Arc` 相当于「多线程可用的 `Rc`」。

### Rust 的做法

- `Arc` = Atomic Rc，引用计数的增减是原子操作
- 多线程场景必须用 `Arc` 替代 `Rc`
- `Arc<T>` 本身只读，可变需搭配 `Mutex`/`RwLock`

```rust
use std::sync::Arc;
use std::thread;

fn main() {
    let arc = Arc::new(42);
    let mut handles = vec![];
    for _ in 0..5 {
        let arc_clone = Arc::clone(&arc);
        handles.push(thread::spawn(move || {
            println!("{}", *arc_clone);  // 只读
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
}
```

### 对比表格

| 特性 | Rc\<T\> | Arc\<T\> |
|------|---------|----------|
| 线程安全 | 否（单线程） | 是 |
| 开销 | 略低 | 原子操作略高 |
| 使用场景 | 单线程多所有者 | 多线程多所有者 |

---

## 5. RefCell\<T\> — 运行时借用检查

### 概念引入（从 TS/JS 视角）

JS 的对象天然是「到处可以改的共享引用」：

```typescript
const obj = { count: 0 };
obj.count = 1;  // 随时可改
```

### Rust 的做法

编译期的借用检查有时过于严格。`RefCell<T>` 把检查推迟到**运行时**：

- **内部可变性**（Interior Mutability）：在「不可变引用」的壳子里修改数据
- `borrow()` → `Ref<T>`，可多个
- `borrow_mut()` → `RefMut<T>`，独占
- 违反规则会 **panic**（运行时错误，而非编译错误）

```rust
use std::cell::RefCell;

fn main() {
    let c = RefCell::new(5);
    *c.borrow_mut() += 1;
    println!("{}", *c.borrow());  // 6
}
```

### 常见搭配：Rc\<RefCell\<T\>\>

多个所有者 + 可变：

```rust
use std::rc::Rc;
use std::cell::RefCell;

fn main() {
    let data = Rc::new(RefCell::new(vec![1, 2, 3]));
    let d2 = Rc::clone(&data);
    data.borrow_mut().push(4);  // 通过 Rc 拿到 RefCell，再可变借用
    println!("{:?}", d2.borrow());  // [1, 2, 3, 4]
}
```

### 背后的 Why

- 编译期借用检查是静态的，无法处理所有动态场景（如某些图结构、缓存）
- `RefCell` 在运行时维护借用状态，灵活但需自律

---

## 6. Cell\<T\> — 简单值的内部可变性

### Rust 的做法

`Cell<T>` 针对实现了 `Copy` 的类型，提供简单的「内部可变」：

- `get()`：复制出值
- `set()`：替换内部值
- 没有「借用」概念，直接复制，无运行时借用检查

```rust
use std::cell::Cell;

fn main() {
    let c = Cell::new(42);
    let old = c.replace(100);  // 替换并返回旧值
    println!("{} {}", old, c.get());  // 42 100
}
```

### 对比 RefCell

| 特性 | Cell\<T\> | RefCell\<T\> |
|------|-----------|--------------|
| 适用类型 | Copy | 任意 T |
| 借用 | 无，直接复制 | borrow/borrow_mut |
| 开销 | 极低 | 运行时检查 |

### 背后的 Why

`Cell` 通过「复制进出」避免了借用的概念，因此不会有运行时 panic。但只适用于 `Copy` 类型，对 `String`、`Vec` 等需要引用语义的类型无效。

---

## 7. Mutex\<T\> 和 RwLock\<T\>（简要介绍）

### Mutex\<T\>

互斥锁，任意时刻只有一个线程能持有锁并修改数据。

- `Arc<Mutex<T>>` = 多线程版的 `Rc<RefCell<T>>`
- `lock()` 返回 `MutexGuard`，实现 `Deref`/`DerefMut`，离开作用域自动释放锁
- 若持锁线程 panic，`Mutex` 会变为「毒化」状态，其他线程 `lock()` 会得到 `Err`

```rust
use std::sync::Mutex;

let m = Mutex::new(5);
{
    let mut g = m.lock().unwrap();
    *g = 6;
}  // g 离开作用域，锁自动释放
println!("{}", *m.lock().unwrap());  // 6
```

### RwLock\<T\>

读写锁：多个读 或 一个写。

- 读多写少时比 `Mutex` 更高效
- `read()` 返回多个 `RwLockReadGuard`，`write()` 返回独占的 `RwLockWriteGuard`

### 对比表格

| 类型 | 读 | 写 | 适用场景 |
|------|-----|-----|----------|
| Mutex\<T\> | 独占（和写一样） | 独占 | 读写比例相当 |
| RwLock\<T\> | 多读者共享 | 独占 | 读多写少 |

---

## 8. 决策树：何时用哪个？

| 需求 | 单线程 | 多线程 |
|------|--------|--------|
| 单一所有者，需要堆 | `Box<T>` | `Box<T>` |
| 多所有者，只读 | `Rc<T>` | `Arc<T>` |
| 多所有者，可变 | `Rc<RefCell<T>>` | `Arc<Mutex<T>>` 或 `Arc<RwLock<T>>` |
| 简单 Copy 值内部可变 | `Cell<T>` | —（或配合 `Arc`） |

**简易决策表**：

```
单所有者？ → Box
多所有者 + 单线程？ → Rc
多所有者 + 多线程？ → Arc
需要内部可变？ → RefCell / Cell / Mutex / RwLock
```

**流程图（文字版）**：

```
需要堆分配？
├─ 是 → 只有一个所有者？
│       ├─ 是 → Box<T>
│       └─ 否 → 多线程？
│               ├─ 是 → Arc<T>（只读）或 Arc<Mutex<T>>（可变）
│               └─ 否 → Rc<T>（只读）或 Rc<RefCell<T>>（可变）
└─ 否 → 需要「不可变外壳下的可变」？
        ├─ Copy 类型 → Cell<T>
        └─ 非 Copy → RefCell<T>（单线程）或 Mutex/RwLock（多线程）
```

---

## 9. 实战：用 Arc + Mutex 实现线程安全计数器

### Rust 实现

```rust
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let c = Arc::clone(&counter);
        let h = thread::spawn(move || {
            let mut num = c.lock().unwrap();
            *num += 1;
        });
        handles.push(h);
    }

    for h in handles {
        h.join().unwrap();
    }

    println!("count: {}", *counter.lock().unwrap());  // 10
}
```

### 对比 Node.js

```typescript
// Node.js 主线程单线程，简单变量不需要锁
let count = 0;
for (let i = 0; i < 10; i++) {
  count++;  // 单线程安全
}

// Worker Threads 若要共享可变状态，需 SharedArrayBuffer 或消息传递
const { Worker } = require('worker_threads');
// 通常通过 postMessage 传递数据，或使用 Atomics + SharedArrayBuffer
```

### 智能指针全家桶对比表

| 类型 | 所有权 | 线程安全 | 可变性 | 典型场景 |
|------|--------|----------|--------|----------|
| Box\<T\> | 单一 | ✓ | 拥有即可变 | 递归类型、trait object |
| Rc\<T\> | 多（计数） | ✗ | 只读 | 单线程多引用 |
| Arc\<T\> | 多（原子计数） | ✓ | 只读 | 多线程多引用 |
| RefCell\<T\> | 单一 | ✗ | 内部可变 | 单线程运行时借用 |
| Cell\<T\> | 单一 | ✗ | 内部可变（Copy） | 简单值替换 |
| Mutex\<T\> | 单一 | ✓ | 互斥可变 | 多线程互斥访问 |
| RwLock\<T\> | 单一 | ✓ | 多读单写 | 读多写少 |

---

## 10. 常见坑和小练习

### 常见坑

1. **Rc 循环引用导致内存泄漏**
   - `Rc` 只解决「何时释放」，不解决循环引用。可用 `Weak` 打破环。

2. **RefCell 违反借用规则导致 panic**
   - 同时存在 `borrow` 和 `borrow_mut` 会 panic，需保证作用域不重叠。

3. **误用 Rc 替代 Arc**
   - `Rc` 未实现 `Send`，跨线程会编译失败；多线程用 `Arc`。

4. **Mutex 死锁**
   - 多个锁的获取顺序不一致可能导致死锁，需统一顺序或使用 `try_lock`。

5. **过度使用 RefCell**
   - 能通过编译期借用解决时，优先用普通引用；`RefCell` 是 escape hatch。

6. **Box 与 Rc 的误选**
   - 若数据只需一个所有者，用 `Box` 即可；`Rc` 有引用计数开销，不需要多所有者时不要用。

7. **Arc\<Mutex\<T\>\> 的锁粒度过大**
   - 锁住整块结构体会降低并发度；考虑拆成多个 `Arc<Mutex<…>>` 或使用更细粒度的锁。

### 小练习

1. **链表**：用 `Box` 实现一个 `i32` 单链表，支持 `push` 和 `len`。

2. **共享配置**：用 `Rc<RefCell<Config>>` 实现一个可在多处读取和修改的配置结构。

3. **线程安全缓存**：用 `Arc<Mutex<HashMap<K, V>>>` 实现一个简单的多线程缓存。

4. **Weak 破环**：实现一棵树，父节点用 `Rc` 引用子节点，子节点用 `Weak` 引用父节点，避免循环引用。

5. **Cell vs RefCell**：分别用 `Cell<i32>` 和 `RefCell<i32>` 实现计数器，体会无借用 vs 有借用的差异。

---

*本章完。下一章将介绍 Rust 的并发模型：线程、 channel、async/await。*
