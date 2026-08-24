---
layout: post
title: "Terminal UI：用 React 的方式重做命令行"
date: 2026-02-27 11:00:00
published: false
tags:
  - Terminal
  - TUI
  - React
  - Ink
  - Frontend
---

如果你用过 Claude Code、Gemini CLI 或 GitHub Copilot CLI，会立刻注意到一件事：这些工具在终端里的表现，和过去那种黑底白字、一行行 `console.log` 的 CLI 完全不同。它们有清晰的布局——左侧是对话区，右侧是状态或工具面板，底部是输入框；有焦点切换、有动效、有层次感。这不是偶然。这些 AI Coding 工具都选择了同一条技术路线：**用 React 写终端界面**。

本文想和你聊聊这个方向的代表方案 [Ink](https://github.com/vadimdemedes/ink)，以及它背后的思路：当「前端之美」的心智迁移到终端这块看似受限的介质时，会发生什么。

<!--more-->

## 一、为什么 Terminal UI 突然「变美」了？

### 从 print 到应用

很长一段时间里，命令行工具给人的印象是：黑窗口，白字或灰字，偶尔加点颜色，输出靠 `console.log` 或 `printf` 堆叠。交互靠一问一答的 prompt。复杂一点的用 ncurses 画表格，但开发和维护成本都很高，和现代前端的组件化、声明式思路相去甚远。

2025 年前后，情况变了。Claude Code、Gemini CLI、Codex CLI 等一系列 AI 编程助手把终端当成了主战场。它们需要展示：多轮对话、工具调用结果、文件变更、进度状态……信息量大、结构复杂，纯文本流完全不够用。于是，**终端被当作一块真正的 UI 画布**来对待。

### 技术选型的共识：React + Ink

这些工具不约而同地选用了同一条技术栈：**Ink**——一个把 React 渲染到终端的 renderer。Claude Code、Gemini CLI、GitHub Copilot CLI、Prisma CLI、Cloudflare Wrangler、Shopify CLI 等，都基于 Ink 构建其 TUI 层。

这背后的逻辑很直观：这些团队大多有丰富的 React 经验。与其用传统方式（ncurses、readline、手写 ANSI 转义）从零搭一套终端 UI，不如复用已有的前端心智——组件、状态、Hooks、声明式渲染。Ink 恰好提供了这一层抽象。

## 二、Ink 的核心：React + Flexbox，心智零迁移

Ink 的 slogan 很干脆：「React for CLIs」。你写的就是 React 组件，只是渲染目标从 DOM 变成了终端。

### Yoga 布局：终端里的 Flexbox

Ink 使用 [Yoga](https://github.com/facebook/yoga) 作为布局引擎——这也是 React Native 用的那套。所以：

- 每一个 `Box` 默认就是 `display: flex` 的容器
- `flexDirection`、`justifyContent`、`alignItems`、`padding`、`margin`、`flexGrow` 等属性，和你在 CSS 里写的几乎一一对应
- 百分比宽高（如 `width="70%"`）也支持，可以做出响应式布局

如果你已经会用 Flexbox 做 Web 布局，那在 Ink 里做终端布局，几乎没有额外学习成本。

### 基础组件：Box 与 Text

Ink 提供两个最核心的组件：

- **`Text`**：承载所有文本，支持 `chalk` 风格的颜色、粗体、下划线等样式
- **`Box`**：布局容器，相当于浏览器里的 `div`，支持上述 Flexbox 属性

所有可见文本必须包在 `Text` 里，所有布局结构用 `Box` 搭。下面是一个最简单的例子：

```jsx
import React from 'react';
import { render, Box, Text } from 'ink';

const App = () => (
  <Box flexDirection="column" padding={1}>
    <Text color="green" bold>✓ 任务完成</Text>
    <Text color="gray">已处理 42 个文件</Text>
  </Box>
);

render(<App />);
```

### 一个「迷你 Claude Code」布局示例

我们可以用 `Box` 和 `flexDirection` 快速搭出一个类似 Claude Code 的三栏布局：左侧主内容、右侧边栏、底部输入区。代码如下：

```jsx
import React, { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';

const App = () => {
  const [input, setInput] = useState('');

  useInput((char, key) => {
    if (key.return) {
      // 处理提交
      return;
    }
    if (key.backspace) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }
    if (char) setInput((prev) => prev + char);
  });

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* 主内容区：左 70% + 右 30% */}
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" width="70%" padding={1} borderStyle="single">
          <Text bold>对话区</Text>
          <Text color="gray">Assistant: 你好，有什么我可以帮忙的？</Text>
        </Box>
        <Box flexDirection="column" width="30%" padding={1} borderStyle="single">
          <Text bold>工具面板</Text>
          <Text color="cyan">Read, Edit, Bash...</Text>
        </Box>
      </Box>
      {/* 底部输入区 */}
      <Box padding={1} borderStyle="single">
        <Text color="yellow">&gt; </Text>
        <Text>{input || ' '}</Text>
      </Box>
    </Box>
  );
};

render(<App />);
```

这里的结构完全是「前端式」的：外层 `flexDirection="column"` 分上下两块，上面再用 `flexDirection="row"` 分左右。`borderStyle="single"` 画出边框，`padding`、`width` 控制间距和占比。熟悉 React 和 Flexbox 的人一眼能看懂。

### Hooks：状态与输入

Ink 支持完整的 React Hooks。除了 `useState`、`useEffect`，还提供了针对终端的专用 Hooks：

- **`useInput`**：监听键盘输入，处理方向键、回车、Ctrl+C 等
- **`useFocus`** / **`useFocusManager`**：管理焦点，实现 Tab 切换、不同区域的键盘导航
- **`useWindowSize`**：获取终端宽高，做响应式布局

这些 API 让「交互式」TUI 的开发体验和写 Web 应用非常接近：状态驱动视图，事件驱动状态更新。

## 三、Ink 的架构：React 的另一种 renderer

很多人好奇：Ink 到底是怎么把 React 画到终端里的？答案其实很直接：**Ink 是 React 的一个自定义 renderer**，和 `react-dom` 平级。React 负责调度和协调，renderer 负责把组件树「画」到宿主环境里。浏览器里是 DOM，终端里就是 stdout。

### react-reconciler：同一套调度，不同的宿主

React 在 16 之后把「协调逻辑」和「宿主渲染」解耦了。`react-dom` 用的是 `react-reconciler` 提供的 API，实现了一套「createInstance、appendChild、commitUpdate……」的 host config，把 React 元素变成 DOM 节点。Ink 做的是一样的的事，只不过宿主不是 DOM，而是**终端**。

Ink 和 Yoga 的关系可以这么理解：**Ink 是 React 的 Terminal renderer，Yoga 是 Ink 内部使用的布局引擎**。Ink 在创建 `Box` 等节点时，会同步创建对应的 Yoga 节点；协调完成后，调用 Yoga 计算布局，再根据布局结果生成输出。Yoga 是 Ink 的依赖，不作为独立进程或服务存在。

Ink 的实现大致分几层：

1. **Reconciler 层**：用 `react-reconciler` 注册一套 host config，告诉 React「如何创建/更新/删除一个终端节点」。这里的「节点」不是 DOM 元素，而是 Ink 内部的节点结构，每个 `Box` 会绑定一个 Yoga 节点。

2. **布局层**：commit 完成后，Ink 调用 Yoga 对整棵布局树做 Flexbox 计算。`flexDirection`、`padding` 等属性在创建时已映射到 Yoga 节点，Yoga 算出每个节点的 x、y、width、height。

3. **输出层**：根据 Yoga 输出的布局结果，把每个 `Text` 节点的内容、样式转换成 ANSI 转义序列，按行列写入一个 2D 字符 buffer。最后通过 `process.stdout.write` 输出，必要时先清屏再重绘。

整体架构可以用下面的字符图概括：

```
┌─────────────────────────────────────────────────────────────────┐
│                        React (调度 + 协调)                         │
│  你的 JSX: <Box><Text>Hello</Text></Box>                         │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     react-reconciler                              │
│  提供 createContainer、updateContainer、commitUpdate 等 API          │
│  不关心宿主是 DOM 还是 Terminal，只负责 diff 和调度                  │
└─────────────────────────────────────┬───────────────────────────┘
                                      │ host config 回调
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Ink (Host Renderer)                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│  │ createInstance│──▶│ Ink 节点树  │───▶│ Yoga 布局计算 (C/WASM)│   │
│  │ appendChild   │    │ Box↔YogaNode│    │ flexDirection,    │   │
│  │ commitUpdate  │    │ Text       │    │ padding, margin... │   │
│  └─────────────┘    └──────┬──────┘    └──────────┬──────────┘   │
│                            │                       │              │
│                            │  布局结果 (x,y,w,h)    │              │
│                            ▼                       │              │
│                    ┌───────────────┐               │              │
│                    │ 2D 字符 buffer │◀──────────────┘              │
│                    │ + ANSI 样式    │                              │
│                    └───────┬───────┘                              │
└────────────────────────────┼──────────────────────────────────────┘
                             │ process.stdout.write
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Terminal (stdout / stdin)                    │
└─────────────────────────────────────────────────────────────────┘
```

简要来说：**React 负责「要渲染什么」，react-reconciler 负责「何时、如何调度更新」，Ink 负责「在终端里怎么画」——而「怎么画」又分两步：Yoga 算位置，Ink 把位置 + 文本转成 ANSI 输出**。

### 用 Counter 串起全过程：原地变化时会发生什么？

用一个最简单的 Counter 来串起整个流程，尤其看看「只有数字原地变化」时，背后发生了什么：

```jsx
import React, { useState, useEffect } from 'react';
import { render, Text } from 'ink';

const Counter = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCount(c => c + 1), 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color="green">
      计数: {count}
    </Text>
  );
};

render(<Counter />);
```

**首次渲染**（count = 0）：

1. React 渲染 `<Counter>`，得到 `{count: 0}` 的虚拟树
2. react-reconciler 调用 Ink 的 host config：createInstance(Text), appendChild(text "计数: 0")
3. Ink 构建节点树，为布局创建 Yoga 节点（这里只有一个 Text，布局很简单）
4. Yoga 计算：这一行占多少宽、多高
5. Ink 把 "计数: 0" + 绿色 ANSI 写入 buffer，`stdout.write` 输出
6. 终端显示：`计数: 0`

**100ms 后**，`setCount(1)` 触发更新：

1. React 调度一次更新，reconciler 做 diff，发现只有 **Text 的 children 变了**（"0" → "1"）
2. reconciler 调用 `commitUpdate`，告诉 Ink：这个 Text 的内容要改成 "计数: 1"
3. **关键点**：Ink 不会只更新终端里「数字那一格」。终端没有 DOM 那样的增量更新能力
4. Ink 清空当前输出区域，整棵树重新走一遍：Yoga 再算一次布局（结果可能一样），再生成完整的 2D buffer
5. 整块内容重写到 stdout，终端看到的是「计数: 1」——从用户视角像是数字原地变了，但底层是一次全量重绘

所以：**虽然 React 和 reconciler 只标记了「Text 的 children 变了」，Ink 仍然会做全屏级别的重绘**。这是终端介质的限制，不是 Ink 的 bug。浏览器里 react-dom 可以只 `textNode.textContent = '1'` 改那一处，终端里通常只能「清掉再画一遍」。

### 与 react-dom 的对比

| 维度       | react-dom           | Ink                    |
|------------|--------------------|------------------------|
| 宿主环境   | DOM                 | 终端（stdout）         |
| 布局引擎   | 浏览器引擎          | Yoga（Flexbox）        |
| 更新粒度   | DOM 增量更新        | 全屏重绘               |
| 输入方式   | 鼠标 + 键盘         | 主要键盘               |

同一套 React 心智，换了一个宿主环境，就能从浏览器「平移」到终端。这种抽象能力，正是 Ink 的核心价值。

## 四、Terminal 特有的问题，Ink 怎么应对？

终端和浏览器差异很大：没有鼠标、没有滚动条、内容可能无限增长、窗口可能被 resize。Ink 针对这些场景提供了一些机制。

### 无鼠标：键盘优先的交互模型

终端里没有可靠的「点击」语义，交互主要靠键盘。Ink 用 `useInput` 监听 stdin 的按键事件，把 `key.upArrow`、`key.downArrow`、`key.return`、`key.tab` 等暴露出来。焦点切换则依赖 `useFocus` 和 `useFocusManager`：你声明哪些区域是可聚焦的，用户用 Tab 在它们之间切换，当前焦点区域才能接收 `useInput` 的事件。

这种「键盘 + 焦点」的模型和 Web 的「鼠标 + 键盘」不同，需要你显式设计 Tab 顺序和快捷键。例如用 `useFocus` 声明可聚焦区域，Tab 在它们之间切换，当前焦点用边框高亮：

```jsx
const Pane = ({ label }) => {
  const { isFocused } = useFocus();
  return (
    <Box borderStyle="single" padding={1} borderColor={isFocused ? 'green' : 'gray'}>
      <Text>{isFocused ? '▶ ' : '  '}{label}</Text>
    </Box>
  );
};
// 多个 Pane 时，Tab 按渲染顺序切换焦点；聚焦中的 Pane 才能收到 useInput 事件
```

一些终端支持鼠标事件（如 xterm 的 SGR 协议），但跨终端兼容性差，Ink 的设计以键盘为中心，这也是大多数 CLI 工具的共识。

### 不断增长的内容：Static 与 overflow

AI 对话、日志输出这类场景的特点是：**新内容不断追加**，旧的不会消失。如果每次都全树重绘，历史消息会被重复渲染，而且可能超出终端高度。

Ink 提供了 **`<Static>`** 组件专门处理这种「只增不减」的内容。`Static` 接收一个 `items` 数组，用 render 函数渲染每一项。关键是：**已经渲染过的 item 不会被重新渲染**，只会把新 item 追加到输出里。这样历史消息「钉」在终端上方，新的往下长，底部的动态区（比如输入框、进度条）照常更新。Gatsby 的构建输出、Tap 的测试列表都是这么做的。

```jsx
<Static items={messages}>
  {msg => (
    <Box key={msg.id}>
      <Text color="gray">{msg.role}: </Text>
      <Text>{msg.content}</Text>
    </Box>
  )}
</Static>
<Box marginTop={1}>
  <Text>输入: {input}</Text>  {/* 动态区，每次更新都重绘 */}
</Box>
```

对于有固定高度的区域，`Box` 支持 `overflow="hidden"` 或 `overflow="visible"`，可以裁掉超出部分。但 Ink 目前**没有 `overflow="scroll"`**，也就是没有内置的「滚动视窗」——你不能在一个固定高度的 Box 里用方向键滚动查看超长内容。社区有 `ink-scroll-view` 等库做类似事情，但需要自己实现 windowing 逻辑（只渲染可见区域 + 维护 scroll offset）。

### 终端尺寸变化与光标

`useWindowSize` 可以拿到当前终端的行数和列数，配合 `stdout.on('resize')` 能在用户拖拽窗口时重新布局。`useCursor` 则用于控制光标的显示和位置，比如在输入框里让光标出现在正确的位置。

另外，当输出行数超过终端高度时，Ink 会清屏再重绘，而不是像 `docker-compose logs -f` 那样让内容自然向上卷动。这是 Ink 的设计选择：它假设你是「应用式」的全屏 TUI，而不是流式日志查看器。

## 五、为什么 React 心智适合 Terminal UI？

### 1. 组件化天然契合面板式布局

TUI 的典型结构就是多块「面板」：对话区、日志区、状态栏、输入框……每一块都可以抽成组件，用 props 控制展示内容，用 state 控制展开/折叠、选中项等。这和我们在 Web 里拆 `Sidebar`、`ChatArea`、`InputBar` 的思路完全一致。

### 2. 状态复杂时声明式更可控

AI 工具要展示的内容非常动态：对话在增长、工具在运行、进度在更新。用命令式的 `process.stdout.write` + 光标控制，很容易写出难以维护的意大利面。而 React 的「state → view」单向数据流，让每次渲染都是当前状态的完整快照，逻辑清晰得多。

### 3. 生态与调试

Ink 是 React renderer，所以你可以用 React DevTools 检查组件树。测试也可以用 React Testing Library 的思路，对组件做快照或行为测试。对已经深度使用 React 的团队来说，这是巨大的效率加成。

## 六、在受限介质中坚持审美

终端没有像素级自由，没有阴影和圆角（除非用 Unicode 和块字符模拟），色彩也受限于 256 色或真彩。但「前端之美」的本质不是特效堆砌，而是**信息层次、留白、对齐、一致性**。这些在终端里同样可以做到。

### 留白与间距

Ink 的 `padding`、`margin`、`gap` 和 Flexbox 的 `justifyContent`、`alignItems` 让你可以精确控制空白。不要塞满每一列，适当的留白能让界面更易读。例如：

```jsx
<Box flexDirection="row" gap={2}>
  <Box padding={1}><Text>左</Text></Box>
  <Box padding={1}><Text>右</Text></Box>
</Box>
```

### 色彩与层次

`Text` 的 `color`、`backgroundColor`、`bold`、`dimColor` 可以建立清晰的视觉层次。一个简单约定：标题用亮色 + 粗体，次要信息用 `dimColor`，成功/错误/警告分别用绿/红/黄。例如：

```jsx
<Box flexDirection="column" gap={1}>
  <Text bold color="cyan"># 构建完成</Text>
  <Text color="green">  ✓ 编译通过</Text>
  <Text color="red">  ✗ 测试失败: spec/a.test.js</Text>
  <Text dimColor>  耗时 2.3s</Text>
</Box>
```

Ink 底层用 chalk，支持 `green`、`#005cc5`、`rgb(232, 131, 136)` 等写法。避免到处高亮，保持克制的配色，终端里的层次感会明显提升。

### 动效与反馈

终端里没有 CSS 动画，但可以借助状态驱动的重绘，做出「活着」的感觉。这里举几个具体例子。

**Spinner**：用社区库 `ink-spinner`，几行代码就能在加载时显示旋转动画：

```jsx
import React from 'react';
import { render, Text } from 'ink';
import Spinner from 'ink-spinner';

const Loading = () => (
  <Text>
    <Text color="green"><Spinner type="dots" /></Text>
    {' 正在拉取...'}
  </Text>
);
render(<Loading />);
```

`Spinner` 内部用 `setInterval` 切换不同字符（如 `⠋` `⠙` `⠹` ...），触发 React 重绘，视觉上就是旋转。`type` 可选 `dots`、`line`、`arrow` 等，来自 [cli-spinners](https://github.com/sindresorhus/cli-spinners)。

**进度条**：用 `Box` 的 `width` 配合百分比，就能模拟进度条宽度变化：

```jsx
const ProgressBar = ({ percent = 50 }) => (
  <Box width={20} flexDirection="row">
    <Box width={`${percent}%`} backgroundColor="green"><Text> </Text></Box>
    <Text color="gray"> {percent}%</Text>
  </Box>
);
```

每次 `percent` 变化，Ink 会重绘，绿色区域「长」一截。这是很多 CLI（如 npm install）的常见模式。

**光标**：`useCursor` 可以控制光标位置和显隐。输入框里让光标出现在正确位置、等待输入时让光标闪烁，都能增强交互反馈。Gatsby 构建时的进度条 + 已完成页列表，就是 Static + 动效组合的典型。

## 七、动手试试：资源与示例

如果你对 Ink 产生了兴趣，官方和社区有大量现成资源可以快速上手。

### Useful Components

Ink 官方文档整理了 [Useful Components](https://github.com/vadimdemedes/ink?tab=readme-ov-file#useful-components)，都是经过验证的社区库，可直接 `npm install` 使用：

| 组件 | 用途 |
|------|------|
| `ink-text-input` | 文本输入框 |
| `ink-select-input` | 下拉选择 |
| `ink-spinner` | 加载动画 |
| `ink-progress-bar` | 进度条 |
| `ink-multi-select` | 多选列表 |
| `ink-table` | 表格 |
| `ink-confirm-input` | 确认（Yes/No） |
| `ink-syntax-highlight` | 代码高亮 |
| `ink-markdown` | 渲染 Markdown |
| `ink-scroll-view` | 滚动容器 |

这些组件覆盖了 TUI 里最常见的交互模式。比如做一个「选择模板」的 CLI，用 `ink-select-input` 几分钟就能搭起来；展示代码片段用 `ink-syntax-highlight`，和 IDE 的终端预览体验类似。

### 官方 Examples

Ink 仓库的 [examples](https://github.com/vadimdemedes/ink/tree/master/examples) 目录提供了可运行的示例，用 `npm run example examples/[name]` 即可体验：

- **Counter**：每 100ms 自增的数字，就是前文用来解释渲染流程的那个
- **Jest**：模拟 Jest 的测试输出 UI，Static + 动态进度
- **Table**：多列表格，感受 Flexbox 在终端里的对齐
- **Focus management**：用 `useFocus` 做 Tab 切换，多个可聚焦区域
- **User input**：`useInput` 监听键盘，实现简单输入
- **Static**：Gatsby 风格的「已完成项在上方累积 + 底部动态更新」
- **Suspense**：异步数据加载 + Suspense 边界
- **Router**：用 React Router 的 `MemoryRouter` 做「页面」切换

这些示例都是完整的、可运行的，建议克隆 [ink](https://github.com/vadimdemedes/ink) 仓库后逐个跑一遍，比读文档直观得多。

### 5 分钟上手路径

1. `npx create-ink-app my-cli` 或 `npx create-ink-app --typescript my-cli`
2. 在 `ui.tsx` 里把默认组件改成前文的 Counter 或迷你布局
3. `npm run build && npm start` 看效果
4. 装上 `ink-spinner`，加一个 `Loading` 组件
5. 打开 [examples](https://github.com/vadimdemedes/ink/tree/master/examples) 挑一个感兴趣的，对照源码改一改

## 八、Ink 的局限（选型参考）

了解这些，有助于你在「是否用 Ink」和「如何设计」时做出更合适的决策。它们不影响 Ink 作为 TUI 方案的价值，但值得在选型时纳入考量。

### 全量重绘与性能

每次 state 变化都会触发全树遍历和全屏重绘。对简单 UI 影响不大；组件树深、更新频繁时，可能出现闪烁或卡顿。建议：用 `Static` 分离只增不减的内容、对昂贵计算用 `useMemo`、必要时节流。Ink 还提供 `incrementalRendering` 和 `maxFps` 选项，可以按需开启。

### 内存占用

Ink 依赖 Node、React、Yoga（含 WASM），整体内存较纯原生 CLI 高：开发模式约 50MB，打包后约 32MB。Go 的 Bubble Tea 同类应用可能只有几 MB。对本地 CLI、AI 工具通常可接受；资源受限环境需权衡。

### 功能边界

- **无 overflow: scroll**：长列表滚动需自己实现或借助 `ink-scroll-view`
- **CJK / IME**：中文输入法下可能有延迟或光标错位
- **Windows**：部分终端 ANSI 支持不完整

## 九、结语：介质在变，美感永恒

前端之美的初心，是追求更好的人机交互——清晰的视觉层次、流畅的反馈、符合直觉的操作。这份追求并不局限于浏览器。当 AI 工具、DevTools、云开发环境越来越依赖终端时，Terminal UI 就成了新的战场。

Ink 的价值在于：**它让 React 开发者无需切换心智，就能在终端里延续同样的设计语言和工程实践**。Flexbox、组件、Hooks——这些你早已掌握的前端技艺，在终端里依然有效。

如果你对 Terminal UI 感兴趣，不妨从 Ink 开始。用你熟悉的 React，在 80x24 的字符画布上，做一点既实用又好看的东西。这也是前端之美的一种延续。

---

**参考文献与延伸阅读**

- [Ink - React for CLIs](https://github.com/vadimdemedes/ink)
- [Ink - Useful Components](https://github.com/vadimdemedes/ink?tab=readme-ov-file#useful-components)
- [Ink - Examples](https://github.com/vadimdemedes/ink/tree/master/examples)
- [Yoga - Cross-platform layout engine](https://github.com/facebook/yoga)
- [Claude Code - Anthropic's agentic coding tool](https://github.com/anthropics/claude-code)
- [Building rich command-line interfaces with Ink and React](https://vadimdemedes.com/posts/building-rich-command-line-interfaces-with-ink-and-react)
