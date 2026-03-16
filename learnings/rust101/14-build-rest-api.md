# 第 14 章：实战 — 用 Axum 构建 REST API

> 面向 TypeScript/Node.js 全栈工程师的 Rust 入门系列

从 Express 或 Fastify 切换到 Rust 的 Web 框架时，最大的心智转变是**提取器（Extractor）**取代了 `req.params`、`req.query`、`req.body`，以及**类型驱动的请求/响应**取代了运行时校验。本章以 Axum 为例，手把手带你从 Hello World 到完整 Todo API，全程对标 Express/Fastify 的写法。

---

## 目录

1. [Axum vs Express/Fastify](#1-axum-vs-expressfastify)
2. [Hello World](#2-hello-world)
3. [路由](#3-路由)
4. [请求与响应](#4-请求与响应)
5. [状态管理](#5-状态管理)
6. [中间件](#6-中间件)
7. [错误处理](#7-错误处理)
8. [数据库访问](#8-数据库访问)
9. [完整实战：Todo API](#9-完整实战todo-api)
10. [常见坑和小练习](#10-常见坑和小练习)

---

## 1. Axum vs Express/Fastify

### 框架选型：为什么选 Axum

| 考量 | Axum 的优势 |
|------|-------------|
| **Tower 生态** | 与 Tokio、Tower 深度集成，中间件、服务抽象统一，可与 gRPC、HTTP 共用 |
| **类型安全** | 提取器在编译时校验参数类型，错误早于运行时暴露 |
| **性能** | 基于 Tokio 异步运行时，零成本抽象，与 actix-web 同梯队 |
| **官方推荐** | Rust 官方团队出品，生态活跃，长期维护有保障 |

### 对比表格：Axum vs Express vs Fastify

| 维度 | Axum (Rust) | Express (Node.js) | Fastify (Node.js) |
|------|-------------|-------------------|-------------------|
| 运行时 | Tokio（单线程多任务） | V8 Event Loop | V8 Event Loop |
| 类型系统 | 编译时强类型 | 需 TS 补充，可绕过 | 需 TS 补充，可绕过 |
| 请求参数 | 提取器（Path、Query、Json） | req.params / req.query / req.body | request.params / query / body |
| 校验 | Serde + 编译时 | zod、joi、express-validator | Fastify schema、zod |
| 中间件 | Tower Layer | (req, res, next) | (request, reply, done) |
| 生态 | 相对年轻，但增长快 | 成熟，包海量 | 成熟，性能优 |

### 其他选项简介

| 框架 | 特点 | 适用场景 |
|------|------|----------|
| **actix-web** | 老牌高性能，Actor 模型 | 极高 QPS、复杂并发 |
| **warp** | 基于 Filter 组合，函数式风格 | 喜欢组合子、Filter 链 |
| **rocket** | 宏驱动，开发体验好 | 快速原型、偏好声明式 |

---

## 2. Hello World

### 最简单的 Axum 服务器

```rust
// main.rs
use axum::{Router, routing::get};

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(hello));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn hello() -> &'static str {
    "Hello, World!"
}
```

### 对比 Express 的 Hello World

```typescript
// Express
import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Cargo.toml 依赖配置

```toml
[package]
name = "axum-hello"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
```

---

## 3. 路由

### Router 定义

```rust
use axum::{Router, routing::{get, post}};

let app = Router::new()
    .route("/", get(handler))
    .route("/users", get(list_users).post(create_user))
    .route("/users/:id", get(get_user));
```

```typescript
// Express
const router = express.Router();
router.get('/', handler);
router.get('/users', listUsers);
router.post('/users', createUser);
router.get('/users/:id', getUser);
app.use(router);
```

### 路径参数（Path）vs Express 的 req.params

```rust
use axum::extract::Path;

async fn get_user(Path(id): Path<u32>) -> String {
    format!("User #{}", id)
}

// 绑定到路由
Router::new().route("/users/:id", get(get_user))
```

```typescript
// Express：req.params 是运行时对象，类型需自行校验
app.get('/users/:id', (req, res) => {
  const id = req.params.id;  // string，可能需要 parseInt
  res.json({ user: id });
});
```

### 查询参数（Query）vs req.query

```rust
use axum::extract::Query;
use serde::Deserialize;

#[derive(Deserialize)]
struct Pagination {
    page: Option<u32>,
    limit: Option<u32>,
}

async fn list_users(Query(pagination): Query<Pagination>) -> String {
    let page = pagination.page.unwrap_or(1);
    let limit = pagination.limit.unwrap_or(10);
    format!("page={}, limit={}", page, limit)
}
```

```typescript
// Express：req.query 是 any，需手动校验
app.get('/users', (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  res.json({ page, limit });
});
```

### 嵌套路由 vs Express Router

```rust
let users_routes = Router::new()
    .route("/", get(list_users).post(create_user))
    .route("/:id", get(get_user).delete(delete_user));

let app = Router::new()
    .nest("/users", users_routes)
    .nest("/api/v1", users_routes);  // /api/v1/users, /api/v1/users/:id
```

```typescript
// Express
const userRouter = express.Router();
userRouter.get('/', listUsers);
userRouter.post('/', createUser);
userRouter.get('/:id', getUser);
userRouter.delete('/:id', deleteUser);

app.use('/users', userRouter);
app.use('/api/v1', userRouter);
```

---

## 4. 请求与响应

### 提取器（Extractor）模式 — Axum 的核心设计

Axum 不提供「万能 request 对象」，而是通过**函数参数**声明需要的数据，由框架自动注入：

```rust
// 多个提取器可组合，顺序任意
async fn create_item(
    Path(id): Path<i32>,
    Query(params): Query<SearchParams>,
    Json(body): Json<CreateItem>,
) -> impl IntoResponse {
    // 编译时保证：id 是 i32，params 已解析，body 已反序列化
}
```

| 提取器 | 对应 Express | 说明 |
|--------|--------------|------|
| `Path<T>` | req.params | 路径参数，需实现 Deserialize |
| `Query<T>` | req.query | 查询字符串 |
| `Json<T>` | req.body + express.json() | JSON 请求体 |
| `State<S>` | app.locals / req.app | 应用级状态 |

### Json<T> — 自动序列化/反序列化

```rust
use axum::{extract::Json, Json as AxumJson};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct CreateUser {
    name: String,
    email: String,
}

#[derive(Serialize)]
struct UserResponse {
    id: u32,
    name: String,
}

async fn create_user(Json(payload): Json<CreateUser>) -> AxumJson<UserResponse> {
    // payload 已是反序列化后的 CreateUser
    AxumJson(UserResponse {
        id: 1,
        name: payload.name,
    })
}
```

```typescript
// Express：需 express.json() 中间件 + 手动校验
app.use(express.json());

app.post('/users', (req, res) => {
  const { name, email } = req.body;  // 可能 undefined，需 zod 校验
  res.json({ id: 1, name });
});
```

### Serde：序列化框架

```rust
#[derive(Serialize, Deserialize)]
struct User {
    id: u32,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    email: Option<String>,
}
```

对比 TS：`JSON.parse` / `JSON.stringify` 无类型约束，通常用 **zod** 或 **io-ts** 做运行时校验；Rust 用 Serde 在**反序列化时**即完成类型校验，错误会在提取阶段返回 422。

### 自定义响应和状态码

```rust
use axum::{
    response::IntoResponse,
    http::StatusCode,
};

async fn create_resource() -> impl IntoResponse {
    (StatusCode::CREATED, Json(serde_json::json!({ "id": 1 })))
}
```

```typescript
// Express
app.post('/resources', (req, res) => {
  res.status(201).json({ id: 1 });
});
```

---

## 5. 状态管理

### State — 共享应用状态

```rust
use std::sync::Arc;

struct AppState {
    db_pool: sqlx::PgPool,
    config: Config,
}

let state = Arc::new(AppState { ... });

let app = Router::new()
    .route("/", get(handler))
    .with_state(state);
```

### 在 Handler 中使用 State

```rust
use axum::extract::State;

async fn handler(State(state): State<Arc<AppState>>) -> String {
    let pool = &state.db_pool;
    // 使用连接池
}
```

### 对比 Express 的 app.locals / req.locals

```typescript
// Express
app.locals.db = dbPool;

app.get('/data', async (req, res) => {
  const pool = req.app.locals.db;
  // ...
});
```

### Arc<AppState> 模式

`Arc` 允许多个 handler 共享同一份状态，clone 只是增加引用计数，不复制数据：

```rust
let state = Arc::new(AppState { ... });
let app = Router::new()
    .route("/a", get(handler_a))
    .route("/b", get(handler_b))
    .with_state(state);
```

---

## 6. 中间件

### Tower middleware 概念

Axum 基于 **Tower**：中间件是 `Layer`，包装 `Service`。与 Express 的 `(req, res, next)` 不同，是**类型化**的：

```rust
use tower_http::trace::TraceLayer;

let app = Router::new()
    .route("/", get(hello))
    .layer(TraceLayer::new_for_http());
```

### 日志中间件

```rust
use tower_http::trace::{TraceLayer, DefaultOnRequest, DefaultOnResponse};

let app = Router::new()
    .route("/", get(hello))
    .layer(
        TraceLayer::new_for_http()
            .on_request(DefaultOnRequest::new().level(tracing::Level::INFO))
            .on_response(DefaultOnResponse::new().level(tracing::Level::INFO)),
    );
```

```typescript
// Express
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

### 认证中间件示例

```rust
async fn auth_middleware(
    mut req: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let auth = req.headers().get("Authorization");
    if auth.is_none() {
        return (StatusCode::UNAUTHORIZED, "Missing auth").into_response();
    }
    req.extensions_mut().insert(AuthUser { id: 1 });
    next.run(req).await
}
```

```typescript
// Express
function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).send('Missing auth');
  req.user = { id: 1 };
  next();
}
```

---

## 7. 错误处理

### 自定义错误类型 + IntoResponse

```rust
use axum::{
    response::{IntoResponse, Response},
    http::StatusCode,
    Json,
};

enum AppError {
    NotFound,
    BadRequest(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "Not found"),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.as_str()),
        };
        (status, Json(serde_json::json!({ "error": message }))).into_response()
    }
}
```

### 统一的错误响应格式

```rust
async fn get_user(Path(id): Path<u32>) -> Result<Json<User>, AppError> {
    let user = fetch_user(id).await.map_err(|_| AppError::NotFound)?;
    Ok(Json(user))
}
```

```typescript
// Express：通常用 error handler middleware
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});
```

---

## 8. 数据库访问

### sqlx 简介（对比 Prisma / TypeORM）

| 特性 | sqlx | Prisma | TypeORM |
|------|------|--------|---------|
| 查询检查 | **编译时**（需 DATABASE_URL） | 生成客户端 | 运行时 |
| 异步 | 原生 async | 支持 | 支持 |
| 类型映射 | 手动 derive | 自动生成 | 装饰器 |

### 连接池配置

```rust
// main.rs
use sqlx::postgres::PgPoolOptions;

let pool = PgPoolOptions::new()
    .max_connections(10)
    .connect(&std::env::var("DATABASE_URL").unwrap())
    .await?;

let state = Arc::new(AppState { db_pool: pool });
```

```typescript
// TypeORM / Prisma 通常在模块初始化时创建连接
```

### 查询示例（compile-time checked queries!）

```rust
#[derive(sqlx::FromRow)]
struct User {
    id: i32,
    name: String,
}

let users = sqlx::query_as::<_, User>("SELECT id, name FROM users WHERE active = $1")
    .bind(true)
    .fetch_all(&pool)
    .await?;
```

sqlx 在**编译时**检查 SQL 与 `User` 结构体是否匹配，列名/类型错误会直接报错。

### 简单的 CRUD 代码

```rust
async fn create_user(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUser>,
) -> Result<Json<User>, AppError> {
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email"
    )
    .bind(&payload.name)
    .bind(&payload.email)
    .fetch_one(&state.db_pool)
    .await
    .map_err(|_| AppError::BadRequest("Insert failed".into()))?;
    Ok(Json(user))
}
```

---

## 9. 完整实战：Todo API

### 项目结构

```
axum-todo-api/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── handlers/
│   │   └── mod.rs
│   ├── models/
│   │   └── mod.rs
│   └── state.rs
```

### Cargo.toml 完整配置

```toml
[package]
name = "axum-todo-api"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = { version = "0.7", features = ["json"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.7", features = ["runtime-tokio", "postgres"] }
tower-http = { version = "0.5", features = ["trace"] }
tracing = "0.1"
tracing-subscriber = "0.3"
```

### 完整的 CRUD API 代码

```rust
// src/main.rs
mod handlers;
mod models;
mod state;

use axum::{Router, routing::{get, post, patch, delete}};
use state::AppState;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    let pool = sqlx::postgres::PgPoolOptions::new()
        .connect(&std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://localhost/todo".into()))
        .await
        .expect("DB connection failed");

    sqlx::migrate!("./migrations").run(&pool).await.unwrap();

    let state = Arc::new(AppState { db_pool: pool });

    let app = Router::new()
        .route("/todos", get(handlers::list_todos).post(handlers::create_todo))
        .route("/todos/:id", get(handlers::get_todo).patch(handlers::update_todo).delete(handlers::delete_todo))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

```rust
// src/models/mod.rs
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct CreateTodo {
    pub title: String,
    pub done: Option<bool>,
}

#[derive(Deserialize)]
pub struct UpdateTodo {
    pub title: Option<String>,
    pub done: Option<bool>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Todo {
    pub id: i32,
    pub title: String,
    pub done: bool,
}
```

```rust
// src/state.rs
use sqlx::PgPool;

pub struct AppState {
    pub db_pool: PgPool,
}
```

```rust
// src/handlers/mod.rs
use axum::{
    extract::{Path, State},
    Json,
};
use crate::models::{CreateTodo, Todo, UpdateTodo};
use crate::state::AppState;
use std::sync::Arc;

pub async fn list_todos(State(state): State<Arc<AppState>>) -> Json<Vec<Todo>> {
    let todos = sqlx::query_as::<_, Todo>("SELECT id, title, done FROM todos ORDER BY id")
        .fetch_all(&state.db_pool)
        .await
        .unwrap_or_default();
    Json(todos)
}

pub async fn create_todo(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateTodo>,
) -> Json<Todo> {
    let todo = sqlx::query_as::<_, Todo>(
        "INSERT INTO todos (title, done) VALUES ($1, $2) RETURNING id, title, done"
    )
    .bind(&payload.title)
    .bind(payload.done.unwrap_or(false))
    .fetch_one(&state.db_pool)
    .await
    .expect("Insert failed");
    Json(todo)
}

pub async fn get_todo(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Option<Json<Todo>> {
    let todo = sqlx::query_as::<_, Todo>("SELECT id, title, done FROM todos WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db_pool)
        .await
        .ok()??;
    Some(Json(todo))
}

pub async fn update_todo(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    Json(payload): Json<UpdateTodo>,
) -> Option<Json<Todo>> {
    let todo = sqlx::query_as::<_, Todo>(
        "UPDATE todos SET title = COALESCE($1, title), done = COALESCE($2, done) WHERE id = $3 RETURNING id, title, done"
    )
    .bind(payload.title.as_deref())
    .bind(payload.done)
    .bind(id)
    .fetch_optional(&state.db_pool)
    .await
    .ok()??;
    Some(Json(todo))
}

pub async fn delete_todo(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> axum::http::StatusCode {
    let result = sqlx::query("DELETE FROM todos WHERE id = $1")
        .bind(id)
        .execute(&state.db_pool)
        .await;
    if result.map(|r| r.rows_affected() > 0).unwrap_or(false) {
        axum::http::StatusCode::NO_CONTENT
    } else {
        axum::http::StatusCode::NOT_FOUND
    }
}
```

### migrations/001_create_todos.sql

```sql
CREATE TABLE todos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    done BOOLEAN NOT NULL DEFAULT false
);
```

### 对比同样功能的 Express + TypeScript 版本（简要）

```typescript
// Express + TypeScript 典型写法
import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.get('/todos', async (req, res) => {
  const todos = await prisma.todo.findMany();
  res.json(todos);
});

app.post('/todos', async (req, res) => {
  const { title, done } = req.body;
  const todo = await prisma.todo.create({ data: { title, done: !!done } });
  res.json(todo);
});

app.get('/todos/:id', async (req, res) => {
  const todo = await prisma.todo.findUnique({ where: { id: +req.params.id } });
  if (!todo) return res.status(404).send();
  res.json(todo);
});

app.patch('/todos/:id', async (req, res) => {
  const todo = await prisma.todo.update({
    where: { id: +req.params.id },
    data: req.body,
  });
  res.json(todo);
});

app.delete('/todos/:id', async (req, res) => {
  await prisma.todo.delete({ where: { id: +req.params.id } });
  res.status(204).send();
});
```

**差异小结**：Rust 版本通过提取器和 Serde 在编译期约束类型；Express 依赖 Prisma 的 TS 类型，但 `req.body` 仍需运行时校验（如 zod）。

---

## 10. 常见坑和小练习

### 常见坑

1. **提取器顺序**：`State` 必须放在第一位（或按框架要求的顺序），否则可能编译失败。
2. **Json 反序列化失败**：默认返回 422，如需自定义需实现 `IntoResponse`  for `serde_json::Error`。
3. **sqlx 编译时检查**：需设置 `DATABASE_URL` 或 `SQLX_OFFLINE=true`，否则 `cargo build` 会连数据库。
4. **Clone vs Arc**：大状态用 `Arc`，小配置可用 `Arc` 或实现 `Clone` 的简单结构体。
5. **异步 handler**：必须返回 `impl Future` 或 `async fn`，不能混用同步阻塞调用（会卡住 runtime）。

### 小练习

1. **为 Todo API 添加分页**：`GET /todos?page=1&limit=10`，用 `Query<Pagination>` 提取。
2. **实现认证中间件**：检查 `Authorization: Bearer <token>`，无效时返回 401。
3. **统一错误处理**：将 `sqlx::Error` 转为 `AppError`，实现 `From<sqlx::Error> for AppError`。
4. **添加 CORS**：使用 `tower-http::cors::CorsLayer` 允许前端跨域。
5. **对比性能**：用 `wrk` 或 `ab` 压测 Axum 与 Fastify 的 `/todos` 接口，感受 Rust 的 QPS 优势。

---

*下一篇：第 15 章 — 测试、工具链与 Node.js 互操作，学习 cargo test、文档测试、napi-rs 以及渐进式迁移策略。*
