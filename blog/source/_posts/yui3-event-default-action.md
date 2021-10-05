---
layout: post
title: "YUI经验谈-自定义事件默认行为"
date: 2014-02-14 10:00
comments: true
status: publish
tags: [YUI, Event, JavaScript]
---

纵观主流JS库和框架，YUI在自定义事件方面做的尤为出色。如果需要挑出一个代表性的feature，那么非**事件默认行为**莫属。

## 是什么

YUI自定义事件在总体上模仿了DOM事件的设计思想。DOM中的一些事件是有默认行为的，详细见[DOM3 Event - Default actions and cancelable events](https://dvcs.w3.org/hg/dom3events/raw-file/tip/html/DOM3-Events.html#event-flow-default-cancel)一节。简单来说，所谓默认行为，是指该事件在通常情况下所表现出来的动作，例如：

- 一个链接节点的`click`事件，默认行为是转向该链接href属性对应的地址
- 表单的submit事件，默认行为是将表单包含的数据提交给表单的action

说通常情况下，是因为有时开发者会在事件的回调函数中调用

```
e.preventDefault();
```

来阻止默认行为的发生。

<!-- more -->

<center><img alt="Event Default Action" src="/images/event-default-action.png" /></center>

YUI自定义事件遵循了同样的思路，甚至API也和DOM完全一致。

## 有啥用

事件默认行为，本质上，是一种**管理事件和行为的对应关系**的机制。这种机制既不像回调那样死板，也不像消息那样开放。通过将通用处理逻辑作为事件默认行为，满足常见需求的同时，为定制化需求提供了一定开放性，整体上更加灵活。

在DOM事件中，和默认行为相关的场景并不少见：

- 监听到链接的`click`事件时，在链接地址中加入追踪参数，利用默认行为跳转到新地址
- 阻止表单`submit`事件默认行为，改为异步提交表单，提供更好的用户体验

在自定义事件的应用中，也会遇到一些类似的例子。例如：

- 注册时，有一些邮箱虽然是可用的，但对于EDM不给力，在这种情况下，阻止表单项验证成功的默认行为，展示建议用户使用其它邮箱的提示
- 表单验证组件在检查表单项失败后触发`failure`事件，对应的默认行为是在表单项下方显示错误信息。这样的处理在大部分情况下是完全OK的。不过有一天，交互设计师在一个特定场景下提出所有提示都应该放在整个表单顶部，得益于这种灵活的机制，实现这种定制化逻辑十分轻松
- 字符计数插件在输入变化时会默认更新字符数提示。在评价内容中，有更复杂的提示逻辑和展示效果，这时阻止默认行为，实现定制化内容即可


## 怎么用

下面以表单项验证组件为例，展示如何使用事件默认行为。

首先创建`FieldValidator`组件，并使其具备`EventTarget`的功能，实现自定义事件机制：

```js
var FieldValidator = function (ndField, validateFn) {
    var instance = this;
    // ...
};
Y.augment(FieldValidator, Y.EventTarget);
```

使用`publish`声明检查成功和失败的自定义事件，主要目的是定义事件的默认行为：

```js
var FieldValidator = function (ndField, validateFn) {
    // ...

    // 声明检查成功事件，设置默认行为
    instance.publish('success', {
        emitFacade: true,
        defaultFn: function (e) {
            e.field.next('.tip').setHTML('ok');
        }
    });

    // 声明检查失败事件，设置默认行为
    instance.publish('failure', {
        emitFacade: true,
        defaultFn: function (e) {
            e.field.next('.tip').setHTML('error');
        }
    });
};
```

接下来注册表单项的`focus`、`blur`事件，在`blur`触发时检查表单内容，并触发自定义事件：

```js
var FieldValidator = function (ndField, validateFn) {
    // ...

    ndField.on({
        focus: function (e) {
            ndField.next('.tip').setHTML('');
        },
        blur: function (e) {
            if (validateFn(this.get('value'))) {
                // 检查通过，触发检查成功事件
                instance.fire('success', { field: ndField });
            } else {
                // 检查未通过，触发检查失败事件
                instance.fire('failure', { field: ndField });
            }
        }
    });
};
```

现在就可以使用这个组件了，一般情况下，我们不需要阻止默认行为，下面是一个具体示例：

```js
// 检查邮箱
new FieldValidator(Y.one('[name="email"]'), function (value) {
    return /^(\w)+(\.\w+)*@(\w)+((\.\w+)+)$/.test(value);
});
```

一切看起来都很美，直到有一天你接到一个需求：Yahoo邮箱在检查通过时需要展示EDM不给力的提示，这时候默认行为就可以来拯救你了：

```js
var validator = new FieldValidator(Y.one('[name="email"]'), function (value) {
    return /^(\w)+(\.\w+)*@(\w)+((\.\w+)+)$/.test(value);
});
validator.on('success', function (e) {
	if (e.field.get('value').indexOf('@yahoo.com') !== -1) {
        // 阻止默认行为
        e.preventDefault();

	    // 定制化行为
		e.field.next('.tip').setHTML('换个邮箱吧，yahoo.com邮箱收不到优惠通知哦');
	}
});
```

在`success`事件的回调中，通过阻止默认行为，不再执行提示内容为OK的默认逻辑，而是切换成判断雅虎邮箱，并给出特定提示的定制化逻辑。

完整代码展示，请移步[JSFiddle](http://jsfiddle.net/springuper/h4XAY/)。

## 要注意

一个好的idea，最容易被滥用。默认行为不是万能药，只适合一些这样的场景：

- 需要通过事件进行消息广播。如果callback就可以解决问题，那么明智之举是使用callback
- 存在定制化需求的预期，即有些情况下需要中止默认行为的发生，换之以定制化行为


## 参考

- [DOM3 Event - Default actions and cancelable events](https://dvcs.w3.org/hg/dom3events/raw-file/tip/html/DOM3-Events.html#event-flow-default-cancel)
- [YUI EventTarget](http://yuilibrary.com/yui/docs/event-custom/index.html)
