---
layout: post
title: "Event小记"
date: 2011-03-17 00:39
status: publish
tags: [Event]
---

Event在javascript中的重要性不言而喻，正是它驱动着所有事情的进行。记下一些读书的心得，整理如下：

- Event按类别可分为input events和semantic events。semantic events的发生通常都建立在input events之上，例如点击“提交”按钮后产生onsubmit事件。input events依赖于输入设备。Events按模块可分为HTMLEvents、MouseEvents和UIEvents，对应的接口分别为Event、MouseEvent和UIEvent，其中MouseEvent接口继承了Event接口和UIEvent接口，常用的属性有altKey、ctrlKey、shiftKey和一些位置信息。
- DOM level 0的事件响应方式得到最为广泛的支持。具体应用方式有两种，一种是在页面目标元素中添加对应属性，如&lt;input type="button" onclick="alert(this.nodeName)" /&gt;；对应的另一种方式为 elButton.onclick = function(){ alert(this.nodeName); }。显式调用响应方法也非常简单，elButton.onclick()即可。响应方法中的this指代的是触发事件的页面元素。这种事件处理方式有一些缺点，例如：每个对象的某种事件只能添加一个响应方法，当需要将多个元素绑定事件时实现较为复杂等。
- DOM level 2的事件响应方式进行了诸多改进。事件被赋予一个传播过程，细分为capturing、target node、bubbling三个阶段。这一机制是有一定渊源的，不妨细讲。在当年Netscape与IE大战的年代，当遇到多个嵌套元素绑定同一事件时，如何确定响应方法执行顺序成为大家共同的问题，不幸的是他们做出了相反的选择：NetScape按照事件捕获的顺序执行，即父级节点响应方法优先执行，而IE按照事件冒泡的顺序执行，即子级节点响应方法优先执行。之后W3C过来和稀泥，也就制定了事件传播过程这一机制。需要注意的是，可以通过设定addEventListener的第三个参数设定响应方法在capturing阶段执行（true）还是在bubbling阶段执行（false）。
- 有些元素在一些操作后会有默认动作，如果恰好添加了这类事件监听器的话，执行的顺序是：响应方法执行先于默认动作。阻止默认动作发生，DOM level 0中可以用return false（window.status是一个例外，需return true）；DOM level 2中可以使用preventDefault方法。停止事件传播使用stopPropagation方法。
- IE的事件模型并未遵循W3C标准。事件传播没有capturing阶段，bubbling阶段不能获得currentTarget，不会传递给事件响应方法event对象而是有一个全局event对象，注册/移除响应方法使用attachEvent/detachEvent，阻止事件传播使用cancelBubble等等。
- 为了将鼠标动作限定在特定页面元素，即便鼠标已不在该元素区域内，可将响应方法和事件注册在document上，在IE中可使用setCapture/releaseCapture方法。一个典型的案例是在拖拽模块时，鼠标移动常常快于模块。
- keyCode代表键位编号，charCode代表键位上字符的编号。IE的键盘事件中只有keyCode属性，可以用 e.charCode || e.keyCode获得keypress事件发生时对应按键的字符编号。
- 通过Document.createEvent创建自定义事件，并用Event.initEvent进行初始化，dispatchEvent进行调度。IE中可使用Document.createEventObject创建自定义事件，并用fireEvent进行调度。这部分可以说成为高级前端必备知识，在模块化编程等方面有较为重要的应用。
