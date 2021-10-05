---
layout: post
title: "YUI事件体系之Y.CustomEvent"
date: 2012-09-01 19:13
comments: true
status: publish
tags: [YUI, Event, JavaScript]
---

![DIY](/images/DIY.jpg)

上一篇[文章](/2013/01/20/event-do/)中，简要介绍了YUI实现AOP的`Y.Do`对象。

接下来，我们继续对YUI事件体系进行探索。本次要介绍的是`Y.CustomEvent`对象，从命名上就可以看出，这个对象在整个YUI事件体系中十分重要。它建立起整个自定义事件的体系，而且，DOM事件也构建在这个体系之上。

## Y.Subscriber

Y.Subscriber的作用比较简单：执行回调函数。

```javascript
Y.Subscriber = function (fn, context) {
    this.fn = fn; // 回调函数
    this.context = context; // 上下文
    this.id = Y.stamp(this); // 设置唯一id
};
Y.Subscriber.prototype = {
    constructor: Y.Subscriber,
    // 执行回调函数
    notify: function (args, ce) {
        if (this.deleted) return null;
        var ret;

        ret = this.fn.apply(this.context, args || []);
        // 只监听一次
        if (this.once) {
            ce._delete(this);
        }

        return ret;
    }
};
```

## Y.CustomEvent

