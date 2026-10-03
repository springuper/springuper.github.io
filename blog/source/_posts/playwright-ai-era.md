---
layout: post
title: "接口的观众：浏览器自动化从「一个应用」变成「一层能力」"
date: 2026-09-20 20:00:00
status: draft
published: false
tags:
  - Frontend
  - Playwright
  - Testing
  - E2E
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

同一件事，两份代码。你大概会说：后者好看多了。但好看只是表象，真正被换掉的是别的东西：第一段里得有人判断“睡多久才够”，还得有人维护那串 `nth-child(3)`，第二段里这两件事都交给了工具自己。

这篇文章要回答的，是我自己卡了很久的一个问题：**Cypress 也会自动等待，它的检查项甚至比 Playwright 还多，代码读起来也更舒服，那这一轮换代为什么换掉的会是它？**

老实说，我原本也以为答案在功能表里：Playwright 功能强、生态好。把行业调查、官方发布说明，还有一段我自己跑出来的报错原文摆齐之后，我发现答案不在那儿。

<!--more-->

## 一、同一颗按钮，四种写法

要讲换代，得先知道上一代各自解决了什么问题，以及它们的设计对象是谁。

我用同一件小事来演示：点一颗“600 毫秒后才可用”的提交按钮。下面四段代码都对着这一个页面写，被测文件就是一个存成 HTML 就能直接打开的静态文件：

```html
<!doctype html>
<html lang="zh">
<body>
  <h1>下单</h1>
  <button id="submit" disabled>提交订单</button>
  <p id="result"></p>

  <script>
    // 模拟一个 600 毫秒才回来的接口：这期间按钮是禁用的
    setTimeout(() => { document.getElementById('submit').disabled = false; }, 600);

    document.getElementById('submit').addEventListener('click', () => {
      document.getElementById('result').textContent = '已提交';
    });
  </script>
</body>
</html>
```

判断成没成功只看一件事：最后那行 `<p id="result">` 里有没有出现「已提交」。

![正文那段 fixture 的三个状态：刚打开时按钮禁用、600 毫秒后恢复可点、点下去结果栏才出现「已提交」](../images/order-fixture-states.png)
*被测页面就长这样（Playwright 1.57.0 + Chromium，2026-10-01 实拍，360 像素宽视口）：同一个脚本的三种状态，下面四段代码对着的都是这一张页面*

### Selenium：为「企业的测试生态」设计

要说清 Selenium 是什么，得先看它一开始卡在哪。它 2004 年出生在芝加哥的 ThoughtWorks，最早就是一段跑在浏览器里的 JavaScript，出不了同源策略那道墙：浏览器不许一段脚本去操作另一个域名的页面，跨域和跨窗口就动不了。

