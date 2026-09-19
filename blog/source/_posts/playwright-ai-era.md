---
layout: post
title: "接口的观众：为什么 AI 时代都换成了 Playwright"
date: 2026-09-20 20:00:00
status: draft
published: false
tags:
  - Frontend
  - Playwright
  - Testing
  - E2E
  - Puppeteer
  - Cypress
  - AI
  - Agent
---

先看两段代码。它们干的是同一件事：在一个页面上点一下「提交」按钮。

```js
// 2019 年的写法
await driver.sleep(800);                                  // 求你了，页面你快点
await driver.findElement(By.css('#app > div > div:nth-child(3) .btn')).click();
```

```ts
// 2026 年的写法
await page.getByRole('button', { name: '提交' }).click();
```

同一件事，两份代码。你大概会说：后者好看多了。但好看只是表象，真正被换掉的是别的东西——**第一段的读者是人**（人得判断"睡多久才够"，人得维护那串 `nth-child(3)`），**第二段的读者可以是机器**（它读得懂"角色叫 button、名字叫提交"，也能自己在条件满足时动手）。

这篇文章想论证的就是这句话：**测试工具的换代，不是因为谁的功能更多，而是因为这行代码的读者换人了。**

我原本也以为答案是"Playwright 功能强、生态好"——直到我把三样东西摆在一起看：一份流传很广的行业调查、Playwright 自己的发布说明、还有一段我自己跑出来的报错原文。看完之后我改了主意。下面按顺序摆给你看。

<!--more-->

## 一、三个前任，各自在为谁设计

想搞清楚换代，得先知道上一代各自解决了什么问题——以及**它们的设计对象是谁**。

### Selenium：为「企业的测试生态」设计

