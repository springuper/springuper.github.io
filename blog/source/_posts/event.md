---
layout: post
title: "YUI事件体系之Y.Event"
date: 2013-01-20 14:12
status: publish
tags: [Y.Event, YUI]
---

![mouse event](/images/mouse.png)

在介绍了由`Y.Do`、`Y.CustomEvent`、`Y.EventTarget`构建的自定义事件体系后，本篇文章将为大家介绍建立在这一体系之上，YUI对DOM事件的封装——`Y.Event`。

## Y.DOMEventFacade

众所周知，浏览器之间存在大量的不兼容问题，在事件方面尤其如此。`Y.DOMEventFacade`主要用来处理DOM事件对象的浏览器兼容问题，提供跨浏览器的简洁接口。事实上，我们常在`Y.one('.selector').on('click', function (e) {})`中使用的`e`就是`Y.DOMEventFacade`的实例。

具体来说，兼容处理的属性主要有：

- target，专门处理了target为文本节点的情况，统一为元素节点，方便操作
- relativeTarget，关联目标节点，在mouseover/mouseout等事件中设置
- keyCode/charCode等输入信息
- pageX/clientX等位置信息

兼容处理的方法主要有：

- stopPropagation/stopImmediatePropagation，不支持停止立即传播时，仅能在YUI层面模拟，不会阻止通过原生方法添加的同层回调，即，在YUI监听过el的click事件后，又通过`el.addEventListener('click', nativeCallback)`监听，如果在YUI的回调中调用`e.stopImmediatePropagation`的话，`nativeCallback`仍然会执行
- preventDefault

另外，为了方便同时停止传播和阻止默认行为，YUI还提供了`halt`方法。

<!-- more -->

我们来简单分析下`Y.DOMEventFacade`的实现：

```js
// 为简化代码，省略了专门针对未实现DOM2 Events规范浏览器中的事件对象兼容性处理（代码在event-base-ie模块）

var DOMEventFacade = function (ev, currentTarget, wrapper) {
    this._event = ev;
    this._currentTarget = currentTarget;
    this._wrapper = wrapper || {};

    this.init();
};

// 确定目标节点
DOMEventFacade.resolve = function (n) {
    if (!n) return n;
    try {
        // 如果是TEXT_NODE，则取其父节点
        if (n && 3 === n.nodeType) n = n.parentNode;
    } catch (e) {
        return null;
    }
    return Y.one(n);
};

Y.extend(DOMEventFacade, Object, {
    // 初始化。主要处理事件对象的浏览器兼容问题
    init: function () {
        var e = this._event,
            resolve = DOMEventFacade.resolve;

        // 此处省略对key和dimension的兼容性处理

        this.type = e.type;
        this.target = resolve(e.target);
        this.currentTarget = resolve(this._currentTarget);
        this.relatedTarget = resolve(e.relatedTarget);
    },
    // 停止传播
    stopPropagation: function () {
        this._event.stopPropagation();
        this._wrapper.stopped = 1;
        this.stopped = 1;
    },
    // 立即停止传播，不处理同一节点的后续回调
    stopImmediatePropagation: function () {
        var e = this._event;
        if (e.stopImmediatePropagation) {
            // 原生事件对象支持立即停止传播
            e.stopImmediatePropagation();
        } else {
            // 仅停止传播，在原生层面会继续同层传播
            this.stopPropagation();
        }
        this._wrapper.stopped = 2;
        this.stopped = 2;
    },
    // 阻止默认事件
    preventDefault: function (returnValue) {
        var e = this._event;
        e.preventDefault();
        e.returnValue = returnValue || false;
        this._wrapper.prevented = 1;
        this.prevented = 1;
    },
    // 中止事件，包括停止传播和阻止默认事件
    halt: function (immediate) {
        if (immediate) {
            this.stopImmediatePropagation();
        } else {
            this.stopPropagation();
        }

        this.preventDefault();
    }
});

Y.DOMEventFacade = DOMEventFacade;
```

## Y.Event

`Y.Event`的主要作用是提供添加、注销DOM事件监听的接口。和我们通常的理解不一样的是，它并不是一个类，而是一个简单的对象。

YUI对DOM事件监听的处理思路大体是：根据节点、事件类型，创建一个`Y.CustomEvent`对象cewrapper。然后通过原生方法注册事件监听，回调执行`cewrapper.fire`方法。所有通过YUI添加的事件监听，都注册cewrapper上，从而实现对DOM事件的包装。

我们先来看下如何使用`Y.Event`添加事件监听：

```js
// 例1
YUI().use('selector', 'event-base', function(Y) {
    Y.Event.attach('click', function (e) {
        console.log('#btn-one clicked');
    }, '#btn-one');
    Y.Event.attach('click', function (e) {
        console.log('#btn-one clicked again');
    }, '#btn-one');

    // click #btn-one
    // output '#btn-one clicked', '#btn-one clicked again'

    Y.Event.attach('click', function (e) {
        console.log('#btn-one clicked');
        e.stopPropagation();
    }, '#btn-two');
    Y.Event.attach('click', function (e) {
        console.log('#btn-one clicked again');
        e.stopImmediatePropagation();
    }, '#btn-two');
    Y.Event.attach('click', function (e) {
        console.log('#btn-one clicked the third time');
    }, '#btn-two');

    // click #btn-two
    // output '#btn-two clicked', '#btn-two clicked again'
});
```

当然，也可以使用`Y.Event`注销事件监听：

