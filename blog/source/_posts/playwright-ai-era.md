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

同一件事，两份代码。你大概会说：后者好看多了。但好看只是表象，真正被换掉的是别的东西。第一段的读者是人：人得判断"睡多久才够"，人得维护那串 `nth-child(3)`。第二段的读者可以是机器：它读得懂"角色是 button、名字叫提交"，也能自己在条件满足时动手。

这篇文章想论证的就是这句话：**测试工具的换代，不是因为谁的功能更多，而是因为这行代码的读者换人了。**

老实说，我原本也以为答案是"Playwright 功能强、生态好"。直到我把行业调查、官方发布说明，还有一段我自己跑出来的报错原文摆在一起看，才改的主意。下面按顺序摆给你看。

<!--more-->

## 一、同一颗按钮，四种写法

要讲换代，得先知道上一代各自解决了什么问题，以及它们的设计对象是谁。

我用同一件小事来演示：点一颗"600 毫秒后才可用"的提交按钮。下面四段代码都对着这一个页面写，被测文件就是一个存成 HTML 就能直接打开的静态文件：

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

### Selenium：为「企业的测试生态」设计

Selenium 是这一行的老前辈，核心遗产是协议：WebDriver。2018 年它成了 W3C Recommendation，"用任何语言驱动任何浏览器"从此有了标准。（顺带说清一个容易被夸大的说法：升级成标准的只有 Level 1，现行的 [Level 2](https://www.w3.org/TR/webdriver2/) 和 [WebDriver BiDi](https://www.w3.org/TR/webdriver-bidi/) 到 2026 年 9 月都还是 Working Draft。）

说它"面向企业"，是四件具体的事：六种语言绑定（Java、Python、C#、Ruby、JavaScript、Kotlin），让后端用 Java、数据用 Python 的团队不必为了统一测试工具去统一技术栈；Grid 负责把测试分发到几十台机器上并行跑，这部分别的工具基本不碰，Puppeteer 官方 FAQ 就明说 Grid 超出它范围；[云厂商按协议供货](https://www.selenium.dev/sponsor/)，BrowserStack、TestMu AI 都是官方列的 Development Partner，基建不用自己搭；再加上中立治理，它自 [2011 年](https://sfconservancy.org/news/2011/feb/02/selenium-joins/)起就挂在 Software Freedom Conservancy 名下，不属于任何一家浏览器厂商。

这套协议换来了跨语言与跨厂商的自由，代价是把等待和会话留给了使用者。[官方文档](https://www.selenium.dev/documentation/webdriver/waits/)写得很直白：显式等待就是"你写在代码里的轮询循环"。所以就有了第一代前端测试工程师的必修课：`sleep` 多久才够，这门课的挂科率，的确就是后来所有人嘴里的 flake。

拿那颗按钮写一遍，是一份完整的 Java 文件（Selenium 4 的写法）：

```java
import java.time.Duration;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

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

`import` 那一堆可以略过，要看的只有一行：`wait.until(...)`。"按钮什么时候可点"这件事，是你**显式写出来**的。换成 Python、C# 或 Kotlin，这段逻辑只是换个绑定，协议还是同一个。顺便说一句，Selenium 官方"等待"那一页自己就摆了一个叫 `sleep()` 的例子，里面写的是 `Thread.sleep(1000)`：文档自个儿把这件事认了。

### Puppeteer：为「脚本作者」设计

Puppeteer 是 2017 年从 Chrome 团队长出来的，本质是 Chrome DevTools Protocol（CDP）的一层封装，使用者画像很清楚：写脚本的、做抓取的、需要精确控制浏览器的。

它从来不是测试框架。[官方 FAQ](https://pptr.dev/faq) 到今天仍然这么定位自己：由 Chrome Browser Automation team 维护，是 CDP / WebDriver BiDi 的参考实现，明确写着"不是 Selenium 的替代品"，多语言绑定和 Grid 都不在它范围内。想要测试的便利，社区方案是另外装 `jest-puppeteer`。这里顺便纠正一个流传很广的说法：**"Puppeteer 只支持 Chrome"已经过时了**，从 v23.0.0 起它同时支持 Chrome 与 Firefox（前者默认走 CDP，后者默认走 BiDi）。

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

点了，但什么也没发生：按钮还是禁用状态，浏览器把这次鼠标事件直接吞了。脚本没有报错，它只是"点过了"而已。判据得人写，最后那句断言还得另外装 jest 才有，这就是"参考实现，而不是测试框架"落在代码上的样子。

### Cypress：为「人的开发者体验」设计

Cypress 是 2015 年出现的，野心很不一样：把测试写成一件愉快的事。链式 DSL 读起来像英语，测试跑在浏览器里，还有一个能"时间旅行"的界面：鼠标悬停在某一步，左侧就是当时那一刻的 DOM 快照。

在"给人用"这件事上，它的确做到了极致。而且有个细节大概会让很多人意外：它的 actionability 检查项**比 Playwright 还多**（visible / disabled / detached / readonly / animations / covering / scrolling，比后者四项目长），它也会盯着 DOM 不断重跑查询（[官方原文](https://docs.cypress.io/app/core-concepts/retry-ability)：*"Cypress will watch the DOM - re-running the queries…"*）。

"Cypress 不会自动等待"是流传很广的说法，我本来打算照抄，实测之后改了主意。我写了一个完全不带等待的用例：

```js
cy.visit('/order.html');
cy.get('#submit').click();                       // 不写任何等待
cy.get('#result').should('have.text', '已提交');
```

它倒是通过了，耗时 846 毫秒。也就是说它的确等了：600 毫秒后按钮一可用，点击才落下去。等待这件事，它和 Playwright 一样有。两者真正的边界写在紧挨着的官方那句话里：*"Only queries are retried… commands themselves only execute once"*（只有查询会被重试，命令本身只执行一次）。这句管的是**命令失败之后**要不要重来，不是"动作之前等不等"，其实读成后者就偏了。

回到那颗按钮，一份完整的用例长这样：

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

跑 `npx cypress run --spec cypress/e2e/order.cy.js`，输出末尾是这样（节选，原汇总表有 100 列宽，这里只留两行）：

```text
  1 passing (799ms)
    ✔  All specs passed!
```

代码倒是三家里看着最舒服的，但代价在别处：它必须有真正的浏览器外壳才能跑起来。我这次装完，npm 包只有 7.3 MB，真正的执行体是它下载到缓存里的 641 MB 应用，测试是被这个应用带着跑的，而不是被一行 `require` 拉起来的库。这些在第三节讲内核时会串起来。

### 一张图收束

```
              给人用      给程序用
抽象层级高    Cypress     Playwright
抽象层级低    Selenium    Puppeteer
```

四个工具都在"自动化浏览器"这一格，但各自把抽象画在了不同的高度、面向了不同的读者。同一颗按钮、四段代码，差别不在语法糖，而在把哪一层抽象留给你自己。

## 二、Playwright 做对了什么

Playwright 出现在 2019 年底（npm 上最早可见的版本是 2019-12-05 的 `0.9.1`，`1.0.0` 在 2020-05-06，官方没发过一手发布公告，这两个日期取自 npm registry）。它的作者是谁，官方 FAQ 里写得非常坦率：

> *"We are the same team that originally built Puppeteer at Google, but has since then moved on."*

同一批人，另起炉灶。理由也给了：继续改 Puppeteer 的 API 就得破坏兼容，所以 *"we chose to start with a clean slate"*。这不是"外人来挑战"，是一家人自己觉得原来那套抽象不够用了。他们把新抽象画在了四个地方。

### 1. 把"什么时候可以动手"交给工具

这是它最出名的一点，但流传的版本常常不准确。它不是"加了等待"，而是把人的经验写成了可判定的条件。官方叫 [actionability](https://playwright.dev/docs/actionability)，动作执行前，工具自己等这些条件全部成立：

| 条件 | 官方定义（人话版） |
|---|---|
| Visible | 有非空 bounding box，且不是 `visibility: hidden`；`opacity: 0` 算可见 |
| Stable | 连续两帧 bounding box 不变（还在动的元素不点） |
| Receives Events | 命中测试时这个点上真的是它，不是被别的元素盖住 |
| Enabled | 没 `disabled`，祖先也没有 `aria-disabled` |

"连续两帧不变"这种抠到帧的定义，是我见过对"把经验变成接口"最字面的注解：**它把老工程师嘴里那句"等它别动了再点"直接写成了代码。**

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

和上一节比一比：Puppeteer 那三行 `waitForFunction` 不用写，Cypress 也没快多少（846 对 858 毫秒），差别不在"等不等"，而在这一行 `click()` 自己就把等待包了进去。同样是点这颗按钮，我给三种点法做了对照：

| 点法 | 页面结果 | 说明 |
|---|---|---|
| 按坐标立刻点 `page.mouse.click(x, y)` | `（未提交）` | 按钮还禁用着，真实鼠标事件被吞掉 |
| `locator.dispatchEvent('click')` | `（已提交）` | 事件绕过了检查，看着成功，其实是假成功 |
| `getByRole('button').click()` | `（已提交）`，等了 846 毫秒 | 条件成立才动手 |

<!-- TODO(gif): 录 8 秒，三种点法并排跑一遍，让"假成功"一眼可见 -->

第三行那 846 毫秒不是浪费，是它在等条件成立。但更值得琢磨的是第一行和第二行的对比：**不做检查的自动化，最危险的地方不是失败，而是它能给你一个假成功。** 一个"禁用状态也照样点进去"的脚本会在 CI 里一直绿着，直到上线被真实用户教做人。

### 2. Locator 是描述，不是句柄

`page.getByRole('button', { name: '提交' })` 返回的不是元素引用，而是一句描述，官方定义是"一种在任何时刻都能找到元素的方式"，它是惰性重解析的（见 [Locators 文档](https://playwright.dev/docs/locators)）。这个区别倒是实在：描述可以重试、可以序列化、可以跨进程传递、可以直接印在报错里（下面马上会看到）。反过来，`ElementHandle` 倒是被官方文档[标上了 Discouraged](https://playwright.dev/docs/handles)（不推荐）。

差别有多大？我拿同一颗按钮做了次实验：把 class 从构建哈希 `btn-primary-9f2c1a` 改成 `btn-primary-4b8e77`（模拟一次重新构建），再跑两种写法。

| 写法 | 重构之后 |
|---|---|
| `page.click('.btn-primary-9f2c1a')` | ❌ `Timeout 1200ms exceeded` + `waiting for locator('.btn-primary-9f2c1a')` |
| `page.getByRole('button', { name: '提交订单' })` | ✅ 照样命中 |

不过语义定位其实有个前提，得说清楚：`getByRole` 不是凭空知道"这是个按钮"的，它读的是浏览器的可访问性树。原生标签自带隐式 role（`<button>`、`<a href>`、`<input type="checkbox">`），自定义组件就得自己补上 `role` 和可达名称（`aria-label`，或者 `aria-labelledby`、`<label for>`）。我拿一个只用 `<div onclick>` 拼的按钮试过：

```
getByRole('button').count()   →  0        # div 汤里没有"按钮"这个语义
ARIA 快照里的那一项            →  - text: 提交订单   # 降级成一行普通文本
补上 role="button" 之后         →  1
```

所以这条路对页面是有要求的：**你的界面得先有语义。** 这听着像额外成本，其实是一鱼三吃，同一套标记同时喂饱三件事：屏幕阅读器（可访问性）、`getByRole`（可测试性），以及 agent 读到的 ARIA 快照（可被理解）。我手头项目的 e2e 里就有个用例，断言的是"关键操作要有 `aria-label`、不要用 `title`"：一条测试顺手把无障碍规范也钉住了。

### 3. 一套 API，吃下三个内核（以及为什么别人做不到）

Chromium、Firefox、WebKit，这次不是"分别适配"，而是同一套 API。我本机上装着的就是三个真内核：

```
~/Library/Caches/ms-playwright/
├── chromium-1200
├── firefox-1497
└── webkit-2227     # 真 WebKit，不是换皮
```

这里的"一视同仁"指三个内核都由同一套 API 一等公民地支持，不是"能不能跑起来"：Cypress 的 WebKit 至今标着 experimental，Puppeteer 干脆没有 WebKit。至于"开个 flag 就能驱起来"那个误解，其实得分三层看：

- 语言绑定和浏览器之间隔了一个进程。你在 JS、Python、Java 里调的是同一份实现，它启动一个独立的 driver 子进程，再通过 Playwright 自有协议（定义在仓库的 `packages/protocol/spec/*.yml`）跟它说话。所以它既不是 WebDriver 的又一家绑定，也不是 CDP 的封装。
- 每个内核各走一条通道：

| 内核 | 通道 | 说明 |
|---|---|---|
| Chromium | CDP | 用开源 Chromium 构建，能力直接来自上游 |
| Firefox | 打了补丁的 `-juggler-pipe` | 官方文档原话：Playwright 依赖补丁，用不了品牌版 Firefox |
| WebKit | `--inspector-pipe` | 仓库 `browser_patches/` 下同时维护 firefox 与 webkit 两套补丁 |

- 最关键的一层：它自己编译并维护内核。上面那两个 flag 不是"开关"，而是**只有打过补丁的构建里才存在的通道**。Playwright 每次发版同步更新三个内核的版本，`npx playwright install` 下载的就是这些自定义构建，我本机这份缓存已经 1.0 GB（chromium 324 MB、webkit 275 MB、firefox 253 MB）。

那为什么别人做不到？其实不是开不了 flag，是改不了内核。Cypress 的架构决定了它不往这个方向走，官方原话是 *"Cypress is executed in the same run loop as your application."*，它把驱动注入浏览器、与被测应用同处一个事件循环，这条路要求内核允许注入，而它无法自带打了补丁的 WebKit。（反过来说，同一个原因也换来了它 devtools 联动调试更顺手：断点能把测试和应用一起停住，Playwright 的 runner 和应用则是两个进程。这条是 Gleb Bahmutov 在[个人博客](https://glebbahmutov.com/blog/cy-vs-pw-browser/)里的观点，不是官方结论。）Puppeteer 的定位是 CDP 的参考实现，用官方 Chromium 构建跑 Chrome 系，v23 起 Firefox 走 BiDi，WebKit 不在计划内，它不需要改内核，也就不会去改。Selenium 走 W3C 协议，能力上限取决于各家厂商提供的 driver 实现：覆盖面最广，但每个内核能做什么由厂商说了算。

代价也说清楚：这套"连内核一起维护"的赌注，换来了三内核一致和额外的自动化能力，付出的是每次升级都要重下几百 MB 的自定义浏览器，外加内核补丁的长年维护。官方在 `connectOverCDP` 的文档里留下一句很能说明态度的话：直连 CDP 的保真度 *"significantly lower fidelity than the Playwright protocol connection"*。

> 口径：架构部分来自官方文档与仓库源码。"Juggler"这个词官方文档从不使用，只出现在源码与补丁目录里，属于源码级证据，别当成官方术语引用。

### 4. trace 与那段报错：失败变成了可传递的东西

测试失败时，Playwright 给你一个 `trace.zip`，里面装着 [Actions（含当时用的 locator 与耗时）、Snapshots（动作前中后的全量 DOM 快照）、Screenshots、Source、Log、Errors、Console、Network](https://playwright.dev/docs/trace-viewer)。它把"一次性现象"变成了一个可传递的工件：可以在自己机器上重放，可以塞进 CI 产物，从 1.62 起还能直接在命令行里分析（`npx playwright trace`）。

但真正让我改变判断的，是下面这段报错原文。这是我 2026-09-19 在本机跑 Playwright 1.57.0（Node 24）时真抓到的，我构造了一个 20 行订单列表，然后故意用模糊定位去点它：

```
locator.click: Error: strict mode violation: getByRole('button', { name: '查看' }) resolved to 20 elements:
    1) <button aria-label="查看订单 SO-1001 详情" ...> aka getByRole('button', { name: '查看订单 SO-1001 详情' })
    2) <button aria-label="查看订单 SO-1002 详情" ...> aka getByRole('button', { name: '查看订单 SO-1002 详情' })
    3) <button aria-label="查看订单 SO-1003 详情" ...> aka getByRole('button', { name: '查看订单 SO-1003 详情' })
    ...
```

请仔细看它的结构。它不只是说"你错了"：它说明了为什么错（匹配到 20 个），给出了每个候选的真实身份，最关键的是那句 `aka`，把改正后的 locator 写法一条条列给你了。这不是给人看的礼貌提示，这是一份**写好的补丁**。而且它不是巧合：从 1.51 起，Playwright 直接在报错旁放了一个按钮，叫 Copy prompt。

## 三、转折点：这份接口的观众换人了

前面讲的都还是"Playwright 是个设计得好的工具"。但设计得好，不等于能被时代选中。所以在讲 AI 之前，得先把"AI 之前"补齐，否则容易得出一个偷懒的结论：它是被 AI 突然抬起来的。

并不是。我把 npm 的年下载量拉了出来（同一口径，官方 API）：

| 年份 | playwright | cypress | puppeteer |
|---|---|---|---|
| 2020 | 330 万 | 6,630 万 | 7,850 万 |
| 2022 | 3,810 万 | 2.04 亿 | 1.76 亿 |
| 2023 | 8,640 万 | 2.57 亿 | 2.39 亿 |
| 2024 | 3.31 亿 | 2.77 亿 | 2.06 亿 |
| 2025 | 9.70 亿 | 3.15 亿 | 2.68 亿 |
| 2026（1 到 8 月） | 17.7 亿 | 2.39 亿 | 3.22 亿 |

两个读法：斜率早就在了，2020 到 2023 年 playwright 每年大约翻三倍（330 万到 8,640 万），同期 Cypress 只是温和上涨；但**反超发生在 2024 年**，那一年 playwright 3.31 亿首次超过 cypress 的 2.77 亿，2025 年拉到 3.1 倍，2026 年前八个月接近 7.4 倍。AI 侧的时间线也对得上：2024 年 11 月 MCP 发布，2025 年 2 月 Claude Code 发布、3 月 playwright-mcp 建仓、4 月 Codex CLI 开源，正好压在它那条最陡的坡上。

所以准确的说法是：**它先赢了工具本身的仗（2020 到 2023 的斜率），再赶上 AI 把这仗的价值放大了一档（2024 之后的陡增）。** 下面要解释的，正是第二段为什么成立。

### 结构化 > 像素

2025 年 3 月，微软把 Playwright 包成了一个 MCP server（[playwright-mcp](https://github.com/microsoft/playwright-mcp)，建仓到 2026-09-19 已 37,277 star）。它的 README 第一段就把立场说透了：

> *"enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models."*

再看它给模型的工具描述，更直接：`browser_snapshot` 的说明是 *"this is better than screenshot"*，而 `browser_take_screenshot` 的说明是 *"You can't perform actions based on the screenshot"*。（视觉能力要显式开：`--caps=vision`。）

用量上也看得出来：`@playwright/mcp` 的周下载是 597 万，而官方那个 Puppeteer MCP server 只有 2.7 万，差 220 倍。这一代 agent 想做浏览器操作时，默认的落脚点其实只剩一个了。

那"结构化"到底省了多少？官方没有给过任何量化声明，所以我干脆自己量了一次。构造一个典型的组件库风格页面（20 行表格、class 哈希、内联 style、`__NEXT_DATA__`），用 `locator.ariaSnapshot()`（官方叫 [ARIA snapshots](https://playwright.dev/docs/aria-snapshots)）取同一页面的两种表示：

| 表示 | 字符数 |
|---|---|
| `page.content()` 的 HTML | 12,805 |
| ARIA 快照 | 2,286 |
| 比例 | 17.9% |

但体积其实只是副产品，信息形态才是重点。ARIA 快照里长这样：

```
- heading "订单工作台" [level=1]
- form "筛选":
  - textbox "关键词":
    - /placeholder: 输入订单号
  - combobox "状态":
    - option "全部" [selected]
- row "SO-1001 张三 ¥1,280.00 待发货"
```

没有 `css-1x1q7`，没有 `ant-table-cell`，没有构建产物留下的哈希。模型拿到的是词汇表（role、name、state），而不是渲染残渣，这恰好就是 `getByRole` 需要的输入：同一个抽象层，人和模型都能读。想自己量一次的话，不妨自己动手，三行就够（`npm i -D playwright && npx playwright install chromium` 之后）：

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

<!-- TODO(截图): 左边 HTML、右边 ARIA 快照的并排对比图，比数字更直观 -->

### 确定性 > 视觉启发式

MCP 的 README 里还有一句我很喜欢的话，几乎是这个时代的判词：*"Deterministic tool application. Avoids ambiguity common with screenshot-based approaches."*

"确定性"这三个字看着朴素，但对 agent 是生死攸关的：**它决定了模型的动作能不能被复盘、被重放、被自动化验证。** 视觉方案里"点这里"是一个坐标，语义方案里"点这里"是一个角色加一个名字，后者可以被断言、被 diff、被写进回归测试。

### 可重放 > 一次性

把前面两条接起来看，trace 和 locator 的"可序列化"到底解决什么，就能走出一条完整的链子：修复的前提是复现，一个失败如果只能在那台机器、那个进程里存在，换个人（或换个 agent）就只能靠猜；trace 把现场打包成一个文件，locator 把"该点哪儿"写成一段文本，所以它能被印进报错里，就像上面那段 `aka`；于是失败变成了可传递的对象，在 CI 上产生，在本地打开，也能被另一个程序读取。

反过来看更清楚：如果失败信息里只剩一句"点击失败"、现场只有一张截图，那么修复者（不管人还是模型）都只能从头猜一遍。**可序列化不是"能被自动修复"的保证，但它是前提。**

不用猜：官方自己就把这条链路做成了产品。[Playwright Test Agents](https://playwright.dev/docs/test-agents)（1.56，2025-10-06）内置三个 agent：

```
planner   → 探索应用，产出一份 Markdown 测试计划
generator → 把 Markdown 计划变成 Playwright 测试文件
healer    → 跑测试，自动修复失败的用例
```

它甚至明说了要接到哪些编码 agent 上：

```bash
npx playwright init-agents --loop=vscode|claude|codex|opencode
```

把这些动作排到时间线上，比任何观点都有说服力（来源：[发布说明](https://playwright.dev/docs/release-notes)）：

| 版本 | 时间 | 与"给模型用"有关的动作 |
|---|---|---|
| 1.49 | 2024-11 | `toMatchAriaSnapshot` 断言落地 |
| 1.51 | 2025 | 报错旁出现 Copy prompt 按钮 |
| 1.56 | 2025-10 | Test Agents（planner / generator / healer） |
| 1.57 | 2025 | 移除 `page.accessibility`，把能力收拢到结构化快照上 |
| 1.60 | 2026 | 给快照加 `boxes` 选项，官方措辞：*"useful for AI consumption"* |
| 1.62 | 2026 | `npx playwright trace`（命令行分析 trace）、`npx playwright mcp` |

**当"给模型消费"这几个字开始出现在发布说明里，这就不是观察，而是既成事实了。**

不过这里有个反转得说。同样是官方 README，在 2026 年给出了一个降温的说法：playwright-mcp 现在推荐 coding agent 改用 CLI + Skills（[microsoft/playwright-cli](https://github.com/microsoft/playwright-cli)），理由是 *"…avoid loading large tool schemas and verbose accessibility trees into the model context."*。**连 accessibility tree 都会被嫌啰嗦。** 这句话反而让整篇文章的论点更稳：被时代选中的从来不是某个功能，而是"把网页表示成结构化语义"这件事，因为只有结构化的东西才能被裁剪、被检索、被压进预算。

## 四、把数字摆齐

设计讲完了，还得看它有没有被采用。以下数据都是 2026-09-19 抓的。

[State of JS 2025](https://2025.stateofjs.com/en-US/libraries/testing/)（13,002 人，调查期 2025-09-24 到 11-11）：

| | 使用率 | 留存率 | 备注 |
|---|---|---|---|
| Playwright | 50% | 94% | 2024 年是 36%，+14pp，官方称与 Vitest 并列最大涨幅 |
| Cypress | 47% | 57% | 2022 年留存是 84% |
| Puppeteer | 42% | 70% | |
| Selenium | 37% | 24% | 2022 年留存是 42% |

**2025 年是 Playwright 使用率第一次超过 Cypress。** 比使用率更值得看的倒是留存：94% 对 57%。横截面上的量级差距更直接（npm 周下载，2026-09-10 到 09-16，取自 [npm registry API](https://api.npmjs.org/downloads/point/last-week/playwright)）：

```
每格 ≈ 500 万次下载

playwright          =================
puppeteer           ==
cypress             =
selenium-webdriver  -     （不足一格）
```

对上 Puppeteer 是 8 倍，对 Cypress 是 14 倍，对 Selenium 的 JS 绑定是 47 倍。还有个反直觉的数字：按 star 看，playwright（96,334）和 puppeteer（95,593）几乎打平，puppeteer 建仓还早了两年半。**star 数是"多少人觉得它值得收藏"，不是"多少人在用"**，星标打平、下载量差 8 倍，这个剪刀差本身就是"工具定位不同"最直观的证据：Puppeteer 仍然是抓取和脚本的第一选择，只是那条赛道上没有"测试"这件事。

说"Cypress 完了"，其实既不准确也不厚道。它在下滑，但没停：2024-06-13 官方发了《[Update on Cypress's Workforce](https://www.cypress.io/blog/update-on-cypresss-workforce)》，裁员 11 人，目标是加速现金流平衡；2026-09-01 [Cypress 16](https://www.cypress.io/blog/cypress-16-faster-tests-starting-with-http2-support) 照常发布；它还把赌注押在 AI 上，从 [UI Coverage](https://www.cypress.io/blog/introducing-ui-coverage)（2024-07）到 [AI 生成测试](https://www.cypress.io/blog/add-your-missing-tests-faster-with-test-generation-in-ui-coverage)（2025-05），再到文档里那篇 [Work with AI agents](https://docs.cypress.io/ui-coverage/work-with-ai-agents)，最后干脆出了一份《[Playwright → Cypress 迁移指南](https://docs.cypress.io/app/guides/migration/playwright-to-cypress)》。准确的说法是：相对动能下滑、转入守势，不是停更。Selenium 也一样还在跑（4.49，2026-09-09 发布），只是它 24% 的留存率把痛点写在了脸上，而那些痛点正是"等待和会话"这两件它当年留给用户的事。

有几条流传很广的说法，我顺手核了一遍（写这类文章最值钱的部分往往在这儿）：

| 常见说法 | 实际情况 |
|---|---|
| "Puppeteer 只支持 Chrome" | v23.0.0 起同时支持 Chrome 与 Firefox（Firefox 走 BiDi） |
| "Selenium 近年移交给了 SFC" | 自 2011-02-02 起就是 Software Freedom Conservancy 成员项目，不是"近年" |
| "WebDriver 是 W3C 标准" | 只有 Level 1 是 2018 Recommendation；Level 2 与 BiDi 至今仍是 Working Draft |
| "Browser Use / Stagehand 都是基于 Playwright 的" | 均未见直接依赖：Browser Use 用自研 `cdp-use`，Stagehand 用 `@browserbasehq/sdk`（Skyvern 才是直接依赖 `playwright`） |
| "Cypress 已经停更了" | 2026-09-01 刚发 Cypress 16，仓库持续提交 |
| "Claude Code / Codex / Cursor 官方默认推荐 Playwright" | 未验证。能确认的只有 Playwright 侧提供了这几家的接入命令，反向的官方表态我没找到 |

> 口径与免责：npm 下载量含 CI 里的重复安装、镜像同步和间接依赖，它是量级指标而不是用户数，`playwright` 这个包还被大量用于抓取，不全是测试。有一条数字其实是反过来的，得摆出来：按 [ecosyste.ms](https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/playwright) 统计，cypress 被 6,559 个包反向依赖，playwright 只有 1,947 个，下载量赢 14 倍但"嵌进别人项目里"这件事 Cypress 仍然更多，这就是存量与增量的差别，不写出来就是选择性取证。正文里的耗时、报错、ARIA 比例都是我自己在本机量的，不是官方数据；版本号与下载量都只是 2026-09-19 的快照，引用请以当时为准。

## 结语

把全文收进一张表，方便你直接贴到团队文档里：

| | 定位 | 抽象画在哪 | 读者 | 2026 年的处境 |
|---|---|---|---|---|
| Selenium | 跨语言/企业级标准 | 协议层，等待交给人 | 人 | 仍在维护，留存率下滑 |
| Puppeteer | CDP/BiDi 参考实现 | 浏览器控制层 | 脚本作者 | 抓取场景稳固，测试场景不参与 |
| Cypress | 为人设计的测试体验 | 链式 DSL + 浏览器内运行 | 人 | 转入守势，组件测试仍有优势 |
| Playwright | 语义化的浏览器接口 | 语义定位 + 可序列化 + 可回放 | 人，以及模型 | 使用率与留存双第一 |

一句话总结这篇长文：**浏览器是 agent 的手，而 Playwright 恰好是那只手上最适合被握住的接口。**

不过也别把它当成答案。**换工具不会消灭 flake，它只是把 flake 从"语言层面"挪到了"用法层面"。** 我手头那个用 `@playwright/test` 的项目里就留着反面教材：

```ts
const firstHistoryItem = page.locator('.home-history-item').first();
await page.waitForTimeout(1000);
```

`waitForTimeout(1000)` 和开头那个 `sleep(800)` 是同一种东西，只是换了个更时髦的名字。换一副鞍具也不会自动让马跑得更快（"鞍具"这个说法来自我上一篇横评，《[给大脑配一副好鞍具](https://springuper.github.io/agent-harness-comparison/)》，那里看的是同一件事的另一半：模型外面那层壳）。

这篇里的数据我其实核了两遍，但开源世界变化快，难免有疏漏；我对 Playwright 的用法也还在摸索，谈不上什么最佳实践。如果你在迁移路上踩到了不一样的坑，或者发现文中哪里写错了，欢迎指出、欢迎交流。也可以不妨拿自己项目里最 flaky 的那条用例试一遍，再回来说说体会。权当这篇是一次公开的读书笔记，能对你有点用，就算是额外的收益了。

### 彩蛋

文章里我最喜欢的一处证据其实不是数据，而是那段报错。它把 20 个候选元素的"正确答案"一条条列出来，再配上一个叫 Copy prompt 的按钮，**它等于在明说：我知道你要把我这段话粘给谁看。** 一个工具用了六年时间，终于把自己的错误信息写成了一份 prompt。我写这篇文章的时候，用的也是同一个思路：把话说清楚，让下一个读者（不管是人还是模型）能直接照着干活。

其实还有个更小的彩蛋。Playwright 判定元素"可点"的四个条件里，`opacity: 0` 被算作可见，也就是说一个完全透明的按钮，工具认为你可以点它。这条定义来自官方文档，我第一次读到时，大概盯着看了三遍。人类的直觉说"看不见就是没有"，协议的直觉说"它有框、能命中，那就是存在"：抽象层的分歧，往往就在这种一行的细节里。

---

## 参考

官方文档与发布说明：

- [Playwright - Actionability（可操作性判定）](https://playwright.dev/docs/actionability)
- [Playwright - Locators](https://playwright.dev/docs/locators) / [ElementHandle（已标注不推荐）](https://playwright.dev/docs/handles)
- [Playwright - ARIA snapshots](https://playwright.dev/docs/aria-snapshots) / [Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright - Test Agents（planner / generator / healer）](https://playwright.dev/docs/test-agents) / [Release notes](https://playwright.dev/docs/release-notes)
- [microsoft/playwright-mcp（README）](https://github.com/microsoft/playwright-mcp) / [microsoft/playwright-cli（CLI + Skills）](https://github.com/microsoft/playwright-cli)
- [Puppeteer - FAQ（定位与浏览器支持）](https://pptr.dev/faq)
- [Cypress - Retry-ability（查询重试 vs 命令不重试）](https://docs.cypress.io/app/core-concepts/retry-ability)
- [Cypress 16 发布](https://www.cypress.io/blog/cypress-16-faster-tests-starting-with-http2-support) / [Update on Cypress's Workforce](https://www.cypress.io/blog/update-on-cypresss-workforce)
- [Selenium - Waits（显式等待即轮询循环）](https://www.selenium.dev/documentation/webdriver/waits/)
- [W3C WebDriver Level 2（状态：Working Draft）](https://www.w3.org/TR/webdriver2/) / [WebDriver BiDi](https://www.w3.org/TR/webdriver-bidi/)

数据与观点来源：

- [State of JavaScript 2025 - Testing](https://2025.stateofjs.com/en-US/libraries/testing/)
- [npm registry downloads API](https://api.npmjs.org/downloads/point/last-week/playwright)（对比 [cypress](https://api.npmjs.org/downloads/point/last-week/cypress)、[puppeteer](https://api.npmjs.org/downloads/point/last-week/puppeteer)）
- [ecosyste.ms（反向依赖统计）](https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/playwright)
- [Cypress vs Playwright; Browser Included — Gleb Bahmutov（个人观点）](https://glebbahmutov.com/blog/cy-vs-pw-browser/)

延伸阅读（我自己的前两篇）：

- 《[给大脑配一副好鞍具：五款 Agent Harness 的解剖与实测](https://springuper.github.io/agent-harness-comparison/)》
- 《[积木，而非成品：Pi Agent Harness 的克制与精妙](https://springuper.github.io/pi-harness-anatomy/)》

> 版本与核实说明：第一节和第二节的代码都在本机实跑过，Playwright 1.57.0 + Node 24.13.0、Puppeteer 25.12.0 + Chrome for Testing 154、Cypress 16.1.1，文中那些输出是当时的终端原文，不是手写示意，探针脚本也内嵌在正文里，可自行复现。只有 Selenium 那段 Java 代码是按官方文档的 API 写法整理的，没有实跑（跑它要另装 JDK、Maven 和 ChromeDriver）。掌故与沿革类内容（Puppeteer 与 Playwright 的团队渊源、Cypress 的裁员、Selenium 归属 SFC 的时间、WebDriver 各层级的状态）同样按官方文档、官方博客或仓库源码核过；凡官方没有量化声明的地方，文中都写明了那是我自己量的。
