# 第 08 章：集合与迭代器 —— Rust 的函数式编程核心

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

**集合与迭代器是 Rust 最优雅、最高效的抽象之一。** 从 TypeScript 的 `Array.map/filter`、`Map`、`Set` 出发，你会发现在 Rust 中，惰性求值的迭代器链不仅更灵活，还能做到「零成本抽象」—— 不产生中间分配，性能逼近手写循环。本章将带你全面掌握 Rust 的集合生态与迭代器哲学。

---

## 目录

1. [核心集合类型](#1-核心集合类型)
2. [迭代器（Iterator）—— Rust 的函数式编程核心](#2-迭代器iteratorrust-的函数式编程核心)
3. [常用迭代器适配器](#3-常用迭代器适配器)
4. [惰性求值 vs 立即求值](#4-惰性求值-vs-立即求值)
5. [collect() 的魔法](#5-collect-的魔法)
6. [自定义迭代器](#6-自定义迭代器)
7. [实战：用迭代器处理日志数据](#7-实战用迭代器处理日志数据)
8. [常见坑](#8-常见坑)
9. [小练习](#9-小练习)

---

## 1. 核心集合类型

### Vec&lt;T&gt; vs Array —— 动态数组对比

#### 概念引入（从 TS/JS 视角）

在 TypeScript 中，数组是动态的，可以 `push`、`pop`、`splice`，长度可变：

```typescript
const arr: number[] = [1, 2, 3];
arr.push(4);
const last = arr.pop();
const len = arr.length;
const second = arr[1];        // 可能 undefined（越界）
const has = arr.includes(2);
```

#### Rust 的做法

`Vec<T>` 是 Rust 的「动态数组」，类似 TS 的 `Array`，但类型更严格：

```rust
let mut vec: Vec<i32> = vec![1, 2, 3];
vec.push(4);
let last = vec.pop();         // 返回 Option<i32>
let len = vec.len();
// 索引访问 vs get()
let second = vec[1];          // 越界会 panic!
let second_safe = vec.get(1); // 返回 Option<&i32>
let has = vec.contains(&2);
```

#### 背后的 Why

Rust 区分「必然成功」与「可能失败」：直接用 `[]` 索引是「我确信索引有效」；`get()` 返回 `Option`，让你显式处理越界。TS 的 `arr[i]` 越界返回 `undefined`，容易埋坑。

#### 常用方法对比表

| 操作 | TypeScript | Rust |
|------|------------|------|
| 创建 | `[]` / `new Array()` | `vec![]` / `Vec::new()` |
| 添加 | `push(x)` | `push(x)` |
| 移除末尾 | `pop()` → `T \| undefined` | `pop()` → `Option<T>` |
| 长度 | `length` | `len()` |
| 索引取值 | `arr[i]` → `T \| undefined` | `vec[i]` panic / `vec.get(i)` → `Option<&T>` |
| 是否包含 | `includes(x)` | `contains(&x)` |
| 迭代 | `for (const x of arr)` | `for x in &vec` / `vec.iter()` |
| 清空 | `arr.length = 0` | `vec.clear()` |
| 插入 | `splice(i, 0, x)` | `insert(i, x)` |
| 移除 | `splice(i, 1)` | `remove(i)` |

#### 索引访问 vs get()（panic vs Option）

```typescript
// TypeScript: 越界返回 undefined，容易忽略
const arr = [1, 2, 3];
const x = arr[10];  // undefined，后续用 x 可能出 bug
```

```rust
// Rust: 两种方式
let vec = vec![1, 2, 3];

// 方式 1：[] 索引 —— 越界 panic（适合你确定索引有效时）
let x = vec[1];  // 2

// 方式 2：get() —— 返回 Option，安全
match vec.get(10) {
    Some(v) => println!("{}", v),
    None => println!("索引越界"),
}
```

---

### HashMap&lt;K, V&gt; vs Map / Object

#### 概念引入（从 TS/JS 视角）

```typescript
const map = new Map<string, number>();
map.set("a", 1);
map.set("b", 2);
const val = map.get("a");     // number | undefined
const has = map.has("c");     // false

// 常见模式：不存在时设置默认值
if (!map.has("count")) {
  map.set("count", 0);
}
map.set("count", map.get("count")! + 1);
```

#### Rust 的做法

```rust
use std::collections::HashMap;

let mut map = HashMap::new();
map.insert("a", 1);
map.insert("b", 2);
let val = map.get("a");       // Option<&i32>
let has = map.contains_key("c");

// entry API —— Rust 独有的优雅模式
*map.entry("count").or_insert(0) += 1;
```

#### entry API —— Rust 独有的优雅模式

对比 JS 的 `if (!map.has(key)) map.set(key, default)`，Rust 的 `entry` 一步到位：

```typescript
// TypeScript: 啰嗦
if (!map.has("count")) {
  map.set("count", 0);
}
map.set("count", map.get("count")! + 1);

// 或用 ?? 但还是要两次操作
map.set("count", (map.get("count") ?? 0) + 1);
```

```rust
// Rust: entry 一行搞定
*map.entry("count").or_insert(0) += 1;

// 或用 or_insert_with 惰性计算默认值
map.entry("key").or_insert_with(|| expensive_compute());
```

| entry 方法 | 说明 |
|------------|------|
| `or_insert(value)` | 不存在时插入 value |
| `or_insert_with(f)` | 不存在时用闭包 f 计算并插入 |
| `and_modify(f)` | 存在时用 f 修改值 |
| `or_default()` | 不存在时插入 `Default::default()` |

---

### HashSet&lt;T&gt; vs Set

```typescript
const set = new Set<number>([1, 2, 3]);
set.add(4);
set.has(2);   // true
set.delete(2);
const arr = [...set];
```

```rust
use std::collections::HashSet;

let mut set: HashSet<i32> = [1, 2, 3].into();
set.insert(4);
set.contains(&2);  // true
set.remove(&2);
let vec: Vec<_> = set.into_iter().collect();
```

---

### String vs string（回顾和深化）

| 操作 | TypeScript | Rust |
|------|------------|------|
| 创建 | `"hi"` / `new String()` | `"hi"` (str) / `String::from("hi")` |
| 追加 | `str += "x"` | `s.push_str("x")` / `s.push('c')` |
| 长度 | `str.length` | `s.len()` (字节) / `s.chars().count()` (字符) |
| 索引 | `str[i]` | 不直接支持（UTF-8），用 `s.chars().nth(i)` |
| 分割 | `str.split(',')` | `s.split(',')` 返回迭代器 |

---

### VecDeque、BTreeMap 简要介绍

| 类型 | 用途 | 类比 |
|------|------|------|
| `VecDeque<T>` | 双端队列，两端 O(1) push/pop | 类似 TS 数组但两端操作高效 |
| `BTreeMap<K,V>` | 有序映射，按键排序 | 类似 `Map` 但有序，可范围查询 |
| `BTreeSet<T>` | 有序集合 | 类似 `Set` 但有序 |

```rust
use std::collections::{VecDeque, BTreeMap};

let mut deque = VecDeque::new();
deque.push_back(1);
deque.push_front(0);

let mut btree = BTreeMap::new();
btree.insert("b", 2);
btree.insert("a", 1);
// 迭代时按 key 顺序: ("a", 1), ("b", 2)
```

---

## 2. 迭代器（Iterator）—— Rust 的函数式编程核心

### Iterator trait：只需要实现 next() 方法

Rust 的迭代器是一个 **trait**，核心只需实现 `next()`：

```rust
pub trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
    // 其他方法（map, filter, collect 等）有默认实现
}
```

实现 `Iterator` 后，自动获得 `map`、`filter`、`take`、`collect` 等几十个方法。

### 对比 TS 的 Array.prototype 方法

| TypeScript | Rust |
|------------|------|
| `arr.map(f)` | `iter.map(f)` |
| `arr.filter(f)` | `iter.filter(f)` |
| `arr.reduce(acc, f)` | `iter.fold(init, f)` |
| `arr.find(f)` | `iter.find(f)` |
| `arr.some(f)` | `iter.any(f)` |
| `arr.every(f)` | `iter.all(f)` |
| `arr.flatMap(f)` | `iter.flat_map(f)` |

### 三种迭代方式：iter() / iter_mut() / into_iter()

| 方法 | 产生类型 | 所有权 |
|------|----------|--------|
| `iter()` | `Iterator<Item = &T>` | 借用，原集合不变 |
| `iter_mut()` | `Iterator<Item = &mut T>` | 可变借用，可修改元素 |
| `into_iter()` | `Iterator<Item = T>` | 消耗集合，取得所有权 |

```rust
let vec = vec![1, 2, 3];

// 只读遍历，vec 仍可用
for x in vec.iter() {
    println!("{}", x);
}

// 可变遍历，可修改
for x in vec.iter_mut() {
    *x += 1;
}

// 消耗 vec，遍历后 vec 不可再用
for x in vec.into_iter() {
    println!("{}", x);
}
// println!("{:?}", vec);  // 错误：vec 已被移动
```

### for 循环的本质是语法糖

```rust
for x in vec.iter() {
    println!("{}", x);
}
```

等价于：

```rust
let mut iter = vec.iter();
while let Some(x) = iter.next() {
    println!("{}", x);
}
```

---

## 3. 常用迭代器适配器

### map / filter / filter_map

```typescript
// TypeScript
const nums = [1, 2, 3, 4, 5];
const result = nums
  .filter(n => n % 2 === 0)
  .map(n => n * 2);
// [4, 8]
```

```rust
// Rust
let nums = vec![1, 2, 3, 4, 5];
let result: Vec<_> = nums
    .iter()
    .filter(|n| *n % 2 == 0)
    .map(|n| n * 2)
    .collect();
// [4, 8]
```

`filter_map`：过滤 + 映射合一，返回 `Option` 时自动跳过 `None`：

```rust
let strings = ["1", "two", "3", "four"];
let nums: Vec<i32> = strings
    .iter()
    .filter_map(|s| s.parse().ok())
    .collect();
// [1, 3]
```

### enumerate（对比 entries()）

```typescript
// TypeScript: Object.entries / arr.entries()
for (const [i, v] of arr.entries()) {
  console.log(i, v);
}
```

```rust
// Rust
for (i, v) in vec.iter().enumerate() {
    println!("{}: {}", i, v);
}
```

### zip（对比 lodash.zip）

```rust
let a = [1, 2, 3];
let b = [10, 20, 30];
let sum: Vec<_> = a.iter().zip(b.iter()).map(|(x, y)| x + y).collect();
// [11, 22, 33]
```

### flat_map（对比 flatMap）

```rust
let matrix = [[1, 2], [3, 4], [5, 6]];
let flat: Vec<_> = matrix.iter().flat_map(|row| row.iter()).collect();
// 或
let flat: Vec<_> = matrix.iter().flatten().collect();
```

### take / skip / chain

```rust
let nums = [1, 2, 3, 4, 5];
nums.iter().take(2);      // [1, 2]
nums.iter().skip(2);      // [3, 4, 5]
nums.iter().chain([6, 7].iter());  // [1,2,3,4,5,6,7]
```

### 对比表格：TS Array 方法 → Rust Iterator 方法

| TypeScript | Rust |
|------------|------|
| `map(f)` | `map(\|x\| f(x))` |
| `filter(f)` | `filter(\|x\| f(x))` |
| `flatMap(f)` | `flat_map(\|x\| f(x))` |
| `reduce(init, f)` | `fold(init, \|acc, x\| f(acc, x))` |
| `find(f)` | `find(\|x\| f(x))` |
| `findIndex(f)` | `position(\|x\| f(x))` |
| `some(f)` | `any(\|x\| f(x))` |
| `every(f)` | `all(\|x\| f(x))` |
| `slice(0, n)` | `take(n)` |
| `slice(n)` | `skip(n)` |
| `concat` | `chain` |
| `entries()` | `enumerate()` |
| `reverse()` | `rev()` |

---

## 4. 惰性求值 vs 立即求值

### TS：每个 map/filter 都立即产生新数组

```typescript
const arr = [1, 2, 3, 4, 5];
const a = arr.filter(n => n > 2);   // 立即执行，分配新数组 [3,4,5]
const b = a.map(n => n * 2);       // 立即执行，再分配 [6,8,10]
const c = b.slice(0, 1);           // 再分配 [6]
```

每一步都分配新数组，链越长，中间分配越多。

### Rust：iterator chain 是惰性的，直到 collect 才执行

```rust
let nums = vec![1, 2, 3, 4, 5];
let result: Vec<_> = nums
    .iter()
    .filter(|n| **n > 2)
    .map(|n| n * 2)
    .take(1)
    .collect();  // 只有 collect 时才真正执行
```

在 `collect()` 之前，`filter`、`map`、`take` 只是**组合了迭代器**，没有分配任何中间 Vec。执行时按需取元素，一次遍历完成所有逻辑。

### 性能优势：不产生中间分配

```rust
// 手写循环
let mut result = Vec::new();
for n in nums.iter() {
    if *n > 2 {
        result.push(n * 2);
        if result.len() >= 1 { break; }
    }
}

// 迭代器版本 —— 编译后性能与上面相当！
let result: Vec<_> = nums.iter().filter(|n| **n > 2).map(|n| n * 2).take(1).collect();
```

### 零成本抽象的实际体现

Rust 的迭代器是「零成本抽象」的典型：写起来像函数式，跑起来像手写循环，没有额外分配和虚函数调用。

---

## 5. collect() 的魔法

### 类型驱动的收集：同一 iterator 可 collect 成多种类型

```rust
let nums = [1, 2, 2, 3, 3, 3];

let vec: Vec<_> = nums.iter().collect();
let set: HashSet<_> = nums.iter().collect();
let mut map: HashMap<_, _> = nums.iter().map(|n| (n, n * 2)).collect();
let s: String = vec!['a', 'b', 'c'].into_iter().collect();
```

同一个迭代器，`collect` 成什么取决于你声明的类型。

### turbofish 语法 ::&lt;&gt;

当类型无法推断时，用 turbofish 指定：

```rust
let vec: Vec<i32> = (0..5).collect();
// 或
let vec = (0..5).collect::<Vec<i32>>();
```

### 对比 TS

```typescript
// TypeScript: 需要手动构造
const entries = [...map.entries()];
const map2 = new Map(entries);
const obj = Object.fromEntries(entries);
```

```rust
// Rust: 类型驱动，一行 collect
let map: HashMap<_, _> = iterator.collect();
```

---

## 6. 自定义迭代器

为自己的类型实现 `Iterator` trait：

```rust
struct Countdown {
    count: u32,
}

impl Countdown {
    fn new(start: u32) -> Self {
        Self { count: start }
    }
}

impl Iterator for Countdown {
    type Item = u32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.count == 0 {
            None
        } else {
            self.count -= 1;
            Some(self.count + 1)
        }
    }
}

fn main() {
    let c = Countdown::new(3);
    for n in c {
        println!("{}", n);  // 3, 2, 1
    }
}
```

---

## 7. 实战：用迭代器处理日志数据

需求：解析日志行，过滤 ERROR 级别，按模块统计次数，输出前 5。

**TypeScript 版本：**

```typescript
const logs = [
  "2024-01-15 10:00:00 [INFO]  [http]  Request started",
  "2024-01-15 10:00:01 [ERROR] [http]  Connection failed",
  "2024-01-15 10:00:02 [ERROR] [db]   Query timeout",
  "2024-01-15 10:00:03 [INFO]  [http]  Request ended",
  "2024-01-15 10:00:04 [ERROR] [http]  Connection failed",
];

const errorByModule: Record<string, number> = {};
for (const line of logs) {
  const match = line.match(/\[ERROR\]\s+\[(\w+)\]/);
  if (match) {
    const mod = match[1];
    errorByModule[mod] = (errorByModule[mod] ?? 0) + 1;
  }
}
const sorted = Object.entries(errorByModule)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);
console.log(sorted);
```

**Rust 版本：**

```rust
use std::collections::HashMap;

fn main() {
    let logs = [
        "2024-01-15 10:00:00 [INFO]  [http]  Request started",
        "2024-01-15 10:00:01 [ERROR] [http]  Connection failed",
        "2024-01-15 10:00:02 [ERROR] [db]   Query timeout",
        "2024-01-15 10:00:03 [INFO]  [http]  Request ended",
        "2024-01-15 10:00:04 [ERROR] [http]  Connection failed",
    ];

    let error_by_module: HashMap<&str, u32> = logs
        .iter()
        .filter_map(|line| {
            line.find("[ERROR]").and_then(|_| {
                line.find("[http]").or_else(|| line.find("[db]")).and_then(|start| {
                    let module = line[start + 1..].split(']').next()?;
                    Some(module.trim())
                })
            })
        })
        .fold(HashMap::new(), |mut acc, module| {
            *acc.entry(module).or_insert(0) += 1;
            acc
        });

    let mut sorted: Vec<_> = error_by_module.into_iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));
    for (module, count) in sorted.into_iter().take(5) {
        println!("{}: {}", module, count);
    }
}
```

简化版解析（用正则或更清晰的逻辑）：

```rust
// 更清晰：先解析出 (is_error, module)
let parsed: Vec<_> = logs
    .iter()
    .filter_map(|line| {
        if !line.contains("[ERROR]") { return None; }
        let after_bracket = line.find(']')?;
        let rest = &line[after_bracket + 1..];
        let mod_start = rest.find('[')? + 1;
        let mod_end = rest[mod_start..].find(']')?;
        Some(&rest[mod_start..mod_start + mod_end])
    })
    .collect();

let mut counts: HashMap<&str, u32> = HashMap::new();
for m in parsed {
    *counts.entry(m).or_insert(0) += 1;
}
```

---

## 8. 常见坑

### 坑 1：迭代器消费后无法再用

```rust
let iter = vec![1, 2, 3].iter();
let a: Vec<_> = iter.map(|x| x + 1).collect();
let b: Vec<_> = iter.map(|x| x * 2).collect();  // 错误！iter 已被消费
```

**解决：** 需要第二次迭代时，对原集合再调用 `iter()`。

### 坑 2：collect 需要类型注解

```rust
let nums = vec![1, 2, 3];
let doubled = nums.iter().map(|x| x * 2).collect();  // 编译错误：collect 成什么？
let doubled: Vec<_> = nums.iter().map(|x| x * 2).collect();  // 正确
```

### 坑 3：闭包里的引用与所有权

```rust
let vec = vec![1, 2, 3];
let iter = vec.iter().filter(|x| **x > 1);
// 若在 iter 使用期间修改 vec，会借用的编译错误
```

### 坑 4：into_iter 会消耗集合

```rust
let vec = vec![1, 2, 3];
for x in vec.into_iter() { }  // vec 被消耗
println!("{:?}", vec);  // 错误
```

---

## 9. 小练习

### 练习 1：统计单词频率

给定 `Vec<&str>` 的单词列表，用 `HashMap` 和 `entry` API 统计每个单词出现次数，然后按频次降序输出前 3 个。

```rust
// 示例输入
let words = vec!["apple", "banana", "apple", "cherry", "banana", "apple"];
// 输出: [("apple", 3), ("banana", 2), ("cherry", 1)]
```

<details>
<summary>参考答案</summary>

```rust
use std::collections::HashMap;

fn main() {
    let words = vec!["apple", "banana", "apple", "cherry", "banana", "apple"];
    let mut counts: HashMap<&str, u32> = HashMap::new();
    for w in &words {
        *counts.entry(*w).or_insert(0) += 1;
    }
    let mut sorted: Vec<_> = counts.into_iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));
    for (word, n) in sorted.into_iter().take(3) {
        println!("{}: {}", word, n);
    }
}
```

</details>

### 练习 2：用迭代器实现 flatMap + 去重

给定 `vec![vec![1, 2], vec![2, 3], vec![3, 4]]`，用迭代器先扁平化，再去重，最后排序，得到 `[1, 2, 3, 4]`。

<details>
<summary>参考答案</summary>

```rust
use std::collections::BTreeSet;

fn main() {
    let matrix = vec![vec![1, 2], vec![2, 3], vec![3, 4]];
    let result: Vec<_> = matrix
        .into_iter()
        .flat_map(|v| v.into_iter())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    println!("{:?}", result);  // [1, 2, 3, 4]
}
```

或更简洁：`flat_map` → `into_iter` → 用 `BTreeSet` 或先 collect 再 sort dedup。

</details>

### 练习 3：实现斐波那契迭代器

实现一个 `Fib` 类型，实现 `Iterator<Item = u64>`，产生斐波那契数列：1, 1, 2, 3, 5, 8, ...

<details>
<summary>参考答案</summary>

```rust
struct Fib {
    a: u64,
    b: u64,
}

impl Fib {
    fn new() -> Self {
        Self { a: 0, b: 1 }
    }
}

impl Iterator for Fib {
    type Item = u64;

    fn next(&mut self) -> Option<Self::Item> {
        let c = self.a + self.b;
        self.a = self.b;
        self.b = c;
        Some(self.a)
    }
}

fn main() {
    for n in Fib::new().take(10) {
        print!("{} ", n);
    }
    // 1 1 2 3 5 8 13 21 34 55
}
```

</details>

---

**下一章预告：** 第 09 章将介绍 **闭包与函数**，学习 Fn/FnMut/FnOnce 三种闭包 trait 以及它们与所有权的关系。
