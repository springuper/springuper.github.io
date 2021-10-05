---
layout: post
title: "YUI事件体系之Y.delegate"
date: 2013-04-05 23:23
status: publish
tags: [Y.delegate, YUI]
---

![relay baton](/images/delegate.jpg)

在介绍了YUI自定义事件体系和对DOM事件的封装后，本篇文章重点阐述事件方面的一种常用技术——事件代理。事件代理（Event Delegation，又称事件委托）充分运用事件传播模型，用一种十分优雅的方式实现了批量节点事件监听。具体的原理和优点请移步zakas比较古老的一篇文章[Event delegation in JavaScript](http://www.nczonline.net/blog/2009/06/30/event-delegation-in-javascript/)。事件代理在YUI中的实现为`Y.delegate`。

## 基本用法

为方便讨论，约定以下名称：

- 代理节点：实际监听事件的节点。在事件传播到此节点时判断是否符合代理条件，符合则执行回调函数。
- 被代理节点：希望监听事件的节点。如果不采用事件代理，那么应该直接监听这些节点的事件。
- 目标节点：事件发生的目标节点，即`event.target`。

三者的层次关系从内到外依次为：目标节点 &lt;= 被代理节点 &lt;= 代理节点。

<!-- more -->

假设html为：

```html
<ul>
    <li>
        <a href="http://google.com">google</a>
    </li>
    <li>
        <a name="facebook" href="http://facebook.com">facebook</a>
    </li>
    <li>
        <a name="twitter" href="http://twitter.com">twitter</a>
    </li>
</ul>
```

先来看下`Y.delegate`的简单用法：

```js
// 例1
// API: Y.delegate(type, fn, el, filter)
YUI().use('event-delegate', function(Y) {
    var handle = Y.delegate('click', function (e) {
        e.halt();
        console.log(this.get('tagName') + ' is clicked');
    }, 'ul', 'a');

    Y.delegate('click', function (e) {
        console.log(this.get('tagName') + ' is clicked');
    }, 'ul', 'li');

    // click first anchor
    // output 'A is clicked'
    // output 'LI is clicked'

    handle.detach();

    // click first anchor again
    // output 'LI is clicked'
});
```

可以看出，回调函数中的this指向的是使用`Y.Node`包装的被代理节点。

YUI3新加入的`Y.Node`对象也封装了delegate，例1更常见的实现如下：

```js
// 例2
// API: Y.Node.prototype.delegate(type, fn, filter)
YUI().use('node-event-delegate', function(Y) {
    var ndList = Y.one('ul'),
        handle;

    handle = ndList.delegate('click', function (e) {
        e.halt();
        console.log(this.get('tagName') + ' is clicked');
    }, 'a');

    ndList.delegate('click', function (e) {
        console.log(this.get('tagName') + ' is clicked');
    }, 'li');

    // click first anchor
    // output 'A is clicked'
    // output 'LI is clicked'

    handle.detach();

    // click first anchor again
    // output 'LI is clicked'
});
```

筛选条件除了例1中使用的selector外，还支持函数：

```js
// 例3
YUI().use('node-event-delegate', function(Y) {
    var ndList = Y.one('ul');

    ndList.delegate('click', function (e) {
        e.halt();
        console.log(this.get('tagName') + ' is clicked');
    }, function (nd, e) {
        return nd.get('name') &&
               e.target.get('tagName').toLowerCase() === 'a';
    });

    // click the first anchor
    // no output

    // click the second anchor
    // output 'LI is clicked'
});
```

## 源码分析

接下来，让我们看看YUI的内部实现吧。

注：为了更容易的看懂代码的核心，我做了适当的简化，感兴趣的朋友可以去看未删节的[源码](https://github.com/yui/yui3/blob/v3.9.1/src/event/js/delegate.js)。

```js
var toArray = Y.Array,
    isString = Y.Lang.isString;

function delegate(type, fn, el, filter) {
    var container = isString(el) ? Y.Selector.query(el, null, true) : el,
        handle;

    // 监听代理节点的type事件
    handle = Y.Event._attach([type, fn, container], { facade: false });
    handle.sub.filter  = filter;
    // 改写事件触发回调函数
    handle.sub._notify = delegate.notifySub;

    return handle;
}
    
// 代理节点触发事件时的回调函数
delegate.notifySub = function (thisObj, args, ce) {
    // 计算符合filter的被代理节点集合
    var currentTarget = delegate._applyFilter(this.filter, args, ce),
        e, i, len, ret;
    if (!currentTarget) return;

    currentTarget = toArray(currentTarget);

    // 生成事件对象
    e = args[0] = new Y.DOMEventFacade(args[0], ce.el, ce);
    // 将代理节点保存在事件对象container属性上，方便回调函数调用
    e.container = Y.one(ce.el);

    for (i = 0, len = currentTarget.length; i < len && !e.stopped; ++i) {
        // 将被代理节点保存在事件对象currentTarget属性上
        e.currentTarget = Y.one(currentTarget[i]);

        // 回调函数中的this指向被代理节点
        ret = this.fn.apply(e.currentTarget, args);
        if (ret === false) break;
    }

    return ret;
};

// 计算符合filter的被代理节点集合
delegate._applyFilter = function (filter, args, ce) {
    var e         = args[0],
        container = ce.el,
        target    = e.target || e.srcElement,
        match     = [],
        isContainer = false;

    // 处理事件目标节点为文本节点的情况
    if (target.nodeType === 3) {
        target = target.parentNode;
    }

    // filter是selector
    if (isString(filter)) {
        while (target) {
            isContainer = (target === container);
            // 测试target是否符合selector filter
            if (Y.Selector.test(target, filter, (isContainer ? null : container))) {
                match.push(target);
            }
            if (isContainer) break;

            target = target.parentNode;
        }
    // filter是function
    } else {
        // 将target节点作为function filter的第一个参数，
        // 第二个参数为事件对象
        args.unshift(Y.one(target));
        args[1] = new Y.DOMEventFacade(e, container, ce);

        while (target) {
            // function filter中this指向target
            if (filter.apply(args[0], args)) {
                match.push(target);
            }
            if (target === container) break;

            // 更新target
            target = target.parentNode;
            args[0] = Y.one(target);
        }

        // 恢复args对象
        args[1] = e;
        args.shift();
    }

    return match.length <= 1 ? match[0] : match;
};

Y.delegate = Y.Event.delegate = delegate;
```

## 进阶用法

### 批量代理

`Y.delegate`支持同时代理多种类型的事件，调用方式有如下两种：

- Y.delegate({ typeA: fnA, typeB: fnB }, el, filter)
- Y.delegate([typeA, typeB], fn, el, filter)

```js
// 例4
YUI().use('node-event-delegate', function(Y) {
    var ndList = Y.one('ul');
    ndList.delegate({
        click: function (e) {
            e.halt();
            console.log(e.type);
        },
        dblclick: function (e) {
            e.halt();
            console.log(e.type);
        }
    }, 'li');

    // double click the first anchor
    // output 'click'
    // output 'click'
    // output 'dblclick'

    ndList.delegate(['click', 'dblclick'], function (e) {
        e.halt();
        console.log(e.type);
    }, 'li');

    // double click the first anchor
    // output 'click'
    // output 'click'
    // output 'dblclick'
});
```

### 修改回调函数this，传递数据

```js
// 例5
YUI().use('node-event-delegate', function(Y) {
    Y.one('ul').delegate('click', function (e, args) {
        e.halt();
        console.log(this === document.body);
        console.log(args.data);
    }, 'li', document.body, { data: 'data' });

    // click the first anchor
    // output 'true'
    // output 'data'
});
```

### focus、blur事件的代理

在DOM规范中，诸如focus、blur、load、unload、resize等事件是不冒泡的，因为这类事件只限定在某个节点上触发。但focus和blur事件有些特殊，在表单交互方面十分常用，如果能够支持冒泡，那么通过事件代理可以减少很多监听事件的操作。滑稽的是，focusin、focusout两个类似的事件却支持冒泡。

令人欣喜的是，YUI通过定义新的DOM事件实现了focus、blur事件的代理，awesome！

```js
// 例6
YUI().use('node-event-delegate', 'event-focus', function(Y) {
    Y.one('form').delegate({
        focus: function (e) {
            // 清除错误提示
            clearErr(this);
        },
        blur: function (e) {
            // 如果内容为空，则提示错误信息
            if (this.get('value') === '') showErr(this);
        }
    }, 'input');

    function clearErr(nd) {
        var ndErr = nd.next('.error');
        if (ndErr) ndErr.hide().setHTML('');
    };

    function showErr(nd) {
        var ndErr = nd.next('.error');
        if (!ndErr) {
            ndErr = Y.Node.create('<span class="error"></span>');
            nd.insert(ndErr, 'after');
        }

        ndErr.show().setHTML('请输入内容');
    };
});
```

## 示例代码

所有示例代码均在[GitHub](https://github.com/springuper/yuianalyser/tree/master/event)。

## 参考

- [YUILibrary-UserGuides-Event Delegation](http://yuilibrary.com/yui/docs/event/#delegation)
- [Event delegation in JavaScript](http://www.nczonline.net/blog/2009/06/30/event-delegation-in-javascript/)
- [YUILibrary-delegate](https://github.com/yui/yui3/blob/v3.9.1/src/event/js/delegate.js)
