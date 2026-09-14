---
layout: post
title: "积木，而非成品：Pi Agent Harness 的克制与精妙"
date: 2026-09-06 20:00:00
status: draft
tags:
  - AI
  - Agent
  - Harness
  - Pi
  - TypeScript
---

上一篇文章《给大脑配一副好鞍具》，我把五款 agent harness 放在同一套"五件套"框架下做了解剖和实测。那一轮实测里，Pi 交出的成绩单是这样的：**9 秒修完 3 个 bug、3375 个 token、成本 0.00007 美元**——五家里最快，也最便宜，便宜到约等于免费。当时我给它的画像是一句玩笑话："极客的改装车手：一切自己动手、自己说了算。"

这篇文章想做的一件事：不再满足于上篇那句结论，而是**把 Pi 从底层到界面逐层拆开来看**——它为什么能跑这么快、这么省？它那些"别人都有而它偏不做"的设计，到底是偷懒还是深思？以及最关键的：**在一众大同小异的 agent harness 里，Pi 真正独到和精妙的地方到底是什么？**

先给结论，再拆给你看：

- **它的独到之处，一半藏在"敢不做"里**——这个品类里用 **harness（马具）** 自称的项目不多，而把 harness 做成"库"而不是"产品"这件事，它做得最彻底：模型层、循环层、产品层、UI 层严格单向分层，CLI 只是其中一个驾驶舱；
- **另一半藏在"把一切做成数据"里**——会话是一棵可以原地分支的树，压缩是给历史写摘要而不是删历史，token 与缓存是消息上的一等计量单位。因为一切都数据化了，它才可以被拆开、被续跑、被分享、甚至被 agent 自己读源码来向你解释。

拆到最后一层你会发现，Pi 的这些"克制"其实都指向同一个词：**选择权**。模型你随便换，历史怎么存由数据说了算，安全边界由你画，连"要不要子代理"都由你自己拼。好，开工。

<!--more-->

## 一、先认识 Pi

### 1.1 身份卡

