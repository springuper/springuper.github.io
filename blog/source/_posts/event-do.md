---
layout: post
title: "YUI事件体系之Y.Do"
date: 2012-07-14 17:34
comments: true
status: publish
tags: [YUI, Event, JavaScript]
---

YUI团队在种种场合不断的夸耀自己的事件体系是多么强大：

- YUI 3′s Event module is one of the strengths of the library  --Eric Miraglia, [YUI Theater — Luke Smith: "Events Evolved"](http://www.yuiblog.com/blog/2009/10/30/smith-yuiconf2009-events/)
- YUI 3 is not all about DOM manipulation — it also contains a robust set of class/object management tools, not to mention our powerful custom events --Tilo Mitra, [10 Things I Learned While Interning at YUI](http://net.tutsplus.com/articles/general/10-things-i-learned-while-interning-at-yui/)
- One of the strengths of the YUI App Framework is that it's integrated tightly with the rest of YUI and benefits from YUI's fantastic event system and plugin/extension infrastructure. --Ryan Grove, [How can I decided whether to choose YUI 3's MVC or Backbone for a new project?](http://www.quora.com/How-can-I-decided-whether-to-choose-YUI-3s-MVC-or-Backbone-for-a-new-project#ld_xJGMd1_3012)

事实的确如此吗？就使用YUI的开发者反馈来看，应该是不错的：

- AFAIK YUI 3's event system is the most sophisticated of any JavaScript framework. Am I wrong in thinking that? --[Walter Rumsby](https://twitter.com/wrumsby/status/113568040834174976)
- I love the event system in YUI. Pure awesomeness. --[Kevin Isom](https://twitter.com/kev_nz/statuses/180472697644515328)
- I am constantly impressed by the degree of excellence I find in working with the YUI3 framework --Andrew Wooldridge, [Cross YUI Communication and Custom Events](http://andrewwooldridge.com/blog/2011/03/08/cross-yui-communication-and-custom-events/)

作为一名YUI用户，我对其事件体系的强大深有体会。从本篇文章起，我将对YUI事件机制做一个全面分析。

本次我们介绍的是比较基础的两个对象`Y.EventHandle`和`Y.Do`。千里之行积于跬步，YUI整套事件机制也是从这两个对象开始构筑的。

<!-- more -->

## Y.EventHandle
`Y.EventHandle`的作用很简单：注销事件/消息监听。

```javascript
Y.EventHandle = function (evt, sub) {
    this.evt = evt; // 事件对象
    this.sub = sub; // 监听对象
};
Y.EventHandle.detach = function () {
    this.evt._delete(this.sub); // 执行event对象的_delete方法，注销事件/消息监听
    return true;
};
```

## Y.Do

`Y.Do`的作用是：向对象方法前面或者后面插入其它方法(前置、后置方法)，以达到动态修改对象行为的目的。这种方式，也称作[AOP](http://en.wikipedia.org/wiki/Aspect-oriented_programming)。

## 示例

让我们先来看个简单的例子：

```javascript
// 例1
YUI().use('event-custom', function (Y) {
    var cat = {
        eat: function () {
            console.log('eat a fish');
        }
    };

    cat.eat(); // output: eat a fish

    var beforeHandle = Y.Do.before(function () {
        console.log('catch a fish');
    }, cat, 'eat');
    var afterHandle = Y.Do.after(function () {
        console.log('done!');
    }, cat, 'eat');
    cat.eat(); // output: catch a fish, eat, done!

    afterHandle.detach();
    cat.eat(); // output: catch a fish, eat
});
```

在不修改原对象方法的基础上，可以方便的添加前置、后置方法，并且注销这些方法也很容易。`Y.Do`非常漂亮的解决了我们动态修改对象方法的需求！很难想象，如果不用`Y.Do`代码会复杂成怎样。

## 源代码分析

接下来，让我们看看YUI的内部实现吧。这是多么有趣的事，就像小时候买把手枪，想不明白为什么可以射击，就砸开一看究竟。

为了更容易的看懂代码的核心，我做了适当的简化，感兴趣的朋友可以去看未删节的[源码](http://yuilibrary.com/yui/docs/api/files/event-custom_js_event-do.js.html#l16)。

```javascript
// 代码版本为YUI3.4.1，YUI3.5.0对Y.Do的实现有所改进
var DO_BEFORE = 0,
    DO_AFTER = 1;
Y.Do = {
    // 缓存处理对象
    objs: {},
    before: function (fn, obj, sFn) {
        return this._inject(DO_BEFORE, fn, obj, sFn);
    },
    after: function (fn, obj, sFn) {
        return this._inject(DO_AFTER, fn, obj, sFn);
    },
    _inject: function (when, fn, obj, sFn) {
        var id = Y.stamp(obj), o, sid;
        if (!this.objs[id]) this.objs[id] = {};
        o = this.objs[id];
        if (!o[sFn]) {
            // 创建保存对象、方法名的Method对象
            o[sFn] = new Y.Do.Method(obj, sFn);
            // 修改对象方法
            obj[sFn] = function () {
                return o[sFn].exec.apply(o[sFn], arguments);
            };
        }
        sid = id + Y.stamp(fn) + sFn;
        // 注册插入方法
        o[sFn].register(sid, fn, when);

        // 返回EventHandle对象，方便注销
        return new Y.EventHandle(o[sFn], sid);
    }
}

Y.Do.Method = function (obj, sFn) {
    this.obj = obj;
    this.methodName = sFn;
    this.method = obj[sFn];
    this.before = {};
    this.after = {};
};
Y.Do.Method.prototype.register = function (sid, fn, when) {
    if (when) {
        this.after[sid] = fn;
    } else {
        this.before[sid] = fn;
    }
};
// 注销插入方法
Y.Do.Method.prototype._delete = function (sid) {
    delete this.before[sid];
    delete this.after[sid];
};
Y.Do.Method.prototype.exec = function () {
    var before = this.before,
        after = this.after,
        i, ret;
    // 执行插入前面的方法
    for (i in before) {
        if (before.hasOwnProperty(i)) {
            ret = before[i].apply(this.obj, arguments);
        }
    }
    // 执行原方法
    ret = this.method.apply(this.obj, arguments);
    // 执行插入后面的方法
    for (i in after) {
        if (after.hasOwnProperty(i)) {
            ret = after[i].apply(this.obj, arguments);
        }
    }
    return ret;
};
```

## 适用场景

### a) 动态修改对象方法

请参照例1。

### b) 动态修改原型方法

原型也是对象，所以，另外一个适用场景就是修改原型方法。

```javascript
// 例2
YUI().use('event-custom', function (Y) {
    function Car(brand) {
        this.brand = brand;
    };
    Car.prototype.start = function () {
        console.log('start');
    };

    var myCar = new Car('bmw');
    Y.Do.before(function () {
        console.log('open the door');
    }, Car.prototype, 'start');
    Y.Do.after(function () {
        console.log('the car is started!');
    }, Car.prototype, 'start');

    myCar.start(); // output: open the door, start, the car is started!
});
```

### c) 动态修改宿主方法

为宿主对象添加插件时，插件往往需要在宿主一些方法前后执行某些操作。YUI提供了一个很好的[例子](http://yuilibrary.com/yui/docs/plugin/#methods)。

### d) 动态修改被扩展对象方法

为对象添加扩展时，扩展对象往往需要在被扩展对象一些方法前后执行某些操作。YUI提供了一个很好的[例子](http://yuilibrary.com/yui/docs/assets/base/myextension.js.txt)。

## 进阶使用

由于简化代码，省略了一些细节。`Y.Do`还有很多功能，例如：可以根据前置方法返回值阻止默认方法执行、替换参数等等。下面介绍一些这样的进阶使用方式：

```javascript
// 例3
YUI().use('event-custom', function (Y) {
    function Car(brand, degree) {
        this.brand = brand;
        this.degree = degree || 0;
    };
    Car.prototype.shift = function (degree) {
        console.log('change to ' + degree);
    };

    var myCar = new Car('bmw');
    
    // 多个前置方法
    Y.Do.before(function (degree) {
        console.log('prepare to change');
    }, Car.prototype, 'shift');
    Y.Do.before(function (degree) {
        console.log('prepare to change again');
    }, Car.prototype, 'shift');
    myCar.shift(1); // output: prepare to change, prepare to change again, change to 1

    // 多个后置方法
    Y.Do.after(function (degree) {
        console.log('already change');
    }, Car.prototype, 'shift');
    Y.Do.after(function (degree) {
        console.log('already change again');
    }, Car.prototype, 'shift');
    myCar.shift(2); // output: ..., change to 2, already change, already change again 

    // 中止执行
    Y.Do.before(function (degree) {
        if (degree < 0) {
            console.log('halt, too low!');
            return new Y.Do.Halt();
        }
    }, Car.prototype, 'shift');
    myCar.shift(-1); // output: ..., halt, too low! 

    // 阻止默认方法
    Y.Do.before(function (degree) {
        if (degree > 4) {
            console.log('prevent changing, too high!');
            return new Y.Do.Prevent();
        }
    }, Car.prototype, 'shift');
    myCar.shift(5); // output: ..., prevent changing, too high!, already change, ... 

    // 替换参数
    Y.Do.before(function (degree) {
        var d = Math.floor(degree);
        if (degree !== d) {
            return new Y.Do.AlterArgs('degree should be a integer', [d]);
        }
    }, Car.prototype, 'shift');
    myCar.shift(2.5); // output: ..., change to 2, ... 

    // 替换返回值
    Y.Do.after(function (degree) {
        if (degree === 0) {
            return new Y.Do.AlterReturn('', 'wow, your car now has no power');
        }
    }, Car.prototype, 'shift');
    var ret = myCar.shift(0); // output: ..., change to 0, ... 
    console.log(ret); // wow, your car now has no power
});
```

## 参考

- [YUILibrary-Do](http://yuilibrary.com/yui/docs/api/classes/Do.html)
- [YUILibrary-EventTarget](http://yuilibrary.com/yui/docs/event-custom/index.html)
- [Wikipedia-AOP](http://en.wikipedia.org/wiki/Aspect-oriented_programming)
