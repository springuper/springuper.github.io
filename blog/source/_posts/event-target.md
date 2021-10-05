---
layout: post
title: "YUI事件体系之Y.EventTarget"
date: 2012-11-25 21:25
comments: true
status: publish
tags: [YUI, Event, JavaScript]
---

![bubble girl](/images/bubble-girl.jpg)

上两篇文章[YUI事件体系之Y.Do](/event-do/)、[YUI事件体系之Y.CustomEvent](/event-custom/)中，分别介绍了YUI实现AOP的`Y.Do`对象，以及建立自定义事件机制的`Y.CustomEvent`对象。

本篇文章，将要介绍YUI事件体系集大成者、最为精华的部分——`Y.EventTarget`。

## Y.EventTarget

DOM事件中的目标元素为`event.target`，这类元素可以触发、监听一些事件，例如input元素的click、focus等事件。这也正是`Y.EventTarget`的命名渊源，它提供了一种让任意对象定义、监听、触发自定义事件的实现方式。

从设计上看，`Y.EventTarget`通过内部维护一系列`Y.EventCustom`对象，提供了可以通过事件名称进行事件定义、监听和触发的便捷接口。另外，推荐使用`Y.augment`将它以组合的方式加载在其它类上，而不要使用继承。关于`Y.augment`和`Y.extend`之间的异同，可以参考我之前的一篇文章：[Y.extend与Y.augment](/extend-and-augment/)。

YUI很多基础类都扩展了`Y.EventTarget`，重要的有`Y`（YUI instance，sandbox）、`Y.Global`、`Y.Node`、`Y.NodeList`、`Y.Base`等。

