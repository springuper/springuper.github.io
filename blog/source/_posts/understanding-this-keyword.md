---
layout: post
title: "[译]理解Javascript关键字this"
date: 2011-06-21 21:52
status: publish
tags: [This]
---

<div class="preface">
    <p>在上一次原生javascript分享时，我发现自己对this的理解仍然不够准确。在翻看了很多现有的文章后，我很失望的发现基本全是在讲种种类型的场景下this是怎样怎样，我需要的不是这些，我想看到更深入的一些解释，例如this在函数中从何而来。后来，我准备自己查阅资料后总结一篇，就在准备资料的时候我欣喜的看到了下面这篇文章，当时的心情只能用相见恨晚来表达。我认为自己不会写出更好的文章，所以就勉强翻译过来给一些E文不太好的童鞋分享，E文好的童鞋请移步，原著更加准确生动些。</p>
    <p>原文链接：<a href="http://javascriptweblog.wordpress.com/2010/08/30/understanding-javascripts-this/" target="_blank">Understanding JavaScript’s this keyword</a></p>
</div>

`this`在Javascript中应用广泛，但对它的误解却比比皆是。

## 你需要知道

每个运行环境\(execution context，简称环境\)都含有一个与之关联的ThisBinding常量，它们具有相同的生命周期。运行环境分为三类：

### 1. 全局环境

`this`指向全局对象，在浏览器中为`window`对象。

```js
alert(this);  // window
```

<!-- more -->

### 2. 函数环境

至少有5种调用函数的方式，`this`的值取决于具体的调用方式。

#### a) 作为属性调用

`this`的值为将函数作为属性调用的基本对象\([baseValue](http://javascriptweblog.wordpress.com/2010/08/09/variables-vs-properties-in-javascript/)\)

```js
var a = {
    b: function() {
        return this;
    }
};

a.b();  // a
a['b']();  // a

var c = {};
c.d = a.b;
c.d();  // c
```

#### b) 作为变量调用

`this`指向全局对象。

```js
var a = {
    b: function() {
        return this;
    }
};

var foo = a.b;
foo();  // window

var a = {
    b: function() {
        var c = function() {
            return this;
        };
        return c();
    }
};

a.b();  // window
```

自执行函数\(self-invoking functions\)也是如此：

```js
var a = {
    b: function() {
        return (function() { return this; })();
    }
};

a.b();  // window
```

#### c) 通过Function.prototype.call调用

`this`的值由`call`的第一个参数决定。

#### d) 通过Function.prototype.apply调用

`this`的值由`apply`的第一个参数决定。

```js
var a = {
    b: function() {
        return this;
    }
};

var d = {};

a.b.apply(d);  // d
```

#### e) 通过new作为构造器调用

`this`指向新生成的对象。

```js
var A = function() {
    this.toString = function() { return "I'm an A"; };
};

new A();  // "I'm an A"
```

### 3. eval环境

`this`的值等于调用`eval`方法的执行环境中的`this`。

```js
alert(eval('this == window'));  // true - (except firebug, see above)
var a = {
    b: function() {
        eval('alert(this == a)');
    }
};

a.b();  // true
```

## 你也许想知道

本节以ECMA 5 262为参考，对在函数环境下`this`获取值的过程做深入探究。

我们从ECMA中的`this`定义开始：

> 关键字this等于当前执行环境中ThisBinding的值。  *ECMA 5, 11.1.1*

### ThisBinding是如何设定的呢？

每个函数都定义了一个内部方法\[\[Call\]\]\(ECMA 5, 13.2.1 [[Call]]\) ，用来将invocation values传给该函数的执行环境：

> 当控制器进入函数对象F的函数代码(function code)的执行环境时，依据调用对象提供的参数thisValue和argumentsList，执行以下步骤：
> 
> 1. 若函数代码 (function code) 为严格代码 (strict code)，令ThisBinding等于thisValue
> 2. 否则，若thisValue为null或undefined，令ThisBinding等于全局对象
> 3. 否则，若thisValue不是Object类型，令thisBinding等于ToObject(thisValue)
> 4. 否则，令thisBinding等于thisValue
> 5. ⋯⋯
> *ECMA 5, 10.4.3 Entering Function Code*

也就是说，`ThisBinding`在`thisValue`为基本类型时设定为其强制转化对象，或者当`thisValue`为`undefined`、`null`时，设定为全局对象\(运行于严格模式时除外，这种情况下`ThisBinding`等于`thisValue`\)。

### 那thisValue从何而来？

这里我们需要回到之前提到的五种调用函数的方式：

#### 1. 作为属性调用

#### 2. 作为变量调用

用ECMAScript的说法，这两种方式称为Function Calls，包含两个要素：MemberExpression和Arguments list。

> 1. 令ref为执行MemberExpression后得到的结果
> 2. 令func为GetValue(ref)
> 6. 若Type(ref)是引用，则
>     a) 若IsPropertyReference(ref)为true，令thisValue为GetBase(ref)
>     b) 否则，ref的基本对象是一个Environment Record，令thisValue为执行GetBase(ref)的具体方法ImplicitThisValue得到的结果
> 7. 否则，Type(ref)不是引用，则令thisValue为undefined
> 8. 令this等于thisValue，argument values等于argList，调用func内部方法[[Call]]，并将结果返回
> *ECMA 5, 11.2.3 Function Calls*

