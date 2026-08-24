---
layout: post
title: "给大脑配一副好鞍具：五款 Agent Harness 的解剖与实测"
date: 2026-08-23 22:00:00
status: publish
tags:
  - AI
  - Agent
  - Harness
  - Claude Code
  - Codex
  - OpenCode
  - Pi
  - DeepSeek Harness
---

如果你用过两个以上的 AI 编程工具，大概率会有这种困惑：**同一个模型，装在 Claude Code 里和装在 OpenCode 里，干活的样子完全不一样。** 一个慢条斯理、先列计划再动手；一个风风火火、脚本一甩就开跑；一个问东问西，一个闷头就干。模型明明是同一个，差别从哪来的？

答案藏在 harness 里。

"Harness" 的英文原意是**马具、鞍具**——套在牲口身上，让它的力气能变成拉车、耕地这些实际用途的那套东西。AI 语境下，[Anthropic 官方文档](https://code.claude.com/docs/en/glossary)给这类工具起过一个很准确的名字：**agentic harness**（Agent 鞍具）。大模型本身只会"说话"——从概率里吐出下一段 token；是 harness 给它装上了"手脚"（读写文件、跑命令）、"眼睛"（观察执行结果）、"红绿灯"（权限审批），它才真正能干起活来。

所以，**你买的从来不是模型，而是"模型 + 一整套鞍具"。** 这篇文章想做的事很朴素：拿一把解剖刀，把五款有代表性的 agent harness——Claude Code、Codex、OpenCode、Pi、DeepSeek Harness——按同一套框架拆开，看看它们各自把"身体"装成了什么样；再把我亲手实测的记录摆上来，让结论都落在事实上。

为了拆得干净，我给自己配了一套统一的解剖框架。先讲框架，再拆标本。

<!--more-->

## 一、解剖学：Agent Harness 的五件套

把几款 agent harness 拆开来看，最终都会得到同一张地图：**无论哪一款，拆到底都是这五件套的不同配法。**

```
   +--------------------------------------------+
   | 模型 LLM（大脑）                           |
   | 只会"说话"，不会"干活"                     |
   +--------------------------------------------+
                         | system prompt + 工具 schema
                         v
   +--------------------------------------------+
   | agent harness（鞍具）                      |
   |                                            |
   | 1. 循环 Loop   思考 -> 行动 -> 观察        |
   | 2. 工具 Tools  bash / fs / edit            |
   | 3. 记忆 Memory 上下文 / 压缩 / 会话持久化  |
   | 4. 权限 Sandbox 能自动做 vs 要问人         |
   | 5. 界面 UI     TUI / Web / headless        |
   |                                            |
   | + 扩展点  MCP / 插件 / subagent / hooks    |
   +--------------------------------------------+
```

这五件套，每一件的职责都很清楚：

**① 循环（Loop）**——agent 的"反射弧"。大模型不会自己反复思考，是 harness 在它外面套了一层 `think → act → observe` 的循环：让模型生成一段思考（要不要调用工具？调哪个？），harness 执行工具，把结果喂回去，再让模型接着想。这一圈一圈转下来，才叫"自主干活"。ReAct 循环本身并不神秘，几十行代码就能写出来；**麻烦的是循环的"质量"**——什么时候该停、出错怎么恢复、多轮工具调用怎么组织，这些才是 harness 的功夫。

**② 工具（Tools）**——agent 的"手脚"。读写文件、执行命令、搜索、编辑……每个工具都是一块肌肉。五件套里它最容易理解，但也是最容易"失血"的地方：工具怎么描述给模型（schema 写得好不好）、参数怎么校验、结果怎么截断，直接决定模型"手脚灵不灵活"。

**③ 记忆（Memory）**——上下文窗口是模型唯一的"工作台面"，而它**又小又贵**（哪怕 1M 上下文也装不下一个大型仓库）。harness 的功课是：往窗口里放什么、不放什么、装不下时怎么压缩、会话结束后怎么持久化。"记忆"这一件套，是五款工具差异最大的地方之一。

**④ 权限/沙箱（Permissions & Sandbox）**——agent 的"红绿灯"。文件能不能随便改？命令能不能随便跑？网络能不能访问？有的 harness 默认全放行（信任用户），有的默认全拦截（信任沙箱），大部分在这两者之间划了一条"需要问人"的线。**这一件套的配法，直接决定了工具给人的"安全感"和"爽快感"，也最能看出一个团队的工程哲学。**

**⑤ 界面/入口（UI）**——驾驶舱长什么样。终端 TUI、浏览器 Web、无头 headless、API/SDK……同一个引擎可以配不同的驾驶舱，这也是后文 DSH 的 profile 玩法。

还有一个横切的**扩展点（Extensibility）**：MCP 服务器、插件、subagent、hooks。它不是独立的第六件套，而是"这五件套都允许你改装"的能力。

有了这张地图，再看五款 harness，就不需要记一堆功能列表了——**只需要问：它的五件套，各自是怎么配的？哪些是焊死的，哪些是能换的？** 下面五个角色登场，然后我们逐个解剖。

## 二、五个角色登场

先给五款工具各发一张"身份卡"，顺便配上拟人化的印象。注意，所有数字都标注了抓取日期，因为开源项目的 star 数每天都在变。

| | Claude Code | Codex | OpenCode | Pi | DeepSeek Harness |
|---|---|---|---|---|---|
| **出身** | Anthropic（2025-02 随 Claude 3.7 Sonnet 发布研究预览） | OpenAI（CLI 于 2025-04 开源） | sst 团队发起（现归 anomalyco 维护） | Earendil Works（作者 badlogic） | DeepSeek AI |
| **开源** | 闭源产品 | CLI 开源（Rust，Apache-2.0） | 全开源（TypeScript，MIT） | 全开源（TypeScript，MIT） | 全开源（MIT，developer preview） |
| **GitHub star**（2026-08-23） | —（闭源） | [114k](https://github.com/openai/codex) | [200k](https://github.com/anomalyco/opencode) | [96k](https://github.com/earendil-works/pi-mono) | [186k](https://github.com/deepseek-ai/deepseek-harness) |
| **模型绑定** | 默认 Claude 系（可用 Anthropic 兼容 API 换） | 默认 GPT 系（config.toml 可换） | 中立（几十家 provider + 本地模型） | 中立（统一 API + 订阅 OAuth） | 默认 DeepSeek 适配器（provider 可插拔） |
| **默认界面** | 终端 TUI（React/Ink） | 终端 TUI（Rust） | 终端 TUI + 桌面 App + IDE 插件 | 终端 TUI（自研渲染引擎） | Web UI（`dsh web`）/ headless / TUI |
| **招牌机制** | CLAUDE.md、hooks、subagents | AGENTS.md、审批模式、多层沙箱 | provider 中立、opencode.json、LSP | 无内置权限系统、可自我扩展 | 一切皆插件、profile 与配置层叠 |

拟人化的第一印象是这样的：

- **Claude Code = 五星酒店的全能管家。** 服务周到，门禁森严，会自己安排小团队（subagents），还会在你进门时记住你的喜好（CLAUDE.md）。代价是：默认得住他家酒店（模型绑定偏软，Anthropic 兼容 API 也能换 DeepSeek/MiniMax，见 3.1 实测），菜单是后厨定的（闭源）。
- **Codex = 学院派的实验室主任。** 纪律严明——先沙箱再动手，审批分级一丝不苟；论文公开（架构文档、AGENTS.md 公约），连实验设备都开源了（CLI 开源、2026 年连整套 Harness 也开源了）。
- **OpenCode = 开源美食广场。** 谁家模型都能来摆摊，摊位多到挑花眼；不站队是它最大的卖点，也是它最大的压力（二十万 star 的社区治理）。
- **Pi = 极客的改装车手。** 车是自己焊的（自研 TUI），**默认不装安全带**（没有内置权限系统），随时能拆开看（可自我扩展）。开得快，但安全自负。
- **DeepSeek Harness = 乐高工厂。** 一切皆插件，配置靠 patch 一层层叠汉堡；web、headless、TUI 是同一个引擎换外壳。缺点是还在施工（developer preview），图纸会改。

下面进入正题，逐个解剖。每节都用同一把刀：循环怎么跑、记忆怎么管、权限怎么设、怎么扩展，外加一节实测记录。实测的方法和局限，我会在最后一节统一交代，这里先看结果。

## 三、逐个解剖

### 3.1 Claude Code：管家的服务体系

Claude Code 是 2025 年把"AI 编程"这个词从演示变成日常的工具，也是整个品类的参照系。它的五件套配法，可以用一个词概括：**服务周全**。

**循环：最典型的 agent loop + hooks。** 它的主循环和其他家没有本质区别（think → act → observe），但它给循环装上了**挂钩点（hooks）**——这是它最精巧的设计之一。你可以把 hook 理解成"在循环的特定阶段插一脚"：模型调用工具之前、之后、用户提交输入时、会话结束时……都能挂一段你自己的脚本，用来拦截、改写，或在一旁记录。

```
   用户输入
     │
     ▼
   [UserPromptSubmit hook]  ← 可在此改写输入
     │
     ▼
   模型思考 / 计划
     │
     ▼
   [PreToolUse hook] ──► 工具执行 ──► [PostToolUse hook]
      │                              │
      ▼                              ▼
   观察结果 ◄────────────────────────┘
     │
     ▼
   继续循环 或 收尾 ──► [Stop hook] ──► [SessionEnd hook]

   其他挂点：SessionStart / PreCompact（压缩前）/ SubagentStop（子 agent 结束）
   / Notification（后台任务完成提醒）
```

举个最实用的例子：团队想让"提交代码前自动跑 lint 和测试"，不需要改任何产品代码，只需要在 `PreToolUse` 或 `Stop` 阶段挂一个 hook，让 Claude Code 在动手前/收尾时强制执行 `npm run lint && npm test`。这相当于**把公司流程写进了鞍具里**——[官方文档](https://code.claude.com/docs/en/hooks)把这套机制开放给了所有用户，这也是它生态粘性的来源之一。

**记忆：CLAUDE.md 是长期记忆，上下文裁剪是短期记忆。** CLAUDE.md（项目级 + 用户级）是给 agent 的"入职手册"，每次会话自动读入；配合 `.claude/` 目录下的子 agent 定义（subagents），相当于给管家配了"部门手册"和"下属名单"。上下文管理则交给内置的压缩策略，用户一般不用操心。

**权限：默认要问，可以授权。** 第一次跑危险命令，它会停下来问你要不要允许；你可以记下"允许这条规则"，也可以整段放开。`--dangerously-skip-permissions` 这种 flag 的存在，说明它把"放权"也做成了显式操作——**管家不会自作主张，但你说放行它就放行。**

**扩展：MCP + 插件 + hooks + subagents，四件套齐全。** 2025 年下半年开始支持插件生态，配合 MCP 服务器接入外部工具，可扩展性是五家里最完整的之一——当然，这一切都发生在一个闭源的壳里，你能改的是"挂什么"，不能改的是"引擎本身"。

**实测记录。** 我这台机器上 Claude Code 2.1.3 的配置很有意思：`~/.claude/settings.json` 里把 `ANTHROPIC_BASE_URL` 指到了 DeepSeek 的 Anthropic 兼容端点（`https://api.deepseek.com/anthropic`），模型换成了 deepseek-v4-flash——**Claude Code 跑着 DeepSeek 模型**。这说明"模型绑定"这一格其实是软的：只要厂商提供 Anthropic Messages 兼容端点，鞍具就能换马（DeepSeek 的路径是 `/anthropic/v1/messages`，MiniMax 也提供同款）。本次实测里，五款工具因此**统一用上了 deepseek-v4-flash**，对比完全落在 harness 本身（详见第五节）。实测任务一（修复 3 个注入 bug 并让测试全过）：37 秒完成，11 轮对话，输入 2.2 万 + 缓存读取 14 万 + 输出 0.1 万 token（合计约 16.3 万），成本 0.216 美元——五家里最贵的一趟（它偏好"多轮多确认"的风格 + 大量缓存读取）。它的修复过程很"管家"：先读全文件，明确列出三个 bug，一次性精准编辑，再跑测试验证。

### 3.2 Codex：学院派的纪律与沙箱

Codex 的开源 CLI（Rust，Apache-2.0）是 2025-04 发布的。如果说 Claude Code 的五件套关键词是"服务"，Codex 的关键词是**纪律**——尤其是权限/沙箱这一件，它做得最重、最认真。

**权限：审批模式分级 + 沙箱层层设防。** 这是 Codex 最值得讲的部分。它把"模型想执行命令"这件事拆成两级关卡：先是审批策略（什么时候需要问人），再是沙箱（命令在什么隔离环境里跑）。

```
   模型想执行命令
        │
        ▼
   ┌────────────────────────────────┐
   │ 1. 审批策略                    │ deny ──► 命令不执行，错误回给模型
   │ auto（默认，视命令而定）       │
   │ never（从不询问）              │
   │ on-request（由模型决定）       │
   └────────────────────────────────┘
                   │ allow
                   ▼
   ┌────────────────────────────────┐
   │ 2. 沙箱选择                    │
   │ read-only：只读，连写都拦      │
   │ workspace-write：工作区可写    │
   │ full-access：完全放行          │
   └────────────────────────────────┘
                   │
                   ▼
   ┌────────────────────────────────┐
   │ 底层沙箱实现（按平台自动选）   │
   │ macOS: Seatbelt(sandbox-exec)  │
   │ Linux: Landlock + seccomp      │
   │ 可选: Docker / Nix+Bubblewrap  │
   └────────────────────────────────┘
                   │
                   ▼
              执行命令
```

值得注意的细节：Codex 的沙箱不是"建议"，而是**默认开启**。`--sandbox read-only` 模式下它连写文件都要经过沙箱；macOS 上每个 shell 命令都包一层 `sandbox-exec`（Seatbelt），Linux 上用 Landlock + seccomp。命令的"工作区权限"和"网络权限"是分开管的，需要联网的操作（比如装依赖）会明确触发更高权限的请求。这套设计在五家里最接近"企业级"。

**记忆：AGENTS.md 公约 + 项目记忆。** 它推动的 [AGENTS.md 约定](https://developers.openai.com/codex/agreements) 是一个跨工具的"项目入职手册"标准——写一次，多个 agent 工具都能读。这算是它给行业留下的一个"公共品"。

**扩展：MCP 支持 + config.toml 换 provider。** 我的实测配置就是证据：`~/.codex/config.toml` 里把 `model_provider` 换成了 DeepSeek（`base_url: api.deepseek.com`），跑的是 deepseek-v4-flash。**Codex CLI 换非 OpenAI 模型，改几行配置就行**——它的 harness 层和模型层解耦得很干净。

**2026-08 的大动作：Codex Harness 开源。** OpenAI 在 8 月把整套 Codex Harness 开源了（Apache-2.0，[官方博客](https://developers.openai.com/blog/codex-as-a-platform)），包含三件东西：`codex exec` 命令行、TypeScript/Python SDK、以及 app-server（通过 JSON-RPC 连到本地 Codex 进程，提供持久会话、事件流、人在环审批）。最震撼的是一组数据：**两个 harness 设计改动，把 GPT-5.6 Sol 在 ARC-AGI-3 上的成绩从 13.3% 提到 38.3%，输出 token 降了 6 倍**——"是 harness 设计，而不是模型大小，驱动了 agent 的收益"（[报道](https://www.edgen.tech/news/post/openai-open-sources-codex-harness-cutting-agent-token-use-sixfold)）。这句话，几乎是整篇文章的题眼：**当模型越来越同质化、越来越便宜，鞍具本身成了决定"一匹马能拉多少货"的关键变量。**

**实测记录。** Codex CLI 0.146.0 + deepseek-v4-flash 跑同一个修复任务：25 秒，**只用 1762 个 token 就完成了**——五家里最省，比我预期的少一个数量级。它读代码 → 定位 → 一次编辑 → 跑测试，节奏干净利落，没有任何多余的来回。这跟"纪律"的设定完全一致：不废话，干完就停。

我还在一个"外层已有沙箱"的环境里跑了它，收获了一个意外但绝佳的观察：当 macOS 的 `sandbox-exec` 无法嵌套启动时，**Codex 宁可失败也不绕过**——它试了不同 shell、不同目录，确认是环境问题后，0 改动地退出，并如实汇报"审批策略是 never，我不能擅自提权"。13,339 个 token 全花在诊断和诚实汇报上。这就是"纪律"两个字在工程上的样子：**安全边界是硬约束，不是建议。**

### 3.3 OpenCode：美食广场的兼容性

OpenCode 从 sst 团队手里长出来（现在归 anomalyco 维护），TypeScript 全开源，MIT，是五家里 star 最高的（20 万）。它的五件套关键词：**兼容**。

**循环：标准 loop，但"中场"特别多。** OpenCode 的会话模型支持中途插入权限确认、在 TUI 里切换 agent（Tab 键在 build/plan 之间切换）、把 LSP（语言服务器）接进来给 agent 提供实时的类型信息——这是它区别于其他家的一个亮点：**让 agent 的"眼睛"更专业**，不止看文本，还看符号、类型、引用关系。

**模型：五件套里它把"模型层"做成了多面插座。** 这是它安身立命的本事：

```
                 ┌───────────────────────────────────────────────────┐
                 │ Agent Loop（一套循环）                            │
                 │ tools / sessions / LSP / MCP                      │
                 └───────────────────────────────────────────────────┘
                                           │ 同一套 tool-call 协议
                 ┌───────────────────────────────────────────────────┐
                 │ provider 适配层（多面插座）                       │
                 └───────────────────────────────────────────────────┘
                  │         │      │      │        │       │
                  Anthropic OpenAI Google DeepSeek MiniMax Ollama(本地)
```

实测里我的 OpenCode 1.14.18 配的是 deepseek-v4-flash（同一个 `auth.json` 里同时存着 MiniMax 国际版、国内版和 DeepSeek 三把钥匙）。**同一套代码，今天接云端、明天接本地 Ollama，不用改业务逻辑**——这是"美食广场"的底气：你不站队，所以你永远有得选。

**记忆与配置：opencode.json 一站管理。** 规则、agent、模型、权限、工具，全在一个配置文件里；还内置了"权限策略"（permissions/policies）体系，可以给不同工具、不同目录设不同规则。

**扩展：插件 + MCP + 桌面 App + 分享。** `opencode` 还能 `--share` 把会话分享出来；桌面 App 和 IDE 扩展让它可以不只在终端里用。

**实测记录。** 任务一（单文件三 bug）：11 秒完成，8 次工具调用，约 1.3 万 token——上来先用 bash 看了 `ls`/`git log`/`git status` 摸清仓库，再读文件、分三次 edit、跑测试，节奏稳当。任务二（多文件）：19 秒，13 次工具调用，约 1.5 万 token，这次它改动了**全部三个文件**（含把 `subtractStock()` 改成防御式），和 codex/pi 同属"下沉派"。值得注意的一个细节：它默认 agent 叫 `build`，另外内置了一个只读的 `plan` agent——**把"先看后动"做成了产品级的两个模式**，这在五家里是独一份的设计（其他家大多靠用户自己口头约束）。

### 3.4 Pi：极客的手工改装车

Pi 是 Earendil Works（作者是游戏圈出身的 badlogic，Mario Zechner）做的。TypeScript monorepo，MIT，96k star，用 Bun 打包成单文件可执行。它的五件套关键词：**极简与信任**。

**权限：五家里唯一"默认不设防"的。** Pi 的 README 里写得很直白：它**没有内置权限系统**来限制文件系统、进程、网络或凭据访问，默认以启动它的用户的权限运行。这在五家里是独一份的激进选择——其他家至少有一层"要问人"的机制，Pi 直接说：**我信任你，你自己负责自己的安全。**

但"不设防"不等于"没法防"，它给了三种容器化方案（[文档](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/containerization.md)）：

```
   ┌──────────────────────────────────────┐
   │ Pi 核心（Bun 单文件）                │
   │ pi-ai        统一多 provider API     │
   │ pi-agent-core  循环 + 状态管理       │
   │ pi-coding-agent  CLI                 │
   │ pi-tui       自研 TUI（差分渲染）    │
   └──────────────────────────────────────┘
                      │ 默认：以你的用户权限"裸奔"
                      ▼
   ┌──────────────────────────────────────┐
   │ 可选安全壳（按需挑一个）             │
   │ 1. Gondolin：微 VM，宿主保留         │
   │    凭证，内置工具/命令路由进 VM      │
   │ 2. Docker：整进程装进容器            │
   │ 3. OpenShell：策略控制的沙箱         │
   └──────────────────────────────────────┘
```

这套哲学的价值在于：**把"安全"从产品里拿出来，还给用户和环境。** 你在自己的机器上跑，裸奔最顺手；你在 CI 里跑，套 Docker 最干净；你给别人的机器用，上 OpenShell。相比"产品替你决定安全边界"，Pi 选择"边界由你画"。

**记忆：会话即文件 + 主动分享。** Pi 的会话是文件（可以 `--export` 成 HTML），还推了一个很有意思的机制：**把开源工作里的真实 agent 会话发布到 Hugging Face**（[pi-share-hf](https://github.com/badlogic/pi-share-hf)），用真实世界的工具调用、失败、修复数据来改进 agent，而不是靠玩具 benchmark。作者本人就定期公开自己的会话——这大概是五家里对"真实数据"最激进也最坦诚的做法。

**扩展：可自我解释。** Pi 的文档里有一句很酷的话：**"你甚至可以问 agent 它自己是怎么工作的"**——因为它是开源的，agent 可以直接读自己的源码来回答。它还支持订阅制 OAuth（ChatGPT、Claude Pro、GitHub Copilot、xAI、OpenRouter 都能登录），把"用别人的订阅跑自己的 harness"做成了特性。

**实测记录。** Pi 0.84.2 + deepseek/deepseek-v4-flash 跑同一个修复任务：**9 秒完成，6 次工具调用（3 次 bash、2 次 read、1 次 edit），3375 token，成本 0.00007 美元**——五家里最快、最便宜，便宜到可以忽略不计。它的风格非常"动手派"：上来就是 bash 一通 ls/find，然后 read、edit、npm test，行云流水。没有确认、没有多余的礼貌，就像改装车手直接掀开发动机盖。当然，这趟之所以这么顺，也是因为任务本身简单、不需要任何权限判断——如果任务需要联网或动敏感目录，裸奔的代价就要另算了。

### 3.5 DeepSeek Harness：插件流水线

最后拆的是 DeepSeek Harness（`dsh`）——需要声明一下，这篇文章就运行在它上面，我会尽量用解剖刀而不是滤镜说话。它的五件套关键词：**一切皆插件**（"Everything is a Plugin"）。

**架构：没有"特权核心"。** dsh 建立在 Cordis 这个插件框架之上（[设计论文](https://github.com/cordiverse/paper)）：模型适配器、工具注册表、会话日志、甚至 agent 循环本身，**全都是插件**。官方架构文档里有一句很硬的话："没有需要 patch 的特权核心——你扩展 dsh 的方式，就是把它旁边的插件挂上去。"（[架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)）这意味着它的五件套，**每一件理论上都能换**。

**装配方式：配置层叠（叠汉堡）。** dsh 的"profile"（配置档案）是核心概念。一个 profile = 一组"组合包（bundle）" + 你自己的覆盖配置，按顺序叠起来：

```
   ┌────────────────────────────────────────────────────┐
   │ 1. 空配置根                                        │
   ├────────────────────────────────────────────────────┤
   │ 2. dsh.profile.bundles 里各组合包的 patch（按序）  │
   │    dsh-base（模型/工具/沙箱/权限/持久化/遥测）     │
   │    dsh-web-app（浏览器 UI）                        │
   ├────────────────────────────────────────────────────┤
   │ 3. profile 自己的 cordis.patch.yml（你的覆盖）     │
   ├────────────────────────────────────────────────────┤
   │ 4. $DSH_HOME/cordis.patch.yml（全局覆盖）          │
   ├────────────────────────────────────────────────────┤
   │ 5. --patch 参数（一次性覆盖）                      │
   └────────────────────────────────────────────────────┘
   每一层按 id 替换/插入"插件行"，后层可覆盖前层任意一行
```

这套"叠汉堡"机制解决的是 agent 领域的一个真问题：**agent 系统太容易变成"配置地狱"**——几十个开关互相打架。dsh 用"层"来建立秩序：基础能力（dsh-base）是一层，模式（web/headless）是一层，你的个性化是一层，谁在上谁说了算，清清楚楚。`dsh web`（浏览器 UI）和 `dsh --profile headless "任务"`（一次性无头执行）就是**同一个引擎的两个 profile**——换驾驶舱不用换引擎，这正是五件套里"界面"这一件被做成可插拔的样子。

**循环：官方文档给了完整的 turn flow。** 它的循环设计里我最想提的一点是"**模型可见即记录**"（model-visible means logged）这个不变量：任何到达模型请求的内容，都必须能从会话日志里重建出来。这保证了 replay、fork、持久化、遥测全都从一条真实的事件流派生，而不是各存各的副本。

```
   turn/start
     claim 下一条输入
     组装 prompt 段 + 工具 schema
     → agent/pre-step                    拒绝 | 进入
        step/start
        追加输入为 user/message
        从日志推导模型历史
        agent/request → llm/stream → assistant/chunk* → assistant/message
        tool/call* → tools/pre-execute → tools/execute → tools/post-execute → tool/result*
        step/end
        还有未清账的工具 → 下一个 step
     → agent/turn-stopping
   turn/end
```

（此图摘自[官方架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)，`turn` = 一次"欠债还清"的完整回合，`step` = 一次模型请求 + 它调用的工具。）

**权限：沙箱与 fs 分离。** dsh-base 里同时挂了 bash 沙箱（macOS/Linux 用 sandbox，Windows 用 ACL 受限令牌）和文件策略层，但两者是**分开的**——这带来一个实测里非常有意思的差异，见下面的记录。

**实测记录。** DeepSeek Harness 0.1.1-rc.2（headless profile）跑同一个任务：26 秒完成，修复正确（事后验证 4/4 通过）。但过程很有戏剧性：**它的 bash 沙箱在我这个"外层已有沙箱"的环境里同样启动失败**（`sandbox-exec: sandbox_apply: Operation not permitted`），按理说它和 codex 一样寸步难行——但它没有停。因为它的 fs 工具（读、写、编辑）走的是独立的文件策略层，不受 bash 沙箱故障影响，于是 agent 照常读代码、照常编辑、修完全部 bug，然后发现 `npm test` 跑不了，就**手动逐用例做了数学验证**，并在汇报里诚实说明："沙箱后端不可用，提权通道被拒，拒绝是最终的，所以我改为仔细检查验证。"（原话大意）

这组对照非常能说明问题：

- **Codex**：所有操作都经过沙箱体系 → 沙箱挂了 → 整个 agent 停摆（安全优先，失败即停）。
- **DSH**：fs 和 shell 分属两套机制 → 一个挂了另一个照常 → 任务完成（可用性优先，降级继续）。

没有谁对谁错，这是两种工程哲学：**把安全做成一堵墙（墙倒了，什么都过不去）vs 把安全做成一道道闸（闸坏了，别的路还能走）。** 对"只读分析"这类任务，DSH 的降级能力是优点；对"必须确保命令被隔离"的场景，Codex 的宁可停摆是优点。顺便说一句，dsh 现在还明确标注是 developer preview——接口随时可能破坏性变更，这一点文章里必须如实交代。

## 四、横向对比：同一张表，五种配法

先交代一下测试任务（完整方法见第五节）：**任务一**是一个 4 个测试的小仓库，故意注入 3 处 bug（税率重复计算、缺失四舍五入、硬编码税率），起步状态 1 过 3 挂；**任务二**升级成多文件订单服务（`inventory.js`/`pricing.js`/`checkout.js` 三个文件），同样注入 3 处 bug（折扣码大小写、缺库存检查、空订单不报错），其中"库存不足要报错"这条横跨两个文件，起步 3 过 3 挂。两个任务提示词完全一致，五家各自跑在独立副本上，不允许修改测试文件。

先回放任务一的"名场面"：五家各自的工具轨迹。下面这些不是示意图，是从各家会话日志里摘出来的**真实记录**（DSH 的轨迹来自它的 session 日志，Pi 和 OpenCode 来自各自的 JSON 输出，Claude Code 与 Codex 的无头模式不导出工具明细，所以用它们自述的流程）：

```
Claude Code（11 轮对话，37s）：
  读全文件 → 列出 3 个 bug → 一次 edit 全部修复 → npm test
  风格：先看全，再动手，多轮确认

Codex（25s，仅 1762 tokens）：
  读代码 → 定位 → 一次编辑 → 跑测试
  风格：一把梭，不废话（这是它自己汇报的流程）

OpenCode（8 次工具调用，11s）：
  bash（ls + git log + git status）→ bash（cat + ls -R）→ read×2 → edit×3 → npm test
  风格：先摸清仓库（连 git 历史都看了），再动手

Pi（6 次工具调用，9s）：
  bash ls → bash find → read×2 → edit → npm test
  风格：bash 开路，跑得飞快

DSH（12 次工具调用，26s）：
  bash ls → glob → bash → read×3 → edit×3 → read → bash×2
  风格：读得多、改得稳；bash 沙箱不可用就改用 fs 工具 + 数学验证
  （其中 bash 调用都尝试过但被沙箱拦下——见 3.5 节的对照实验）
```

同一个任务（任务一）、同样的三处 bug，五家的"解题姿势"各不相同：有先看后动的、有先测后改的、有一把梭的、有 bash 开路的。**这就是五件套配法差异最直观的样子。**

### 进阶任务（任务二）：任务变难后，修法开始分派

我又加跑了一档更复杂的任务，看看差距会不会拉开。结果很有意思：**五家全部修复通过（6/6），"能不能修好"依然拉不开差距，"怎么修"却明显分成了两派。**

```
claude（29s，11 轮，$0.197）   ：checkout 接上 hasStock() 前置检查 → 只改 2 个文件
dsh（17s，13 次工具调用）      ：同上，checkout + pricing（这次 bash 环境正常，跑通了 npm test）
codex（23s，6,030 tokens）     ：除 checkout 检查外，还把 subtractStock() 改成防御式 → 改全部 3 个文件
opencode（19s，13 次工具调用，1.5 万 tokens）：同 codex，改全部 3 个文件
pi（16s，12 次工具调用，5,394 tokens，$0.0001）：同 codex，改全部 3 个文件
```

**一派只在"入口"设卡**（claude、dsh）：在 `checkout` 里调用 `hasStock()` 前置检查，库存不足就抛错，`inventory` 原样不动；**另一派把防线下沉到"数据层"**（codex、opencode、pi）：让 `subtractStock()` 自己拒绝扣成负数，从根上保证库存不会变负。两种修法都让测试通过，但防御的边界画在了不同的位置——这跟它们在权限/沙箱上的哲学（Codex/Pi 更"底层兜底"）隐隐呼应。

这里还有个有趣的细节：**修法不只看 harness，也看模型**。OpenCode 第一轮（用 MiniMax-M2.7）跑任务二时只改了 checkout + pricing，属于"入口派"；换成 deepseek-v4-flash 重跑后，它改动了全部三个文件，变成了"下沉派"。同一个 harness、不同的模型，解题姿势都会变——这也是为什么我坚持把四家统一到同一个模型再对比。

顺带一提：任务一里 DSH 因为 bash 沙箱起不来只能"数学验证"，这一轮环境正常后它顺利跑通了 `npm test`——印证了 3.5 节的结论：那是环境问题，不是能力问题。

把五件套和五款工具放进一张表：

| 五件套 | Claude Code | Codex | OpenCode | Pi | DSH |
|---|---|---|---|---|---|
| **① 循环** | 标准 loop + hooks 挂点 | 标准 loop，干净利落 | 标准 loop + LSP 增强 | 标准 loop，快 | 标准 loop，事件驱动（turn/step） |
| **② 工具** | bash/fs/edit/…（闭源内置） | bash/fs/edit/…（Rust 原生） | bash/fs/edit/… + LSP | bash/fs/edit/…（可扩展） | bash/fs/edit/…（全部可插拔） |
| **③ 记忆** | CLAUDE.md + subagents + 自动压缩 | AGENTS.md 公约 + 项目记忆 | opencode.json + 规则体系 | 会话即文件 + HF 公开分享 | 会话日志即真相 + 压缩/投影插件 |
| **④ 权限** | 默认询问，可授权 | **审批分级 + 沙箱全家桶（最重）** | 权限策略可配置 | **默认无权限系统（最轻）** | 沙箱与 fs 分层，可降级 |
| **⑤ 界面** | TUI + headless -p | TUI + exec + IDE + App + Web | TUI + 桌面 + IDE + share | TUI（自研） | **Web / headless / TUI 多 profile** |
| **扩展** | hooks + MCP + 插件 + subagents | MCP + SDK + app-server | MCP + 插件 + LSP | 扩展 + OAuth 订阅 | **一切皆插件 + patch 层叠** |

再画一张光谱图，把五款工具放到两个坐标轴上——横轴是"开箱即用 ↔ 自己组装"，纵轴是"模型锁定 ↔ 模型中立"：

```
   模型锁定
     │
   Claude Code（Anthropic 兼容 API 可换）
     │
     │                     Codex（config 可换模型）
     │
     │                          DSH（默认 DeepSeek，provider 可插拔）
     │
     │                               OpenCode
     │
     │                                    Pi
     └──────────────────────────────────────────────> 模型中立
     开箱即用                                         自己组装
     （batteries included）                           （BYO）
```

### 资源占用：安装体积与内存

选型时还有一个实在的维度：**磁盘和内存**。我把五款工具的安装体积和运行时峰值内存都量了一遍（同样跑任务一，macOS `/usr/bin/time -l` 抓主进程峰值 RSS）：

| | Claude Code | Codex | OpenCode | Pi | DSH |
|---|---|---|---|---|---|
| **安装形态** | Node 应用 | Rust 单二进制 | Bun 单二进制 | Bun 打包 + npm 依赖 | Node 应用（多包） |
| **安装体积**（实测） | 170 MB | **258.5 MB** | 96.4 MB（目录 153 MB） | 143 MB | 283 MB |
| **峰值内存**（任务一，主进程 RSS） | 385 MB | **85 MB** | 374 MB | 194 MB | 221 MB |

这里有一个很反直觉的结果：**Codex（Rust）的安装体积其实是五家里第二大的（258.5 MB），但运行时内存却是五家里最低的（85 MB）**——"Rust 省内存"的印象成立，"Rust 体积小"的印象在它身上不成立。拆开看原因：258.5 MB 基本全是二进制本体（安装目录里其余资源加起来不到 5 MB）。需要澄清的是，**桌面 App 本身（.dmg）和 app-server 是独立的 release 资产，装 CLI 不会带上它们**——这个二进制就是 CLI 自己，只是大得惊人：`__TEXT` 段 252 MB，其中机器码 `__text` 约 185 MB（整个 agent 运行时——沙箱实现、协议客户端、MCP、TUI、内嵌 webview/字体等 UI 资源——被静态链接进了一个文件），且没有 debug 符号可剥。所有安装渠道（brew cask、npm、官方脚本、GitHub release）装的都是这同一个二进制（官方 gzip 压缩包 84 MB，解压即此），**不存在更小的"纯 CLI"版本**。反过来，两个"内存大户"是 Claude Code（385 MB）和 OpenCode（374 MB）——Node/Bun 运行时本身就有不小的底座，再加上推理时的上下文缓冲。

几点说明：内存测的是**主进程**的峰值 RSS，工具派生的 bash 子进程不计入；安装体积口径不同（单二进制 vs npm 全家桶），Pi 和 DSH 如果只算真正跑起来的文件会更小；这些数字随版本变化，仅供参考——但对"这台机器装得下吗、跑得起吗"这类问题，量级是有用的。

换个角度说结论：

- **想省心、要生态**，选 Claude Code——服务最周全，代价是闭源；模型绑定是软的（Anthropic 兼容端点即可换 DeepSeek/MiniMax 等，见 3.1 实测）。
- **重视安全和可审计性**，选 Codex——沙箱最硬、最省 token，而且连 harness 本体都开源了。
- **要模型自由、要社区**，选 OpenCode——中立插座 + 20 万 star，怎么接都行。
- **追求速度和极简，且自己掌控环境**，选 Pi——快得离谱、便宜得离谱，安全自负。
- **想深度定制 harness 本身**，选 DSH——一切皆插件，五件套全都能换；但要接受 developer preview 的不稳定。

## 五、实测方法论与免责声明

为了让上面这些结论站得住，我交代一下怎么测的。**完整的复现材料——两档任务源码、测试环境说明、五款工具的运行脚本、全部原始会话记录（工具轨迹/token/成本）与结果汇总——已开源在 [github.com/springuper/agent-harness-bench](https://github.com/springuper/agent-harness-bench)，任何人可以自行查证或重跑。**

1. **同一任务，两档难度**：**任务一**是一个 4 个测试的小仓库，故意注入 3 个 bug（税率重复计算、缺失四舍五入、硬编码税率），起步状态 1 过 3 挂；**任务二**是多文件订单服务（`inventory.js`/`pricing.js`/`checkout.js`），注入 3 个 bug（折扣码大小写、缺库存检查、空订单不报错），其中"库存不足要报错"横跨两个文件，起步 3 过 3 挂。两档提示词完全一致："修复 bug，让 npm test 全过，不改测试文件，跑测试确认。"
2. **隔离环境**：五款工具各自跑在**独立的仓库副本**里，避免"先跑完的改好了代码，后跑的捡现成"这种污染（第一轮我就踩了这个坑，五家共享一个目录，结果 Pi 8 秒修完后，其他家全在"验证已通过的代码"）。
3. **版本与模型**：Claude Code 2.1.3、Codex CLI 0.146.0、OpenCode 1.14.18、Pi 0.84.2、DSH 0.1.1-rc.2，**五款全部使用同一个模型 deepseek-v4-flash**——对比完全落在 harness 本身的差异上。Claude Code 是通过 DeepSeek 的 Anthropic 兼容端点（`https://api.deepseek.com/anthropic`）接入的，这本身就是"模型与 harness 解耦"的一个例证（详见 3.1 节）。token 数和成本虽然同模型，但各家计费口径与缓存策略不同，仍只宜做量级参考。
4. **日期**：所有 star 数、版本号、实测数据均为 2026-08-23 抓取，开源世界变化快，引用时请以当时为准。
5. **坦白**：作者深度使用 DSH（这篇文章就是在 DSH 里写的），文章尽量用解剖刀而不是滤镜；但如果你发现哪里偏了，欢迎在评论区指出来。

把两档任务的实测放到一起对照。先看任务一：

| | Claude Code | Codex | OpenCode | Pi | DSH |
|---|---|---|---|---|---|
| 版本 | 2.1.3 | 0.146.0 | 1.14.18 | 0.84.2 | 0.1.1-rc.2 |
| 实测模型 | deepseek-v4-flash | deepseek-v4-flash | deepseek-v4-flash | deepseek-v4-flash | deepseek-v4-flash |
| 结果 | ✅ 4/4 | ✅ 4/4 | ✅ 4/4 | ✅ 4/4 | ✅ 4/4 |
| 耗时 | 37s | 25s | 11s | **9s** | 26s |
| 工具调用/轮次 | 11 轮对话 | 自述：读→编辑→测试 | 8 次工具调用 | 6 次工具调用 | 12 次工具调用 |
| token（约） | 16.3 万（含缓存读） | **1,762** | 1.3 万 | 3,375 | 6.8 万（含缓存读） |
| 缓存命中率 | 86% | 未上报 | **98%** | 91% | 81% |
| 成本（约） | $0.216 | 极低 | 低 | **$0.00007** | 极低 |

*（说明：五家同模型，但各家 token 计费口径与缓存策略不同，"成本"是各工具自己上报的数值，仅供参考。）*

任务二同样全绿，关键数字：

| | Claude Code | Codex | OpenCode | Pi | DSH |
|---|---|---|---|---|---|
| 结果 | ✅ 6/6 | ✅ 6/6 | ✅ 6/6 | ✅ 6/6 | ✅ 6/6 |
| 耗时 | 29s | 23s | 19s | **16s** | 17s |
| 工具调用/轮次 | 11 轮对话 | 自述（6,030 tokens） | 13 次工具调用 | 12 次工具调用 | 13 次工具调用 |
| token（约） | 11.7 万（含缓存读） | 6,030 | 1.5 万 | **5,394** | 7.1 万（含缓存读） |
| 缓存命中率 | 78% | 未上报 | **98%** | 93% | 82% |
| 成本（约） | $0.197 | 极低 | 低 | **~$0.0001** | 极低 |
| 改动文件 | checkout+pricing | 全部 3 个 | 全部 3 个 | 全部 3 个 | checkout+pricing |

*（任务二的 codex 与 dsh 是在无外层沙箱的正常环境下跑的——任务一里它们的 bash 沙箱启动失败是环境限制，不是能力问题，见 3.5 节。缓存命中率 = 缓存读取 token / 总 token，反映 harness 复用上下文的程度；首步必然冷启动，短任务里命中率主要由后续步骤决定。Codex 无头输出不提供缓存明细。）*

## 六、结尾：鞍具的时代

写这篇文章的过程中，最触动我的数据是 Codex Harness 开源时的那个结果：**两个 harness 设计改动，让同一个模型的成绩从 13.3% 涨到 38.3%，token 还省了 6 倍。** 这意味着什么？

意味着**模型正在变成商品，鞍具正在变成差异。** 当大模型的能力越来越同质化、价格越来越便宜，"选哪个模型"的答案会越来越不重要；而"怎么把模型的力气变成实际产出"——循环怎么设计、上下文怎么管理、安全边界怎么划、怎么扩展——会越来越值钱。2026 年回头看，这五款工具几乎在同一件事上押注，只是姿势不同：Anthropic 押服务与生态，OpenAI 押纪律与开源，OpenCode 押中立与社区，Pi 押极简与信任，DeepSeek 押插件化与可组合性。

还有一件小事我想留作彩蛋：**我这台机器上，五款工具现在跑着同一个引擎——deepseek-v4-flash。** Claude Code 是通过 DeepSeek 的 Anthropic 兼容端点接入的，另外四家各有各的连法，但没有一行业务代码是为"某个模型"写的，全是 harness 在替我干活。这大概就是鞍具时代最好的注脚——**马是谁不重要了，重要的是鞍具合不合手。**

最后，如果你也想亲自感受"同一副大脑、五副鞍具"的差别，把下面这段复制到任何一款工具的 headless 模式里试试，你会有自己的答案：

```
修复这个仓库里的 bug，让 npm test 全部通过。不要修改 test/ 目录下的测试文件。完成后运行测试确认。
```

## 附：五款工具的无头模式一行命令

本文的实测全部走的是各家的"无头（headless）"模式——不打开交互界面，把任务当作参数丢进去，跑完退出。这也是把 agent 接进 CI、批处理脚本的标准姿势。**五款工具全都提供无头模式，所以"能不能接 CI"这个问题的答案是：都可以**——差异只在输出格式（有的给 JSON 事件流，有的给纯文本）和权限/沙箱参数（见下方小提示）。以下命令都是我这次实测真实用过的（2026-08-23），复制即用：

```bash
# Claude Code：-p 无头模式；通过 DeepSeek 的 Anthropic 兼容端点接引擎（CI 常用）
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic ANTHROPIC_AUTH_TOKEN=sk-你的key \
  ANTHROPIC_MODEL=deepseek-v4-flash \
  claude -p "修复这个仓库里的 bug，让 npm test 全部通过" --dangerously-skip-permissions

# Codex CLI：exec 非交互执行，--sandbox workspace-write 用工作区沙箱
codex exec --sandbox workspace-write --skip-git-repo-check "修复这个仓库里的 bug，让 npm test 全部通过"

# OpenCode：run 非交互执行，-m 指定 provider/模型（这里用 DeepSeek）
opencode run -m deepseek/deepseek-v4-flash --dangerously-skip-permissions "修复这个仓库里的 bug，让 npm test 全部通过"

# Pi：-p 非交互模式，--provider/--model 指定引擎（这里用 DeepSeek）
pi -p "修复这个仓库里的 bug，让 npm test 全部通过" --provider deepseek --model deepseek/deepseek-v4-flash

# DeepSeek Harness：headless profile，一次性任务，打印最终答案后退出
dsh --profile headless "修复这个仓库里的 bug，让 npm test 全部通过"
```

几个小提示：

- 换引擎（模型）只改对应参数：Claude Code 看 `ANTHROPIC_BASE_URL`/`ANTHROPIC_MODEL`，Codex 看 `config.toml` 的 `model_provider`，OpenCode 看 `-m provider/model`，Pi 看 `--provider/--model`，DSH 看 settings 里的模型配置——**五款工具的"鞍具"和"马"都是可以分开换的**，这正是本文想让你带走的核心印象。唯一的前提是**协议兼容**：Claude Code 需要对方提供 Anthropic Messages 兼容端点（DeepSeek 的 `https://api.deepseek.com/anthropic`、MiniMax 的 `/anthropic` 都行），其余四家走 OpenAI/Responses 兼容协议，选择面更大。
- 各家都支持把输出格式化成 JSON（`--output-format json` / `--format json` / `--mode json` 等），方便脚本解析。
- 沙箱和权限开关的名字各不相同：`--dangerously-skip-permissions`（Claude Code/OpenCode）、`--sandbox`（Codex）、无权限系统（Pi）、profile 内权限策略（DSH）。接 CI 前，请一定先搞清楚你在哪一档权限上跑。
