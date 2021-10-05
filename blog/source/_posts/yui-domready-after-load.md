---
layout: post
title: "YUI onDOMReady滞后window.onload原因浅析"
date: 2011-03-11 14:12
status: publish
tags: [YUI2, domready, load]
---

## 开篇

我很好奇其他前端工程师在wp后台写新文章的时候是在用可视化还是html模式。反正我是一路打着标签过来的，呵呵。

## 缘起

一直以来，我都先验的认为dom ready事件肯定发生在load之前。但是，最近的一个ticket上线后发现一个很奇怪的现象：在IE下，有时会发生页面load时仍没有捕捉到dom ready的时间。通过多次观察，发现发生这种现象一般是较为简单的页面。

## 分析

首先，在反复检查代码后排除了自身bug的问题。然后，去找到YUI（我们团队主要以YUI2作为基础库，并准备近期升级到YUI3）的`onDOMReady`实现，希望通过分析源码找到问题的起源，将`onDOMReady`在不含frame的IE中分支拣出来，代码量并不多：

<!-- more -->

```js
// Process onAvailable/onContentReady items when the
// DOM is ready.
YAHOO.util.Event.onDOMReady(
    YAHOO.util.Event._tryPreloadAttach,
    YAHOO.util.Event, true);

var n = document.createElement('p');

EU._dri = setInterval(function() {
    try {
        // throws an error if doc is not ready
        n.doScroll('left');
        clearInterval(EU._dri);
        EU._dri = null;
        EU._ready();
        n = null;
    } catch (ex) {
    }
}, EU.POLL_INTERVAL);
```

实现的思路非常清晰：创建一个段落元素，然后轮询这个元素是否可以运行`doScroll`方法，在IE中，所有元素都有`doScroll`方法，而且如果文档没有完全解析完成的话，运行这个方法会报错。YUI正是运用了IE的这个特点来判定dom ready。而问题恰恰出在轮询而不是原生事件上，因为轮询有一个时间差（40毫秒），如果在下次嗅探之前文档加载完成，那么YUI所得到的dom ready时间就会滞后，进一步，如果页面并不包括很多图片等额外元素时，那么在下一次嗅探前dom ready且迅速触发load的话，就会出现YUI得到的dom ready时间比load时间更晚的怪象。

## 修正

了解清楚问题的真正原因，问题的解决办法也就非常容易想到。最简单的办法是在load触发后滞后一段时间再执行需要dom ready时间的方法。进一步，因为在Firefox、Chrome、Safari等现代浏览器可以直接利用DOMContentLoaded事件即时捕捉到dom ready的时间，没有必要滞后执行，所以可以做下相应的判断。这种细节的处理才能显示出对用户体验的追求和优秀前端的价值。
