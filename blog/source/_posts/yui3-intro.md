---
layout: post
title: "浅析YUI3"
date: 2011-05-21 21:16
status: publish
tags: [YUI]
---

最近因为忙于YUI2到YUI3的迁移，没时间更新博客。现在闲暇一些，觉得似乎写一点自己对于YUI3的理解再合适不过。

主要内容有以下几点：

1. 全局命名空间
2. 改变一切的模块
3. Combo
4. 链式调用
5. 更广泛的自定义事件
6. 一些问题

## 全局命名空间
YUI3为了保持向前兼容，采用了新的全局命名空间`YUI`。新的命名空间与YUI2的全局命名空间`YAHOO`最大的不同就是：`YUI`是一个构造函数，而且是一个[无论如何也返回一个实例的构造函数](http://shangchun.net/scope-safe-contructor.html)。

## 改变一切的模块

YUI2时代，一般都是将某方面的全部方法写在统一的命名空间下，例如DOM相关的方法均在`YAHOO.util.Dom`，在需要使用这些方法时我们直接调用即可。YUI2真正体现了**基础方法库**\(function library\)这样一种定位。

<!-- more -->

YUI3最大的变化和进步在于，它采用了革新性的底层组织方式，其核心就是模块\(module\)。在YUI3中，每个方法不再属于某个文件、某个命名空间，而是属于某个模块。每个模块代表一个独立的功能，例如`DOM`、`Event`等。下面是一个简单的例子：

```js
YUI.add('new-module', function (Y) {
    Y.sayHelloWorld = function (id) {
        var el = Y.DOM.byId(id);
        Y.DOM.set(el, 'innerHTML', 'Hello, world!');
    };
}, '1.0.0', { requires: ['dom'] });
```

通过调用`YUI`构造器本身的`add`静态方法，我们声明了一个新的模块，模块的名称为new-module，模块为`YUI`的实例`Y`挂载了`sayHelloWorld`方法，因为这个方法使用了dom模块的方法`byId`，所以要在`add`的第四个参数中标明new-module模块依赖于dom模块。

添加模块的目的是为了使用它，下面给出调用new-module的示例：

```js
// html
<div id="entry"></div>

// js
YUI().use('new-module', function(Y) {
    Y.sayHelloWorld('entry');   // <div id="entry">Hello, world!</div>
});
```

通过调用YUI实例的`use`方法，在列出模块名称之后，我们可以随意使用它们挂载的方法。需要提醒的是，YUI的[loader](http://developer.yahoo.com/yui/3/yui/#loader)会发现new-module模块依赖于dom模块，然后它去check当前页面是否已经有dom模块，没有的话则动态加载。

总结一下，发现模块为我们带来了这些好处：

- **遗弃domready**：在YUI2中，页面通常要在domready之后调用js方法。在YUI3中可以省掉这一步了，因为只有在所有需要的模块都加载完毕后才会调用js方法，而我们通常都是在&lt;body&gt;最后面引入js，此时dom基本已经就绪。当然，YUI3仍然提供domready事件监听方法。
- **沙箱**(Sandbox)：在使用模块时，我们只能调用这些模块以及它们依赖的所有模块给YUI实例挂载的方法。这种机制可以限定你的代码在一定范围内执行，而不是肆意妄为。
- **自动加载**：我们不必再手动添加&lt;script&gt;标签引入js，更不必为js文件间的顺序依赖问题揪心，YUI的loader会为你摆平，而它的依据正是各个模块中的`requires`参数。
- **开发框架**(Framework)：基于这种方法的声明/调用机制，YUI3更像一个js开发框架而不仅仅是一个方法库。我们可以将自己需要的功能作为一个个模块，可以细分为全局通用模块、分站通用模块、分站应用模块等层级。YUI3为此提供了非常简便的接口。

我觉得用这样一句话形容模块对于YUI的意义最好不过：“[Inception](http://movie.douban.com/subject/3541415/)”中Cobb所说的“a very simple idea that changed everything”。

至于模块如何设计、如何分级，将是一个非常有挑战的问题。我准备在适当的时间做下经验总结，现在暂不展开讲。

## Combo
在YUI3框架中，每个模块都对应一个独立的js文件\(也有所有子模块组成一个模块的特殊情况，在此不细较\)，日常开发中，往往需要动态加载大量的模块，造成http请求数较YUI2时代翻几番。众所周知的是，在YUI团队的[Best Practices for Speeding Up Your Web Site](http://developer.yahoo.com/performance/rules.html)一文中提到的第一条准则就是降低http请求数。如果模块化带来的更小粒度更大规模的js文件使得页面加载速度更慢，那么它所有的优势将不再具有吸引力。好消息是，YUI团队很好的解决了这一问题，他们引入了combo的思想，即使用服务器端技术，收到包含多个js文件请求的url之后，合并这些文件为一个大文件返回。

关于Combo的具体文章，可以参考[在服务端合并和压缩JavaScript和CSS文件](http://dancewithnet.com/2010/06/08/minify-js-and-css-files-in-server)。

## 链式调用

jQuery因为方便的链式调用而风靡全球，其write less do more的核心理念也随之深入人心。欣喜的是，YUI团队汲取了这一优点，在YUI3中引入了新的[Node/NodeList](http://developer.yahoo.com/yui/3/node)对象，并取代DOM成为YUI3 Core。这一变化无疑将增加YUI3代码的书写效率，成为有一个显著的加分点。

## 更广泛的自定义事件

YUI3提供了简约而强大的custom event：更加dom-like的调用方法，可以冒泡，可以经历各个事件阶段，可以定义默认动作，可以设定传播范围是模块内部还是模块之间等等。目前对于这部分仍然不甚熟悉，有兴趣的朋友可以参考Luke Smith做的这个[讲座](http://developer.yahoo.com/yui/theater/video.php?v=smith-yuiconf2009-events)。

## 一些问题

YUI3并不完美，目前为止仍然存在一些问题，列举如下：

- 文档仍然不够详尽，很多时候只能去查源代码。例如YUI2中`getRegion`方法在YUI3中的对应方法为`node.get('region')`。
- Node实例只能通过`get`方法取id，value等自身属性，可以参考jQuery采用更简洁的api，例如`val()`, `height()`, `text()`等。
- 得到一个定制的YUI实例时，需要将自己开发的模块的`path`、`requires`信息作为参数传进去，而在声明自定义模块时仍需要设定`requires`，这种冗余设计是可以做优化的。
- 使用Node操作Form时非常繁琐。例如要获取一个text表单项只能使用`ndForm.one('input[name="xxx"]')`，而不能`ndForm.get('xxx')`。
- 在存在name="id"项的表单中，存在因`Y.Selector.test`失效而产生的各种问题。例如`Y.one('#input-id').ancestor('form')`取不到等等。
- 没有公开的Form的`serialize`方法。
</ul>

ok，这就是我对YUI3的一些浅薄见解。欢迎讨论和指正。随着经验的不断积累，后续会奉上更深入的一些分析。
