# 第 13 章：异步与并发 — 重新理解 async/await

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

在 TypeScript/Node.js 中，`async/await` 基于单线程事件循环和 Promise；在 Rust 中，`async/await` 则与 OS 线程、`Future`、运行时紧密交织。Rust 没有内置运行时，`Future` 是**惰性**的，且多线程带来了 `Send`/`Sync` 等全新的类型约束。本章将从 TS/JS 工程师的视角出发，系统梳理 Rust 的异步与并发模型，助你跨越认知鸿沟，写出正确、高效、无数据竞争的并发代码。

---

## 目录

1. [并发 vs 并行 vs 异步](#1-并发-vs-并行-vs-异步)
2. [Rust 的线程](#2-rust-的线程)
3. [Send 和 Sync trait](#3-send-和-sync-trait)
4. [async/await in Rust vs Node.js](#4-asyncawait-in-rust-vs-nodejs)
5. [tokio 运行时](#5-tokio-运行时)
6. [Channel — 线程/任务间通信](#6-channel--线程任务间通信)
7. [异步中的所有权挑战](#7-异步中的所有权挑战)
8. [实战：用 tokio 实现一个并发爬虫](#8-实战用-tokio-实现一个并发爬虫)
9. [常见坑和小练习](#9-常见坑和小练习)

---

## 1. 并发 vs 并行 vs 异步

### 概念澄清

| 概念 | 含义 | 典型例子 |
|------|------|----------|
| **并发** | 多个任务交替进行，不一定同时执行 | 单核 CPU 上多任务切换 |
| **并行** | 多个任务真正同时执行 | 多核 CPU 上同时跑多个线程 |
| **异步** | 不阻塞等待结果，通过回调/Promise/Future 在完成后继续 | I/O 等待时让出 CPU |

**关系**：异步是实现并发的一种手段；并行是并发在硬件上的体现。你可以「异步但不并行」（单线程事件循环），也可以「并行且异步」（多线程 + 异步 I/O）。

### Node.js 的模型：单线程 + 事件循环 + 异步 I/O

```typescript
// Node.js：单线程，事件循环调度异步任务
async function main() {
  const a = await fetch("https://api.example.com/a");  // 等待 I/O 时，事件循环处理其他任务
  const b = await fetch("https://api.example.com/b");
  return [a, b];
}
// 所有 JS 代码在同一线程执行，I/O 由 libuv 在底层用线程池/非阻塞 API 完成
```

- **单线程**：JS 代码只在一个线程上跑，不存在 JS 层面的数据竞争
- **事件循环**：调度 `setTimeout`、Promise、I/O 回调等
- **异步 I/O**：`fs`、`http`、`fetch` 等由 libuv 处理，不阻塞 JS 主线程

### Rust 的选择：线程 + async/await，两者都支持

Rust 不强制你选哪一种，而是提供两套工具：

| 模型 | 工具 | 适用场景 |
|------|------|----------|
| **多线程** | `std::thread`、`std::sync::Mutex` | CPU 密集、简单并发 |
| **异步** | `async/await`、`tokio` | I/O 密集、大量并发连接 |

你可以**同时用**：多线程 + 每线程一个异步运行时，实现高吞吐。

---

## 2. Rust 的线程

### std::thread::spawn — 真正的 OS 线程

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let handle = thread::spawn(|| {
        for i in 1..5 {
            println!("子线程: {}", i);
            thread::sleep(Duration::from_millis(100));
        }
    });

    for i in 1..4 {
        println!("主线程: {}", i);
        thread::sleep(Duration::from_millis(100));
    }

    handle.join().unwrap();  // 等待子线程完成
}
```

每调用一次 `thread::spawn`，就创建一个**真正的 OS 线程**，不是「协程」或「绿色线程」。

### 对比 Node.js 的 Worker Threads

```typescript
// Node.js：Worker 线程，需要显式引入
import { Worker } from "worker_threads";

const worker = new Worker("./worker.js", { workerData: { id: 1 } });
worker.on("message", (msg) => console.log(msg));
worker.postMessage({ task: "compute" });
```

| 特性 | Node.js Worker | Rust std::thread |
|------|----------------|------------------|
| 默认模型 | 单线程，Worker 需显式用 | 多线程是标准库一部分 |
| 创建成本 | 较贵（V8 隔离、序列化） | 较便宜（直接 OS 线程） |
| 数据共享 | postMessage 拷贝/Transferable | 共享内存（需 Sync） |

### Move 闭包和线程：为什么线程闭包通常需要 move

```rust
fn main() {
    let msg = String::from("hello");

    // 错误！msg 可能在主线程 drop，子线程还在用
    // let handle = thread::spawn(|| println!("{}", msg));

    let handle = thread::spawn(move || {
        println!("{}", msg);  // move 把 msg 的所有权移到闭包里
    });

    // println!("{}", msg);  // 错误：msg 已被 move
    handle.join().unwrap();
}
```

线程可能比主线程活得更久，闭包必须**拥有**其捕获的数据，否则主线程 drop 数据时子线程可能产生悬垂引用。`move` 把捕获变量的所有权转移到闭包内。

### JoinHandle — 等待线程完成

```rust
let handle = thread::spawn(|| 42);
let result = handle.join().unwrap();  // Result<i32, Box<dyn Any + Send>>
println!("线程返回值: {}", result);
```

`join()` 阻塞当前线程直到子线程结束，返回 `Ok(返回值)` 或 `Err(panic 信息)`。

---

## 3. Send 和 Sync trait

### Send：可以安全地跨线程转移所有权

`T: Send` 表示类型 `T` 的值可以**安全地**从一个线程转移到另一个线程（通过 move 或 channel）。

```rust
// 实现了 Send 的类型：i32, String, Vec<T>（T: Send）, Box<T>（T: Send）等
// 未实现 Send：Rc<T>（非原子引用计数，不能跨线程）
// Cell<T>、RefCell<T> 等内部可变类型有特殊规则
```

### Sync：可以安全地跨线程共享引用

`T: Sync` 表示 `&T` 可以安全地被多个线程共享（即 `&T: Send`）。`Mutex<T>`、`Arc<T>` 实现了 `Sync`，所以可以跨线程共享。

```rust
use std::sync::{Arc, Mutex};

let data = Arc::new(Mutex::new(0));
let data_clone = Arc::clone(&data);
thread::spawn(move || {
    *data_clone.lock().unwrap() += 1;
});
```

### 编译器自动推断和检查

你不需要手动实现 `Send`/`Sync`（大部分类型由标准库实现）。编译器会根据字段类型自动推断，并**在编译期**拒绝不安全的用法：

```rust
// 错误：Rc 不是 Send，不能跨线程
use std::rc::Rc;
let r = Rc::new(1);
thread::spawn(move || {
    println!("{}", r);  // 编译错误！
});
```

### 对比 Node.js：单线程不需要这个概念

Node.js 主线程是单线程，JS 对象天然「只在一个线程」，不存在跨线程 move 或共享的问题，因此没有 `Send`/`Sync` 的等价物。

### 为什么这是 Rust 的杀手特性：编译时消除数据竞争

- **数据竞争**：多个线程同时写同一块内存，且至少一个未同步
- Rust 通过 `Send`/`Sync` + 所有权，**在编译期**禁止这类代码
- 无需运行时检查，零成本，且不会漏网

---

## 4. async/await in Rust vs Node.js

### 语法相似：async fn, .await

```typescript
// TypeScript
async function fetchUser(id: number): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
```

```rust
// Rust
async fn fetch_user(id: u64) -> Result<User, reqwest::Error> {
    let res = reqwest::get(format!("https://api.example.com/users/{}", id)).await?;
    let user = res.json().await?;
    Ok(user)
}
```

### 但机制完全不同！

| 方面 | Node.js Promise | Rust Future |
|------|-----------------|-------------|
| **执行时机** | 创建即开始执行（eager） | 惰性的，只有被 poll 才执行（lazy） |
| **返回值** | Promise\<T\> | impl Future<Output = T> |
| **await 位置** | `await expr`（前缀） | `expr.await`（后缀） |
| **运行时** | 内置（libuv + V8） | 无内置，需 tokio/async-std 等 |

### Node.js Promise：创建即开始执行（eager）

```typescript
// 创建 Promise 时，里面的逻辑立刻开始跑
const p = new Promise((resolve) => {
  console.log("1");  // 立即打印
  setTimeout(() => resolve(42), 1000);
});
// 即使你不 await，console.log("1") 已经执行
```

### Rust Future：惰性的，只有被 poll 才执行（lazy）

```rust
// 调用 async fn 只返回一个 Future，不会执行任何逻辑
let fut = fetch_user(1);  // 此时不发起请求！
// 只有被 .await 或放进 runtime 里 poll，才会真正执行
let user = fut.await;     // 这里才发起请求
```

### Future trait 解析

```rust
// 简化版
trait Future {
    type Output;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}

enum Poll<T> {
    Ready(T),   // 完成，返回结果
    Pending,    // 未完成，稍后再 poll
}
```

运行时不断 `poll` Future，返回 `Pending` 时把任务挂起，待 I/O 就绪再继续；返回 `Ready` 时得到最终结果。

### .await vs await — 位置不同（后缀 vs 前缀）

```typescript
// TypeScript：await 是前缀运算符
const x = await somePromise();
```

```rust
// Rust：.await 是后缀调用，像方法链
let x = some_future().await;
```

Rust 采用后缀是为了与方法链、`?` 操作符更自然地组合：`foo().await?.bar()`。

### 对比表格

| 特性 | Node.js | Rust |
|------|---------|------|
| 异步原语 | Promise | Future |
| 执行模型 | Eager | Lazy |
| await 语法 | `await x` | `x.await` |
| 运行时 | 内置 | 需 tokio 等 |
| 取消 | 无标准取消 | 可 drop Future 实现取消 |

---

## 5. tokio 运行时

### Rust 没有内置异步运行时！

对比 Node.js：一启动就有事件循环，Promise 自动被调度。Rust 的 `Future` 是**纯接口**，必须交给某个「运行时」去 `poll`，否则永远不会执行。

### tokio = Rust 的异步运行时

tokio 提供：
- 多线程 work-stealing 调度器
- 非阻塞 I/O（TCP、UDP、文件等）
- 定时器、channel 等
- 类似 Node.js 的 libuv + event loop 角色

### #[tokio::main]

```rust
use tokio;

#[tokio::main]
async fn main() {
    println!("在 tokio 运行时中");
    fetch_user(1).await;
}
```

`#[tokio::main]` 宏将 `main` 展开为：创建 tokio runtime，并在其上运行你的 `async fn main`。

### tokio::spawn — 异步任务（类似 Promise 并发）

```typescript
// Node.js：Promise.all 并发
const [a, b] = await Promise.all([
  fetch("/api/a"),
  fetch("/api/b"),
]);
```

```rust
// Rust：tokio::spawn 在后台跑，返回 JoinHandle
let handle1 = tokio::spawn(async { fetch_a().await });
let handle2 = tokio::spawn(async { fetch_b().await });

let (a, b) = (handle1.await?, handle2.await?);
```

`tokio::spawn` 把 `Future` 提交给运行时，返回 `JoinHandle`，`.await` 它可得到任务结果。

### tokio::select! — 类似 Promise.race

```typescript
// Node.js: Promise.race
const result = await Promise.race([fetch("/api/a"), timeout(5000)]);
```

```rust
// Rust: tokio::select!
tokio::select! {
    result = fetch_a() => println!("a 先完成: {:?}", result),
    _ = tokio::time::sleep(Duration::from_secs(5)) => println!("超时"),
}
```

### tokio::join! — 类似 Promise.all

```rust
let (a, b) = tokio::join!(fetch_a(), fetch_b());
```

在同一任务里并发执行多个 Future，等待全部完成。比 `spawn` 更轻量，不创建新任务。

---

## 6. Channel — 线程/任务间通信

### mpsc channel（多生产者单消费者）

```rust
use std::sync::mpsc;
use std::thread;

let (tx, rx) = mpsc::channel();

thread::spawn(move || {
    tx.send("hello").unwrap();
});

println!("收到: {}", rx.recv().unwrap());
```

- `tx`（Sender）可被 clone，多个生产者
- `rx`（Receiver）唯一，单消费者
- `send`/`recv` 阻塞式；`try_recv` 非阻塞

### 对比 Node.js 的 EventEmitter

```typescript
import { EventEmitter } from "events";
const ee = new EventEmitter();
ee.on("data", (chunk) => console.log(chunk));
ee.emit("data", "hello");
```

| 特性 | Node.js EventEmitter | Rust mpsc |
|------|----------------------|-----------|
| 模型 | 发布/订阅，多对多 | 生产者/消费者，多对一 |
| 背压 | 无，易内存增长 | 有，channel 有缓冲或阻塞 |
| 类型 | 运行时检查 | 编译期类型安全 |

### 对比 TS 的 Subject（RxJS）

```typescript
import { Subject } from "rxjs";
const subj = new Subject<string>();
subj.subscribe((v) => console.log(v));
subj.next("hello");
```

Subject 是多播、可多订阅；Rust mpsc 是单消费者，语义更接近「队列」。

### tokio::sync::mpsc 和 tokio::sync::broadcast

```rust
// tokio 的 mpsc：异步 send/recv
let (tx, mut rx) = tokio::sync::mpsc::channel(32);
tokio::spawn(async move {
    tx.send("msg").await.unwrap();
});
let msg = rx.recv().await;

// broadcast：多消费者，每个都能收到
let (tx, _rx1) = tokio::sync::broadcast::channel(16);
let mut rx2 = tx.subscribe();
tx.send("broadcast").unwrap();
```

---

## 7. 异步中的所有权挑战

### 为什么异步闭包经常需要 move

```rust
// 错误：data 可能在被 await 点时被 drop
let data = vec![1, 2, 3];
tokio::spawn(async {
    println!("{:?}", data);  // 编译错误：data 可能活得不够久
});

// 正确：move 把 data 的所有权移入 async 块
tokio::spawn(async move {
    println!("{:?}", data);
});
```

`.await` 会让当前 Future 挂起，恢复时可能在不同线程。因此被捕获的变量必须**拥有**或**共享**足够久，`move` 把所有权移入 Future。

### Arc 在异步中的使用

```rust
use std::sync::Arc;

let data = Arc::new(vec![1, 2, 3]);
let d1 = Arc::clone(&data);
let d2 = Arc::clone(&data);

let h1 = tokio::spawn(async move {
    println!("{:?}", d1);
});
let h2 = tokio::spawn(async move {
    println!("{:?}", d2);
});

h1.await.unwrap();
h2.await.unwrap();
```

多任务共享同一数据时，用 `Arc<T>`（或 `Arc<Mutex<T>>` 如需修改）。

### 生命周期和 async — 'static bound

`tokio::spawn` 要求 Future 是 `'static`，即不能借用局部变量：

```rust
// 错误
let x = 1;
tokio::spawn(async {
    println!("{}", x);  // x 不是 'static
});

// 正确：move 且 x 拥有或 Arc 包装
let x = 1;
tokio::spawn(async move {
    println!("{}", x);
});
```

### Pin — 简要介绍（为什么 Future 需要被 pin）

Future 在 `.await` 处挂起时，其内部可能持有自引用（例如结构体里存了自己的引用）。若 Future 在内存中移动，自引用会失效。`Pin<P>` 保证 `P` 指向的对象**不会被移动**，从而安全地 `poll`。多数情况下，你只需用 `Box::pin` 或让运行时处理，不必直接操作 `Pin`。

---

## 8. 实战：用 tokio 实现一个并发爬虫

### 需求

- 抓取多个 URL
- 限制并发数（例如最多 3 个）
- 错误处理
- 对比 Node.js 版本

### Node.js 版本

```typescript
async function fetchUrls(urls: string[], concurrency: number): Promise<string[]> {
  const results: string[] = [];
  const pool = urls.slice();
  
  async function worker() {
    while (pool.length > 0) {
      const url = pool.shift()!;
      try {
        const res = await fetch(url);
        const text = await res.text();
        results.push(text);
      } catch (e) {
        console.error(`Failed ${url}:`, e);
      }
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, () => worker())
  );
  return results;
}
```

### Rust + tokio 版本

```rust
use tokio::sync::Semaphore;
use std::sync::Arc;

async fn fetch_url(url: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let body = reqwest::get(url).await?.text().await?;
    Ok(body)
}

async fn fetch_urls_concurrent(
    urls: Vec<String>,
    concurrency: usize,
) -> Vec<Result<String, Box<dyn std::error::Error + Send + Sync>>> {
    let semaphore = Arc::new(Semaphore::new(concurrency));
    let mut handles = vec![];

    for url in urls {
        let sem = Arc::clone(&semaphore);
        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            fetch_url(&url).await
        });
        handles.push((url, handle));
    }

    let mut results = vec![];
    for (url, handle) in handles {
        match handle.await {
            Ok(Ok(body)) => results.push(Ok(body)),
            Ok(Err(e)) => {
                eprintln!("Failed {}: {}", url, e);
                results.push(Err(e));
            }
            Err(e) => results.push(Err(e.into())),
        }
    }
    results
}

#[tokio::main]
async fn main() {
    let urls = vec![
        "https://example.com".into(),
        "https://rust-lang.org".into(),
    ];
    let results = fetch_urls_concurrent(urls, 3).await;
    for (i, r) in results.iter().enumerate() {
        println!("URL {}: {} bytes", i, r.as_ref().map(|s| s.len()).unwrap_or(0));
    }
}
```

### 对比要点

| 方面 | Node.js | Rust |
|------|---------|------|
| 并发控制 | 手动 pool + Promise.all | Semaphore + tokio::spawn |
| 错误类型 | throw / reject | Result |
| 取消 | 无标准 | drop JoinHandle 可取消 |

---

## 9. 常见坑和小练习

### 常见坑

1. **忘记 .await**：Rust 的 Future 是惰性的，不 await 就白写。
2. **在非 async 里 .await**：必须在 `async` 函数或块内才能 `.await`。
3. **跨 await 持有锁**：`MutexGuard` 跨 `.await` 可能死锁，用 `tokio::sync::Mutex` 或缩短锁的粒度。
4. **spawn 非 'static**：`tokio::spawn` 要求 `'static`，局部引用需 `move` 或 `Arc` 包装。
5. **阻塞 runtime**：在 async 里调用 `std::thread::sleep`、`std::sync::Mutex` 等会阻塞整个 worker 线程，应用 `tokio::time::sleep`、`tokio::sync::Mutex`。

### 小练习

1. 用 `std::thread` 写一个「多线程求和」：把 `1..=1000` 分给 4 个线程，各自求和后主线程汇总。
2. 用 `tokio::join!` 并发请求 3 个 URL，打印每个的字节长度。
3. 用 `tokio::sync::mpsc` 实现一个「生产者-消费者」：生产者发送 1..10，消费者打印。
4. 思考：为什么 `Rc<T>` 不实现 `Send`？什么情况下需要 `Arc<Mutex<T>>`？

---

*下一章预告：第 14 章——实战用 Axum 构建 REST API，从路由到中间件到数据库，对比 Express/Fastify 完成一个完整项目。*