```js
// 例2
YUI().use('selector', 'event-base', function(Y) {
    var countThree = 0;
    var handle = Y.Event.attach('click', function (e) {
        console.log('#btn-three clicked', ++countThree);
        handle.detach();
    }, '#btn-three');

    // click #btn-three many times
    // output '#btn-three clicked 1'

    var countFour = 0;
    Y.Event.attach('click', function (e) {
        console.log('#btn-four clicked', ++countFour);
        Y.Event.detach('click', null, '#btn-four');
    }, '#btn-four');

    // click #btn-four many times
    // output '#btn-four clicked 1'
});
```

### 源代码分析

接下来，让我们看看YUI的内部实现吧。

注：为了更容易的看懂代码的核心，我做了适当的简化，感兴趣的朋友可以去看未删节的[源码](https://github.com/yui/yui3/blob/v3.8.0/build/event-base/event-base-debug.js#L397)。

```js
var add = function (el, type, fn, capture) {
        if (el && el.addEventListener) {
            el.addEventListener(type, fn, capture);
        } else if (el && el.attachEvent) {
            el.attachEvent('on' + type, fn);
        }
    },
    remove = function (el, type, fn, capture) {
        if (el && el.removeEventListener) {
            try {
                el.removeEventListener(type, fn, capture);
            } catch (ex) {}
        } else if (el && el.detachEvent) {
            el.detachEvent('on' + type, fn);
        }
    },
    // 判断o是否为HTMLCollection或HTMLElement数组
    shouldIterate = function (o) {
        try {
            return (o && typeof o !== "string" && Y.Lang.isNumber(o.length) && !o.tagName && !Y.DOM.isWindow(o));
        } catch (ex) {
            return false;
        }
    };

Y.Env.evt.dom_wrappers = {};
Y.Env.evt.dom_map = {};

var Event = function () {
    var _wrappers = Y.Env.evt.dom_wrappers,
        _el_events = Y.Env.evt.dom_map;

    return {
        // 添加事件监听
        attach: function (type, fn, el, context) {
            return Event._attach(Y.Array(arguments, 0, true));
        },

        // 创建自定义事件对象，在原生事件触发时执行该对象的fire方法，
        // 从而处理它上面的所有回调
        _createWrapper: function (el, type) {
            var cewrapper,
                ek  = Y.stamp(el),
                key = 'event:' + ek + type;

            cewrapper = _wrappers[key];
            if (!cewrapper) {
                cewrapper = Y.publish(key, {
                    silent: true,
                    bubbles: false,
                    contextFn: function () {
                        cewrapper.nodeRef = cewrapper.nodeRef || Y.one(cewrapper.el);
                        return cewrapper.nodeRef;
                    }
                });

                cewrapper.overrides = {};

                cewrapper.el = el;
                cewrapper.key = key;
                cewrapper.domkey = ek;
                cewrapper.type = type;
                // 作为原生DOM事件回调
                cewrapper.fn = function (e) {
                    // 触发事件，回调方法可以直接调用作为第一个参数的
                    // DOM事件包装对象
                    cewrapper.fire(Event.getEvent(e, el));
                };

                // 重写_delete方法，执行_clean来注销原生DOM节点事件监听
                cewrapper._delete = function (s) {
                    var ret = Y.CustomEvent.prototype._delete.apply(this, arguments);
                    if (!this.hasSubs()) {
                        // 全部回调都被注销，则注销DOM事件监听
                        Event._clean(this);
                    }
                    return ret;
                };

                _wrappers[key] = cewrapper;
                _el_events[ek] = _el_events[ek] || {};
                _el_events[ek][key] = cewrapper;

                // 通过原生方法注册事件监听，这是关键的入口
                add(el, type, cewrapper.fn);
            }

            return cewrapper;
        },

        // 添加事件监听的内部实现
        _attach: function (args) {
            var handles, oEl, cewrapper, context,
                ret,
                type = args[0],
                fn = args[1],
                el = args[2];
            if (!fn || !fn.call) return false;

       l) return false;

            if (Y.Node && Y.instanceOf(el,      lis = Event.getListeners(oEl, type),
                i, lYUI().use('node-base', 'selector', 'event-base', function(Y)  recursively');
    }, '#btn-six');

    // click #btn-six
    // and then, click any elements in #wrapper
    // output nothing
});
```

## 通过Y和Node监听事件

YUI3借鉴了jQuery对HTMLElement/HTMLCollection的封装方式，方便进行链式调用，这就是`Y.Node`。

事件监听是不是可以不用繁琐的使用`Y.Event`，在`Y.Node`对象上直接调用呢？当然可以。主要有四个方法：

- NodeInstance.on
- NodeInstance.once
- NodeInstance.after
- NodeInstance.onceAfter

实际上，以上四个方法是通过内部调用Y的对应方法，例如`Node.prototype.on`内部调用了`Y.on`，而Y上的对应方法是由于Y本身是一个`Y.EventTarget`对象才获得的。最终，在`Y.EventTarget.prototype.on`中调用了`Y.Event`。

```js
// 例5
YUI().use('node', function(Y) {
    Y.Event.attach('click', function (e) {
        console.log('wrapper clicked');
    }, '#btn-one');

    // 等价的Y.on写法
    Y.on('click', function (e) {
        console.log('btn-one clicked');
    }, '#btn-one');

    // 等价的Node.on写法
    Y.one('#btn-one').on('click', function (e) {
        console.log('btn-one clicked');
    });
});
```

## 示例代码

所有示例代码均在[GitHub](https://github.com/springuper/yuianalyser/tree/master/event)。

## 参考

- [YUILibrary-UserGuides-Event](http://yuilibrary.com/yui/docs/event/)
- [YUILibrary-Event](https://github.com/yui/yui3/blob/v3.8.0/build/event-base/event-base-debug.js)
   