`Y.CustomEvent`主要作用是：建立自定义事件机制，为方便的进行事件创建、监听、触发提供良好基础。自定义事件机制，实际上是[Observer Pattern](http://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern)（[Publish–subscribe Pattern](http://en.wikipedia.org/wiki/Observer_pattern)的演化）的一种实现，这种机制能够方便的实现模块间解耦，增强模块的扩展性。

YUI的自定义事件较其它一些js库来说要强大一些，有这样一些好的features：

- 支持事件接口(Event Facade)，在回调函数中可以进行调用
- 支持设置默认执行方法
- 支持停止/立即停止传播，并可设定停止传播时执行的方法
- 支持阻止默认行为(默认执行方法)，并可设定阻止默认行为时执行的方法
- 支持冒泡。指定冒泡目标序列，就可以顺序的触发事件(需要`Y.EventTarget`)
- 支持广播。每个自定义事件，都可以设置在当前YUI实例范围内和全局YUI内进行广播

可以看出，YUI的自定义事件和DOM事件极其类似，这种设计自然到我们在用自定义事件时，丝毫感觉不到和DOM事件的差异。

<!-- more -->

### 示例

让我们先来看个简单的例子：

```javascript
// 例1 简单自定义事件
YUI().use('event-custom', function (Y) {
    var eatEvent = new Y.CustomEvent('eat');
    var onHandle = eatEvent.on(function () {
        Y.log('before eating');
    });
    var onHandle2 = eatEvent.on(function () {
        Y.log('before eating, too');
    });
    var afterHandle = eatEvent.after(function () {
        Y.log('after eating');
    }); 

    // output: "before eating", "before eating, too", "after eating"
    eatEvent.fire();

    onHandle2.detach();
    // output: "before eating", "after eating"
    eatEvent.fire();
});
```

有些事件只需触发一次，比如你的各种第一次～～～。来看这个例子：
```javascript
// 例2 仅触发一次的自定义事件
YUI().use('event-custom', function (Y) {
    var birthEvent = new Y.CustomEvent('birth', {
        fireOnce: true  // you can only birth once
    });
    var onBirthHandle = birthEvent.on(function () {
        Y.log('before birth');
    });

    // output: "before birth"
    birthEvent.fire();
    // nothing happened
    birthEvent.fire();

    // 只触发一次的事件在触发后，再次添加监听方法时，会被立即执行
    // output: before birth, too
    var onBirthHandle2 = birthEvent.on(function () {
        Y.log('before birth, too');
    });
});
```

也许你还在琢磨，事件广播是什么？因为YUI使用了sandbox设计，可以生成不同实例绑定不同api，所以才有了事件广播机制。来看这个例子：

```javascript
// 例3 事件广播
YUI().use('event-custom', function (Y) {
    var cryEvent = new Y.CustomEvent('cry', {
        broadcast: 2  // global broadcast
    });
    cryEvent.on(function () {
        Y.log('before cry');
    });
    Y.on('cry', function () {
        Y.log('YUI instance broadcast');
    });
    Y.Global.on('cry', function () {
        Y.log('YUI global broadcast');
    });

    // output: "before cry", "YUI instance broadcast", "YUI global broadcast"
    cryEvent.fire();
});
```

文章之前介绍过YUI自定义事件的种种NB之处，那么用起来如何呢，来看下面的例子：

```javascript
// 例4 复杂自定义事件
YUI().use('event-custom', function (Y) {
    var driveEvent = new Y.CustomEvent('drive', {
        emitFacade: true,
        host: {  // hacking. 复杂自定义事件需要指定host，该host必须augment Y.EventTarget
            _yuievt: {},
            _monitor: function () {}
        },
        defaultFn: function () {
            Y.log('execute defaultFn');
        },
        preventedFn: function () {
            Y.log('execute preventedFn');
        },
        stoppedFn: function () {
            Y.log('execute stoppedFn');
        }
    });
    driveEvent.on(function (e) {
        e.stopImmediatePropagation();
    });
    driveEvent.on(function (e) {
        e.preventDefault();
    });
    driveEvent.after(function (e) {
        Y.log('after driving');
    });

    // output: "execute stoppedFn", "execute defaultFn"
    driveEvent.fire();
});
```

不要失望，现在还没有介绍到事件体系的精华部分`Y.EventTarget`，所以很多特性（例如冒泡）还不能体现出来，拭目以待吧。

### 源代码分析

接下来，让我们看看YUI的内部实现吧。

注：为了更容易的看懂代码的核心，我做了适当的简化，感兴趣的朋友可以去看未删节的[源码](http://yuilibrary.com/yui/docs/api/files/event-custom_js_event-custom.js.html#l38)。

```javascript
var AFTER = 'after',
    // config白名单
    CONFIGS = ['broadcast', 'monitored', 'bubbles', 'context', 'contextFn', 'currentTarget', 'defaultFn', 'defaultTargetOnly', 'details', 'emitFacade', 'fireOnce', 'async', 'host', 'preventable', 'preventedFn', 'queuable', 'silent', 'stoppedFn', 'target', 'type'];

Y.CustomEvent = function (type, o) {
    this.id = Y.stamp(this);
    this.type = type;
    this.context = Y;
    this.preventable = true;
    this.bubbles = true;
    this.subscribers = {}; // (前置)监听对象容器 注：YUI3.7.0将此处进行了优化
    this.afters = {}; // 后置监听对象容器 注：YUI3.7.0将此处进行了优化
    this.subCount = 0;
    this.afterCount = 0;

    o = o || {};
    this.applyConfig(o, true);
};
Y.CustomEvent.prototype = {
    constructor: Y.CustomEvent,
    // 设置参数
    applyConfig: function (o, force) {
        if (o) {
            Y.mix(this, o, force, CONFIGS);
        }
    },

    // 添加前置监听对象
    on: function (fn, context) {
        var a = (arguments.length &gt; 2) ? Y.Array(arguments, 2, true) : null;
        return this._on(fn, context, a, true);
    },
    // 添加后置监听对象
    after: function (fn, context) {
        var a = (arguments.length &gt; 2) ? Y.Array(arguments, 2, true) : null;
        return this._on(fn, context, a, AFTER);
    },
    // 内部添加监听对象
    _on: function (fn, context, args, when) {
        var s = new Y.Subscriber(fn, context);

        if (this.fireOnce &amp;&amp; this.fired) {
            // 仅触发一次的事件在触发后，再次添加监听方法时，会被立即执行
            this._notify(s, this.firedWith);
        }

        if (when == AFTER) {
            this.afters[s.id] = s;
            this.afterCount++;
        } else {
            this.subscribers[s.id] = s;
            this.subCount++;
        }

        return new Y.EventHandle(this, s);
    },

    // 触发事件
    fire: function () {
        if (this.fireOnce &amp;&amp; this.fired) {
            // 仅触发一次的事件，如果已经触发过，直接返回true
            return true;
        } else {
            // 可以设置参数，传给回调函数
            var args = Y.Array(arguments, 0, true);

            this.fired = true;
            this.firedWith = args;

            if (this.emitFacade) {
                // 复杂事件
                return this.fireComplex(args);
            } else {
                return this.fireSimple(args);
            }
        }
    },
    // 触发简单事件
    fireSimple: function (args) {
        this.stopped = 0;
        this.prevented = 0;
        if (this.hasSubs()) {
            var subs = this.getSubs();
            // 处理前置监听对象
            this._procSubs(subs[0], args);
            // 处理前置监听对象
            this._procSubs(subs[1], args);
        }
        this._broadcast(args);
        return this.stopped ? false : true;
    },
    // 判断是否有监听对象
    hasSubs: function (when) {
        var s = this.subCount,
            a = this.afterCount;
        if (when) {
            return (when == 'after') ? a : s;
        }
        return (s + a);
    },
    // 获取所有前置／后置监听对象
    getSubs: function () {
        var s = Y.merge(this.subscribers),
            a = Y.merge(this.afters);
        return [s, a];
    },
    // 获取监听对象
    _procSubs: function (subs, args, ef) {
        var s, i;
        for (i in subs) {
            if (subs.hasOwnProperty(i)) {
                s = subs[i];
                if (s && s.fn) {
                    if (false === this._notify(s, args, ef)) {
                        // 回调返回false时，立即停止处理后续回调
                        this.stopped = 2;
                    }
                    if (this.stopped == 2) {
                        // 立即停止处理后续回调，方便实现stopImmediatePropagation
                        return false;
                    }
                }
            }
        }

        return true;
    },
    // 通知监听对象，执行回调方法
    _notify: function (s, args, ef) {
        var ret = s.notify(args, this);
        if (false === ret || this.stopped &gt; 1) {
            return false;
        }
        return true;
    },
    // 广播事件
    _broadcast: function (args) {
        if (!this.stopped &amp;&amp; this.broadcast) {
            var a = Y.Array(args);
            a.unshift(this.type);

            // 在当前YUI实例Y上广播
            if (this.host !== Y) {
                Y.fire.apply(Y, a);
            }

            // 在全局对象YUI上广播，跨实例
            if (this.broadcast == 2) {
                Y.Global.fire.apply(Y.Global, a);
            }
        }
    },

    // TODO: 在下一篇介绍Y.EventTarget的文章中再做介绍
    fireComplex: function (args) {},

    // 移除监听器
    detach: function (fn, context) {
        // unsubscribe handle
        if (fn &amp;&amp; fn.detach) {
            return fn.detach();
        }

        var i, s,
            found = 0,
            subs = Y.merge(this.subscribers, this.afters);

        for (i in subs) {
            if (subs.hasOwnProperty(i)) {
                s = subs[i];
                if (s &amp;&amp; (!fn || fn === s.fn)) {
                    this._delete(s);
                    found++;
                }
            }
        }

        return found;
    },
    _delete: function (s) {
        if (s) {
            if (this.subscribers[s.id]) {
                delete this.subscribers[s.id];
                this.subCount--;
            }
            if (this.afters[s.id]) {
                delete this.afters[s.id];
                this.afterCount--;
            }
        }

        if (s) {
            s.deleted = true;
        }
    }
};
```

### 适用场景
自定义事件的适用场景与Publish–subscribe Pattern基本一致。具体来讲，我觉得以下一些场景是非常适合用自定义事件的：

#### a) 需要暴露接口/行为以满足扩展需要

底层模块一般会设计的尽量简单，解决核心问题，并适当的开放一些接口，方便应用层进行扩展以满足实际需求。例如表单验证控件，有可能需要在某个表单项验证成功/失败后执行一些额外操作，举一个实际的例子：当用户输入的邮箱地址验证成功时，我们会检查是不是某些比较烂的邮件服务商，如果是则给出一些建议。

YUI作为一个底层基础库，在组件/控件层面加入了大量的自定义事件，以满足实际应用中的需要。例如`Y.Anim`的start、end事件，`Y.io`的success、failure、end事件，`Y.Attribute`中的属性变化事件等。

#### b) 行为可能会被其它模块/方法中止

这一点非常像DOM事件，我们经常会中止一些事件的默认行为，例如anchor的点击事件。

### 自定义事件 VS 回调函数

这是一个比较难的问题，我自己的看法是：相对回调函数，自定义事件是一种更重但更灵活的方案。在实际应用中，如果对于关心某消息的受众不够清楚，那么就使用事件。否则，比较适合使用回调函数。

[MSDN](http://msdn.microsoft.com/en-us/library/aa733743%28v=vs.60%29.aspx)上的解释更好一些：“An event is like an anonymous broadcast, while a call-back is like a handshake. The corollary of this is that a component that raises events knows nothing about its clients, while a component that makes call-backs knows a great deal”。

另外，如果对于性能特别关心，在可能的情况下，尽量使用回调。

## 参考
- [YUILibrary-CustomEvent](http://yuilibrary.com/yui/docs/api/files/event-custom_js_event-custom.js.html)
- [YUILibrary-EventTarget](http://yuilibrary.com/yui/docs/event-custom/index.html)
- [Wikipedia-Publish–subscribe Pattern](http://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern)
- [Zakas-Custom events in JavaScript](http://www.nczonline.net/blog/2010/03/09/custom-events-in-javascript/)
- [When to Use Events or Call-Backs for Notifications][1]

[1]:http://msdn.microsoft.com/en-us/library/aa733743(v=vs.60).aspx
