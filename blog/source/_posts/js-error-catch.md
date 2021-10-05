---
layout: post
title: "Javascript错误监控机制"
date: 2011-11-06 20:30
status: publish
tags: [try-cacth, onerror]
---

> If an error is possible, someone will make it. The designer must assume that all possible errors will occur and design so as to minimize the chance of the error in the first place, or its effects once it gets made. Errors should be easy to detect, they should have minimal consequences, and, if possible, their effects should be reversible.
> *--Donald Norman, author, The Design of Everyday Things*

我觉得后端工程师较前端工程师最大的便利之一就是：**良好的代码监控机制**。

每次后端工程师上线后，如果PHP运行中出现错误，会立即记录在error log中，并由脚本根据不同的错误级别进行邮件、短信报警。前端工程师在这方面被动很多，大多数情况下是通过用户反映给客服，然后客服再通知技术部门解决，中间的链条甚至会更长一些，因此前端方面的bug造成的影响往往较为严重。

有什么办法可以缓解这一点，能够让我们在错误面前变被动为主动，第一时间解决问题呢？下面就介绍一种简单的Javascript错误监控机制。

## Javascript错误模型

### 生命周期

<center>
  <img alt="error flow" src="/images/error-flow.png" />
</center>

如上图所示，一个错误发生后，首先会被`try-catch`处理，如果没有被停止，则继续传递给`window.onerror`处理，如果没有被停止，则最终传递给浏览器控制台处理。

<!-- more -->

#### try-catch

`try-catch`属于ECMAScript中的语句，能够捕捉到顺序执行代码中的错误，以及`throw`抛出的错误，但遗憾的是，它对于延时执行（或称异步执行，例如通过事件、计时器等触发的代码）代码却无能为力。

`try-catch`捕捉到的错误会作为catch的第一个参数，记作ex，兼容性较好的一个属性为`ex.message`，此属性在IE、FireFox、Chrome中均能够较为准确的描述错误信息。例如：

```js
try {
    M.unexistMethod();
} catch(ex) {
    alert(ex.message);
    // IE: "Object does't support this property or method"
    // FF: "M.unexistMethod is not a function"
    // Chrome: "Object # has no method 'unexistMethod'"
}
```

被`try-catch`捕捉到的错误不会继续传播。如果需要的话，可以在`catch`中通过`throw`语句向更高层次传播错误。

#### window.onerror

`window.onerror`属于DOM的范畴，其支持和实现情况自然有很多差异。`window.onerror`先由IE、FireFox支持，并被加入到HTML5标准中。现在Chrome、Safari新版本均已支持，Opera在12 alpha中会增加支持。`window.onerror`可以捕获到所有类型的js错误，包括顺序、延时代码，这是它非常明显的优点。

在错误的处理方面，各个浏览器也是有些差异的。例如，在js文件与页面不在同一个域时：

```js
window.onerror = function(msg, url, line) {
    alert(msg + ':' + line);
    // IE:"Object does't support this property or method:7"
    // FF:"Script error.:0"
    // Chrome:"Script error.:0"
};
M.unexistMethod();
```

可以看出，FireFox和Chrome下都是统一的“Script error.”，且行号错误，这样的信息除了告诉我们有错误以外没有任何意义。有人解释说这是出于同源策略的考虑。如果你的js文件与页面在同一个域中，那么恭喜，在下面的错误日志收集机制中只需使用`window.onerror`就可以了。

此外，`window.onerror`在FireFox中可以捕捉到js文件加载失败的错误。

### 错误日志收集

综合`try-catch`和`window.onerror`两种错误捕捉方式的特点，设计一个较为简单的错误日志收集机制如下：

- 考虑到`try-catch`能够获得更为准确的错误描述信息，兼容性良好，且在错误传播模型中处于最底层，所以将页面方法入口放在`try-catch`内，这样在这些方法顺序代码中出现的错误就可以被`try-catch`捕获到
- 虽然`window.onerror`非常强大，但由于`window.onerror`在兼容性方面的问题，只将延时代码中可能出现的错误交给`window.onerror`处理
- 捕获到错误后，使用简单强大的beacon将错误信息传递给日志服务器

下面是较为精简的一份代码实现：

```js
// base.js
var M ＝ {
    toQueryString: function(o) {
        var res = [], p, encode = encodeURIComponent;
        for (p in o) {
             if (o.hasOwnProperty(p)) res.push(encode(p) + '=' + encode(o[p]));
        }
        return res.join('&');
    },
    beacon: function(msg) {
        var img = new Image();
        img.src = 'http://xxx.com/_.gif?' + msg;
    },
    log: function(info) {
        M.beacon(M.toQueryString(info));
    },
    runMethod: function(method) {
        try {
            method();
        } catch(ex) {
            M.log({ msg: ex.message, type: 'try-catch' });
        }
    }
};
window.onerror = function(msg, url, line) {
    M.log({ msg: msg, url: url, line: line, type: 'onerror' });
    return true;
};

// app.js
M.app = {
    editAddress = function() {
        var elForm = document.getElementById('address-form');
        elForm.onsubmit = function() {
            if (elForm.address.value === '') return false;
        };
        elForm.address.focus();
    }
};
```

```html
<form action="address" method="post" id="address-form">
    <!-- the name is misspelled, so it may cause an error -->
    <input type="text" name="adress" />
    <input type="submit" value="Submit" />
</form>
<script type="text/javascript" src="base.js"></script>
<script type="text/javascript" src="app.js"></script>
<script>
M.runMethod(function() {
    M.app.editAddress();
});
</script>
```

完整代码见[Github](https://github.com/springuper/log-error)。

## 错误日志处理

由于javascript运行在种类、版本繁多的浏览器中，用户的网络情况也千差万别，直接造成的问题就是错误日志中包含很多垃圾信息，例如：

- Script error.
- Object doesn't support this property or method.

这些错误信息信息量太少，不能准确描述错误的真正原因，需要进行过滤。

在监听到一些描述准确的错误后，需要及时发送错误报警，形式可以为邮件、短信，这样就可以在短时间内将线上的问题反馈给前端工程师，减少错误响应时间。

前端工程师终于可以放心大胆的上线了！

## 参考

- [HTML5标准-window.onerror](http://www.w3.org/TR/2010/WD-html5-20100624/webappapis.html#handler-window-onerror)
- [MSDN-window.onerror](http://msdn.microsoft.com/en-us/library/cc197053%28VS.85%29.aspx)
- [MDN-window.onerror](https://developer.mozilla.org/en/DOM/window.onerror)
- [Enterprise JavaScript Error Handling](http://www.slideshare.net/nzakas/enterprise-javascript-error-handling-presentation)
- [Cryptic “Script Error.” reported in Javascript in Chrome and Firefox](http://stackoverflow.com/questions/5913978/cryptic-script-error-reported-in-javascript-in-chrome-and-firefox)