Pi 的官方仓库在 [github.com/earendil-works/pi](https://github.com/earendil-works/pi)（早期叫 `pi-mono`，访问会自动 301 跳转）。它的 README 第一行就亮明了身份：

> # Pi Agent Harness
> This is the home of the Pi agent harness project including our self extensible coding agent.

注意这个词：**它自己管自己叫 harness**。"Harness" 就是上一篇文章里说的"马具/鞍具"——套在模型这匹马身上，把"只会说话"变成"会干活"的那套东西。大多数同类产品自称"coding agent"或"assistant"，把自己当成一个完整的应用；Pi 却挑了 harness 这个更像"零件"的词——它是一套工具，不是目的地。（同样以 harness 自居的还有 DeepSeek Harness，但后者把 harness 做成"插件平台"；Pi 的野心是把 harness 做成**可以嵌入任何程序的库**——这一差异正是本文要展开的主线。）

几个硬指标（2026-09-06 抓取，开源世界变化快）：

| | Pi |
|---|---|
| **作者** | Mario Zechner（badlogic），游戏引擎 [libGDX](https://libgdx.com) 的作者，2026-04 加入 Earendil Inc.（仍 MIT 开源） |
| **仓库** | [earendil-works/pi](https://github.com/earendil-works/pi)（曾用名 pi-mono，301 跳转） |
| **语言/许可** | TypeScript monorepo，MIT |
| **建仓** | 2025-08-09 |
| **star**（2026-09-06） | 102,296（我 8-23 写对比文时约 9.6 万） |
| **当前版本** | 0.85.1（2026-09-06 抓取；我 8-23 实测时是 0.84.2） |
| **npm 包家族** | `@earendil-works/pi-ai`、`pi-agent-core`、`pi-coding-agent`、`pi-tui`、`chord`、`pi-telemetry`、`pi-session-backend-sqlite-node` 等 |

顺带讲个名字的掌故。翻到 2025-08-09 的第一个 commit，`pi` 这个名字最初属于 monorepo 里的一个部署工具——"在 GPU pod 上自动配置 vLLM、跑 agentic 模型"的 CLI（README 原话：*"Deploy and manage LLMs on GPU pods with automatic vLLM configuration for agentic workloads."*，用法是 `pi start Qwen/Qwen2.5-Coder-32B-Instruct`）。那时的三件套是：pi-tui（差分渲染终端库）、pi-agent（带会话持久化的 agent 库）、以及这个叫 pi 的 pod 工具。后来编码 agent 越长越大，反过来继承了 "Pi" 这个名字——所以别问它是不是圆周率，它更像"某台跑模型的机器"的昵称（官方从没解释过名字，这是我的考古推测）。自我定位也是后来才长齐的：2025 年底它还自称 "a radically simple and opinionated coding agent"，2026 年初才改成 "minimal terminal coding harness / Adapt pi to your workflows"，直到 2026-05-07 的 README 才写下今天的大标题 "# Pi Agent Harness"。

它的产品 README 里有一段话，几乎就是整个项目的设计宣言：

> Pi is a minimal terminal coding harness. **Adapt pi to your workflows, not the other way around**, without having to fork and modify pi internals.

翻译过来：**让 Pi 适应你的工作流，而不是让你去适应 Pi；而你不需要 fork 它的源码来做到这一点。** 这句话里藏着两层野心：一是"极简"，二是"可被塑造"。官方文档里还有一句更狠的，是这篇解剖的题眼：**"积木，而非成品"**（英文原话 "Primitives, not features"）——Pi 给你的是可以自由拼装的原语，而不是替你拼好的成品功能。

### 1.2 它的"不做清单"本身就是产品文档

Pi 的产品 README 里有一节叫 Philosophy，通篇是一个接一个的"No"：

- **No MCP**——不做 MCP 协议接入（作者专门写了篇博客解释：[《What if you don't need MCP?》](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)）
- **No sub-agents**——没有内置子代理
- **No permission popups**——没有权限确认弹窗
- **No plan mode**——没有计划模式
- **No built-in to-dos**、**No background bash**

这句话值得逐字读：

> Pi is aggressively extensible so it doesn't have to dictate your workflow. Features that other tools bake in can be built with extensions, skills, or installed from third-party pi packages. This keeps the core minimal while letting you shape pi to fit how you work.

**别人家"内置"的功能，在 Pi 这里是"可以自己造，或者装个第三方包"**。这套思路我们在前端见过太多次了——框架 vs 库、batteries included vs 自己组装。但放到 agent harness 这个还年轻的品类里，它是独一份的激进。

所以拆解 Pi 的正确姿势不是背功能清单，而是带着两个问题去看：

1. **它把"层"切在了哪里？为什么这样切？（架构观）**
2. **它把什么东西做成了"数据"而不是"代码"？（数据观）**

下面带着这两个问题，按 monorepo 的依赖方向**从下往上逐层拆**——先看最底下的"模型层"：

```
   pi-tui（自研终端 UI：差分渲染）
       ▲
   pi-coding-agent（CLI：interactive / print / json / rpc / SDK）
       ▲
   pi-agent-core（agent 循环、会话树、压缩、状态机）
       ▲
   pi-ai（统一多 provider LLM API）
       ▲
   OpenAI / Anthropic / Google / DeepSeek / 各家订阅 OAuth / 本地模型……
```

依赖永远是单向的：上层 import 下层，下层对上层一无所知。

## 二、pi-ai：把全世界的模型抹平成同一条流

### 2.1 问题：模型是供应商，协议是方言

一个 agent harness 的第一层功课，是回答"模型怎么接"。市面上每家的协议都不一样：OpenAI 有 Completions 和 Responses 两套、Anthropic 是 Messages、Google 是 Generative AI、DeepSeek/Moonshot 走 OpenAI 兼容、AWS 是 Bedrock、Copilot 又混着来……如果 harness 为每个模型写一份胶水代码，那它永远在追新模型的路上。

Pi 的做法是把这一层彻底抽成一个独立包：**pi-ai**（`@earendil-works/pi-ai`）。它不是一个 HTTP 服务，而是一个进程内库，核心是三个对象：

- **`Model`**——一个模型的完整描述：id、名称、所属 provider、baseUrl、上下文窗口、价格、以及一堆**兼容性开关**；
- **`Context`**——一次请求的输入：system prompt + 消息列表 + 工具 schema；
- **`StreamOptions`**——温度、maxTokens、**缓存保留策略**、sessionId 等。

Provider 是"运行时单位"，拥有自己的模型目录、认证方式和流式行为；但 provider 之间共享的是同一套 **wire 协议实现**——整个 pi-ai 只认识十种"方言"（`KnownApi`）：openai-completions、openai-responses、anthropic-messages、bedrock、google-generative-ai、vertex…… 以及一个它自己的 **pi-messages**。也就是说："Anthropic 的模型走 anthropic-messages 方言；xAI/Groq/Cerebras/OpenRouter 这群 OpenAI 兼容的，全共享 openai-completions 方言；DeepSeek 也是，只是 baseUrl 不同。"

你可能脱口而出：给每个模型写个适配器不就行了？——难的不是写适配器，而是让几十个适配器不失控。Pi 的答案是把它想成一层**翻译**，而且翻译只有两步：上层只认识统一的 Model / Context / 事件流，真正的方言差异全部被关在"驱动（driver）"里。每个驱动只做两件事——把统一消息翻译成该方言的报文（`toWire`），再把 provider 吐回来的原始字节翻译成统一事件（`toEvent`）：

```ts
// 示意：pi-ai 的"翻译层"思路（非逐字源码）
async function* stream(model, context, options) {
  const driver = getApiDriver(model.api);   // 按 wire 方言取驱动（10 选 1）
  const wire = driver.toWire({              // 统一输入 → 该方言的报文
    system: context.systemPrompt,
    messages: context.messages,             // 统一消息模型
    tools: context.tools,
    cacheRetention: options.cacheRetention, // none | short | long
    sessionId: options.sessionId,
    compat: model.compat,                   // 该模型的兼容开关矩阵
  });
  for await (const raw of driver.rawStream(wire)) {
    yield driver.toEvent(raw);              // provider 原始字节 → 统一事件
  }
}
```

各家差异（缓存怎么打点、thinking 叫什么名字、哪些参数不能发）全都落在这 `toWire` / `toEvent` 两步里——这正是 2.3 节要说的 compat 开关矩阵的用武之地。

### 2.2 消息不是字符串，是结构化的"内容块"

前端工程师都熟悉"把界面数据化"的好处；Pi 把"对话数据化"做到了同样的程度。消息只有三种角色：`UserMessage`、`AssistantMessage`、`ToolResultMessage`——**没有 system 消息类型**（系统提示是 Context 的一部分，不混进历史）。而 assistant 的正文不是一大段字符串，而是一组**内容块（content blocks）**：

```
AssistantMessage.content: Array<
  | TextContent      // 普通文本
  | ThinkingContent  // 思考过程（可单独开关/分级）
  | ToolCall         // 工具调用（结构化参数）
>
UserMessage.content 还可以带 ImageContent（图片）
```

这些内容块在走向各家协议时，会被翻译成各自的样子（示意，以各家当时的协议为准）：

```
          pi 统一消息      Anthropic          OpenAI 系             Google
思考     ThinkingContent → thinking 块      reasoning_content    thought
工具调用 ToolCall        → tool_use 块      tool_calls           functionCall
图片     ImageContent    → image 块         image_url            inlineData
```

注意翻译的方向永远是"以 pi 的统一模型为准"，而不是"迁就最强的那个方言"——所以 pi 里可以有 Anthropic 没有的抽象（比如把思考单独分级），翻译不了就降级、能翻译就带走。

**思考（thinking）在 Pi 里是一等公民**：有独立的 `ThinkingLevel`（minimal/low/medium/high/xhigh/max），由 `Model.thinkingLevelMap` 翻译成各家协议里不同的字段。这意味着 harness 可以把"模型的推理过程"和"对外说的话"分开处理——压缩时可以只留结论、渲染时可以折叠思考块、计费时可以分开算。

### 2.3 流式协议：13 种事件，一条流走到底

模型响应是流式的，pi-ai 把它规约成一个**类型化事件流**，一共 13 个变体：

```
start
 ├── text_start / text_delta / text_end
 ├── thinking_start / thinking_delta / thinking_end     ← 思考单独成流
 ├── toolcall_start / toolcall_delta / toolcall_end     ← 每个工具调用也是一段增量流
done / error
```

delta 事件带 `contentIndex` 和一份共享的"累积消息"，所以下游既可以做逐字渲染，也可以等流结束取最终消息。最妙的是这个流容器**既是 AsyncIterable，又承诺一个 `result()`**——"你既可以把它当流消费，也可以把它当 Promise 等"。光说抽象没感觉，看一段真实消费它的样子（示意，API 形状以当时文档为准）：

```ts
// 同一件事的两种吃法
const stream = await models.stream(model, context, { cacheRetention: "short" });

// 吃法一：当流，逐字渲染（顺便把 thinking 和正文分开显示）
for await (const ev of stream) {
  if (ev.type === "text_delta")      ui.appendText(ev.delta);
  if (ev.type === "thinking_delta")  ui.appendThinking(ev.delta);
}

// 吃法二：当 Promise，等最终消息（usage、stopReason 都在上面）
const message = await stream.result();
console.log(message.usage.cost.total); // token 花了多少、缓存命中多少，全程透明
```

`stopReason` 也比常见的多两个值：除了 `stop / length / toolUse / error / aborted`，还有 `pending`（流式中）和 `deferred`（异步响应）。这两个取值像是在为未来留位置：万一模型不再是一个同步流，而是"先给你一个任务号、稍后回传结果"，协议层也已经放得下。

> 抽象不损失细节。pi-ai 为每个模型维护一个 **compat 开关矩阵**：`cacheControlFormat`、`supportsLongCacheRetention`、`supportsStore`、`supportsReasoningEffort`…… 抽象抹平的是"方言"，不是"能力差异"。

### 2.4 一个不得不提的精妙设计：faux

怎么在没有真实模型、不花钱的情况下测试整个 harness？Pi 内置了一个 **faux provider**（`src/providers/faux.ts`，700 多行）：一个零网络的假模型，把调用方排队的响应脚本**按真实的 delta 事件流吐出来**——能限速（模拟慢模型）、能模拟 abort、能模拟 deferred 异步响应，甚至**能按 sessionId 前缀命中来仿真 prompt cache 的 cacheRead/cacheWrite**。仓库开发守则（AGENTS.md）明文规定：coding-agent 的回归测试只准用 faux，不许用真实 API key。

这件事看似小，其实是大工程的分水岭：**当"模型"可以被一个确定性脚本替代，整个循环的测试就从"碰运气"变成了"可复现"。** 前端同行看到这里会心一笑——这不就是"用 mock 数据驱动开发 UI"在 agent 世界的翻版么？后面讲压缩、讲缓存时你会再见到 faux 的妙用。

**一句话带走：** pi-ai 的全部工作，就是让 N 种"模型方言"变成 1 种"事件流"——上层从此只认识一个形状；连测试用的假模型，吐出来的都是这个形状。

## 三、pi-agent-core：循环只是一个函数

### 3.1 控制反转：把 agent 从产品降格为库

如果说 pi-ai 解决的是"模型怎么接"，pi-agent-core（`@earendil-works/pi-agent-core`）解决的是"**循环本身**"——而且是把它做成了一个你可以 `import` 进自己程序的**函数**，而不是一个只能通过 CLI 触发的黑盒。

这是 Pi 架构观里最关键的一刀。前端的发展史告诉我们：**"框架"替你决定控制流，"库"把控制流还给你**（所以 jQuery 是库、Angular 是框架，React 一度被争论到底算哪个）。大多数 coding agent 是"框架"——你必须活在它的 TUI 里。Pi 是"库"——**agent 循环是一个你可以 await 的 async 函数**，CLI、批处理、RPC、SDK、别人的应用，都只是这个函数的不同宿主。README 里那句话（"adapt pi to your workflows, not the other way around"）在架构上的落点就在这里。

### 3.2 一个回合（turn）是怎么被驱动的

Pi 里一个回合（turn）的定义很干净：**一次 assistant 响应 + 它引发的所有工具调用与结果**。驱动它的 `runLoop` 是"双层 while"，概念上等价于下面这个骨架（示意，非逐字源码）：

```ts
async function runTurn(model, context, tools) {
  // 外层：处理"该停了又追加的后续请求"（follow-up）
  while (true) {
    // 内层：think → act → observe
    while (true) {
      const assistant = await streamAssistantResponse(model, context); // 一条事件流
      const calls = assistant.content.filter(c => c.kind === "toolCall");

      // 没有工具调用 → 内层退出，本回合自然结束
      if (calls.length === 0) break;

      // 逐个执行工具，把结果作为 toolResult 消息写回上下文
      for (const call of calls) {
        const result = await executeTool(call, tools);
        context.messages.push(createToolResultMessage(call.id, result));
      }
      // 工具调完，把结果喂回去，让模型接着想 → 回到内层开头
    }
    // 内层退出后，若还有排队中的 follow-up，就再来一轮
    if (!context.followUpQueue.length) break;
  }
}
```

真实代码比这复杂得多（assistant 消息是**先占位入栈、再按 delta 原位更新**的，事件模型分 pi-ai 层和 agent 层两层，工具执行走"准备→校验→执行→收尾"四个阶段），但骨架就是它。**"循环本身不神秘"**——上一篇文章说过，几十行就能写出来；Pi 的功夫全在循环的"边界条件"上。

### 3.3 精妙之处：它把"什么时候停"变成了一组显式规则

模型不会自己喊停，循环得知道什么时候收手。先别急着看答案——猜猜最朴素的循环会在真实世界翻哪些车？至少三个：**① 模型可能永远在要工具，谁来踩刹车？② 输出被截断成半截，参数还要不要执行？③ 出错了怎么办，把整段对话从头重放一遍？** Pi 的停止判定散落在几个明确的位置，正好是这三问的护栏：

1. **自然停**：该条 assistant 消息没有 toolCall，也没有排队中的输入 → 内层退出；
2. **工具喊停**：一个工具执行完可以返回 `terminate: true`，当**一批工具全员 terminate** 时，本轮强制结束——这是"工具主动说够了"的通道；
3. **钩子喊停**：`shouldStopAfterTurn` 返回 true 时，回合结束立刻收尾——典型用途是"该压缩了，先停一下"；
4. **出错即停**：`stopReason === "error" | "aborted"` 时不执行任何工具，直接结束回合；
5. **截断保护**：`stopReason === "length"`（输出被 token 上限截断）时**同样不执行任何工具、全部判错让模型重发**——防止一段被腰斩的参数被半执行。这个细节很见功力：宁可不干活，也不能干一半。

注意第 ① 问的答案很 Pi：它没有用"最大轮次"这种一刀切，而是把刹车分散交给各方——工具可以返回 `terminate: true` 喊停，宿主可以随时用 `AbortSignal` 打断，钩子可以用 `shouldStopAfterTurn` 收尾。**循环本身没有"最大轮次"的硬上限**，因为"什么时候该停"只有正在干活的工具和最了解语境的宿主知道，不该由循环自作主张。

### 3.4 出错怎么办：continue 是官方重试原语

模型调用会超时、会报错、会溢出。Pi 的恢复哲学可以浓缩成一行 API 注释：

> Continue an agent loop from the current context without adding a new message. Used for retries.

也就是 `agent.continue()`——**不加新消息，从当前上下文"接着跑"**。这是重试的官方原语，而不是"把整个对话重放一遍"。产品层在它之上套了一层自动恢复：默认指数退避重试（最多 3 次），遇到输出过长/溢出时**先自动压缩上下文、再 continue 一次**。整个链条是：

```
一般错误
  → 指数退避重试（至多 3 次）
输出过长 / 上下文溢出
  → 先自动触发压缩，把历史折成摘要
  → continue() 接着跑，而不是从头再来
```

中断则是协作式的：`agent.abort()` 取消当前生成；被中止的工具结果会被标记为错误，但**已经产生的对话历史原样保留**，下次 `prompt()` 是带着旧上下文续跑，不是抹掉重来。

还有两个容易被忽略但极妙的队列：**steering 和 follow-up**。

- **steering（转向）**：循环正在跑（比如模型正在调用工具）时，你想插一句话？投进 steer 队列，它会在当前工具执行完、模型下一次思考前注入；
- **follow-up（续尾）**：循环已经决定要停了，你补一句"顺便把测试也跑了"？投进 follow-up 队列，它会再多跑一轮。

同样是"运行中追加输入"，一个插在"还在干活时"，一个插在"正要收工时"——**这两种时机对应完全不同的产品体验**（打断 vs 追加），Pi 把它们建模成了两个队列。这就是"把边界条件显式化"的回报：上层想怎么用，都能找到对应的把手。

**一句话带走：** 循环本身几十行就能写完；Pi 的功夫，是把"停、错、续、插话"这些边界条件全部摆到明面上，并且把决定权留给工具与宿主。

## 四、产品层：敢不做权限，靠扩展自我生长

### 4.1 8 个内置工具，默认只开 4 个

coding-agent 内置的工具只有 8 个：read、bash、edit、write、grep、find、ls（外加 Windows 的 powershell），**默认激活的只有 read / bash / edit / write 四个**。每个工具的 schema 用 TypeBox 描述，工具定义里同时带三样东西：给循环用的执行函数、给模型看的 description、以及**合进系统提示词里的 promptSnippet**。grep 背后是 rg、find 背后是 fd——如果本机没有，Pi 会自动补装。

工具的 schema 极其朴素，比如 bash 就一个 `{ command: string; timeout?: number }`——**任意命令，没有 allowlist**。（这个"吓人"的细节先记下，4.3 会解释它为什么是故意的。）它的系统提示词第一句是：

> You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.

这段话是代码内嵌的，不依赖任何远程下发；整份 system prompt 在本地拼装：工具清单 → 行为准则 → **一段特殊的"Pi 文档"**……

### 4.2 自举的精妙：让 agent 自己读自己的说明书

那个"特殊的 Pi 文档"是什么？系统提示词里会告诉模型：**本仓库随包安装了 Pi 自己的 README、docs 和 examples，当用户问起 Pi 本身时，你可以自己用 read 工具去查阅它们**。也就是说——**你可以直接问 Pi 它是怎么工作的，它会翻开自己的说明书回答你。**

"Read the documentation… but you can also ask the agent to explain itself."（这是仓库 README 里的一句原话。）一个开源项目把"自我解释"做成特性，前提是它足够分层、足够小、足够诚实——这也是为什么它敢叫自己 "self extensible coding agent"。顺带一提：仓库根目录的 `.pi/` 里就是 Pi 自己用的扩展、提示词和技能——**它拿自己开发自己（dogfooding），这是最朴素也最有效的自举证据。**

### 4.3 权限：把"不设防"做成明确的设计

读到这里，你可能已经在心里报警了：没有权限系统？Pi 是不是在"裸奔"？——这是 Pi 最激进、也最容易被误解的一个决定。上一篇横评里我们只给了结论——五家里唯一默认不设防的；这篇把"为什么它敢这么设计"的论证补上。先听它自己的说法，仓库 README 的 Permissions 一节写得很直白：

> Pi does not include a built-in permission system for restricting filesystem, process, network, or credential access. By default, it runs with the permissions of the user and process that launched it.

安全文档里甚至把话说得更绝：

> **This is intentional.** Pi is designed to operate on local source trees… A partial in-process sandbox would be easy to misunderstand as a security boundary… Real isolation needs to come from the operating system or a virtualization/container boundary.

注意它的论证：**"一个进程内的半吊子沙箱，容易被误当成真正的安全边界"**——所以与其给一个让你误以为安全的假边界，不如明说"没有边界，边界请到操作系统/容器层面去画"。这不是偷懒，是一种清醒：in-process 沙箱在对抗"模型被提示词操纵去执行恶意命令"这件事上，本来就靠不住。

补个掌故：官方自己其实也开过这个玩笑。2025-11~12 的 README 里，这一节的标题就叫 **"No Permission System (YOLO Mode)"**，理由和今天几乎一字不差——"权限系统只会增加摩擦，还很容易被绕过"（原话 *"Permission systems add friction while being easily circumvented"*）。后来它换成了今天这种严肃的表述，但"信任用户、把边界交给环境"的立场，从 YOLO 时代到今天没变过。

它提供的安全方案在**进程外面**，三选一（见 [containerization 文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/containerization.md)）：

```
┌─ Pi 核心（以你的用户权限运行）──────────────┐
│  pi-ai / pi-agent-core / pi-coding-agent    │
└──────────────────────────────┬───────────────┘
                               │ 想要更强的边界？套一层壳
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
  Gondolin 扩展          纯 Docker             OpenShell
  宿主保留 pi 与凭证，     整个 pi 进程           策略控制的
  内置工具与命令路由       装进容器              沙箱环境
  进本地 Linux 微 VM
```

另一个容易混淆的概念是 **project trust（项目信任）**：它只决定"要不要加载项目里的 `.pi/settings.json`、项目扩展、技能等**输入资源**"，默认会询问——**它不是工具门禁**。真正做"拦截"的挂载点，是扩展系统里的 `tool_call` 事件。官方 examples 里就躺着四个现成的参考实现：`permission-gate.ts`（拦截危险 bash 命令并弹 UI 确认）、`protected-paths.ts`（保护 .env/.git/node_modules 不被写）、`confirm-destructive.ts`、`project-trust.ts`。**"要权限系统？自己拼一个，20 分钟。"**——这就是"积木，而非成品"。

### 4.4 扩展点：36 个事件钩子 + 技能 + Pi 包

如果说核心是那几块精心打磨的"积木"，这套扩展体系就是让你拼积木的工作台。（先别被 36 个钩子吓到——日常你常用的不超过五个：拦个工具、加个命令、改改提示词、压缩前插一手。下面的骨架你一看就懂。）把"不做清单"变成"可补清单"的，是下面这些机制：

- **Extensions（扩展）**：一个 TS 模块 `export default function (pi: ExtensionAPI) {}`，jiti 免编译加载。`ExtensionAPI` 提供 **36 个事件钩子**（input、每轮 LLM 请求前的 `context`、`tool_call`/`tool_result`、`turn_start`/`turn_end`、`session_before_compact`……），加上注册 API（registerTool / registerCommand / registerProvider / registerShortcut）与动作（sendMessage / appendEntry / setModel……）。放项目 `.pi/extensions/` 或 `~/.pi/agent/extensions/` 即可，`/reload` 热加载；
- **Skills（技能）**：遵循 [Agent Skills](https://agentskills.io) 开放标准（SKILL.md + frontmatter），以 **渐进式披露**注入——上下文里只常驻技能清单与一句话描述，全文按需读取，避免把每个技能的完整说明都塞进窗口；
- **Prompt Templates / Themes**，以及把扩展、技能、模板、主题打包分发的 **Pi Packages**（npm 或 git 安装）——pi.dev 的生态页上已有 5,271 个带 `pi-package` 标签的第三方包（2026-09-07 抓取）。

扩展到底长什么样？一个扩展就是一个 TS 文件，写法上很像中间件。官方 `examples/extensions/` 目录里躺着几十个可以直接抄的示例；先看最小骨架（与官方示例的写法一致，MIT 许可，此处略作删减与译注）：

```ts
// my-extension.ts —— 一个扩展的三种典型动作
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // ① 拦截/改写：危险命令先问人
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("危险操作", "允许执行 rm -rf 吗？");
      if (!ok) return { block: true, reason: "被用户拒绝" };
    }
  });

  // ② 注册新工具：立刻变成模型的"手脚"
  pi.registerTool({
    name: "greet",
    description: "生成一句问候",
    parameters: Type.Object({ name: Type.String() }),
    async execute(toolCallId, params) {
      return { content: [{ type: "text", text: `你好，${params.name}!` }], details: {} };
    },
  });

  // ③ 注册斜杠命令
  pi.registerCommand("hello", {
    description: "打招呼",
    handler: async (args, ctx) => ctx.ui.notify("Hello!", "info"),
  });
}
```

加载方式两种皆可：

```bash
pi --extension path/to/my-extension.ts      # 一次性加载
cp my-extension.ts ~/.pi/agent/extensions/  # 放进目录：自动发现，/reload 热加载
```

两个值得抄进自己扩展里的细节（官方 Key Patterns）：一是字符串参数的枚举要写成 `StringEnum([...])` 而不是 `Type.Union([...])`——否则 Google 系模型不兼容；二是**工具的状态存进 `details` 字段**随会话持久化，这样会话被 fork 时，你的工具状态也会一并被带走、可无损重建。积木要拼得稳，靠的就是这些小规矩。

消费入口共享同一个内核，README 里数了一下是四种模式：交互式 TUI；`print`（一次性批处理，可选 `json` 事件流输出）；`rpc`（stdin/stdout 上的严格 LF JSONL 协议，给非 Node 的 IDE/工具集成）；以及 SDK（`createAgentSession()` 把你的循环嵌进自家应用）。**同一个循环，四个出口，无数种驾驶舱**——这又一次印证了"库化"的架构观。

### 4.5 别人都是怎么拼的：官方示例与社区实践速览

光有"积木"和说明书，新手还是容易站在一堆原语前不知所措。第一次用 Pi 的人常问：它连 MCP、子代理、权限弹窗都不做，是不是"啥都没有"？答案是分三步的：**官方其实给每个 "No" 都配了"自己拼"的样板；拼好的积木，社区还会上架分享；而最常用的一类积木——技能——连拼都不用拼，拷进来就能跑。** 下面按这三步走。（本节生态与热度数据抓取于 2026-09-07，都会随时间变化。）

**第 1 步，官方图鉴：每个 "No" 旁边，都配了"自己拼"的样板。** 仓库里的 `packages/coding-agent/examples/extensions/` 就是官方拼积木的图鉴（MIT，可直接抄）：说 "No permission popups"，这里躺着 `permission-gate.ts`；说 "No plan mode"，这里有 `plan-mode/`。挑几个有代表性的：

| 示例 | 它示范了什么 |
|---|---|
| `permission-gate.ts` | 危险 bash（rm -rf / sudo）先弹 UI 确认——"你要的权限系统"20 分钟版 |
| `protected-paths.ts` / `dirty-repo-guard.ts` | 保护 .env/.git/node_modules 不被写；有未提交改动时阻止会话继续 |
| `dynamic-tools.ts` | 运行期（甚至通过斜杠命令）动态注册工具，带 promptSnippet 与工具级指南 |
| `structured-output.ts` | 一个返回 `terminate: true` 的收尾工具，让 agent"干完就自己停" |
| `plan-mode/` | 自己拼一个只读 `/plan` 计划模式（对应官方那个 "No plan mode"） |
| `todo.ts` | `/todos` 列表工具 + 状态持久化（对应 "No built-in to-dos"） |
| `subagent/` | 派生独立上下文的子代理去跑任务（对应 "No sub-agents"） |
| `ssh.ts` | 把内置工具整体委托到远程机器执行（可插拔 operations 的示范） |
| `custom-compaction.ts` | 把摘要模型换成更便宜/更合适的模型，自定义压缩策略 |
| `custom-provider-gitlab-duo/` | 复用 pi-ai 内置流，几百行自成一个 provider |

看出规律了吗：**这些 "No" 不是功能缺失，而是产品主动让出的决策空间**——于是问题自然来到第二步：拼好的积木，怎么给别人用？

**第 2 步，社区货源：你想要的功能，大概率已经被拼好、上架了。** pi.dev 的 packages 画廊就是官方托管的"积木商店"——任何 npm 包只要带 `pi-package` keyword 就能上架，统一用 `pi install npm:<包名>` 安装。画廊与社区里几个高热度、有代表性的：

| 包/项目 | 类型 | 解决什么问题 |
|---|---|---|
| [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter) | MCP 支持 | 官方说 "No MCP"？社区直接补一个 token 高效的 MCP 客户端，把 MCP server 映射成 Pi 原生工具（1.4k★） |
| [`pi-subagents`](https://github.com/nicobailon/pi-subagents) | 子代理 | 异步子代理委派：独立上下文、结果截断、会话共享，也支持脚本化多代理工作流（3.5k★） |
| [`@narumitw/pi-plan-mode`](https://github.com/narumiruna/pi-extensions) | 计划模式 | Codex 式只读 `/plan` 协作模式，先出方案、确认后再动手 |
| [`@plannotator/pi-extension`](https://github.com/backnotprop/plannotator) | PR 工作流 | 计划/规格/Markdown 批注评审 + PR review，把评审意见喂回 agent——"人在环"工作流的范本（8.5k★） |
| JetBrains [`thinkrail`](https://github.com/JetBrains/thinkrail) | IDE 客户端 | 进程内跑 Pi + Monaco 编辑器 + git worktree 工作区的桌面客户端，回答"怎么把 Pi 接进 IDE"（419★） |
| [`awesome-pi-agent`](https://github.com/thevibeworks/awesome-pi-agent) | 生态清单 | 现役最全的 Pi 扩展/技能/前端/桥接清单（2026 年中接棒已退役的 qualisero 版——旧清单约 1.1k★，新清单仍在维护） |

**第 3 步，轮到你自己：技能连拼都不用拼，拷进来就能跑。** 前面 4.4 的最小骨架已经让你看到，"写一个扩展"其实是 10 分钟级别的事；而更省的一档是**连代码都不用写**——Pi 完整实现了 Agent Skills 开放标准（agentskills.io），扫描 `~/.agents/skills/`（全局）和 `.agents/skills/`（项目，需信任），也可以用 settings.json 的 `skills` 数组指向任意目录（包括 `~/.claude/skills`）。别人按标准写好的技能，拷进来就能用：

- [anthropics/skills](https://github.com/anthropics/skills)（约 17.5 万★）：Agent Skills 的官方参考实现，含 docx/pdf/pptx/xlsx 文档处理、webapp-testing（Playwright 测试）、skill-creator 等十几个技能。把 `skills/<名字>/` 目录拷进 `~/.agents/skills/`，Pi 自动发现，`/skill:pdf` 这类命令直接可用；
- [badlogic/pi-skills](https://github.com/badlogic/pi-skills)（2.5k★）：Pi 作者自己的技能收藏——web 搜索、浏览器自动化、Google 系 CLI（Gmail/日历/网盘）、语音转录等，README 声明与 Claude Code / Codex CLI 兼容，放进 `~/.agents/skills` 即可。

走完这三步再回头看 Pi 的 "No" 清单，你会有完全不同的理解：**它不是"什么都没有"，而是"把做什么的决定权还给了你"**——想要现成的功能，去第 2 步的商店里装；想照着学，第 1 步的图鉴管够；连写都不想写，第 3 步的技能拷进来就跑。这就是"积木，而非成品"真正成立的地方。（提示：第三方包与技能质量参差，装之前先看 README 与 star；跨工具技能若依赖别的工具的专属能力，需要自测。）

### 4.6 订阅 OAuth：把"订阅"变成 API

还有一个很多人津津乐道的特性：`/login`。Pi 内置了各家订阅账号的 OAuth 流程——Claude Pro/Max（PKCE）、ChatGPT/Codex、GitHub Copilot（device-code）、xAI、Kimi For Coding、OpenRouter……凭证加密存在 `~/.pi/agent/auth.json`。于是你可以**用自己已经付费的 ChatGPT/Claude Pro 订阅，去驱动一个开源、可完全掌控的 harness**。"马"是订阅来的，"鞍具"是自己的——这个组合在当前订阅通胀的时代，杀伤力极大。

**一句话带走：** Pi 的产品观，是把"该有什么功能"这个问题从官方手里移交给你——官方只负责把积木与图鉴做精，剩下的由你拼。

## 五、记忆：会话是一棵树，压缩是给树写摘要

这一节是 Pi 最"精妙"的地方，也是它与众不同的工程深度所在。先立一个前提：**上下文窗口是 agent 唯一的"工作台"，而它又小又贵**。那么 harness 的记忆功课只有三问：往窗口里放什么？放不下时怎么办？会话结束后怎么续？

### 5.1 会话是一个文件，文件里是一棵树

先问一个你迟早会遇到的真实问题：**同一个任务试错试出了三条路，你想把它们都留住**——但大多数工具的"历史"是一条线，改了就没了，换方案只能从头再来。Pi 的答案是：把会话做成树。它的每个会话是一个 JSONL 文件：`~/.pi/agent/sessions/--<cwd>--/<timestamp>_<uuid>.jsonl`。第一行是 header（session id、版本、cwd 等），之后**每一行是一个 entry**。关键是 entry 的结构：

```
SessionEntry {
  id: string;          // 8 位 hex
  parentId: string | null;
  timestamp: number;
  type: "message" | "compaction" | "branch_summary" | "label" | ...;
  // message 类型里内嵌一整个 AgentMessage
}
```

每个 entry 都指向自己的 parentId——**所以一个文件里天然长着一棵树，而不是一条线**。当前对话位置就是树的某片叶子；想回到历史里的某个岔路口？那就是一次"切分支"。UI 上对应的命令是：

- `/tree`——查看整棵树，在文件内跳转/切换分支；
- `/fork`——把选中的一条路径复制成一个**新会话文件**（新文件的 header 里带 `parentSession` 指针，记录出身）；
- `/clone`——把当前分支复制到新文件。

这个设计让你意识到：**"重写历史"在 Pi 里不是修改，而是开新枝**。就像 git 一样——历史不可变，想走另一条路就 branch。对 agent 来说这太重要了：你 fork 出去让模型试一个激进方案，不满意，切回原来的叶子继续——**两边的记忆都还在**，互不污染。

构建"模型看到的上下文"时，SessionManager 从当前叶子沿着 parentId 一路走回根（buildContextEntries），遇到最近的压缩条目则特殊处理。这段回溯的规则其实很朴素（示意）：

```ts
// 示意：从叶子向根构建模型看到的上下文
let cursor = leaf;
const kept: Message[] = [];
while (cursor) {
  if (cursor.type === "compaction") {
    kept.unshift(summaryAsMessage(cursor.summary)); // 最近的压缩摘要放最前
    break; // 更早的历史交给"档案"（会话文件），不再进窗口
  }
  kept.unshift(cursor.message);
  cursor = cursor.parentId ? entries[cursor.parentId] : null;
}
```

前端读者应该会心一笑：这跟不可变状态 + 时间旅行调试是同一套审美——**把"状态的变化"存成数据，把"回到过去"变成一次指针操作**。

### 5.2 压缩：不是删历史，是给历史写摘要

当上下文快装不下时，大多数工具的做法是"截断最旧的几条消息"。Pi 不这么干，它的压缩文档里有一句很精确的描述（值得背下来）：

> During a multi-turn agent run, Pi checks this threshold after tools finish and their results are appended, before starting the next assistant response. If the threshold is crossed, Pi compacts **inside the same agent run** and resumes with the summary and retained messages.

拆开看之前，先替你把最自然的问题问出来：**既然要压缩，为什么不干脆全压成摘要、只留最近几句原文？** 因为摘要会丢细节，更因为工具调用与结果一旦被拆开，模型就会看到"调了工具却没结果"。Pi 的压缩目标从来不是"删旧的"，而是"**留尾巴、压老的**"——下面四个机制全在为这个平衡服务：

**① 触发：一个公式 + 三种原因。** 阈值判定是 `contextTokens > contextWindow - reserveTokens`。默认 `reserveTokens = 16384`（预留的余量），`keepRecentTokens = 20000`（压缩后保留的近期内容预算）。触发原因有三种：`manual`（你按 `/compact`）、`threshold`（接近上限）、`overflow`（**真的溢出了**——这种情况会把出问题的响应记为错误，压缩后带标记重试同一次生成，是回合中途的兜底）。触发时机永远在"一步 settle 之后、下一次 LLM 调用之前"，所以压缩不会打断正在进行的生成。判定与切点的逻辑，概念上就这两小段（示意）：

```ts
// 示意：什么时候该压
function shouldCompact(ctxTokens, contextWindow, s) {
  return s.enabled && ctxTokens > contextWindow - s.reserveTokens; // reserve 默认 16384
}

// 示意：从哪里切——从最新往旧累计 token，够 keepRecentTokens 就切
function findCutPoint(entries, keepRecentTokens) {
  let acc = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    acc += estimateTokens(entries[i]);
    if (acc >= keepRecentTokens) return snapUpToValidCut(i); // 上移到合法切点：绝不在 toolResult 上
  }
}
```

**② 切点：宁可不压，不能切坏。** 从最新往旧累计 token，凑够 `keepRecentTokens` 就切——但切点必须落在合法类型上（user/assistant/bash 等），**绝不允许切在 toolResult 上**：工具调用和它的结果必须语义连续，否则模型会看到"调了工具但没结果"。如果某个超长回合必须被腰斩，Pi 会**先单独把回合前缀再摘一次要**（split turn），保证上下文里永远没有半截对话。

**③ 摘要：不是"删掉旧的"，是"写入一条压缩记录"。** 压缩发生后，文件里多了一个 `compaction` entry（字段示意，格式略作简化）：

```
{ "type": "compaction", "id": "…", "parentId": "…",
  "summary": "<模型生成的对话摘要>",
  "firstKeptEntryId": "…",     // 压缩保留下来的第一条原文的 id
  "tokensBefore": 58210,       // 压缩前的估算 token
  "details": { "readFiles": […], "modifiedFiles": […] } }
```

旧消息**一条都没删**——它们只是不再进入模型输入，永远留在会话文件里可以审计、可以回看（用 `/tree` 跳回旧节点，原文一字不少）。此后模型看到的是：摘要消息 + 保留的近期原文 + 之后的新消息。摘要以扩展角色 `compactionSummary` 存在，真正发给模型时才包成一条带固定前后缀的 user 文本，防止模型把摘要误当对话继续。**诚实地说：压缩后你不能自动"追问细节"**——旧消息不会自动回灌；想考古就 `/tree`。这是一条刻意的取舍：窗口是稀缺资源，历史是档案，两者分开管理。

**④ 摘要的质量工程。** 摘要本身由会话主模型生成（可以换便宜模型，见下），输入是经过 `serializeConversation` 文本化的对话（显式标注每段是思考/工具调用/结果，**防止模型把摘要对象当成对话来续写**）；有旧摘要时用增量模板"更新"而不是重写；每次摘要还会累计记录**读过的文件和改过的文件清单**（Cumulative File Tracking），让压缩后的模型仍然"知道"自己动过哪些文件。摘要模板是结构化的：

```
## Goal
## Constraints & Preferences
## Progress（Done / In Progress / Blocked）
## Key Decisions
## Next Steps
## Critical Context
```

这套结构不是随便写的——**它把"压缩"从"丢记忆"变成"交接班记录"**，让模型的短期记忆（窗口）和长期记忆（文件+摘要）有了一个高质量的接口。

### 5.3 换分支的便签：branch summary

还有一个配套的精致机制：用 `/tree` 从一条分支切到另一条时，Pi 会对**即将离开的那段弯路（旧叶子到共同祖先）自动生成一条 `branch_summary`**，挂到导航目标点。这样你回到主线时，模型依然知道"刚才那条岔路上试过什么、结论是什么"——**走弯路不白走**。

最后，压缩也是可扩展的：`session_before_compact` 事件给你"预审"压缩的机会（可以取消，也可以自己提供摘要），官方示例里就有一个把摘要模型换成更便宜的 Gemini Flash 来全量重写的例子。默认配置在 settings 里就是三个数字，可调：

```json
{ "compaction": { "enabled": true, "reserveTokens": 16384, "keepRecentTokens": 20000 } }
```

**一句话带走：** 上下文是工作台，历史是档案，摘要是交接班记录——Pi 把这三者的边界都管成了数据，所以一段对话才能被 fork、被回退、被续跑。

## 六、为什么它跑得又快又省：缓存经济学

### 6.1 一个前提：重复读是便宜的

现在很多模型 API（DeepSeek 尤甚）对"上下文缓存"计费：**如果请求的前缀和之前某次请求相同，命中的部分按远低于正常输入的价格计费**（DeepSeek 的缓存读价大约是正常输入的十分之一量级）。也就是说：**KV 缓存 ≈ 服务端的 CDN**——内容相同就不重新算，只收个搬运费。

顺着这个类比，harness 的缓存功课就非常像前端工程师压榨 HTTP 缓存：**让请求前缀尽量稳定、可命中，并在请求里正确地打缓存标记。** 前面实测里 Pi 的缓存命中率在 91%–93%（我的对比文数据），长会话里可以到 99% 以上；2026-08 中文媒体那篇刷屏的《缓存命中率99.93%！DeepSeek最适合的Harness来了》，讲的就是 Pi + DeepSeek 的社区实践（[hub.baai.ac.cn](https://hub.baai.ac.cn/view/57048) 转载自量子位，2026-08-12；注意那是第三方适配 DeepSeek 的实践数据，不是 DeepSeek 官方的基准成绩）。

### 6.2 Pi 把缓存做成了协议层的一等公民

回看 pi-ai 的设计，你会发现缓存不是"某个 provider 的补丁"，而是贯穿始终的抽象。缓存命中的本质是**两次请求的前缀完全一致**：

```
第 1 次请求: [system][工具 schema][user1][assistant: 调工具][toolResult1]
第 2 次请求: [system][工具 schema][user1][assistant: 调工具][toolResult1][user2…]
             └──────────────── 前缀一字不差 → 命中缓存，只付"搬运费" ────────────────┘
```

所以 Pi 的每一条缓存设计，都只有一个目标：**让"前缀一致"这件事尽量多地发生**。下面逐条看它怎么做到的：

- **usage 里 `cacheRead` / `cacheWrite` 是独立计量字段**，成本按每家 provider 的缓存价单独算（连 Anthropic 1 小时缓存写入按输入 2 倍计费这种细节都建模了）。**命中多少、省了多少钱，对 harness 全程透明**；
- 请求级 `cacheRetention: "none" | "short" | "long"`，**默认 "short"——缓存默认开启**；`sessionId` 同时充当"会话缓存标识"；
- 对不同协议的打点方式做了完整适配：Anthropic 在 **system prompt 首块、最后一个工具、最后一条消息的末块**打 `cache_control: {type: "ephemeral"}`（long 才带 ttl）；OpenAI Responses 侧发 `prompt_cache_key`（把 sessionId 截到 64 字符）和 `prompt_cache_retention: "24h"`；Fireworks 这类靠副本路由命中的，则加 **session-affinity 头**让请求尽量打到同一个缓存副本；
- 前缀稳定靠的是"**每一轮都把同一份 system prompt 放在最前**"，加上缓存断点精准地打在 system/末工具/末消息上——这保证了对话增长的中间部分无论如何变化，最贵的头部始终可命中；
- **压缩/摘要请求反而强制 `cacheRetention: "none"` 并每次换一个一次性 sessionId**——摘要是一次性内容，不值得也不应该污染缓存前缀。

于是 Pi 的"省"有了机制级的解释：**91% 以上的缓存命中 × DeepSeek 量级的缓存读价 = 每轮增量成本趋近于零**。这也是为什么上一篇文章里它的成本低到 0.00007 美元——那不是魔法，是"前缀稳定工程 × 缓存计费模型"叠加的结果。连 faux provider 都会仿真缓存命中，测试环境里的成本模型和线上一致。

## 七、pi-tui：游戏程序员带来的"差分渲染"

最后看最上面那层：界面。Pi 没有用现成的 Ink 之类终端框架，而是自己写了一个极简终端 UI 引擎 **pi-tui**：

> Minimal terminal UI framework with differential rendering and synchronized output for flicker-free interactive CLI applications.

**Differential Rendering：只更新变化的行或视口区域。** 把整块屏幕当成一帧来管理，每帧只把"变了的那几行"写出去（示意）：

```
重绘派：把整个区域重新写一遍       Pi：只更新变化的行
┌──────────────────┐            ┌──────────────────┐
│  aaaaa           │            │  aaaaa           │
│  bbbbb           │            │  bbbbb   ← 没变，不动
│  ccccc → CCCCC   │            │  CCCCC   ← 只发这一行
│  ddddd           │            │  ddddd           │
└──────────────────┘            └──────────────────┘
```

配合 CSI 2026 同步输出（终端先把一整帧攒齐、再一次渲染，杜绝"半帧闪烁"），体验非常顺滑。它区分主屏（保留回滚历史）与备屏（viewport 由应用自己管理滚动），内置 Text/Input/Editor/Markdown/ScrollView 等十几类组件；平台相关的"小助手"（剪贴板、修饰键等）用原生代码预编译成 .node 放进仓库。

为什么放着成熟的方案不用，要自己写一套？市面上最流行的路线是 **Ink——把 React 搬进终端**（Claude Code 的 TUI 就是它写的，上一篇文章提过）：组件化、hooks、生态大，代价是"界面 = React 组件树"这整套心智与依赖。pi-tui 走的是另一条路：**面向帧的极简引擎**——不引入组件树，不跑 diff 算法，只承诺"变化行级"的更新和一次写入的同步输出。对 Pi 这种"能省则省"的项目，这不只是性能选择，也是哲学选择：**它连 UI 都不想替你决定心智模型。** 想用组件树那一套？自己拼——官方示例里的 message-renderer / rainbow-editor 就是给你照着写的。

值得玩味的是**渲染与执行被刻意解耦**：工具执行的 UI 渲染放在独立 renderer 层，这样 RPC / JSON 模式根本不会加载那 ~17MB 的 UI 依赖。交互模式的主循环本身朴素得惊人——`while(true) { 读一行输入; session.prompt(input); }`，所有界面更新都靠订阅 session 事件驱动重渲染。前端的"单向数据流"审美在这里得到了完整的复刻。

作者是游戏圈出身（libGDX 的作者），这套"快"的执念——只渲染变化的部分、攒帧再上屏、能少加载就少加载——全是游戏渲染管线的老手艺：主循环驱动刷新、每帧只画"脏区域"、双缓冲避免撕裂——放到终端里就变成了"diff 行 + CSI 2026"。仓库里甚至有用它跑 DOOM 的示例（在 overlay 里以 35 FPS 实时渲染）——一个终端 UI 引擎能当游戏引擎用，大概是这套渲染哲学最好的注脚。

## 八、演进方向：把 agent 循环搬上网络，让会话可以被多方共享

解剖完"现在的 Pi"，再看一眼"它正在变成什么"。仓库里 `packages/agent/src/harness/**` 躺着一套与经典 `runLoop` **同源但重写**的运行时：**AgentHarness / AgentLane**——把"循环"显式建模成可持久化的状态机：每次运行被拆成可落盘的 operation（run/compaction/navigation），调用方反复 `drive()` 推进，进程死了重启后可以**从断点恢复继续跑**；会话升级成 v4 格式：一棵不可变 Entry 树 + 命名分支指针 + 一次 commit 批量写入，`fork` 就是把一条路径复制成带 `parentSession` 的新会话。配套的还有可插拔存储（内存 / JSONL / **SQLite** 三实现共享同一套 conformance 测试）以及新引入的 **chord**（应用组装运行时：服务、复制状态、增量同步）和 **protocol / server / client** 三个包——目标是让**一个会话可以被多个驾驶舱同时 attach**（本地 TUI、远程 Web UI……），UI 通过复制状态订阅转录。

为什么会冒出这么重的工程？因为**在"一机一进程"的模型下，Pi 永远只是你电脑里的一个 CLI**；而把循环变成可恢复、可共享的服务后，它有机会成为整个团队共用的引擎——"库化"的下一个形态，是"服务化"。

需要诚实交代：这套新运行时目前被 coding-agent 的 `experimental/` 路线使用，**默认 CLI 仍是经典 API**，部分 slice 还抛着 "NotImplemented" 的占位；官网文档也以经典 API 为主。写这篇文章时它的定位是"演进方向"，不是"当前行为"。但方向本身已经足够说明问题：**Pi 正在把"agent 循环"从进程内的函数，变成可以跨进程恢复、可以被远程接入、可以被多个客户端共享的服务。**

## 九、该警惕的地方

作为一篇有诚意的解剖，不能只夸不骂。

1. **没有内置权限 = 安全自负**。这是设计，但也是风险：让 Pi 在你不完全信任的目录上裸奔，等于让任意提示词驱动你的 shell。官方建议容器化，社区安全库（GitLab Advisory Database，2026-09 抓取）也持续在收录它本地执行面的问题，最高有 HIGH 级别。**在共享机器、CI、处理敏感数据时，请务必先套壳。**
2. **版本与文档的"代差"**。经典 API 与新 harness 并存，教学材料（包括很多第三方解读）往往只讲其一；写代码、看文档前先确认你在哪一代上。
3. **"不做 MCP / 不做 sub-agents / 不做 plan mode"的取舍**不是免费的：这些能力要么靠社区包补，要么你得自己写。对"开箱即用党"来说，它比 Claude Code 这类服务周全的工具糙不少。
4. 仓库默认**自动关闭新贡献者的 issue/PR**（维护者会每日人工复查）——项目红火但门槛不低，别被拒了一次就以为是针对你。

## 十、结尾：马是谁不重要，鞍具怎么造才重要

先把前面拆开的东西收进一张表，方便和上一篇的五件套横向表对照：

| 五件套 | Pi 的配法 | 精妙机关 |
|---|---|---|
| **① 循环** | 可 import 的 `runLoop`，以 turn 为单位驱动 | 无轮次硬上限；工具可 `terminate: true` 喊停；`continue()` 是官方重试原语；steering / follow-up 双队列 |
| **② 工具** | 内置 8 个，默认只开 4 个 | schema 用 TypeBox 描述；description + promptSnippet 双轨喂给模型；渲染与执行解耦 |
| **③ 记忆** | 会话文件 = 一棵 entry 树 | `/tree`、`/fork`、`/clone` 原地分支；压缩 = 写摘要 entry 而非删历史 |
| **④ 权限** | 无内置权限系统（明文设计） | 边界画在容器层（Gondolin / Docker / OpenShell）；拦截挂到扩展 `tool_call` 事件 |
| **⑤ 界面** | 自研差分渲染 TUI | 主/备屏 + CSI 2026 攒帧上屏；print / json / rpc / SDK 共享同一个循环 |
| **扩展** | 36 事件钩子 + Skills + Pi 包 | 每个 "No" 都有官方样板；标准技能拷进 `~/.agents/skills` 即用 |

回到开头那道题：Pi 的独到与精妙到底是什么？

我的答案是四个字：**库化与数据化**。它把 harness 切成可以单独取用的库（模型层 / 循环层 / 产品层 / UI 层），所以 CLI 只是众多驾驶舱之一，你甚至可以请 agent 读自己的源码来解释自己；它把会话、分支、压缩、token、缓存全部变成数据，所以历史可以被 fork、被摘要、被续跑、被分享——这棵树长在哪里、怎么修剪，选择权都在你手里。再配上"敢不做"的减法（不做权限弹窗、不做 plan mode）和游戏程序员对"快"的偏执（差分渲染、攒帧上屏、能少加载就少加载），一套把"轻"和"快"做到极致、把边界决定权留给你的积木，就这么齐了——**怎么拼，看你。**

它不是给所有人准备的——如果你要的是"开箱即用的安全与周全"，Claude Code 们更合适。但如果你想**亲手掌控自己那副鞍具的每一颗螺丝**，Pi 是这个品类里把选择权还给你还得最彻底的一个。上一篇文章结尾我说"马是谁不重要了，重要的是鞍具合不合手"；这篇的结尾想补一句：**最好的鞍具，是你随时能拆开、能续上、还能请马自己讲讲它怎么跑的那一副。**

想亲自上手验证这篇里的论断，最快的一条路是：装上 Pi（官网有 quickstart），把官方 `examples/extensions/` 目录翻一遍、照着抄一个自己的扩展，再把 anthropics/skills 拷进 `~/.agents/skills` 跑一次 `/skill:pdf`——这比读十篇解剖文章都管用。别忘了上篇的提醒：给工具用独立的目录副本，别让它们互相"剧透"。

最后一个彩蛋：2026 年 1 月，Pi 官网的 logo 还链在一个叫 **shittycodingagent.ai** 的域名上——作者的自嘲：功能不多，全靠你自己拼。后来域名换成了现在的 pi.dev（由 exe.dev 友情捐赠，这句致谢至今还写在 README 页脚里）。一个敢把自己官网叫"烂编码 agent"的项目，大概也配得上"克制"这两个字。

附上相关资源，供想继续深入的读者：

- 仓库：[earendil-works/pi](https://github.com/earendil-works/pi)（[pi.dev](https://pi.dev) 官网与文档）
- 作者博客：[《What I learned building an opinionated and minimal coding agent》](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)、[《What if you don't need MCP?》](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)
- 我上一篇的横评：《[给大脑配一副好鞍具：五款 Agent Harness 的解剖与实测](https://springuper.github.io/blog/agent-harness-comparison/)》（复现实测用同一提示词即可，命令见其附录）
- 中文教学仓库：[cellinlab/how-pi-agent-works](https://github.com/cellinlab/how-pi-agent-works)（从零实现教学版 agent 的 VitePress 教程，很好的入门伴读）
- 第三方解读：[walkinglabs 的 harness 工程设计系列（Pi 篇）](https://walkinglabs.github.io/learn-harness-engineering/zh-TW/harness-designs/pi/)
- 真实会话数据集：[badlogicgames/pi-mono on Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)（作者公开自己的真实工作会话，并呼吁大家也分享）

> **版本与核实说明**：本文基于仓库 HEAD `9767ba2`（各包版本 0.85.1，2026-09-06 抓取）与公开文档撰写；生态与社区数据（包数量、star、技能集）抓取于 2026-09-07；star 数、版本号、生态数据随时间变化，引用请以当时为准。文中对"当前产品行为（经典 API）"与"演进方向（harness 运行时）"做了区分；凡涉及第三方解读处均已注明。名字来历、YOLO Mode、官网域名等掌故，均按仓库 git 历史考古核验（首提交 2025-08-09 起）。如果发现哪里有偏，欢迎在评论区指出来。
