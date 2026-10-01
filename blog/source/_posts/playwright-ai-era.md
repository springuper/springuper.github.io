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

同一件事，两份代码。你大概会说：后者好看多了。但好看只是表象，真正被换掉的是别的东西：第一段的读者是人（人得判断"睡多久才够"，人得维护那串 `nth-child(3)`），第二段的读者可以是机器（它读得懂"角色叫 button、名字叫提交"，也能自己在条件满足时动手）。

这篇文章想论证的就是这句话：**测试工具的换代，不是因为谁的功能更多，而是因为这行代码的读者换人了。**

老实说，我原本也以为答案是"Playwright 功能强、生态好"。直到我把三样东西摆在一起看：一份流传很广的行业调查、Playwright 自己的发布说明、还有一段我自己跑出来的报错原文。看完之后我改了主意。下面按顺序摆给你看。

<!--more-->

## 一、三个前任，各自在为谁设计

想搞清楚换代，大概得先知道上一代各自解决了什么问题，以及它们的设计对象是谁。

下面三家，我用同一件小事来演示各自的特点：点一颗"600 毫秒后才可用"的提交按钮。第二章里 Playwright 写的也是同一颗按钮，正好能横向比。

### Selenium：为「企业的测试生态」设计

Selenium 是这一行的老前辈，它的核心遗产是协议：WebDriver。2018 年 WebDriver 成为 W3C Recommendation，从此"用任何语言驱动任何浏览器"有了标准。（顺带说清一个容易被夸大的说法：升级成标准的只有 Level 1，现行的 [Level 2](https://www.w3.org/TR/webdriver2/) 和 [WebDriver BiDi](https://www.w3.org/TR/webdriver-bidi/) 到 2026 年 9 月都还是 Working Draft。）

说它"面向企业的测试生态"，是四件很具体的事：

- 六种语言绑定：Java、Python、C#、Ruby、JavaScript、Kotlin。一个公司里后端写 Java、数据写 Python、前端写 JS，都能用同一套协议写测试，不必为了统一测试工具去统一技术栈。
- Grid 负责编排：把一套测试分发到几十台机器、几十个浏览器版本上并行跑。这是"企业级"最实在的那部分需求，也是别的工具基本不碰的部分，Puppeteer 的官方 FAQ 就明说 Grid 超出它的范围。
- [云厂商按协议供货](https://www.selenium.dev/sponsor/)：BrowserStack、TestMu AI（原 LambdaTest）都是 Selenium 官方列出的 Development Partner，测试基建不用自己搭，买就行。
- 中立治理：Selenium 自 [2011 年](https://sfconservancy.org/news/2011/feb/02/selenium-joins/)起就是 Software Freedom Conservancy 的成员项目，不属于任何一家浏览器厂商。企业敢把它写进五年规划，靠的正是这一点。

这套协议换来了跨语言与跨厂商的自由，代价是把两件麻烦事留给了使用者：等待和会话。[官方文档](https://www.selenium.dev/documentation/webdriver/waits/)写得很直白：显式等待就是"你写在代码里的轮询循环"。也就是说，WebDriver 本身没有内建的"这个元素现在能不能点了"的判定。这件事得你自己写。

于是就有了第一代前端测试工程师的必修课：`sleep` 多久才够。这门课的挂科率，的确就是后来所有人嘴里的 flake。

拿那颗提交按钮写一遍，长这样（Selenium 4 的 Java 绑定）：

```java
WebDriver driver = new ChromeDriver();
driver.get("https://example.com/order");

Wait<WebDriver> wait = new WebDriverWait(driver, Duration.ofSeconds(5));
WebElement submit =
    wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("#submit")));
submit.click();

driver.quit();
```

要看的是第三行："按钮什么时候可点"这件事，是你**显式写出来**的。换成 Python、C# 或 Kotlin，这段逻辑只是换个绑定，协议还是同一个，这就是"六种语言绑定"在实际工作里的样子。顺便说一句，Selenium 官方"等待"那一页自己就摆了一个叫 `sleep()` 的例子，里面写的是 `Thread.sleep(1000)`：文档自个儿把这件事认了。

### Puppeteer：为「脚本作者」设计

Puppeteer 是 2017 年从 Chrome 团队长出来的，本质是 Chrome DevTools Protocol（CDP）的一层好用的封装。它的使用者画像很清楚：写脚本的人、做抓取的人、需要精确控制浏览器的人。

它从来不是一个测试框架，[官方 FAQ](https://pptr.dev/faq) 到今天仍然这么定位自己：由 Chrome Browser Automation team 维护，是 CDP / WebDriver BiDi 的参考实现，并且明确写着"不是 Selenium 的替代品"，多语言绑定和 Grid 都不在它范围内。想要测试的便利，社区方案是另外装 `jest-puppeteer`。

这里得纠正一个流传很广的说法："Puppeteer 只支持 Chrome"已经过时了。从 v23.0.0 起它同时支持 Chrome 与 Firefox（Chrome 默认走 CDP，Firefox 默认走 BiDi）。

同一颗按钮，用 Puppeteer 写是这样：

```js
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://example.com/order');

await page.waitForFunction(() => {
  const btn = document.querySelector('#submit');
  return btn && !btn.disabled;        // 判据是你自己写的
});
await page.click('#submit');

expect(await page.$eval('#result', (el) => el.textContent)).toBe('已提交');

await browser.close();
```

`waitForFunction` 里那个判据是人写的，不是工具替你判断的；最后那句 `expect` 还得另外装 jest 才有。这就是"CDP 的参考实现，而不是测试框架"落在代码上的样子。

<!-- TODO(gif): 3 秒动画：用一张图对比"Puppeteer 需要自己搭 runner + 断言 + 等待"与"Playwright 开箱即测"，体现工具定位差异 -->

### Cypress：为「人的开发者体验」设计

Cypress 是 2015 年出现的，它的野心很不一样：把测试写成一件愉快的事。链式 DSL 读起来像英语，测试跑在浏览器里，还有一个能"时间旅行"的界面：鼠标悬停在某一步，左侧就是当时那一刻的 DOM 快照。

在"给人用"这件事上，它的确做到了极致。而且有个细节大概会让很多人意外：

> **Cypress 的 actionability 检查项比 Playwright 还多。**

官方的检查清单包括 visible / disabled / detached / readonly / animations / covering / scrolling，比 Playwright 的四项还长；它也会盯着 DOM 不断重跑查询（[官方原文](https://docs.cypress.io/app/core-concepts/retry-ability)：*"Cypress will watch the DOM - re-running the queries…"*）。

那它的分水岭在哪？就在紧挨着的下一句官方措辞里：

> *"Only queries are retried… commands themselves only execute once"*（只有查询会被重试，命令本身只执行一次）

翻译一下：Cypress 会反复确认"那个按钮出现了没"，但 `.click()` 一旦执行失败，它不会重新点一次。检查做得很多，动作却不重试。这就是"给人设计"和"给机器设计"的分岔口：人盯着失败现场自己能重试，机器需要工具替它重试。

同一颗按钮，Cypress 的写法最像英语，连 `await` 都不用：

```js
cy.visit('/order');
cy.get('#submit').should('not.be.disabled');     // 查询与断言会一直重试
cy.get('#submit').click();                       // 命令本身只出手一次
cy.get('#result').should('have.text', '已提交');
```

写起来确实最舒服，代价就藏在第二行和第三行之间：`should` 会重试到通过为止，`click()` 只出手一次。前面那句官方措辞，落到代码里就是这两行的区别。

### 一张图看清这一代的分工

```
              给人用      给程序用
抽象层级高    Cypress     Playwright
抽象层级低    Selenium    Puppeteer
```

四个工具都在"自动化浏览器"这一格，但**它们各自把抽象画在了不同的高度、面向了不同的读者**。同一颗按钮、四段代码，差别不在语法糖，而在把哪一层抽象留给你自己。接下来这一百年不变的规律是：读者的规模一变，抽象线就会跟着挪。

## 二、Playwright 做对了什么

Playwright 出现在 2019 年底（npm 上最早可见的版本是 2019-12-05 的 `0.9.1`，`1.0.0` 在 2020-05-06；官方没有发过一手发布公告，这两个日期取自 npm registry）。它的作者是谁，官方 FAQ 里有一句写得非常坦率：

> *"We are the same team that originally built Puppeteer at Google, but has since then moved on."*

同一批人，另起炉灶。理由也给了：继续改 Puppeteer 的 API 就得破坏兼容，所以 *"we chose to start with a clean slate"*。

所以这不是"外人来挑战"，是一家人自己觉得原来那套抽象不够用了。他们把新抽象画在了四个地方。

### 1. 把"什么时候可以动手"变成工具的事

这是 Playwright 最出名的一点，但流传的版本其实常常不准确。它不是"加了等待"，而是把人的经验写成了可判定的条件。官方叫 [actionability](https://playwright.dev/docs/actionability)，动作执行前，工具自己等这些条件全部成立：

| 条件 | 官方定义（人话版） |
|---|---|
| Visible | 有非空 bounding box，且不是 `visibility: hidden`；`opacity: 0` 算可见 |
| Stable | 连续两帧 bounding box 不变（还在动的元素不点） |
| Receives Events | 命中测试时这个点上真的是它，不是被别的元素盖住 |
| Enabled | 没 `disabled`，祖先也没有 `aria-disabled` |

"连续两帧不变"这种抠到帧的定义，是我见过对"把经验变成接口"最字面的注解：**它把老工程师嘴里那句"等它别动了再点"直接写成了代码。**

说得再顺口，也不如跑一次。回到第一章那颗按钮（`disabled` 600 毫秒，点成功就往页面上写一行「已提交」），Playwright 的写法就一行：

```js
await page.getByRole('button', { name: '提交订单' }).click();
```

没有显式等待，没有 `waitForFunction`，也没有判据。同一颗按钮，我给三种点法做了对照实验，结果不一样：

| 点法 | 页面结果 | 说明 |
|---|---|---|
| 按坐标立刻点 `page.mouse.click(x, y)` | `（未提交）` | 按钮还禁用着，真实鼠标事件被吞掉 |
| `locator.dispatchEvent('click')` | `（已提交）` | 事件绕过了检查，看着成功，其实是假成功 |
| `getByRole('button').click()` | `（已提交）`，等了 846 毫秒 | 条件成立才动手 |

<!-- TODO(gif): 录 8 秒，三种点法并排跑一遍，让"假成功"一眼可见 -->

第三行那 846 毫秒不是浪费，是它在等条件成立。但更值得琢磨的是第一行和第二行的对比：**不做检查的自动化，最危险的地方不是失败，而是它能给你一个假成功。** 一个"禁用状态也照样点进去"的脚本会在 CI 里一直绿着，直到上线被真实用户教做人。

这也是为什么那种天真写法在 Playwright 里反而不好写：等待焊在动作内部，除非你显式调用跳过检查的 API，否则绕不过去。

### 2. Locator 是「描述」，不是「句柄」

`page.getByRole('button', { name: '提交' })` 返回的不是一个元素引用，而是一句描述：官方定义是"一种在任何时刻都能找到元素的方式"。它是惰性重解析的（见 [Locators 文档](https://playwright.dev/docs/locators)）。

这个区别倒是实在：描述可以重试、可以序列化、可以跨进程传递、可以直接印在报错里（下面马上会看到）。`ElementHandle` 倒是被官方文档[标上了 Discouraged](https://playwright.dev/docs/handles)（不推荐）。

语义定位（`getByRole` / `getByLabel` / `getByText` / `getByPlaceholder` / `getByTestId`）背后的 role 来自 W3C ARIA 规范：这意味着你的测试代码开始长得像一份 UI 规范，而不是一串 DOM 路径。

差别有多大？我拿同一颗按钮做了次实验。先把 class 从构建哈希 `btn-primary-9f2c1a` 改成 `btn-primary-4b8e77`（模拟一次重新构建），再跑两种写法：

| 写法 | 重构之后 |
|---|---|
| `page.click('.btn-primary-9f2c1a')` | ❌ `Timeout 1200ms exceeded` + `waiting for locator('.btn-primary-9f2c1a')` |
| `page.getByRole('button', { name: '提交订单' })` | ✅ 照样命中 |

<!-- TODO(截图): 两行终端报错并排截图，右边打勾 -->

不过语义定位有个前提，得说清楚：`getByRole` 不是凭空知道"这是个按钮"的。它读的是浏览器的可访问性树：原生标签自带隐式 role（`<button>`、`<a href>`、`<input type="checkbox">`），自定义组件就得自己补上 `role` 和可达名称（`aria-label`，或者 `aria-labelledby`、`<label for>`）。

我拿一个只用 `<div onclick>` 拼的按钮试过：

```
getByRole('button').count()   →  0        # div 汤里没有"按钮"这个语义
ARIA 快照里的那一项            →  - text: 提交订单   # 降级成一行普通文本
补上 role="button" 之后         →  1
```

所以这条路对页面是有要求的：**你的界面得先有语义。** 这听着像额外成本，其实是一鱼三吃，同一套标记同时喂饱三件事：屏幕阅读器（可访问性）、`getByRole`（可测试性），以及 agent 读到的 ARIA 快照（可被理解）。我手头项目的 e2e 里就有个用例，断言的是"关键操作要有 `aria-label`、不要用 `title`"：一条测试顺手把无障碍规范也钉住了。

### 3. 一套 API，吃下三个内核

Chromium、Firefox、WebKit，这次不是"分别适配"，而是同一套 API。我本机上装着的就是三个真内核：

```
~/Library/Caches/ms-playwright/
├── chromium-1200
├── firefox-1497
└── webkit-2227     # 真 WebKit，不是换皮
```

（这里的"等价物"指三个内核都由同一套 API 一等公民地支持，而不是"能不能跑起来"。Cypress 的 WebKit 至今标着 experimental，Puppeteer 干脆没有 WebKit。）

上面这段我第一版写得很乱，重新理一遍。因为"开个 flag 就能驱起来"是个误解，这件事得分三层看：

第一层：语言绑定和浏览器之间隔了一个进程。 你在 JS、Python、Java 里调的是同一份实现，它启动一个独立的 driver 子进程，再通过 Playwright 自有协议（定义在仓库的 `packages/protocol/spec/*.yml`）跟它说话。所以它既不是 WebDriver 的又一家的绑定，也不是 CDP 的封装。

第二层：每个内核各走一条通道。

| 内核 | 通道 | 说明 |
|---|---|---|
| Chromium | CDP | 用开源 Chromium 构建，能力直接来自上游 |
| Firefox | 打了补丁的 `-juggler-pipe` | 官方文档原话：Playwright 依赖补丁，用不了品牌版 Firefox |
| WebKit | `--inspector-pipe` | 仓库 `browser_patches/` 下同时维护 firefox 与 webkit 两套补丁 |

第三层，也是最关键的一层：它自己编译并维护内核。 上面那两个 flag 不是"开关"，而是**只有打过补丁的构建里才存在的通道**。Playwright 每次发版同步更新三个内核的版本，`npx playwright install` 下载的就是这些自定义构建，我本机这份缓存已经 1.0 GB（chromium 324 MB、webkit 275 MB、firefox 253 MB）。

那为什么别人做不到？不是开不了 flag，是改不了内核。

- Cypress 的架构决定了它不往这个方向走。 官方原话是：*"Cypress is executed in the same run loop as your application."* 它把驱动注入浏览器、与被测应用同处一个事件循环（这也是它 devtools 联动调试体验好的原因）。这条路要求内核允许注入，而它无法自带打了补丁的 WebKit，所以官方对 WebKit 的措辞只能是 experimental。
- Puppeteer 的定位是 CDP 的参考实现：用官方 Chromium 构建跑 Chrome 系，v23 起 Firefox 走 BiDi，WebKit 不在计划内。它不需要改内核，也就不会去改。
- Selenium 走 W3C 协议：能力上限取决于各家厂商提供的 driver 实现。覆盖面最广，但每个内核能做什么由厂商说了算。

代价也说清楚：这套"连内核一起维护"的赌注，换来了三内核一致和额外的自动化能力，付出的是每次升级都要重下几百 MB 的自定义浏览器，外加内核补丁的长年维护。官方在 `connectOverCDP` 的文档里留下一句很能说明态度的话：直连 CDP 的保真度 *"significantly lower fidelity than the Playwright protocol connection"*。

> 口径声明：架构部分来自官方文档与仓库源码。"Juggler"这个词官方文档从不使用，只出现在源码与补丁目录里，属于源码级证据，别当成官方术语引用。

### 4. trace.zip：把失败变成一个可以传递的东西

测试失败时，Playwright 给你的是一个 `trace.zip`。里面装着：[Actions（含当时用的 locator 与耗时）、Snapshots（动作前/中/后的全量 DOM 快照）、Screenshots、Source、Log、Errors、Console、Network](https://playwright.dev/docs/trace-viewer)。

它把"一次性现象"其实变成了一个可传递的工件：可以在自己机器上重放，可以塞进 CI 产物，可以从 1.62 起直接在命令行里分析（`npx playwright trace`）。

### 5. 落点：一段我自己跑出来的报错

前面四条都是"设计得好"。但真正让我改变判断的，是下面这段报错原文。这是我 2026-09-19 在本机跑 Playwright 1.57.0（Node 24）时真抓到的，我构造了一个 20 行订单列表，然后故意用模糊定位去点它：

```
locator.click: Error: strict mode violation: getByRole('button', { name: '查看' }) resolved to 20 elements:
    1) <button aria-label="查看订单 SO-1001 详情" ...> aka getByRole('button', { name: '查看订单 SO-1001 详情' })
    2) <button aria-label="查看订单 SO-1002 详情" ...> aka getByRole('button', { name: '查看订单 SO-1002 详情' })
    3) <button aria-label="查看订单 SO-1003 详情" ...> aka getByRole('button', { name: '查看订单 SO-1003 详情' })
    ...
```

请仔细看这个报错的结构。它不只是说"你错了"：

1. 它说明了为什么错（匹配到 20 个）；
2. 它给出了每个候选的真实身份；
3. 最关键的是那句 `aka`：它把改正后的 locator 写法一条条列给你了。

这不是给人看的礼貌提示，这是一份**写好的补丁**。而且它也不是巧合：从 1.51 起，Playwright 直接在报错旁放了一个按钮，叫 Copy prompt。

## 三、转折点：这份接口的观众换人了

前面讲的都还是"Playwright 是个设计得好的工具"。但设计得好，不等于能被时代选中。所以在讲 AI 之前，得先把"AI 之前"补齐，否则容易得出一个偷懒的结论：它是被 AI 突然抬起来的。

并不是。我把 npm 的年下载量拉了出来（同一口径，官方 API）：

| 年份 | playwright | cypress | puppeteer |
|---|---|---|---|
| 2020 | 330 万 | 6,630 万 | 7,850 万 |
| 2021 | 1,320 万 | 1.26 亿 | 1.22 亿 |
| 2022 | 3,810 万 | 2.04 亿 | 1.76 亿 |
| 2023 | 8,640 万 | 2.57 亿 | 2.39 亿 |
| 2024 | 3.31 亿 | 2.77 亿 | 2.06 亿 |
| 2025 | 9.70 亿 | 3.15 亿 | 2.68 亿 |
| 2026（1 到 8 月） | 17.7 亿 | 2.39 亿 | 3.22 亿 |

这张表有三个读法：

1. 斜率早就在了。 2020 到 2023 年，playwright 每年大约翻三倍（330 万到 8,640 万），同期 Cypress 是温和上涨。也就是说趋势不是 AI 带来的，AI 之前它已经连着三年在抢地盘。
2. 但反超发生在 2024 年。 这一年 playwright 3.31 亿首次超过 cypress 的 2.77 亿；2025 年拉到 3.1 倍，2026 年前八个月已经接近 7.4 倍。拐点可以标到年份。
3. 时间线对得上。 2024 年 11 月 MCP 发布，2025 年 2 月 Claude Code 发布、3 月 playwright-mcp 建仓、4 月 Codex CLI 开源，这些正好压在 playwright 那条最陡的坡上。

（口径：npm 下载量含 CI 重复安装与间接依赖，这里是量级不是用户数；2026 年只统计到 8 月 31 日。另外，下载量 2024 年就反超了，行业调查里的"使用率"要到 2025 年才反超，两个口径差一年，第四节会看到。）

所以准确的说法是：**它先赢了工具本身的仗（2020 到 2023 的斜率），再赶上 AI 把这仗的价值放大了一档（2024 之后的陡增）。** 下面要解释的，正是第二段为什么成立。

我用三个词来概括，每一个都能落到我抓到的原文上。

### 结构化 > 像素

2025 年 3 月，微软把 Playwright 包成了一个 MCP server（[playwright-mcp](https://github.com/microsoft/playwright-mcp)，建仓到 2026-09-19 已 37,277 star）。它的 README 第一段就把立场说透了：

> *"enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models."*

再看它给模型的工具描述，更直接：`browser_snapshot` 的说明是 *"this is better than screenshot"*，而 `browser_take_screenshot` 的说明是 *"You can't perform actions based on the screenshot"*。（视觉能力要显式开：`--caps=vision`。）

那"结构化"到底省了多少？官方其实没有给过任何量化声明，所以我干脆自己量了一次。构造一个典型的组件库风格页面（20 行表格、class 哈希、内联 style、`__NEXT_DATA__`），用 `locator.ariaSnapshot()`（官方叫 [ARIA snapshots](https://playwright.dev/docs/aria-snapshots)）取同一页面的两种表示：

| 表示 | 字符数 |
|---|---|
| `page.content()` 的 HTML | 12,805 |
| ARIA 快照 | 2,286 |
| 比例 | 17.9% |

<!-- TODO(表格配图): 用真实站点（如组件库官网）再测 2～3 个页面，把比例分布做成一张小图 -->

但**体积其实只是副产品，信息形态才是重点**。ARIA 快照里长这样：

```
- heading "订单工作台" [level=1]
- form "筛选":
  - textbox "关键词":
    - /placeholder: 输入订单号
  - combobox "状态":
    - option "全部" [selected]
- row "SO-1001 张三 ¥1,280.00 待发货"
```

没有 `css-1x1q7`，没有 `ant-table-cell`，没有构建产物留下的哈希。模型拿到的是词汇表（role、name、state），而不是渲染残渣，这恰好就是 `getByRole` 需要的输入。同一个抽象层，人和模型都能读。

想自己量一次的话，三行就够（`npm i -D playwright && npx playwright install chromium` 之后）：

```js
// aria-probe.mjs ： 打印任意页面的「模型视角」
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

> *"Deterministic tool application. Avoids ambiguity common with screenshot-based approaches."*

"确定性"这三个字看着朴素，但对 agent 是生死攸关的：**它决定了模型的动作能不能被复盘、被重放、被自动化验证。** 视觉方案里"点这里"是一个坐标，语义方案里"点这里"是一个角色加一个名字：后者可以被断言、被 diff、被写进回归测试。

### 可重放 > 一次性

把前面两条接起来看，trace 和 locator 的"可序列化"到底解决什么，就能走出一条完整的链子：

1. 修复的前提是复现。 一个失败如果只能在那台机器、那个进程里存在，换个人（或换个 agent）就只能靠猜。
2. trace 把现场打包成一个文件（DOM 快照、网络、console、动作前后的状态），locator 把"该点哪儿"写成一段文本，所以它能被印进报错里，就像第 5 节那段 `aka`。
3. 于是失败变成可传递的对象：在 CI 上产生，在本地打开，也能被另一个程序读取。官方 healer 干的就是这件事：读失败、定位、改 locator、再跑一遍。

反过来看更清楚：如果失败信息里只剩一句"点击失败"、现场只有一张截图，那么修复者（不管人还是模型）都只能从头猜一遍。**可序列化不是"能被自动修复"的保证，但它是前提。**

不用猜：官方自己就把这条链路做成了产品。[Playwright Test Agents](https://playwright.dev/docs/test-agents)（1.56，2025-10-06）内置三个 agent：

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

把 Playwright 近两年的[发布说明](https://playwright.dev/docs/release-notes)按时间排一遍，比任何观点都有说服力：

| 版本 | 时间 | 与"给模型用"有关的动作 |
|---|---|---|
| 1.49 | 2024-11 | `toMatchAriaSnapshot` 断言落地 |
| 1.51 | 2025 | 报错旁出现 Copy prompt 按钮 |
| 1.56 | 2025-10 | Test Agents（planner / generator / healer） |
| 1.57 | 2025 | 移除 `page.accessibility`，把能力收拢到结构化快照上 |
| 1.59 | 2026 | 补上 `Page.ariaSnapshot`（我本机 1.57 上用的是 `locator.ariaSnapshot()`）；1.60 给快照加 `boxes` 选项，官方措辞：*"useful for AI consumption"* |
| 1.62 | 2026 | `npx playwright trace`（命令行分析 trace）、`npx playwright mcp` |
| 1.63 | 2026-09-04 | `ariaSnapshotJSON` |

**当"给模型消费"这几个字开始出现在发布说明里，这就不是观察，而是既成事实了。**

### 但这里有个反转，必须说

同样是官方 README，在 2026 年给出了一个降温的说法。playwright-mcp 现在推荐 coding agent 改用 CLI + Skills（[microsoft/playwright-cli](https://github.com/microsoft/playwright-cli)），理由是：

> *"…avoid loading large tool schemas and verbose accessibility trees into the model context."*

**连 accessibility tree 都会被嫌啰嗦。** 这句话反而让整篇文章的论点更稳：被时代选中的从来不是某个功能，而是"把网页表示成结构化语义"这件事本身。因为只有结构化的东西才能被裁剪、被检索、被压进预算。

### 数据上也看得到

| 包（npm，周下载，2026-09-10 ~ 09-16） | 下载量 |
|---|---|
| `@playwright/mcp` | 597 万 |
| `@modelcontextprotocol/server-puppeteer` | 2.7 万 |

220 倍。这个差距其实不在功能层面，它是生态位层面的差距：这一代 agent 想做浏览器操作时，默认的落脚点已经只剩一个了。

## 四、换代的证据：数据、曲线，和守势的一方

前面讲的是"设计"。但设计得好不等于被采用。所以还得看数据。以下数据其实都是 2026-09-19 抓的。

### 交叉点已经过去了

[State of JS 2025](https://2025.stateofjs.com/en-US/libraries/testing/)（13,002 人，调查期 2025-09-24 ~ 11-11）：

| | 使用率 | 留存率 | 备注 |
|---|---|---|---|
| Playwright | 50% | 94% | 2024 年是 36%，+14pp，官方称与 Vitest 并列最大涨幅 |
| Cypress | 47% | 57% | 2022 年留存是 84% |
| Puppeteer | 42% | 70% | |
| Selenium | 37% | 24% | 2022 年留存是 42% |

**2025 年是 Playwright 使用率第一次超过 Cypress。** 但比使用率更值得看的，倒是留存：94% 对 57%。

### 当下这一周的量级差

第三节那张年度表看的是趋势，这一周的横向差距更直接（npm 周下载，2026-09-10 到 09-16，取自 [npm registry API](https://api.npmjs.org/downloads/point/last-week/playwright)）：

```
每格 ≈ 500 万次下载

playwright          =================
puppeteer           ==
cypress             =
selenium-webdriver  -     （不足一格）
```

对上 Puppeteer 是 8 倍，对 Cypress 是 14 倍，对 Selenium 的 JS 绑定是 47 倍。换了赛道以后，它们已经不在一个量级上了。

### 一个反直觉的数字

按 star 数看，这两个倒是几乎打平：

| 仓库 | star（2026-09-19） | 建仓 |
|---|---|---|
| microsoft/playwright | 96,334 | 2019-11 |
| puppeteer/puppeteer | 95,593 | 2017-05 |
| cypress-io/cypress | 51,019 | 2015-03 |
| SeleniumHQ/selenium | 34,499 | 2013-01 |

**star 数说明的是"有多少人觉得它值得收藏"，不是"有多少人用它"。** 星标打平、下载量差 8 倍，这个剪刀差本身就是"工具定位不同"的最直观证据：Puppeteer 仍然是抓取和脚本的第一选择，只是那条赛道上没有"测试"这件事。

### 守势的一方，其实都在动

说"Cypress 完了"，其实既不准确也不厚道。事实是：它在下滑，但没停。

- 2024-06-13，Cypress 官方发了一篇《[Update on Cypress's Workforce](https://www.cypress.io/blog/update-on-cypresss-workforce)》：裁员 11 人，目标是加速现金流平衡、为 C 轮做准备。
- 2026-09-01，[Cypress 16](https://www.cypress.io/blog/cypress-16-faster-tests-starting-with-http2-support) 照常发布（HTTP/2 默认、Node 24 / Electron 41 / Chromium 146）。
- 它把赌注押在 AI 上：[UI Coverage](https://www.cypress.io/blog/introducing-ui-coverage)（2024-07）→ [AI 生成测试](https://www.cypress.io/blog/add-your-missing-tests-faster-with-test-generation-in-ui-coverage)（2025-05）→ 文档新增 [Work with AI agents](https://docs.cypress.io/ui-coverage/work-with-ai-agents)，把覆盖率报告当成 agent 的上下文。
- 还有一招很能说明姿态：官方出了一份《[Playwright → Cypress 迁移指南](https://docs.cypress.io/app/guides/migration/playwright-to-cypress)》。

准确的说法是：**相对动能下滑 + 转入守势**，不是停更。

Selenium 也一样还在跑（4.49，2026-09-09 发布），只是它的留存率数据（37% 使用率、24% 留存）把痛点写在了脸上：那些痛点正是"等待和会话"这两件它当年留给用户的事。

### 口径声明（这段必须读）

- npm 下载量包含 CI 里的重复安装、镜像同步和间接依赖，它其实只是量级指标，不是用户数。`playwright` 这个包还被大量用于抓取，不全是测试。
- 有一个数字其实是反过来的，得摆出来：按 [ecosyste.ms](https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/playwright) 统计，cypress 被 6,559 个包反向依赖，playwright 只有 1,947 个。下载量赢 14 倍，但"嵌进别人项目里"这件事 Cypress 仍然更多：这就是存量与增量的差别，不写出来就是选择性取证。
- star 数、版本号、下载量倒都是 2026-09-19 的快照。开源世界变脸比翻书快，引用请以当时为准；想自己核一遍的话，不妨跑一下正文里那段探针脚本。

## 五、顺带纠偏：六条流传很广但已经过时的说法

写这类文章最值钱的部分，往往不是"安利"，而是把大家嘴里的旧知识更新一下。以下六条其实都核过一手来源：

| 常见说法 | 实际情况 |
|---|---|
| "Puppeteer 只支持 Chrome" | v23.0.0 起同时支持 Chrome 与 Firefox（Firefox 走 BiDi） |
| "Selenium 近年移交给了 SFC" | 自 2011-02-02 起就是 Software Freedom Conservancy 成员项目，不是"近年" |
| "WebDriver 是 W3C 标准" | 只有 Level 1 是 2018 Recommendation；Level 2 与 BiDi 至今仍是 Working Draft |
| "Browser Use / Stagehand 都是基于 Playwright 的" | 均未见直接依赖：Browser Use 用自研 `cdp-use`，Stagehand 用 `@browserbasehq/sdk`（Skyvern 才是直接依赖 `playwright`） |
| "Cypress 已经停更了" | 2026-09-01 刚发 Cypress 16，仓库持续提交 |
| "Claude Code / Codex / Cursor 官方默认推荐 Playwright" | 未验证。能确认的只有：Playwright 侧提供了这几家的接入命令，反向的官方表态我没找到 |

最后那条我倒是特意留着：**找不到证据的事，就说找不到。**

## 六、什么时候我不选 Playwright

一篇只有正面论证的文章是软文。下面这些反驳我认，而且都有出处。

### 组件测试，我仍然会先看 Cypress

Cypress 为组件测试提供了官方 mounting library 和 bundler 集成（React 18-19、Vue 3、Angular 21-22、Svelte 5，以及 Vite / Webpack / Next.js 的配置）。Playwright 的组件测试到 2026 年才改成 `mount()` fixture + 自建 dev server，还移除了 `experimental-ct-*` 包：迁移成本实打实更高。

### 调试联动性，是 Playwright 的真实短板

这一点倒是值得认真写：Cypress 的测试和应用跑在同一个 JS 事件循环里，所以在 devtools 里下一个断点，两边会一起停住；Playwright 的 runner 和应用则是两个进程，联动调试要麻烦得多。

（口径：这是 Gleb Bahmutov 在 [2025-09-30 的个人博客](https://glebbahmutov.com/blog/cy-vs-pw-browser/)里的观点，不是官方文档结论。但它的确是内行话，值得听。）

### 还有两类场景

- Selenium：6 种语言绑定 + Grid 的大规模编排，是多语言/企业遗留团队的结构性优势，连 Puppeteer 的官方 FAQ 都承认这两件事超出自己范围。
- Puppeteer：纯抓取、轻量脚本。只干一件事的时候，谁也不想先装一个测试运行器。

### 最后，坦白说点我自己的坏话

Playwright 的确不会自动消灭 flaky 测试。我手头一个项目（`apps/dsa-web`，用 `@playwright/test ^1.58.2`）里的 e2e 用例，就同时存在"教科书示范"和"反面教材"：

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

前六节讲的都是"设计"和"数据"。但要真正证明"接口的观众换人了，所以工具换人了"，最硬的证据是：**让同一个模型、用三套工具、做同一件事，看差别。** 这其实就是我上一篇《[给大脑配一副好鞍具](https://springuper.github.io/agent-harness-comparison/)》里用过的方法，这次换个题。

设计（沿用 `agent-harness-bench` 的口径：独立副本、固定提示词、同模型、不改测试文件）

- 任务：一个 Vite + React 小应用，注入 3 个 UI bug，分别是异步提交后列表不刷新 / 防抖搜索竞态 / 弹窗关闭后焦点丢失。
- 三臂：`@playwright/test` 1.63 / Cypress 16 / Puppeteer（用它的 Locator API，不搭稻草人）。
- 指标：首轮通过率、修复轮次、token、耗时、5 次重跑 flake 率，以及一个我自己最想看的新指标，即"第一次失败后，模型定位到根因需要几轮"（这个指标最能量化"报错信息质量"）。
- 对照实验：把同一次失败分别以 ① 原始堆栈 ② Playwright 报错片段 ③ trace + ARIA 快照 喂给 agent，测修复速度差。

结论我会补在这一节，并连同任务源码一起开源：没跑出来的数据不写。

## 八、结语

把全文收进一张表，方便你直接贴到团队文档里：

| | 定位 | 抽象画在哪 | 读者 | 2026 年的处境 |
|---|---|---|---|---|
| Selenium | 跨语言/企业级标准 | 协议层，等待交给人 | 人 | 仍在维护，留存率下滑 |
| Puppeteer | CDP/BiDi 参考实现 | 浏览器控制层 | 脚本作者 | 抓取场景稳固，测试场景不参与 |
| Cypress | 为人设计的测试体验 | 链式 DSL + 浏览器内运行 | 人 | 转入守势，组件测试仍有优势 |
| Playwright | 语义化的浏览器接口 | 语义定位 + 可序列化 + 可回放 | 人，以及模型 | 使用率与留存双第一 |

一句话总结这篇长文：**浏览器是 agent 的手，而 Playwright 恰好是那只手上最适合被握住的接口。**

不过也别把工具当成答案。换一副鞍具不会自动让马跑得更快，文中那些我自己项目里的坏味道就是提醒：真正决定测试质量的，仍然是写它的人怎么想。

这篇里的数据我核了两遍，但开源世界变化快，难免有疏漏；我对 Playwright 的用法也还在摸索，谈不上什么最佳实践。如果你在迁移路上踩到了不一样的坑，或者发现文中哪里写错了，欢迎指出、欢迎交流。也可以不妨拿自己项目里最 flaky 的那条用例试一遍，再回来说说体会。权当这篇是一次公开的读书笔记，能对你有点用，就算是额外的收益了。

### 彩蛋

文章里我最喜欢的一处证据其实不是数据，而是那段报错。

那份报错把 20 个候选元素的"正确答案"一条条列出来，再配上一个叫 **Copy prompt** 的按钮。**它等于在明说：我知道你要把我这段话粘给谁看。**

一个工具用了六年时间，终于把自己的错误信息写成了一份 prompt。我写这篇文章的时候，用的也是同一个思路：把话说清楚，让下一个读者（不管是人还是模型）能直接照着干活。

其实还有个更小的彩蛋：Playwright 判定元素"可点"的四个条件里，`opacity: 0` 被算作可见。也就是说，一个完全透明的按钮，工具认为你可以点它。这条定义来自官方文档，我第一次读到时，大概盯着看了三遍。人类的直觉说"看不见就是没有"，而协议的直觉说"它有框、能命中，那就是存在"。抽象层的分歧，往往就在这种一行的细节里。

---

## 参考

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

延伸阅读（我自己的前两篇）：

- 《[给大脑配一副好鞍具：五款 Agent Harness 的解剖与实测](https://springuper.github.io/agent-harness-comparison/)》：五款 harness 的横评与实测
- 《[积木，而非成品：Pi Agent Harness 的克制与精妙](https://springuper.github.io/pi-harness-anatomy/)》：单款 harness 的逐层解剖

观点来源（已标注为个人观点）：

- [Cypress vs Playwright; Browser Included — Gleb Bahmutov](https://glebbahmutov.com/blog/cy-vs-pw-browser/)

> 版本与核实说明：文中数据抓取于 2026-09-19，工具版本为 Playwright 1.63.0、Cypress 16、Selenium 4.49，Puppeteer 取官方 FAQ 与 v23 发布说明。ARIA 探针与那段报错原文是我在本机 Playwright 1.57.0 + Node 24.13.0 上实跑得到的，不是手写示意，探针脚本已内嵌在正文里，可自行复现；第一章里 Selenium、Puppeteer、Cypress 三家的示例代码按各自官方文档的 API 写法整理，未在本机逐一实跑。掌故与沿革类内容（Puppeteer 与 Playwright 的团队渊源、Cypress 的裁员、Selenium 归属 SFC 的时间、WebDriver 各层级的状态）同样按官方文档、官方博客或仓库源码核过；凡官方没有量化声明的地方，文中都写明了那是我自己量的。开源世界变化快，版本号与下载量都只是快照，引用请以当时为准。