为了绕开这道墙，ThoughtWorks 的 Paul Hammant 提了一个“driven 模式”：把浏览器当成远端，用你熟悉的语言从外面发指令，中间再放一台 server 当代理。那台 server 就是 Selenium RC（沿革来自官方的 [Selenium History](https://www.selenium.dev/history/)）。

它和你的代码之间因此隔了一层协议。所以 Selenium 今天其实不是一款软件，而是一份契约加一群实现：一边是 WebDriver 协议（[Level 1 在 2018 年成了 W3C Recommendation](https://www.w3.org/TR/webdriver1/)），另一边是各家浏览器厂商提供的 driver 和语言绑定。

契约式设计的好处是覆盖面，而且这份覆盖面不由任何一家供给。六种语言绑定（Java、Python、C#、Ruby、JavaScript、Kotlin）让后端用 Java、数据用 Python 的团队不必为了统一测试工具去统一技术栈。

Grid 把测试分发到几十台机器上并行跑，这部分别的工具基本不碰，Puppeteer 官方 FAQ 就明说 Grid 超出它范围；不想自己搭基建的，云厂商会[按协议供货](https://www.selenium.dev/sponsor/)，BrowserStack、TestMu AI 都是官方列的 Development Partner。这份覆盖面之所以成立，是因为它不属于任何一家浏览器厂商。**所谓“面向企业的测试生态”，说的就是这些：那些能力不是它的功能，是它的生态。**

代价也在同一句话里：契约不替你管会话和等待，那些就落在使用者手上。[官方文档](https://www.selenium.dev/documentation/webdriver/waits/)写得很直白：显式等待是“loops added to the code that poll the application for a specific condition to evaluate as true before it exits the loop”，说白了就是一段写在代码里、反复轮询到条件成立的循环。

拿那颗按钮写一遍，是一份完整的 Java 文件（Selenium 4 的写法，import 那一堆先略掉）：

```java
public class OrderTest {
    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver();
        driver.get("file:///path/to/order.html");

        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(5));
        WebElement submit =
            wait.until(ExpectedConditions.elementToBeClickable(By.id("submit")));
        submit.click();

        String result = driver.findElement(By.id("result")).getText();
        System.out.println("页面上的结果：" + result);
        driver.quit();
    }
}
```

要看的只有一行：`wait.until(...)`。“按钮什么时候可点”这件事，是你**显式写出来**的。顺便说一句，Selenium 官方“等待”那一页自己就摆了一个叫 `sleep()` 的例子，里面写的是 `Thread.sleep(1000)`：文档自个儿把这件事认了。

所以就有了第一代前端测试工程师的必修课：`sleep` 多久才够。这门课的挂科率，的确就是后来所有人嘴里的 flake。

### Puppeteer：为「脚本作者」设计

Puppeteer 是 2017 年从 Chrome 团队长出来的，本质是 Chrome DevTools Protocol（CDP）的一层封装，使用者画像很清楚：写脚本的、做抓取的、需要精确控制浏览器的。

它其实从来就不是测试框架。[官方 FAQ](https://pptr.dev/faq) 到今天仍这么定位自己：由 Chrome Browser Automation team 维护，是 CDP / WebDriver BiDi 的参考实现；连“是不是 Selenium 的替代品”都是 FAQ 里的一个问题，答案是多语言绑定和 Grid 这类编排能力“beyond Puppeteer's scope”。想要测试的便利，社区方案是另外装 `jest-puppeteer`。

顺带交代一段掌故。Playwright 是微软的项目，但写它的人和 Puppeteer 是同一批，原来都在 Google 做 Puppeteer。他们另起炉灶的原因是想要的东西在旧 API 上做不出来，官方原话是 *"All the changes and improvements above would require breaking changes to the Puppeteer API, so we chose to start with a clean slate instead."*（这段文字随 README 的 FAQ 段在 2020 年 4 月被删掉了，现在只能从[仓库历史](https://github.com/microsoft/playwright/commit/9bd55e9364907eb6ce16c694843ab8cb313c38eb)里读到。）不是外人来挑战，是一家人自己觉得原来那套抽象不够用了。

同一颗按钮，它的完整脚本是这样（Node，装上 puppeteer 就能跑）：

```js
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('file:///path/to/order.html');

  await page.waitForFunction(() => {          // 判据得自己写
    const btn = document.querySelector('#submit');
    return btn && !btn.disabled;
  });
  await page.click('#submit');

  const result = await page.$eval('#result', (el) => el.textContent);
  console.log('页面上的结果：' + result);
  await browser.close();
})();
```

输出：

```text
页面上的结果：已提交
```

把中间那三行 `waitForFunction` 删掉会怎样？我把这一版也真跑了一遍：

```text
页面上的结果：""
```

点了，但的确什么也没发生：按钮还是禁用状态，浏览器把这次鼠标事件直接吞了。脚本没有报错，它只是“点过了”罢了。判据得人写，最后那句断言还得另外装 jest 才有，这就是“参考实现，而不是测试框架”落在代码上的样子。

### Cypress：为「人的开发者体验」设计

Cypress 是 2015 年出现的，野心很不一样：把测试写成一件愉快的事。链式 DSL 读起来像英语，测试跑在浏览器里，还有一个能“时间旅行”的界面：鼠标悬停在某一步，左侧就是当时那一刻的 DOM 快照。

在“给人用”这件事上，它的确做到了极致。而且有个细节大概会让很多人意外：它的 actionability 检查项**比 Playwright 还多**（visible / disabled / detached / readonly / animations / covering / scrolling，七项，比后者四项多），它也会盯着 DOM 不断重跑查询（[官方原文](https://docs.cypress.io/app/core-concepts/interacting-with-elements)：*"Cypress will watch the DOM - re-running the queries that yielded the current subject…"*）。

“Cypress 不会自动等待”是流传很广的说法，不妨自己验一下。我本来打算照抄，实测之后改了主意。我写了一个完全不带等待的用例：

```js
cy.visit('/order.html');
cy.get('#submit').click();                       // 不写任何等待
cy.get('#result').should('have.text', '已提交');
```

它倒是通过了，耗时 846 毫秒：600 毫秒后按钮一可用，点击才落下去。等待这件事，它和 Playwright 一样有。两者真正的边界写在官方那句[原文](https://docs.cypress.io/app/core-concepts/retry-ability)里：*"Only queries are retried… commands themselves only execute once"*，这句管的是**命令失败之后**要不要重来，不是“动作之前等不等”，其实读成后者就偏了。

回到那颗按钮，一份完整的用例长这样（比上面那版多了一条显式断言）：

```js
describe('下单', () => {
  it('提交订单', () => {
    cy.visit('/order.html');
    cy.get('#submit').should('not.be.disabled');
    cy.get('#submit').click();
    cy.get('#result').should('have.text', '已提交');
  });
});
```

跑 `npx cypress run --spec cypress/e2e/order.cy.js`，输出末尾是这样（节选）：

```text
  1 passing (799ms)
    ✔  All specs passed!
```

代码倒是三家里看着最舒服的，但代价在别处：它必须有真正的浏览器外壳才能跑起来。我这次装完，`node_modules/cypress` 只有 7.3 MB，真正的执行体是它下载到缓存里的 641 MB 应用：测试是被这个应用带着跑的，而不是被一行 `require` 拉起来的库。

**最后这半句，是下一节的入口。**

### 一张图收束

```
              给人读      给机器读
抽象层级高    Cypress     Playwright
抽象层级低    Selenium    Puppeteer
```

四个人都在“自动化浏览器”这一格，但各自把抽象画在了不同的高度、面向了不同的读者。同一颗按钮、四段代码，差别倒是不在语法糖，而在把哪一层抽象留给你自己。

不过这张图倒是解释不了换代：**在“工具自己判断条件”这件事上，Cypress 和 Playwright 是同一档的**，它甚至在检查项上更多。所以换代的原因不在这里。下面两节分头回答两个问题：Playwright 凭什么赢，以及为什么偏偏是这两年。

## 二、一个应用，还是一层能力

上一节 Cypress 留下了一句话：测试是被那个 641 MB 的应用带着跑的，不是被一行 `require` 拉起来的库。我一开始其实把它当成一条成本记下来，后来才发现这是全文最重要的一条线索：**它说的不是体积，是形态。**

看它的官方模块 API 就明白了。文档里一共只有三个函数：`cypress.run()`、`cypress.open()`、`cypress.cli.parseRunArguments()`（见 [Module API](https://docs.cypress.io/app/references/module-api)）。你能用 Node 启动一次测试运行，但拿不到一个页面：没有 `page`，没有 `browser`，没有任何能在自己进程里操作的对象。

Playwright 反过来。`@playwright/test` 是一个测试 runner，但它建在 `playwright-core` 这个库上，`chromium.launch()` 在任何 Node 进程里都能跑起来：你可以在自己的脚本里开一个浏览器，做三件事，关掉，全程不进任何 runner。

这件事 Cypress 自己的文档解释得更清楚：*"Cypress is executed in the same run loop as your application."*（见 [Why Cypress](https://docs.cypress.io/app/get-started/why-cypress)）它把驱动注入浏览器，和被测应用共用同一个事件循环。这个设计换来了很好的调试体验（后面会替它说话），代价是它只能以“一个应用”的形式存在：你得进到它里面去写测试。

**能当零件用，还是只能当整机用，这才是 Cypress 和 Playwright 的分界线。** 把它摆到功能表旁边，你会发现这条线上挂着三样东西。

### 第一样：一层能力可以供多个消费者

同一份接口既能写测试，又能写脚本，还能喂给 agent。下载量上有个很直白的痕迹：`playwright` 这个包的量级远高于任何测试框架该有的水平，因为它同时被抓取、脚本和各种自动化工具在用。

反过来看更能说明问题：playwright-mcp 能在 2025 年 3 月被建起来，前提就是 Playwright 在别人的进程里跑得起来。Cypress 做不了这件事，不是没人写，是它的形态不允许。

### 第二样：失败是一个可以被传递的工件

测试失败时，Playwright 给你一个 `trace.zip`，里面装着[每一步的动作与耗时、动作前后的 DOM 快照、截图、源码、日志和网络记录](https://playwright.dev/docs/trace-viewer)。

它把“一次性现象”变成了一个文件：能塞进 CI 产物，能在别人机器上打开，从 1.59 起还能直接用命令读（`npx playwright trace`）。这里不妨先说人的收益，因为它跟 AI 没关系：以前 CI 挂了，你得把那台机器复现出来；现在工件跟着失败一起被存下来。至于模型也能读它，那是顺带的。

### 第三样：库层面的能力可以被组合

并行倒也是一个例子：`--shard` 和多 worker 都自带，不用另外接一套编排服务。

内核是更硬的一个例子，也是这套形态的最大代价所在。Chromium、Firefox、WebKit，这次不是“分别适配”，而是同一套 API。我本机上装着的的确就是三个真内核：

```
~/Library/Caches/ms-playwright/
├── chromium-1200
├── firefox-1497
└── webkit-2227     # 真 WebKit，不是换皮
```

这里的“一视同仁”指三个内核都由同一套 API 一等公民地支持，不是“能不能跑起来”：Cypress 的 WebKit 至今标着 experimental，Puppeteer 干脆没有 WebKit。至于“开个 flag 就能驱起来”那个误解，其实得分三层看：

- 语言绑定和浏览器之间隔了一个进程。你在 JS、Python、Java 里调的是同一份实现，它启动一个独立的 driver 子进程，再通过 Playwright 自有协议（定义在仓库的 `packages/protocol/spec/*.yml`）跟它说话。所以它既不是 WebDriver 的又一家绑定，也不是 CDP 的封装。
- 每个内核各走一条通道：

| 内核 | 通道 | 说明 |
|---|---|---|
| Chromium | CDP | 用开源 Chromium 构建，能力直接来自上游 |
| Firefox | 打了补丁的 `-juggler-pipe` | 官方文档原话：Playwright 依赖补丁，用不了品牌版 Firefox |
| WebKit | `--inspector-pipe` | 仓库 `browser_patches/` 下同时维护 firefox 与 webkit 两套补丁 |

- 最关键的一层：它自己编译并维护内核。上面那两个 flag 不是“开关”，而是**只有打过补丁的构建里才存在的通道**。Playwright 每次发版同步更新三个内核的版本，`npx playwright install` 下载的就是这些自定义构建，我本机这份缓存已经 1.0 GB（chromium 324 MB、webkit 275 MB、firefox 253 MB，另有 headless shell 与 ffmpeg）。

那为什么别人做不到？其实不是开不了 flag，是改不了内核。Cypress 的架构决定了它不往这个方向走：驱动注入浏览器、与被测应用同处一个事件循环，这条路要求内核允许注入，而它无法自带打了补丁的 WebKit。反过来说，同一个原因也让它的 devtools 联动调试更顺手，断点能把测试和应用一起停住。这条是 Gleb Bahmutov 的[个人观点](https://glebbahmutov.com/blog/cy-vs-pw-browser/)，不是官方结论。

Puppeteer 的定位是 CDP 的参考实现，不需要改内核，也就不会去改。Selenium 走 W3C 协议，每个内核能做什么由厂商说了算。

代价也说清楚：这套“连内核一起维护”的赌注，换来了三内核一致和额外的自动化能力，付出的是每次升级都要重下几百 MB 的自定义浏览器，外加内核补丁的长年维护。官方在 `connectOverCDP` 的文档里留下一句很能说明态度的话：直连 CDP 的保真度 *"significantly lower fidelity than the Playwright protocol connection"*。

> 口径：架构部分来自官方文档与仓库源码。“Juggler”这个词官方文档从不使用，只出现在源码与补丁目录里，属于源码级证据，别当成官方术语引用。

**这三样东西合起来，说的是同一件事：可嵌入不是一个附加用法，它决定了这个接口能不能成为别人的零件。** 这件 2020 年就成立的事，要等到 2024 年才变成决定性的优势，原因是第三件事。

## 三、转折点：读者换人了

上一节讲的是“它能不能被别的程序调用”。这一节要讲的是，当调用它的那个程序是模型时，接口还得满足什么。答案有三条，其实都不是新加的，只是过去没人从“读者是谁”这个角度看它们。

### 结构化 > 像素

2025 年 3 月，微软把 Playwright 包成了一个 MCP server（[playwright-mcp](https://github.com/microsoft/playwright-mcp)，建仓到 2026-09-19 已 37,727 star）。它的 README 第一段就把立场说透了：

> *"enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models."*

再看它给模型的工具描述，更直接：`browser_snapshot` 的说明是 *"this is better than screenshot"*，而 `browser_take_screenshot` 的说明是 *"You can't perform actions based on the screenshot"*。（视觉能力要显式开：`--caps=vision`。）

用量上也看得出来：`@playwright/mcp` 的周下载是 597 万，而官方那个 Puppeteer MCP server 只有 2.7 万，差 220 倍。这一代 agent 想做浏览器操作时，默认的落脚点其实只剩一个了。

那“结构化”到底省了多少？官方没有给过量化声明，所以我干脆自己量了一次：构造一个组件库风格的页面（20 行表格、class 哈希、内联 style、`__NEXT_DATA__`），用 `locator.ariaSnapshot()`（[官方叫 ARIA snapshots](https://playwright.dev/docs/aria-snapshots)）取同一页面的两种表示：

| 表示 | 字符数 |
|---|---|
| `page.content()` 的 HTML | 12,805 |
| ARIA 快照 | 2,286 |
| 比例 | 17.9% |

但体积其实只是副产品，形态才是重点。ARIA 快照里长这样：

```
- heading "订单工作台" [level=1]
- form "筛选":
  - textbox "关键词":
    - /placeholder: 输入订单号
  - combobox "状态":
    - option "全部" [selected]
- row "SO-1001 张三 ¥1,280.00 待发货"
```

没有 `css-1x1q7`，没有 `ant-table-cell`，没有构建产物留下的哈希。模型拿到的是词汇表（role、name、state），而不是渲染残渣，这恰好就是 `getByRole` 需要的输入：同一个抽象层，人和模型都能读。想自己量一次的话，不妨动手试试，三行就够（`npm i -D playwright && npx playwright install chromium` 之后）：

```js
// aria-probe.mjs：打印任意页面的「模型视角」
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('https://你的目标页面');

console.log('HTML 字符数:', (await p.content()).length);
console.log('ARIA 字符数:', (await p.locator('body').ariaSnapshot()).length);
console.log(await p.locator('body').ariaSnapshot());   // 这行就是模型看到的东西
await b.close();
```

![左边是页面渲染出来的样子（像素），右边是同一个页面的 ARIA 快照（结构）](../images/aria-vs-pixels.png)
*同一个页面、同一时刻的两种表示：左边是人看到的像素，右边是模型读到的结构（Playwright 1.57.0，2026-10-01 复现并截图；左图是 620 像素宽视口的页面顶部 8 行）*

### 确定性 > 视觉启发式

MCP 的 README 里还有一句我很喜欢的话，几乎是这个时代的判词：*"Deterministic tool application. Avoids ambiguity common with screenshot-based approaches."*

“确定性”这三个字看着朴素，但对 agent 是生死攸关的：**它决定了模型的动作能不能被复盘、被重放、被自动化验证。** 视觉方案里“点这里”是一个坐标，语义方案里“点这里”是一个角色加一个名字，后者可以被断言、被 diff、被写进回归测试。

这恰好是 Playwright 最出名的那一点，只是流传的版本常常不准确。它不是“加了等待”，是把人的经验写成了可判定的条件。官方叫 [actionability](https://playwright.dev/docs/actionability)，动作执行前，工具自己等这些条件全部成立：

| 条件 | 官方定义（人话版） |
|---|---|
| Visible | 有非空 bounding box，且不是 `visibility: hidden`；`opacity: 0` 算可见 |
| Stable | 连续两帧 bounding box 不变（还在动的元素不点） |
| Receives Events | 命中测试时这个点上真的是它，不是被别的元素盖住 |
| Enabled | 没 `disabled`，祖先也没有 `aria-disabled` |

“连续两帧不变”这种抠到帧的定义，是我见过对“把经验变成接口”最字面的注解：**它把老工程师嘴里那句“等它别动了再点”直接写成了代码。**

这里不妨补一句公道话：这套检查 Cypress 也有，而且更多（它比这四个多出 detached、readonly、covering 三项）。所以 actionability 不是 Playwright 赢 Cypress 的地方，它赢的是上一代：Selenium 和 Puppeteer 把判据留给人写，而这两家都把它变成了默认行为。

说得再顺口，也不如跑一次。回到第一节那颗按钮，Playwright 的完整脚本是这样（装好 playwright 并 `npx playwright install chromium` 就能跑）：

```js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file:///path/to/order.html');

  const started = Date.now();
  await page.getByRole('button', { name: '提交订单' }).click();

  console.log(`点击完成，用时 ${Date.now() - started} 毫秒`);
  console.log('页面上的结果：' + await page.locator('#result').textContent());
  await browser.close();
})();
```

输出：

```text
点击完成，用时 858 毫秒
页面上的结果：已提交
```

和第一节比一比：Puppeteer 那三行 `waitForFunction` 不用写，Cypress 也没快多少（846 对 858 毫秒），差别不在“等不等”，而在这一行 `click()` 自己就把等待包了进去。同样是点这颗按钮，我给三种点法做了对照：

| 点法 | 页面结果 | 说明 |
|---|---|---|
| 按坐标立刻点 `page.mouse.click(x, y)` | `（未提交）` | 按钮还禁用着，真实鼠标事件被吞掉 |
| `locator.dispatchEvent('click')` | `（已提交）` | 事件绕过了检查，看着成功，其实是假成功 |
| `getByRole('button').click()` | `（已提交）`，等了 858 毫秒 | 条件成立才动手 |

![同一颗按钮的三种点法：按坐标点没反应、dispatchEvent 假成功、getByRole 等到条件成立才点](../images/three-clicks.gif)
*录制自真实运行（Playwright 1.57 + Chromium）：① 按坐标点，按钮还在禁用态，什么也没发生；② `dispatchEvent` 把事件直接发进去，结果栏变绿，其实是假成功；③ `click()` 等到按钮可用才动手*

第三行等了 858 毫秒，倒不是白等，它在等条件成立。但更值得琢磨的是第一行和第二行的对比：**不做检查的自动化，最危险的地方不是失败，而是它能给你一个假成功。** 一个“禁用状态也照样点进去”的脚本会在 CI 里一直绿着，直到上线被真实用户教做人。

### 可重放 > 一次性

先说一个看起来很小、其实很关键的定义问题。`page.getByRole('button', { name: '提交' })` 返回的不是元素引用，而是一句描述，官方定义是“一种在任何时刻都能找到元素的方式”，它是惰性重解析的（见 [Locators 文档](https://playwright.dev/docs/locators)）。反过来，`ElementHandle` 倒是被官方文档[标上了 Discouraged](https://playwright.dev/docs/handles)（不推荐）。

这个区别倒不是审美：**描述可以重试、可以序列化、可以跨进程传递、可以直接印在报错里。** 差别有多大？我拿同一颗按钮做了次实验：把 class 从构建哈希 `btn-primary-9f2c1a` 改成 `btn-primary-4b8e77`，模拟一次重新构建，再跑两种写法。

| 写法 | 重构之后 |
|---|---|
| `page.click('.btn-primary-9f2c1a')` | ❌ `Timeout 1200ms exceeded` + `waiting for locator('.btn-primary-9f2c1a')` |
| `page.getByRole('button', { name: '提交订单' })` | ✅ 照样命中 |

不过语义定位有个前提，得说清楚：`getByRole` 不是凭空知道“这是个按钮”的，它读的是浏览器的可访问性树。原生标签自带隐式 role（`<button>`、`<a href>`、`<input type="checkbox">`），自定义组件就得自己补上 `role` 和可达名称。我拿一个只用 `<div onclick>` 拼的按钮试过：

```
getByRole('button').count()   →  0        # div 汤里没有"按钮"这个语义
ARIA 快照里的那一项            →  - text: 提交订单   # 降级成一行普通文本
补上 role="button" 之后         →  1
```

所以这条路对页面是有要求的：**你的界面得先有语义。** 这听着像额外成本，其实是一鱼三吃，同一套标记同时喂饱三件事：屏幕阅读器、`getByRole`，以及 agent 读到的 ARIA 快照。我手头项目的 e2e 里就有一条断言：关键操作要有 `aria-label`，不要用 `title`。

语义化之后，“可重放”才有了载体。真正让我改变判断的，是下面这段报错原文。这是我本机跑 Playwright 1.57.0（Node 24）时真抓到的，我构造了一个 20 行订单列表，然后故意用模糊定位去点它：

```
locator.click: Error: strict mode violation: getByRole('button', { name: '查看' }) resolved to 20 elements:
    1) <button aria-label="查看订单 SO-1001 详情" ...> aka getByRole('button', { name: '查看订单 SO-1001 详情' })
    2) <button aria-label="查看订单 SO-1002 详情" ...> aka getByRole('button', { name: '查看订单 SO-1002 详情' })
    3) <button aria-label="查看订单 SO-1003 详情" ...> aka getByRole('button', { name: '查看订单 SO-1003 详情' })
    ...
```

不妨仔细看它的结构。它不只是说“你错了”：它说明了为什么错（匹配到 20 个），给出了每个候选的真实身份，最关键的是那句 `aka`，把改正后的 locator 写法一条条列给你了。这不是给人看的礼貌提示，这是一份**写好的补丁**。而且这大概不是巧合：从 1.51 起，Playwright 在 HTML 报告、Trace Viewer 和 UI Mode 的报错旁都放了一个按钮，叫 Copy prompt（见[发布说明](https://playwright.dev/docs/release-notes)）。

![Playwright HTML 报告里的同一条报错：Errors 面板列出候选，右上角是 Copy prompt 按钮](../images/report-copy-prompt.png)
*同一个用例在 HTML 报告里的样子（Playwright 1.57.0，2026-10-01 实跑）：报错正文、候选列表和那个 Copy prompt 按钮挤在同一块面板里*

它和 Trace Viewer 也是长在一起的：

![Playwright Trace Viewer：左侧动作列表里那步失败的点击被标红选中，右侧是当时的页面快照，底部 Errors 面板里是报错正文与 Copy prompt 按钮](../images/trace-viewer.png)
*Trace Viewer 实拍：失败的那步 Click 被标红选中，右边是它当时的页面快照，底部 Errors 面板给出报错正文（连 20 个候选都列出来了）和一个 Copy prompt 按钮。这份 trace 跑于 2026-09-19，Playwright 1.57.0，页面就是前面那个 20 行的订单列表*

修复的前提是复现：一个失败如果只活在那台机器上，换个人（或者换个 agent）就只能靠猜。好在它现在有了载体，现场在 `trace.zip` 里，该点哪儿写在 locator 里。于是同一个失败能在 CI 上产生，在本地打开，也能被另一个程序读。

**可序列化不是“能被自动修复”的保证，但它是前提。**

### 官方自己早就动手了

把这些动作排到时间线上，比任何观点都有说服力（来源：[发布说明](https://playwright.dev/docs/release-notes)，日期取自 npm registry 的发布时间）：

| 版本 | 时间 | 与“给模型用”有关的动作 |
|---|---|---|
| 1.49 | 2024-11-18 | `toMatchAriaSnapshot` 断言落地 |
| 1.51 | 2025-03-06 | 报错旁出现 Copy prompt 按钮 |
| 1.56 | 2025-10-06 | [Test Agents](https://playwright.dev/docs/test-agents)（planner / generator / healer） |
| 1.57 | 2025-11-25 | 移除 `page.accessibility`，把能力收拢到结构化快照上 |
| 1.59 | 2026-04-01 | `npx playwright trace`：命令行里分析 trace，给 agent 用 |
| 1.60 | 2026-05-11 | 给快照加 `boxes` 选项，官方措辞：*"useful for AI consumption"* |
| 1.62 | 2026-07-24 | 把 MCP server 与 playwright-cli 打包进来（`npx playwright mcp`） |
| 1.63 | 2026-09-04 | trace 里记录 aria 快照，Trace Viewer 新增 Display Aria 模式 |

最后一行是这篇文章快定稿时才发出来的，我觉得它比表格里任何一行都贴题：**它让 trace 和 aria 快照（两份都是给机器读的东西）在同一个界面里合流了。**

**当“给模型消费”这几个字开始出现在发布说明里，这就不是观察，而是既成事实了。**

不过这里有个反转得说。同样是官方 README，在 2026 年给出了一个降温的说法：playwright-mcp 现在推荐 coding agent 改用 CLI + Skills（[microsoft/playwright-cli](https://github.com/microsoft/playwright-cli)），理由是 *"…avoid loading large tool schemas and verbose accessibility trees into the model context."*。**连 accessibility tree 都会被嫌啰嗦。**

这句话反而让整篇文章的论点更稳，但得说清楚它稳在哪：前面我量出 ARIA 快照比 HTML 小 5.6 倍，官方现在又说它依然太占地方。两件事不矛盾，因为被时代选中的从来不是“小”，而是**可裁剪**：2,286 个字符照样塞不进上下文，但它可以被切片、按需取一部分，HTML 那 12,805 个字符不行。

## 四、什么情况下我不换

第二、三节都在讲 Playwright 拿到了什么。“一层能力”这个说法其实有个副作用：容易被读成“应用的形态过时了”。所以这里得把边界补上，顺便回答开头那个问题。

**组件测试，我仍然会先看 Cypress。** 它有官方的 mounting library 和 bundler 集成（React、Vue、Angular、Svelte 都有）。Playwright 的组件测试到 1.62 才换成 `mount()` fixture 加自建 dev server 的 stories 模型，1.63 又宣布三个 `experimental-ct-*` 包不再更新。对以组件为主的团队来说，迁移成本是实打实的。

**调试联动性，是 Playwright 的真实短板。** Cypress 的测试和应用跑在同一个 JS 事件循环里，在 devtools 里下一个断点，两边会一起停住；Playwright 的 runner 和应用则是两个进程，联动调试要麻烦得多。（口径：这是 Gleb Bahmutov 的[个人观点](https://glebbahmutov.com/blog/cy-vs-pw-browser/)，不是官方结论，但的确是内行话。）

**另外两类场景也别硬换**：Selenium 的六种语言绑定加 Grid 编排，是多语言或企业遗留团队的结构性优势；纯抓取和轻量脚本，谁也不想先装一个测试运行器，Puppeteer 在这条路上仍然稳。

还有一件得坦白说：Playwright 不会自动消灭 flaky 测试。我手头那个用 `@playwright/test` 的项目里就留着反面教材：

```ts
const firstHistoryItem = page.locator('.home-history-item').first();
await page.waitForTimeout(1000);
```

`waitForTimeout(1000)` 和开头那个 `sleep(800)` 是同一种东西，只是换了个更时髦的名字。**换工具不会消灭 flake，它只是把 flake 从“语言层面”挪到了“用法层面”。** 换一副鞍具也不会自动让马跑得更快（“鞍具”这个说法来自上一篇横评《[给大脑配一副好鞍具](https://springuper.github.io/agent-harness-comparison/)》，再往前那篇《[积木，而非成品](https://springuper.github.io/pi-harness-anatomy/)》拆的是同一个问题的另一个样本）。

所以这一节的结论是：**Cypress 不是被打败的，是被“换了用法”绕过去的。** 你如果只写给人看的组件测试，它仍然是好选择；你要的如果是一层能被别的程序消费的能力，那现在只有 Playwright 够用。这两件事不是同一个问题的两个答案，是两个问题。

## 五、把数字摆齐

坦白说，设计讲完了还得看它有没有被采用。以下数据都是 2026-09-19 抓的。

[State of JS 2025](https://2025.stateofjs.com/en-US/libraries/testing/)（13,002 人，调查期 2025-09-24 到 11-11）：

| | 使用率 | 留存率 | 备注 |
|---|---|---|---|
| Playwright | 50% | 94% | 2024 年是 36%，+14pp，官方称与 Vitest 并列最大涨幅 |
| Cypress | 47% | 57% | 2022 年留存是 84% |
| Puppeteer | 42% | 70% | |
| Selenium | 37% | 24% | 2022 年留存是 42% |

**2025 年是 Playwright 使用率第一次超过 Cypress。** 比使用率更值得看的倒是留存：94% 对 57%。横截面上的量级差距更直接（npm 周下载，2026-09-10 到 09-16，取自 [npm registry API](https://api.npmjs.org/downloads/point/2026-09-10:2026-09-16/playwright)）：

```
每格 ≈ 500 万次下载

playwright          =================
puppeteer           ==
cypress             =
selenium-webdriver  -     （不足一格）
```

对上 Puppeteer 是 8 倍，对 Cypress 是 14 倍，对 Selenium 的 JS 绑定是 47 倍。还有个反直觉的数字：按 star 看，playwright 96,334 颗，puppeteer 95,593 颗，几乎打平。**star 数是“多少人觉得它值得收藏”，不是“多少人在用”**，星标打平、下载量差 8 倍，这个剪刀差就是“工具定位不同”最直观的证据：Puppeteer 还是抓取和脚本的第一选择，只是那条赛道上没有测试。

说“Cypress 完了”，其实既不准确也不厚道。它在下滑，但没停：2024 年[裁员 11 人](https://www.cypress.io/blog/update-on-cypresss-workforce)，2026-09-01 照常发布 [Cypress 16](https://www.cypress.io/blog/cypress-16-faster-tests-starting-with-http2-support)；这两年它一直在 AI 上押注，甚至出了一份《[Playwright → Cypress 迁移指南](https://docs.cypress.io/app/guides/migration/playwright-to-cypress)》。守势是真的，停更不是。

还有一条数字是反过来的，得摆在这儿：按 [ecosyste.ms](https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/playwright) 统计，cypress 被 6,559 个包反向依赖，playwright 只有 1,947 个。下载量赢了 14 倍，但“嵌进别人项目里”这件事 Cypress 仍然更多，这是存量与增量的差别，不写出来就是选择性取证。

Selenium 也一样还在跑（4.49，2026-09-09 发布），只是它 24% 的留存率把痛点写在了脸上，而那些痛点正是“等待和会话”这两件它当年留给用户的事。

有几条流传很广的说法，我顺手核了一遍（写这类文章最值钱的部分往往在这儿）：

| 常见说法 | 实际情况 |
|---|---|
| “Puppeteer 只支持 Chrome” | v23.0.0（2024-08）起同时支持 Chrome 与 Firefox（Firefox 走 BiDi） |
| “Selenium 近年移交给了 SFC” | 自 [2011-02-02](https://sfconservancy.org/news/2011/feb/02/selenium-joins/) 起就是 Software Freedom Conservancy 成员项目，不是“近年” |
| “WebDriver 是 W3C 标准” | 只有 Level 1 是 2018 Recommendation；[Level 2](https://www.w3.org/TR/webdriver2/) 与 [WebDriver BiDi](https://www.w3.org/TR/webdriver-bidi/) 至今仍是 Working Draft |
| “Browser Use / Stagehand 都是基于 Playwright 的” | 均未见直接依赖：Browser Use 用自研 `cdp-use`，发布出来的 `@browserbasehq/stagehand` 依赖 `@browserbasehq/sdk`（同一个 monorepo 里的 integrations、evals 包倒是把 playwright 列成了 devDependency）；Skyvern 才是直接依赖 `playwright` |
| “Cypress 已经停更了” | 2026-09-01 刚发 Cypress 16，仓库持续提交 |
| “Claude Code / Codex / Cursor 官方默认推荐 Playwright” | 未验证。能确认的只有 Playwright 侧提供了这几家的接入命令，反向的官方表态我没找到 |

> 口径与免责：npm 下载量含 CI 里的重复安装、镜像同步和间接依赖，它是量级指标而不是用户数，`playwright` 这个包还被大量用于抓取，不全是测试（这条在第二节里反倒成了论据）。正文里的耗时、报错、ARIA 比例都是我自己在本机量的；版本号与下载量都只是 2026-09-19 的快照，引用请以当时为准。

## 结语

把全文收进一张表，方便你直接贴到团队文档里：

| | 形态 | 抽象画在哪 | 读者 | 2026 年的处境 |
|---|---|---|---|---|
| Selenium | 协议 + 各家 driver | 协议层，等待交给人 | 人 | 仍在维护，留存率下滑 |
| Puppeteer | 库 | 浏览器控制层 | 脚本作者 | 抓取场景稳固，测试场景不参与 |
| Cypress | 应用（测试在它里面跑） | 链式 DSL + 浏览器内运行 | 人 | 转入守势，组件测试仍有优势 |
| Playwright | 库（runner 建在库上） | 语义定位 + 可序列化 + 可回放 | 人，以及模型 | 使用率与留存双第一 |

一句话总结这篇长文：**浏览器自动化从“一个应用”变成了“一层能力”，而 Playwright 恰好是那层能力上最适合被握住的接口。** 至于 AI，它不是这场换代的原因，它是把这件事的价值放大了一档的那阵风。

这篇里的数据我其实核了两遍，但开源世界变化快，难免有疏漏；我对 Playwright 的用法也还在摸索，谈不上什么最佳实践。如果你在迁移路上踩到了不一样的坑，或者发现文中哪里写错了，欢迎指出、欢迎交流。也不妨拿自己项目里最 flaky 的那条用例试一遍，再回来说说体会。权当这篇是一次公开的读书笔记，能对你有点用，就算是额外的收益了。

### 彩蛋

文章里我最喜欢的一处证据其实不是数据，而是那段报错。它把 20 个候选元素的“正确答案”一条条列出来，再配上一个叫 Copy prompt 的按钮，**它等于在明说：我知道你要把我这段话粘给谁看。** 一个工具用了六年时间，终于把自己的错误信息写成了一份 prompt。我写这篇文章的时候，用的也是同一个思路：把话说清楚，让下一个读者能直接照着干活。

其实还有个更小的彩蛋。Playwright 判定元素“可点”的四个条件里，`opacity: 0` 被算作可见，也就是说一个完全透明的按钮，工具认为你可以点它。这条定义来自官方文档，我第一次读到时，大概盯着看了三遍。人类的直觉说“看不见就是没有”，协议的直觉说“它有框、能命中，那就是存在”：抽象层的分歧，往往就在这种一行的细节里。

---

## 参考

官方文档与发布说明：

- [Playwright - Actionability（可操作性判定）](https://playwright.dev/docs/actionability)
- [Playwright - Locators](https://playwright.dev/docs/locators) / [ElementHandle（已标注不推荐）](https://playwright.dev/docs/handles)
- [Playwright - ARIA snapshots](https://playwright.dev/docs/aria-snapshots) / [Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright - Test Agents（planner / generator / healer）](https://playwright.dev/docs/test-agents) / [Release notes](https://playwright.dev/docs/release-notes)
- [microsoft/playwright-mcp（README）](https://github.com/microsoft/playwright-mcp) / [microsoft/playwright-cli（CLI + Skills）](https://github.com/microsoft/playwright-cli)
- [Puppeteer - FAQ（定位与浏览器支持）](https://pptr.dev/faq)
- [Cypress - Module API（只有 run / open / parseRunArguments）](https://docs.cypress.io/app/references/module-api) / [Why Cypress（同一事件循环）](https://docs.cypress.io/app/get-started/why-cypress)
- [Cypress - Retry-ability（查询重试 vs 命令不重试）](https://docs.cypress.io/app/core-concepts/retry-ability) / [Interacting with elements（七项检查）](https://docs.cypress.io/app/core-concepts/interacting-with-elements)
- [Cypress 16 发布](https://www.cypress.io/blog/cypress-16-faster-tests-starting-with-http2-support) / [Update on Cypress's Workforce](https://www.cypress.io/blog/update-on-cypresss-workforce)
- [Selenium - History（同源策略与 driven 模式）](https://www.selenium.dev/history/) / [Waits（显式等待即轮询循环）](https://www.selenium.dev/documentation/webdriver/waits/)
- [W3C WebDriver Level 1（2018 Recommendation）](https://www.w3.org/TR/webdriver1/) / [Level 2（Working Draft）](https://www.w3.org/TR/webdriver2/) / [WebDriver BiDi（Working Draft）](https://www.w3.org/TR/webdriver-bidi/)

数据与观点来源：

- [State of JavaScript 2025 - Testing](https://2025.stateofjs.com/en-US/libraries/testing/)
- [npm registry downloads API](https://api.npmjs.org/downloads/point/2026-09-10:2026-09-16/playwright)（对比 [cypress](https://api.npmjs.org/downloads/point/2026-09-10:2026-09-16/cypress)、[puppeteer](https://api.npmjs.org/downloads/point/2026-09-10:2026-09-16/puppeteer)）
- [ecosyste.ms（反向依赖统计）](https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/playwright)
- [Cypress vs Playwright; Browser Included — Gleb Bahmutov（个人观点）](https://glebbahmutov.com/blog/cy-vs-pw-browser/)
- [microsoft/playwright@9bd55e9（2020-04 删掉的那段 FAQ）](https://github.com/microsoft/playwright/commit/9bd55e9364907eb6ce16c694843ab8cb313c38eb)

延伸阅读（我自己的前几篇）：

- 《[给大脑配一副好鞍具：五款 Agent Harness 的解剖与实测](https://springuper.github.io/agent-harness-comparison/)》：同一个“形态决定上限”的问题，看的是模型外面那层壳
- 《[积木，而非成品：Pi Agent Harness 的克制与精妙](https://springuper.github.io/pi-harness-anatomy/)》：同一套拆解方法的另一个样本

> 版本与核实说明：数据（下载量、调查、star、反向依赖）抓取于 2026-09-19；第一节和第二节的代码都在本机实跑过，用的是撰写期的最新版：Playwright 1.57.0 + Node 24.13.0、Puppeteer 25.12.0 + Chrome for Testing 154、Cypress 16.1.1，文中那些输出是当时的终端原文，不是手写示意，探针脚本也内嵌在正文里，可自行复现。只有 Selenium 那段 Java 代码是按官方文档的 API 写法整理的，没有实跑（跑它要另装 JDK、Maven 和 ChromeDriver）。掌故与沿革类内容（Puppeteer 与 Playwright 的团队渊源、Cypress 的裁员、Selenium 归属 SFC 的时间、WebDriver 各层级的状态）同样按官方文档、官方博客或仓库源码核过；Playwright 早期 FAQ 那段话随 README 的 FAQ 段在 2020 年 4 月被删除，现在只能从仓库历史里读到，正文引的是仓库原文。ARIA 对比图、按钮三态图与 HTML 报告截图都是 2026-10-01 在本机实拍的，字符数与 9 月 19 日那次完全一致。凡官方没有量化声明的地方，文中都写明了那是我自己量的。