YUILibrary有专门一个章节介绍EventTarget，非常详尽，如果你对EventTarget的设计思路和使用方法感兴趣，请移步[YUILibrary-EventTarget](http://yuilibrary.com/yui/docs/event-custom/)。

<!-- more -->

### 示例

首先，让我们看看`Y.EventTarget`独立调用的例子：

```javascript
// 例1
YUI().use('event-custom', function (Y) {
    var et = new Y.EventTarget();

    et.on('say', function (msg) {
        console.log('say:', msg);
    });
    et.on('listen', function (msg) {
        console.log('listen:', msg);
    });

    // output: say: Hello, world
    instance.fire('say', 'Hello, world');
});
```

<!-- more -->

这种方式实际意义不大，YUI中只有`Y.Global`使用了这种方式。

下面，让我们看下最广泛的使用方式，即通过`Y.augment`扩展其它类：

```javascript
// 例2
YUI().use('event-custom', function (Y) {
    function MyClass() {}
    MyClass.prototype.add = function (item) {
        // do sth
        this.fire('addItem', { item: item });
    };
    MyClass.prototype.remove = function (item) {
        // do sth
        this.fire('removeItem', { item: item });
    };
    // 用EventTarget扩展MyClass
    Y.augment(MyClass, Y.EventTarget);

    var instance = new MyClass();
    // 监听addItem事件
    instance.on('addItem', function (data) {
        console.log('add an item:', data.item);
    });
    // 监听removeItem事件
    instance.on('removeItem', function (data) {
        console.log('remove an item:', data.item);
    });

    // output: add an item: orange
    instance.add('orange');
    // output: remove an item: red
    instance.remove('red');
});
```

### 源代码分析

接下来，让我们看看YUI的内部实现吧。

注：为了更容易的看懂代码的核心，我做了适当的简化，感兴趣的朋友可以去看未删节的[源码](http://yuilibrary.com/yui/docs/api/files/event-custom_js_event-custom.js.html#l38)。

```javascript
var AFTER_PREFIX = '~AFTER~';

// EventTarget构造器
var ET = function (opts) {
    var o = opts || {};
    // 私有事件聚合器
    this._yuievt = this._yuievt || {
        id: Y.guid(),
        events: {},
        config: o,
        // 默认配置
        defaults: {
            context: o.context || this,
            host: this,
            emitFacade: o.emitFacade,
            fireOnce: o.fireOnce,
            queuable: o.queuable,
            broadcast: o.broadcast
        }
    };
};

ET.prototype = {
    constructor: ET,
    // 创建事件
    publish: function (type, opts) {
        var ce,
            events = this._yuievt.events,
            defaults = this._yuievt.defaults;

        ce = events[type];
        if (ce) { // 已创建过该事件
            if (opts) {
                ce.applyConfig(opts, true);
            }
        } else { // 基于CustomEvent，创建新事件
            ce = new Y.CustomEvent(type,
                                    (opts) ? Y.merge(defaults, opts) : defaults);
            events[type] = ce;
        }

        return ce;
    },
    // 监听事件
    on: function (type, fn, context) {
        var ce,
            after,
            handle,
            args = null;

        // 判断是否为后置监听
        if (type.indexOf(AFTER_PREFIX) &gt; -1) {
            after = true;
            type = type.substr(AFTER_PREFIX.length);
        }

        // 获取自定义事件对象，如果未创建则先创建
        ce = this._yuievt.events[type] || this.publish(type);
        if (arguments.length &gt; 3) {
            args = Y.Array(arguments, 3, true);
        }

        // 调用自定义事件对象的_on方法监听事件
        handle = ce._on(fn, context, args, after ? 'after' : true);

        return handle;
    },
    // 监听一次事件
    once: function () {
        var handle = this.on.apply(this, arguments);
        if (handle.sub) {
            // 监听器执行一次则失效
            handle.sub.once = true;
        }
        return handle;
    },
    // 后置监听事件
    after: function (type, fn) {
        var a = Y.Array(arguments, 0, true);
        a[0] = AFTER_PREFIX + type;
        return this.on.apply(this, a);
    },
    // 后置监听一次事件
    onceAfter: function () {
        var handle = this.after.apply(this, arguments);
        if (handle.sub) {
            handle.sub.once = true;
        }
        return handle;
    },
    // 触发事件
    fire: function (type) {
        var ce,
            args;
        args = Y.Array(arguments, 1, true);
        ce = this._yuievt.events[type];
        // 尚未创建事件
        if (!ce) return true;

        return ce.fire.apply(ce, args);
    },
    // 注销事件监听
    detach: function (type, fn, context) {
        var events = this._yuievt.events,
            ce,
            i;

        // 未设置事件类型，则注销所有类型的事件
        if (!type) {
            for (i in events) {
                if (events.hasOwnProperty(i)) {
                    events[i].detach(fn, context);
                }
            }
            return this;
        }

        ce = events[type];
        if (ce) {
            ce.detach(fn, context);
        }

        return this;
    }
};
```

### 进阶用法

`Y.EventTarget`作为一个十分重要的类，提供了非常丰富、方便的使用方式，除了依赖内部`Y.CustomEvent`实现的事件接口、默认执行方法、事件广播等，其余主要有：

#### a) 事件冒泡

多个EventTarget对象之间可以建立一定事件传播关系，类似DOM事件中的冒泡。

```javascript
// 例3
YUI().use('event-custom', function (Y) {
    // 父类
    function Parent() { ... }
    Y.augment(Parent, Y.EventTarget, true, null, { emitFacade: true });
    // 子类
    function Child() { ... }
    Y.augment(Child, Y.EventTarget, true, null, { emitFacade: true });

    var parent = new Parent(),
        child = new Child();
    // 子类对象添加冒泡目标对象，child -&gt; parent
    child.addTarget(parent);

    parent.on('hear', function (e) {
        console.log('parent hear', e.msg);
    });
    child.on('hear', function (e) {
        console.log('child hear', e.msg);
    });

    // output: child hear Hi, parent hear Hi
    child.fire('hear', { msg: 'Hi' });
});
```

#### b) 事件前缀

在事件冒泡的基础上，考虑到区分不同EventTarget对象触发相同事件，YUI引入了事件前缀（Event Prefix）。

```javascript
// 例4
YUI().use('event-custom', function (Y) {
    // 父类
    function Parent() { ... }
    Y.augment(Parent, Y.EventTarget, true, null, {
        emitFacade: true,
        prefix: 'parent' // 配置事件前缀
    });
    // 子类
    function Child() { ... }
    Y.augment(Child, Y.EventTarget, true, null, {
        emitFacade: true,
        prefix: 'child' // 配置事件前缀
    });

    var parent = new Parent(),
        child = new Child();
    child.addTarget(parent);

    parent.on('hear', function (e) { // 不能捕捉到child的hear事件
        console.log('parent hear', e.msg);
    });
    child.on('hear', function (e) {
        console.log('child hear', e.msg);
    });

    // output: child hear Hi
    child.fire('hear', { msg: 'Hi' });

    parent.on('*:see', function (e) { // 要想监听到其它EventTarget对象的see事件，需要设置prefix
        console.log('parent see', e.thing);
    });
    child.on('child:see', function (e) { // 等同监听see事件
        console.log('child see', e.thing);
    });

    // output: child hear MM, parent see MM
    child.fire('see', { thing: 'MM' });
});
```

## 参考

- [YUILibrary-CustomEvent](http://yuilibrary.com/yui/docs/api/files/event-custom_js_event-custom.js.html)
- [YUILibrary-EventTarget](http://yuilibrary.com/yui/docs/event-custom/index.html)
