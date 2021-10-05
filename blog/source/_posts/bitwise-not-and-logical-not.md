---
layout: post
title: "js 中的 !! 与 ~~"
date: 2015-10-17 21:01
status: publish
tags: [BitwiseNOT, LogicalNOT, JavaScript]
---

在各大 js 的开源项目中，时常见到 !! 和 ~~，偶有猜对，却总不得要领。本文旨在深入剖析下这两个运算符的原理，以及使用时的利弊。

## !

为了简化问题，我们首先了解下常见的逻辑非运算符 !，EcmaScript 中的定义是：

> 产生式 `UnaryExpression : ! UnaryExpression` 按照下面的过程执行：
> 
> - 令 `expr` 为解析执行 `UnaryExpression` 的结果
> - 令 `oldValue` 为 ToBoolean(GetValue(`expr`))
> - 如果 `oldValue` 为 true, 返回 false
> - 返回 true

GetValue 处理取值的细节，例如依附于对象的属性、执行 getter 等，不再深究。重点看下 ToBoolean，它能够将各种类型的值最终转化为布尔类型。具体的规则可参考 [ES5#9.2 ToBoolean](http://es5.github.io/#x9.2) 一节。

接下来的处理很简单，如果 ToBoolen 得到的结果 `oldValue` 是 true，那就返回 false，否则返回 true。

## !!

了解了 ! 之后，!! 就很好解释了，简单来说就是：

> 产生式 `UnaryExpression : !! UnaryExpression` 按照下面的过程执行：
> 
> - 令 `expr` 为解析执行 `UnaryExpression` 的结果
> - 返回 ToBoolean(GetValue(`expr`))

是的，比 ! 的运算过程减少了两步，执行完 ToBoolean 后就直接返回了。这也是 !! 最主要的用途：**将操作数转化为布尔类型**。例如：

```js
!! null // false
!! undefined // false

!! '' // false
!! 'hello' // true

!! 5 // true
!! 0 // false

!! {} // true
```

值得提示的一点是，!! 实际上等效于 `Boolean` 被当做函数调用的效果：

```js
!!(value) === Boolean(value)
```

## ~

按位非操作符 ~ 比逻辑非操作符 ! 复杂一些，作用是将数值比特位中的 1 变成 0，0 变成 1。EcmaScript 中的定义为：

> 产生式 `UnaryExpression : ~ UnaryExpression` 按照下面的过程执行：
> 
> - 令 `expr` 为解析执行 `UnaryExpression` 的结果
> - 令 `oldValue` 为 ToInt32(GetValue(`expr`))
> - 返回 `oldValue` 按位取反的结果

与逻辑非执行过程第二步不同，按位非调用的是 ToInt32 而不是 ToBoolean。ToInt32 的处理过程比较复杂，简化为以下四步：

- 令 `number` 为调用 ToNumber 将输入参数转化为数值类型的结果
- 如果 `number` 是 NaN，+0，-0，+∞ 或者 -∞，返回 +0
- 令 `posInt` 为 sign(`number`) * floor(abs(`number`))
- 将 `posInt` 进行取模处理，转化为在 −2^31 到 2^31−1 之间的 32 位有符号整数并返回

从效果上看，ToInt32 依次做了这样几件事：

- 类型转换，非数值类型的需要转化为数值类型
- 特殊值处理，NaN 和 ∞ 都被转化为 0
- 取整，如果是浮点数，会损失小数点后面的精度
- 取模，将整数调整到 32 位有符号整数区间内，如果整数原本不在这个区间，会丧失精度

执行完 ToInt32 之后，将得到的 32 位有符号整数进行按位取反，并将结果返回。

需要注意的是，所有的位操作都会先将操作数转化为 32 位有符号整数。

## ~~

和 !! 与 ! 的关系类似，~~ 实际上是 ~ 的简化版：

> 产生式 `UnaryExpression : ~~ UnaryExpression` 按照下面的过程执行：
> 
> - 令 `expr` 为解析执行 `UnaryExpression` 的结果
> - 返回 ToInt32(GetValue(`expr`))

因为第一次执行 ~ 时已经将操作数转化为 32 位有符号整数，第二次执行 ~ 时实际只是将按位取反的结果再次按位取反，相当于取消掉 ~ 处理过程中的第三步。那么 ~~ 的用途也就很明确了：**将操作数转化为 32 位有符号整数**。

下面来看一些具体例子：

```js
~~ null // 0
~~ undefined // 0
~~ NaN // 0
~~ {} // 0
~~ true // 1
~~ '' // 0
~~ 'string' // 0
~~ '1' // 1
~~ Number.POSITIVE_INFINITY // 0

~~ 1.2 // 1
~~ -1.2 // -1
~~ 1.6 // 1
~~ -1.6 // -1
~~ (Math.pow(2, 31) - 1) // 2147483647 = 2^31-1
~~ (Math.pow(2, 31)) // -2147483648 = -2^31
~~ (-Math.pow(2, 31)) // -2147483648 = -2^31
~~ (-Math.pow(2, 31) - 1) // 2147483647 = 2^31-1
~~ (Math.pow(2, 32)) // 0
```

如果你需要将一个参数转化为 32 位有符号整数，那么 ~~ 将是最简便的方式。不过要切记，它会损失精度，包括小数和整数部分。

## 参考

- [按位操作符-MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators)
- [ToBoolean - ES5](http://es5.github.io/#x9.2)
- [ToInt32 - ES5](http://es5.github.io/#x9.5)
- [Bitwise NOT Operator - ES5](http://es5.github.io/#x11.4.8)
- [Logical NOT Operator - ES5](http://es5.github.io/#x11.4.9)
