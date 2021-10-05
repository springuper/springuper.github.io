---
layout: post
title: "如何保证调用构造函数也会得到一个实例"
date: 2011-03-10 13:36
status: publish
tags: [Instanceof, Scope-safe Constructor]
---

题目比较绕，其实意思很简单，先不解释，给出如下两个场景：

## 情景1

在js中，面向对象编程方法越来越流行，构造函数作为基础概念，使用的频率较高。

```js
function spring(name){
    this.name = name;
}
var firstIns = new spring('shang chun');   //an instance of spring
```

众所周知，构造函数本身也是一个函数，这就意味着它可以被随意调用。随着岁月的积累或协作人员之间信息不对称，很有可能不慎如下调用了这个构造函数：

```js
var secondeIns = spring('wang qiang');   // 'this' refer to window now
```

这样的代码并不会报错，但是却给全局对象`window`增加了`name`属性，这样的失误需要一种合适的方法避免。

<!-- more -->

## 情景2

想想看，如果我们想要马上调用新生成的实例，是不是只能这样去写

```js
(new spring('shang chun')).hasOwnProperty('name');
```

有没有更好的方法呢？

## 解决方案

事情回到了起点，我们想要的实际上是一个只要调用就无论如何都返回一个实例的构造函数，不管用不用`new`操作符。最近在看YUI3的源码，发现他们给出一种很好的解决方案，示例：

```js
function spring(name) {
    var _this = this;
    var insanceOf = function(o, type){
        return (o && o.hasOwnProperty && (o instanceof type));
    };
    if (!instanceOf(_this, spring)) {
         _this = new spring(name);
    } else {
         _this.name = name;
    }
    return _this;
}

var ins = new spring('shang chun');  // normal constructor
ins.name;  // outputs 'shang chun'

spring('shang chun').name;  // outputs 'shang chun'
```