Selenium 是这一行的老前辈，它的核心遗产是协议：WebDriver。2018 年 WebDriver 成为 W3C Recommendation，从此"用任何语言驱动任何浏览器"有了标准。（顺带说清一个容易被夸大的说法：升级成标准的只有 **Level 1**——现行的 [Level 2](https://www.w3.org/TR/webdriver2/) 和 WebDriver BiDi 到 2026 年 9 月都还是 Working Draft。）

这套协议换来了跨语言与跨厂商的自由，代价是把两件麻烦事留给了使用者：**等待**和**会话**。[官方文档](https://www.selenium.dev/documentation/webdriver/waits/)写得很直白：显式等待就是"你写在代码里的轮询循环"。也就是说，WebDriver 本身没有内建的"这个元素现在能不能点了"的判定——这件事得你自己写。

于是就有了第一代前端测试工程师的必修课：`sleep` 多久才够。这门课的挂科率，就是后来所有人嘴里的 flake。

### Puppeteer：为「脚本作者」设计

Puppeteer 是 2017 年从 Chrome 团队长出来的，本质是 Chrome DevTools Protocol（CDP）的一层好用的封装。它的使用者画像很清楚：写脚本的人、做抓取的人、需要精确控制浏览器的人。

它**从来不是一个测试框架**——[官方 FAQ](https://pptr.dev/faq) 到今天仍然这么定位自己：由 Chrome Browser Automation team 维护，是 CDP / WebDriver BiDi 的**参考实现**，并且明确写着"不是 Selenium 的替代品"，多语言绑定和 Grid 都不在它范围内。想要测试的便利，社区方案是另外装 `jest-puppeteer`。

这里得纠正一个流传很广的说法：**"Puppeteer 只支持 Chrome"已经过时了**。从 v23.0.0 起它同时支持 Chrome 与 Firefox（Chrome 默认走 CDP，Firefox 默认走 BiDi）。

<!-- TODO(gif): 3 秒动画——用一张图对比"Puppeteer 需要自己搭 runner + 断言 + 等待"与"Playwright 开箱即测"，体现工具定位差异 -->

### Cypress：为「人的开发者体验」设计

Cypress 是 2015 年出现的，它的野心很不一样：**把测试写成一件愉快的事**。链式 DSL 读起来像英语，测试跑在浏览器里，还有一个能"时间旅行"的界面——鼠标悬停在某一步，左侧就是当时那一刻的 DOM 快照。

在"给人用"这件事上，它是真的做到了极致。而且有个细节会让很多人意外：

> **Cypress 的 actionability 检查项比 Playwright 还多。**

官方的检查清单包括 visible / disabled / detached / readonly / animations / covering / scrolling，比 Playwright 的四项还长；它也会盯着 DOM 不断重跑查询（[官方原文](https://docs.cypress.io/app/core-concepts/retry-ability)：*"Cypress will watch the DOM - re-running the queries…"*）。

那它的分水岭在哪？就在紧挨着的下一句官方措辞里：

> *"Only queries are retried… **commands themselves only execute once**"*（只有查询会被重试，命令本身只执行一次）

翻译一下：Cypress 会反复确认"那个按钮出现了没"，但 `.click()` 一旦执行失败，它**不会**重新点一次。检查做得很多，动作却不重试——这就是"给人设计"和"给机器设计"的分岔口：人盯着失败现场自己能重试，机器需要工具替它重试。

### 一张图看清这一代的分工

```
抽象层级高
   ^
   |   Cypress             Playwright
   |   （链式 DSL，          （语义定位 + 可序列化
   |     为人设计）             locator，为机器也友好）
   |
   |   Selenium            Puppeteer
   |   （协议标准，          （CDP 薄封装，
   |     等待交给人）          给脚本作者）
   |
   +----------------------------------------> 读者从"人"偏向"机器"
      给人用                                   给程序用
```

四个工具都在"自动化浏览器"这一格，但**它们各自把抽象画在了不同的高度、面向了不同的读者**。接下来这一百年不变的规律是：读者的规模一变，抽象线就会跟着挪。

## 二、Playwright 做对了什么

Playwright 出现在 2019 年底（npm 上最早可见的版本是 2019-12-05 的 `0.9.1`，`1.0.0` 在 2020-05-06；官方没有发过一手发布公告，这两个日期取自 npm registry）。它的作者是谁，官方 FAQ 里有一句写得非常坦率：

> *"We are the same team that originally built Puppeteer at Google, but has since then moved on."*

同一批人，另起炉灶。理由也给了：继续改 Puppeteer 的 API 就得破坏兼容，所以 *"we chose to start with a clean slate"*。

所以这不是"外人来挑战"，**是一家人自己觉得原来那套抽象不够用了**。他们把新抽象画在了四个地方。

### 1. 把"什么时候可以动手"变成工具的事

这是 Playwright 最出名的一点，但流传的版本常常不准确。它不是"加了等待"，而是把人的经验写成了**可判定的条件**——官方叫 [actionability](https://playwright.dev/docs/actionability)：动作执行前，工具自己等这些条件全部成立：

| 条件 | 官方定义（人话版） |
|---|---|
| Visible | 有非空 bounding box，且不是 `visibility: hidden`；**`opacity: 0` 算可见** |
| Stable | **连续两帧 bounding box 不变**（还在动的元素不点） |
| Receives Events | 命中测试时这个点上真的是它，不是被别的元素盖住 |
| Enabled | 没 `disabled`，祖先也没有 `aria-disabled` |

"连续两帧不变"这种抠到帧的定义，是我见过对"把经验变成接口"最字面的注解——**它把老工程师嘴里那句"等它别动了再点"直接写成了代码。**

### 2. Locator 是「描述」，不是「句柄」

`page.getByRole('button', { name: '提交' })` 返回的不是一个元素引用，而是一句**描述**：官方定义是"一种在任何时刻都能找到元素的方式"——它是惰性重解析的。

这个区别很实在：描述可以重试、可以序列化、可以跨进程传递、可以直接印在报错里（下面马上会看到）。而 `ElementHandle` 反而被官方文档标上了 **Discouraged（不推荐）**。

而语义定位（`getByRole` / `getByLabel` / `getByText` / `getByPlaceholder` / `getByTestId`）背后的 role 来自 W3C ARIA 规范——**这意味着你的测试代码开始长得像一份 UI 规范**，而不是一串 DOM 路径。

### 3. 一套 API，吃下三个内核

Chromium、Firefox、WebKit——这次不是"分别适配"，而是同一套 API。我本机上装着的就是三个真内核：

```
~/Library/Caches/ms-playwright/
├── chromium-1200
├── firefox-1497
└── webkit-2227          # 真 WebKit，不是 Chromium 换皮
```

（这一点上，Cypress 和 Puppeteer 都给不了等价物。想测 Safari 的等价内核，几乎没有第二条路。）

架构上也值得记一笔，因为它解释了"为什么它敢说自己不是 WebDriver 的又一个绑定"：**语言绑定 → 独立的 driver 子进程 → 自有协议**（协议定义在仓库的 `packages/protocol/spec/*.yml`）。Chromium 走 CDP；Firefox 走打了补丁的 `-juggler-pipe`；WebKit 走 `--inspector-pipe`。官方在 `connectOverCDP` 的文档里留下一句很能说明态度的话：直连 CDP 的保真度 *"significantly lower fidelity than the Playwright protocol connection"*。

> 口径声明：上面这段架构来自官方文档与仓库源码。但要提醒一句——"Juggler"这个词**官方文档从不使用**，它只出现在源码与补丁目录里，属于源码级证据，别当成官方术语引用。

### 4. trace.zip：把失败变成一个可以传递的东西

测试失败时，Playwright 给你的是一个 `trace.zip`。里面装着：[Actions（含当时用的 locator 与耗时）、Snapshots（动作前/中/后的全量 DOM 快照）、Screenshots、Source、Log、Errors、Console、Network](https://playwright.dev/docs/trace-viewer)。

它把"一次性现象"变成了**一个可传递的工件**——可以在自己机器上重放，可以塞进 CI 产物，可以从 1.62 起直接在命令行里分析（`npx playwright trace`）。

### 5. 落点：一段我自己跑出来的报错

前面四条都是"设计得好"。但真正让我改变判断的，是下面这段报错原文——**这是我 2026-09-19 在本机跑 Playwright 1.57.0（Node 24）时真抓到的**，我构造了一个 20 行订单列表，然后故意用模糊定位去点它：

```
locator.click: Error: strict mode violation: getByRole('button', { name: '查看' }) resolved to 20 elements:
    1) <button aria-label="查看订单 SO-1001 详情" ...> aka getByRole('button', { name: '查看订单 SO-1001 详情' })
    2) <button aria-label="查看订单 SO-1002 详情" ...> aka getByRole('button', { name: '查看订单 SO-1002 详情' })
    3) <button aria-label="查看订单 SO-1003 详情" ...> aka getByRole('button', { name: '查看订单 SO-1003 详情' })
    ...
```

（为了看得清，我把每行里那个很长的 `class` 属性省略成了 `...`，其余一字未改。）

请仔细看这个报错的结构。它不只是说"你错了"：

1. 它说明了**为什么错**（匹配到 20 个）；
2. 它给出了**每个候选的真实身份**；
3. 最关键的是那句 `aka`——**它把改正后的 locator 写法一条条列给你了。**

这不是给人看的礼貌提示，这是一份**写好的补丁**。而且它也不是巧合：从 1.51 起，Playwright 直接在报错旁放了一个按钮，叫 **Copy prompt**。

## 三、转折点：这份接口的观众换人了

到这里，前面讲的都还是"Playwright 是个设计得好的工具"。要解释"为什么偏偏是 AI 时代换代"，得回答一个更具体的问题：**为什么这套抽象对模型特别友好？**

我用三个词来概括，每一个都能落到我抓到的原文上。

### 结构化 > 像素

2025 年 3 月，微软把 Playwright 包成了一个 MCP server（[playwright-mcp](https://github.com/microsoft/playwright-mcp)，建仓到 2026-09-19 已 37,277 star）。它的 README 第一段就把立场说透了：

> *"enables LLMs to interact with web pages through **structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models**."*

再看它给模型的工具描述，更直接：`browser_snapshot` 的说明是 *"this is better than screenshot"*，而 `browser_take_screenshot` 的说明是 *"You can't perform actions based on the screenshot"*。（视觉能力要显式开：`--caps=vision`。）

那"结构化"到底省了多少？官方**没有给过任何量化声明**——所以我自己量了一次。构造一个典型的组件库风格页面（20 行表格、class 哈希、内联 style、`__NEXT_DATA__`），用 `locator.ariaSnapshot()` 取同一页面的两种表示：

| 表示 | 字符数 |
|---|---|
| `page.content()` 的 HTML | 12,805 |
| ARIA 快照 | **2,286** |
| 比例 | **17.9%** |

<!-- TODO(表格配图): 用真实站点（如组件库官网）再测 2～3 个页面，把比例分布做成一张小图 -->

但**体积只是副产品，信息形态才是重点**。ARIA 快照里长这样：

```
- heading "订单工作台" [level=1]
- form "筛选":
  - textbox "关键词":
    - /placeholder: 输入订单号
  - combobox "状态":
    - option "全部" [selected]
- row "SO-1001 张三 ¥1,280.00 待发货"
```

没有 `css-1x1q7`，没有 `ant-table-cell`，没有构建产物留下的哈希。模型拿到的是**词汇表**（role、name、state），而不是渲染残渣——而这恰好就是 `getByRole` 需要的输入。**同一个抽象层，人和模型都能读。**

想自己量一次的话，三行就够（`npm i -D playwright && npx playwright install chromium` 之后）：

```js
// aria-probe.mjs —— 打印任意页面的「模型视角」
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('https://你的目标页面');

console.log('HTML 字符数:', (await p.content()).length);
console.log('ARIA 字符数:', (await p.locator('body').ariaSnapshot()).length);
console.log(await p.locator('body').ariaSnapshot());   // 这行就是模型看到的东西
await b.close();
```

<!-- TODO(截图): ARIA 快照 vs HTML 的并排截图，左右对比更直观 -->

### 确定性 > 视觉启发式

MCP 的 README 里还有一句我很喜欢的话，几乎是这个时代的判词：

> *"**Deterministic tool application**. Avoids ambiguity common with screenshot-based approaches."*

"确定性"这三个字看着朴素，但对 agent 是生死攸关的：**它决定了模型的动作能不能被复盘、被重放、被自动化验证。** 视觉方案里"点这里"是一个坐标，语义方案里"点这里"是一个角色加一个名字——后者可以被断言、被 diff、被写进回归测试。

### 可重放 > 一次性

把前面两条接起来看，就明白了为什么 trace 和 locator 的可序列化如此重要：**一个能被序列化的失败，就是一份能被自动修复的任务。**

不用猜——官方自己就把这条链路做成了产品。[Playwright Test Agents](https://playwright.dev/docs/test-agents)（1.56，2025-10-06）内置三个 agent：

```
planner  → 探索应用，产出一份 Markdown 测试计划
generator → 把 Markdown 计划变成 Playwright 测试文件
healer   → 跑测试，自动修复失败的用例
```

而且它明说了要接到哪几个编码 agent 上：

```bash
npx playwright init-agents --loop=vscode|claude|codex|opencode
```

### 官方时间线：AI 不是外挂上去的，是长进去的

把 Playwright 近两年的发布说明按时间排一遍，比任何观点都有说服力：

| 版本 | 时间 | 与"给模型用"有关的动作 |
|---|---|---|
| 1.49 | 2024-11 | `toMatchAriaSnapshot` 断言落地 |
| 1.51 | 2025 | 报错旁出现 **Copy prompt** 按钮 |
| 1.56 | 2025-10 | **Test Agents**（planner / generator / healer） |
| 1.57 | 2025 | **移除 `page.accessibility`**，把能力收拢到结构化快照上 |
| 1.59 | 2026 | 补上 `Page.ariaSnapshot`（我本机 1.57 上用的是 `locator.ariaSnapshot()`）；1.60 给快照加 `boxes` 选项，官方措辞：*"useful for **AI consumption**"* |
| 1.62 | 2026 | `npx playwright trace`（命令行分析 trace）、`npx playwright mcp` |
| 1.63 | 2026-09-04 | `ariaSnapshotJSON` |

**当"给模型消费"这几个字开始出现在发布说明里，这就不是观察，而是既成事实了。**

### 但这里有个反转，必须说

同样是官方 README，在 2026 年给出了一个降温的说法。playwright-mcp 现在推荐 coding agent 改用 **CLI + Skills**（[microsoft/playwright-cli](https://github.com/microsoft/playwright-cli)），理由是：

> *"…avoid loading large tool schemas and **verbose accessibility trees** into the model context."*

**连 accessibility tree 都会被嫌啰嗦。** 这句话反而让整篇文章的论点更稳：被时代选中的从来不是某个功能，而是**"把网页表示成结构化语义"这件事本身**——因为只有结构化的东西才能被裁剪、被检索、被压进预算。

### 数据上也看得到

| 包（npm，周下载，2026-09-10 ~ 09-16） | 下载量 |
|---|---|
| `@playwright/mcp` | 597 万 |
| `@modelcontextprotocol/server-puppeteer` | **2.7 万** |

220 倍。这个差距不在功能层面，它是**生态位层面**的差距：这一代 agent 想做浏览器操作时，默认的落脚点已经只剩一个了。

## 四、换代的证据：数据、曲线，和守势的一方

前面讲的是"设计"。但设计得好不等于被采用——所以还得看数据。以下全部是 2026-09-19 抓取。

### 交叉点已经过去了

[State of JS 2025](https://2025.stateofjs.com/en-US/libraries/testing/)（13,002 人，调查期 2025-09-24 ~ 11-11）：

| | 使用率 | 留存率 | 备注 |
|---|---|---|---|
| **Playwright** | **50%** | **94%** | 2024 年是 36%，**+14pp**，官方称与 Vitest 并列最大涨幅 |
| Cypress | 47% | 57% | 2022 年留存是 84% |
| Puppeteer | 42% | 70% | |
| Selenium | 37% | **24%** | 2022 年留存是 42% |

**2025 年是 Playwright 使用率第一次超过 Cypress。** 但比使用率更值得看的是留存：94% 对 57%。

### 三年曲线：一个是斜坡，一个是平地

npm 月下载（同一口径，官方 API）：

```
2024-01   playwright   1,568 万   ▏
          cypress      2,327 万   ████████████

2025-01   playwright   4,956 万   ███
          cypress      2,373 万   ████████████

2026-08   playwright    3.50 亿   ████████████████████
          cypress      3,079 万   ██████████
```

近一周的差距是 **14 倍**（playwright 8,670 万 vs cypress 612 万）；对 Puppeteer 是 8 倍（1,059 万）；Selenium 的 JS 绑定 182 万。**换了赛道以后，两边已经不在一个量级上了。**

### 一个反直觉的数字

按 star 数看，Playwright 和 Puppeteer 几乎打平：

| 仓库 | star（2026-09-19） | 建仓 |
|---|---|---|
| microsoft/playwright | 96,334 | 2019-11 |
| puppeteer/puppeteer | 95,593 | 2017-05 |
| cypress-io/cypress | 51,019 | 2015-03 |
| SeleniumHQ/selenium | 34,499 | 2013-01 |

**star 数说明的是"有多少人觉得它值得收藏"，不是"有多少人用它"。** 星标打平、下载量差 8 倍，这个剪刀差本身就是"工具定位不同"的最直观证据：Puppeteer 仍然是抓取和脚本的第一选择，只是那条赛道上没有"测试"这件事。

### 守势的一方，其实都在动

说"Cypress 完了"是不准确也不厚道的。事实是：**它在下滑，但没停**。

- 2024-06-13，Cypress 官方发了一篇《[Update on Cypress's Workforce](https://www.cypress.io/blog/update-on-cypresss-workforce)》：裁员 11 人，目标是加速现金流平衡、为 C 轮做准备。
- 2026-09-01，**Cypress 16 照常发布**（HTTP/2 默认、Node 24 / Electron 41 / Chromium 146）。
- 它把赌注押在 AI 上：[UI Coverage](https://www.cypress.io/blog/introducing-ui-coverage)（2024-07）→ [AI 生成测试](https://www.cypress.io/blog/add-your-missing-tests-faster-with-test-generation-in-ui-coverage)（2025-05）→ 文档新增 [Work with AI agents](https://docs.cypress.io/ui-coverage/work-with-ai-agents)，把覆盖率报告当成 agent 的上下文。
- 还有一招很能说明姿态：官方出了一份《[Playwright → Cypress 迁移指南](https://docs.cypress.io/app/guides/migration/playwright-to-cypress)》。

准确的说法是：**相对动能下滑 + 转入守势**，不是停更。

Selenium 也一样还在跑（4.49，2026-09-09 发布），只是它的留存率数据（37% 使用率、24% 留存）把痛点写在了脸上——那些痛点正是"等待和会话"这两件它当年留给用户的事。

### 口径声明（这段必须读）

- npm 下载量包含 CI 里的重复安装、镜像同步和间接依赖，它是**量级指标**，不是用户数。`playwright` 这个包还被大量用于抓取，不全是测试。
- 有一个数字是反过来的，得摆出来：按 ecosyste.ms 统计，**cypress 被 6,559 个包反向依赖，playwright 只有 1,947 个**。下载量赢 14 倍，但"嵌进别人项目里"这件事 Cypress 仍然更多——**这就是存量与增量的差别**，不写出来就是选择性取证。
- star 数、版本号、下载量都是 2026-09-19 的快照。开源世界变脸比翻书快，引用请以当时为准。

## 五、顺带纠偏：六条流传很广但已经过时的说法

写这类文章最值钱的部分，往往不是"安利"，而是**把大家嘴里的旧知识更新一下**。以下六条我都核过一手来源：

| 常见说法 | 实际情况 |
|---|---|
| "Puppeteer 只支持 Chrome" | **v23.0.0 起同时支持 Chrome 与 Firefox**（Firefox 走 BiDi） |
| "Selenium 近年移交给了 SFC" | 自 **2011-02-02** 起就是 Software Freedom Conservancy 成员项目，不是"近年" |
| "WebDriver 是 W3C 标准" | 只有 **Level 1** 是 2018 Recommendation；**Level 2 与 BiDi 至今仍是 Working Draft** |
| "Browser Use / Stagehand 都是基于 Playwright 的" | 均**未见直接依赖**：Browser Use 用自研 `cdp-use`，Stagehand 用 `@browserbasehq/sdk`（Skyvern 才是直接依赖 `playwright`） |
| "Cypress 已经停更了" | 2026-09-01 刚发 Cypress 16，仓库持续提交 |
| "Claude Code / Codex / Cursor 官方默认推荐 Playwright" | **未验证**。能确认的只有：Playwright 侧提供了这几家的接入命令，反向的官方表态我没找到 |

最后一条我特意留着——**找不到证据的事，就说找不到。**

## 六、什么时候我不选 Playwright

一篇只有正面论证的文章是软文。下面这些反驳我认，而且都有出处。

### 组件测试，我仍然会先看 Cypress

Cypress 为组件测试提供了官方 mounting library 和 bundler 集成（React 18-19、Vue 3、Angular 21-22、Svelte 5，以及 Vite / Webpack / Next.js 的配置）。而 Playwright 的组件测试到 2026 年才改成 `mount()` fixture + 自建 dev server，还移除了 `experimental-ct-*` 包——**迁移成本实打实更高**。

### 调试联动性，是 Playwright 的真实短板

这一点值得认真写：Cypress 的测试和应用跑在**同一个 JS 事件循环**里，所以在 devtools 里下一个断点，两边会一起停住；而 Playwright 的 runner 和应用是**两个进程**，联动调试要麻烦得多。

（口径：这是 Gleb Bahmutov 在 [2025-09-30 的个人博客](https://glebbahmutov.com/blog/cy-vs-pw-browser/)里的观点，不是官方文档结论。但它是内行话，值得听。）

### 还有两类场景

- **Selenium**：6 种语言绑定 + Grid 的大规模编排，是多语言/企业遗留团队的结构性优势——连 Puppeteer 的官方 FAQ 都承认这两件事超出自己范围。
- **Puppeteer**：纯抓取、轻量脚本。只干一件事的时候，谁也不想先装一个测试运行器。

### 最后，说点我自己的坏话

Playwright 不会自动消灭 flaky 测试。我手头一个项目（`apps/dsa-web`，用 `@playwright/test ^1.58.2`）里的 e2e 用例，就同时存在"教科书示范"和"反面教材"：

```ts
// 好的一面：语义定位，读起来像需求
await expect(page.getByRole('button', { name: '复制纯文本' })).toBeVisible();

// 坏的一面：类名定位、硬编码等待、软判断
const firstHistoryItem = page.locator('.home-history-item').first();
await page.waitForTimeout(1000);
const ok = await menuButton.isVisible({ timeout: 2000 }).catch(() => false);
```

`waitForTimeout(1000)` 和 `sleep(800)` 是同一种东西，只是换了个更时髦的名字。**换工具不会消灭 flake，它只是把 flake 从"语言层面"挪到了"用法层面"。** 这也是我对所有"上个新工具就好了"的说法一贯的态度：工具能给你更好的抽象，但不能替你写对的代码。

## 七、还欠一轮实测：让 agent 用三套工具做同一件事

<!-- TODO(本轮草稿待定)：这一节的数字需要真跑出来。设计已经定好，与 agent-harness-bench 的方法论一致。
     若决定本轮不跑，直接删掉本节，并把结语里的相关句子一并删掉。 -->

前六节讲的都是"设计"和"数据"。但要真正证明"接口的观众换人了，所以工具换人了"，最硬的证据是：**让同一个模型、用三套工具、做同一件事，看差别。** 这正是我上一篇《[给大脑配一副好鞍具](/agent-harness-comparison/)》里用过的方法，这次换个题。

**设计**（沿用 `agent-harness-bench` 的口径：独立副本、固定提示词、同模型、不改测试文件）

- **任务**：一个 Vite + React 小应用，注入 3 个 UI bug——异步提交后列表不刷新 / 防抖搜索竞态 / 弹窗关闭后焦点丢失。
- **三臂**：`@playwright/test` 1.63 / Cypress 16 / Puppeteer（**用它的 Locator API**，不搭稻草人）。
- **指标**：首轮通过率、修复轮次、token、耗时、5 次重跑 flake 率，以及一个我自己最想看的新指标——**"第一次失败后，模型定位到根因需要几轮"**（这个指标最能量化"报错信息质量"）。
- **对照实验**：把同一次失败分别以 ① 原始堆栈 ② Playwright 报错片段 ③ trace + ARIA 快照 喂给 agent，测修复速度差。

结论我会补在这一节，并连同任务源码一起开源——**没跑出来的数据不写。**

## 八、结语

把全文收进一张表，方便你直接贴到团队文档里：

| | 定位 | 抽象画在哪 | 读者 | 2026 年的处境 |
|---|---|---|---|---|
| Selenium | 跨语言/企业级标准 | 协议层，等待交给人 | 人 | 仍在维护，留存率下滑 |
| Puppeteer | CDP/BiDi 参考实现 | 浏览器控制层 | 脚本作者 | 抓取场景稳固，测试场景不参与 |
| Cypress | 为人设计的测试体验 | 链式 DSL + 浏览器内运行 | 人 | 转入守势，组件测试仍有优势 |
| **Playwright** | 语义化的浏览器接口 | **语义定位 + 可序列化 + 可回放** | **人，以及模型** | 使用率与留存双第一 |

一句话总结这篇长文：**浏览器是 agent 的手，而 Playwright 恰好是那只手上最适合被握住的接口。**

有人会说这是"AI 时代的新机会"。我更愿意换个说法：**这十年里，测试工具的接口一直在等一群不会抱怨 `sleep(800)` 的用户。** 现在他们来了。

### 彩蛋

文章里我最喜欢的一处证据，不是数据，是那段报错。

那份报错把 20 个候选元素的"正确答案"一条条列出来，再配上一个叫 **Copy prompt** 的按钮——**它等于在明说：我知道你要把我这段话粘给谁看。**

一个工具用了六年时间，终于把自己的错误信息写成了一份 prompt。而我写这篇文章的时候，用的也是同一个思路：**把话说清楚，让下一个读者——不管是人还是模型——能直接照着干活。**

顺带留一个更小的彩蛋：Playwright 判定元素"可点"的四个条件里，`opacity: 0` 被算作**可见**。也就是说，一个完全透明的按钮，工具认为你可以点它。这条定义来自官方文档，我第一次读到时盯着看了三遍——人类的直觉说"看不见就是没有"，而协议的直觉说"它有框、能命中，那就是存在"。**抽象层的分歧，往往就在这种一行的细节里。**

---

**参考文献与延伸阅读**

官方文档与发布说明：

- [Playwright - Actionability（可操作性判定）](https://playwright.dev/docs/actionability)
- [Playwright - Locators](https://playwright.dev/docs/locators) / [ElementHandle（已标注不推荐）](https://playwright.dev/docs/handles)
- [Playwright - ARIA snapshots](https://playwright.dev/docs/aria-snapshots)
- [Playwright - Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright - Test Agents（planner / generator / healer）](https://playwright.dev/docs/test-agents)
- [Playwright - Release notes（1.49 / 1.51 / 1.56 / 1.57 / 1.59 / 1.60 / 1.62 / 1.63）](https://playwright.dev/docs/release-notes)
- [microsoft/playwright-mcp（README）](https://github.com/microsoft/playwright-mcp)
- [microsoft/playwright-cli（CLI + Skills）](https://github.com/microsoft/playwright-cli)
- [Puppeteer - FAQ（定位与浏览器支持）](https://pptr.dev/faq)
- [Cypress - Retry-ability（查询重试 vs 命令不重试）](https://docs.cypress.io/app/core-concepts/retry-ability)
- [Cypress - Update on Cypress's Workforce](https://www.cypress.io/blog/update-on-cypresss-workforce)
- [Cypress 16 发布](https://www.cypress.io/blog/cypress-16-faster-tests-starting-with-http2-support)
- [Selenium - Waits（显式等待即轮询循环）](https://www.selenium.dev/documentation/webdriver/waits/)
- [W3C WebDriver Level 2（状态：Working Draft）](https://www.w3.org/TR/webdriver2/) / [WebDriver BiDi](https://www.w3.org/TR/webdriver-bidi/)

数据来源：

- [State of JavaScript 2025 - Testing](https://2025.stateofjs.com/en-US/libraries/testing/)
- [npm registry downloads API](https://api.npmjs.org/downloads/point/last-week/playwright)（对比 [cypress](https://api.npmjs.org/downloads/point/last-week/cypress)、[puppeteer](https://api.npmjs.org/downloads/point/last-week/puppeteer)）
- [ecosyste.ms（反向依赖统计）](https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/playwright)

观点来源（已标注为个人观点）：

- [Cypress vs Playwright; Browser Included — Gleb Bahmutov](https://glebbahmutov.com/blog/cy-vs-pw-browser/)

> 本文数据基于 2026-09-19 抓取：Playwright 1.63.0、Cypress 16、Selenium 4.49；我自己的探针跑在本机 Playwright 1.57.0 + Node 24.13.0 上。版本不同时实现细节可能有出入。