那么，从本质来讲，`thisValue`成为函数表达式的baseValue\(见上面第6步。译者注：baseValue为`GetBase`方法得到的结果\)。

当函数作为属性调用时，baseValue就是在点号\(或中括号\)前面的标识符。

```js
var foo = {
    bar: function() {
        // (Comments apply to example invocation only)
        // MemberExpression = foo.bar
        // thisValue = foo
        // ThisBinding = foo
        return this;
    }
};

foo.bar();  // foo
foo['bar']();  // foo
```

对于作为变量调用的情况，`baseValue`则是变量对象\(VariableObject，即上面提到的Environment Record\)，变量对象属于声明式Environment Record。ECMA 10.2.1.1讲解道，声明式Environment Record的ImplicitThisValue为`undefined`。

```js
var bar = function() { ... };
bar();  // thisValue is undefined
```

重温上面提到过的10.4.3 Entering Function Code后，我们可以看到，除非在严格模式下，`thisValue`为`undefined`会使`ThisBinding`的值为全局对象。因此`this`在一个作为变量调用的函数中指向全局对象。

```js
var bar = function() {
    // (Comments apply to example invocation only)
    // MemberExpression = bar
    // thisValue = undefined
    // ThisBinding = global object (e.g. window)
    return this;
};

bar();  // window
```

#### 3. 通过Function.prototype.apply调用

#### 4. 通过Function.prototype.use调用

\(规范参见15.3.4.3 Function.prototype.apply，15.3.4.4 Function.prototype.use\)

这两个小节描述了在`call`和`apply`调用函数时，函数中的`this`参数\(它的第一个参数\)的实际值是如何作为`thisValue`传递给10.4.3 Entering Function Code的。\(注意，这一点不同于ECMA 3，后者规定`thisArg`的值为基本类型时需要转换为对象类型，为`null`或`undefined`时需要转化为全局对象——但这些区别通常可以忽略，因为`thisArg`的值会在目标函数调用时进行相同的转换过程\(参见已讲过的10.4.3 Entering Function Code\)\)

#### 5. 通过new作为构造器调用

> 当函数对象F的内部方法[[Construct]]被调用时，执行以下步骤：
> 1. 令obj为新生成的原生ECMAScript对象
> 8. 令thisValue等于obj，args为传入[[Construct]]的参数列表，调用F内部方法[[Call]]，并将结果保存为result
> 10. 返回obj
> *ECMA 5, 13.2.2 [[Construct]]*

显而易见，作为构造器调用函数会生成一个新的对象，它被赋给`thisValue`。这种方式与其它`this`的使用方式截然不同。

## 释疑

### 严格模式
在ECMAScript的严格模式下，`thisValue`不会强制转化为一个对象。`this`的值为`null`或`undefined`时不会转化为全局对象，并且基本类型的值不会转化为包装类型对象。

### bind函数
`Function.prototype.bind`是ECMAScript 5新添加的一个方法，使用主流框架的开发者对它已经非常熟悉。基于`call`/`apply`，`bind`可以通过简单的语法预设执行环境中`thisValue`的值。这在事件响应函数中非常有用，例如一个监听按钮点击事件的函数，它的`ThisBinding`默认为`onclick`属性的`baseValue`，即按钮元素：

```js
// Bad Example: fails because ThisBinding of handler will be button
var sorter = function() {
    sort: function() {
        alert('sorting');
    },
    requestSorting: function() {
        this.sort();
    }
};

$('sortButton').onclick = sorter.requestSorting;

// Good Example: sorter baked into ThisBinding of handler
var sorter = function() {
    sort: function() {
        alert('sorting');
    },
    requestSorting: function() {
        this.sort();
    }
};

$('sortButton').onclick = sorter.requestSorting.bind(sorter);
```

## 延伸阅读

[ECMA 262 5th Edition \(PDF\)](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-262.pdf)

- 11.1.1 Definition of this
- 10.4.3 Entering Function Code
- 11.2.3 Function Calls
- 13.2.1 [[Call]]
- 10.2.1.1 Declarative Environment Record \(ImplicitThisValue\)
- 13.2.2 [[Construct]]
- 15.3.4.3 Function.prototype.apply
- 15.3.4.4 Function.prototype.call
- 15.3.4.5 Function.prototype.bind
- Annex C The Strict Mode of ECMAScript
