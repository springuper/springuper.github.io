---
layout: post
title: "Y.extend与Y.augment"
date: 2012-02-11 21:24
comments: true
status: publish
tags: [YUI, OOP, JavaScript]
---

很长一段时间内，我都没有搞懂YUI3 OOP模块中的`Y.extend`方法与`Y.augment`之间的区别，尽管它们的名称如此显著。现在有些时间，我相信分析源码是最好的解决方法。为了减少不必要的干扰，我简化了这两个方法，使它们仅处理类构造器。

## Y.extend

`Y.extend`方法应用的场景很简单，就是继承。我们知道，JavaScript有多种继承方式，例如原型继承、构造器继承、组合继承、寄生继承等等。YUI采取的为寄生组合继承（Parasitic combination inheritance）。

`Y.extend`的简化代码如下：

```javascript
Y.extend = function (r, s) {
    var sp = s.prototype, rp = Y.Object(sp);
    r.prototype = rp;

    rp.constructor = r;
    r.superclass = sp;

    return r;
};

Y.Object = function (o) {
    var F = function () {};
    F.prototype = o;
    return new F();
}
```

首先获取一个`__proto__`指向父类原型的空对象`rp`，然后将其作为子类原型，这样子类实例就可以沿原型链父类原型方法。然后设置子类的`superclass`属性为父类原型，使得子类构造器可以访问到父类。

<!-- more -->

示例：
```javascript
function Programmer(name) {
    this.name = name;
}
Programmer.prototype.getName = function () {
    return this.name;
};

function FrontEndProgrammer(name, gender) {
    // 调用父类构造器
    FrontEndProgrammer.superclass.constructor.call(this, name);
        this.gender = gender;
}
FrontEndProgrammer.prototype.getGender = function () {
    return this.gender;
};

// 建立类继承关系
Y.extend(FrontEndProgrammer, Programmer);
```

## Y.augment

OOP中，继承是一种主要方式，但还有另一种方式同样重要，即组合(Composition)。组合不同于继承的是，不会在类之间建立关系，只将提供类（类似父类）的属性、原型属性和方法添加在接受类（类似子类）中。`Y.augment`就是YUI中一种用来组合类的方法。

Y.augment的简化代码如下：
```javascript
Y.augment = function (receiver, supplier, args) {
    var rProto    = receiver.prototype,
        sProto    = supplier.prototype,
        copy,
        property;

    args = args ? Y.Array(args) : [];

    copy = function (value, key) {
        if (!(key in rProto)) {
            if (Object.prototype.toString.call(value) === '[object Function]') {
                rProto[key] = function () {
                    // 将方法赋给实例
                    this[key] = value;
                    // 执行提供类构造器
                    supplier.apply(this, args);
                    // 执行提供类方法
                    return value.apply(this, arguments);                
                };
            } else {
                rProto[key] = value;
            }
        }
    };

    for (property in sProto) {
        copy.call(null, sProto[property], property);
    }

    return receiver;
};
```

逻辑比较简单，将提供类原型属性处理后拷贝给接受类原型。如果拷贝的是一个方法，则使用一个代理方法，主要作用是执行一次提供类构造器，使接受类对象获得提供类构造器中添加的属性。

从代码中可以发现，`Y.augment`的第三个参数`args`是传递给提供类构造器的，问题在于`args`只能在执行`Y.augment`时指定，也就是说不能在创建接受类实例时指定。这是`Y.augment`与`Y.extend`非常重要的一个区别。

另外一个问题是，接受类实例在执行不同提供类原型方法时，提供类构造器会被多次执行，在提供类构造器中逻辑比较复杂时会引起显而易见的效率问题。这个问题是由于我简化代码的缘故，[YUI源码](http://yuilibrary.com/yui/docs/api/files/oop_js_oop.js.html#l31)中采用了一种方法隔离技术，能够在第一次调用提供类方法时才将所有提供类方法赋给接收类实例，并保证只执行一次提供类构造器。

示例：
```javascript
function Code(language) {
    this.language = language;
}
Code.prototype.getLanguage = function () {
    return this.language;
};

function FrontEndProgrammer(name, gender) {
    this.name = name;
    this.gender = gender;
}
FrontEndProgrammer.prototype.getName = function () {
    return this.name;
};
FrontEndProgrammer.prototype.getGender = function () {
    return this.gender;
};

// 组合类
Y.augment(FrontEndProgrammer, Code, 'JavaScript');
```

## Y.extend与Y.augment区别

`Y.extend`和`Y.augment`很好的体现了OOP两种主要方式：继承和组合。设计模式中提倡使用组合方式：Favor 'object composition' over 'class inheritance' （[Gang of Four](http://en.wikipedia.org/wiki/Design_Patterns) 1995:20）。

总结一下，`Y.extend和`Y.augment`有如下区别：
- `Y.extend`改变原型链，可以通过`instanceof`操作符判定子类实例与父类关系
- `Y.extend`可以在创建子类实例时指定传递给父类的参数，`Y.augment`只能在组合类时设定
- `Y.augment`会将提供类原型方法赋给接受类实例

根据各自特点，可以发现，`Y.extend`更适合从属关系非常强的两个类，例如男人和人，男人的主体属性是人，附加一些胡须、喉结、力气之类的特征；`Y.augment`更适合提供类是接受类一个扩展的情况，例如程序员和工具书，工具书只是程序员用来参考的工具，而不是主要属性。

以下是YUI3中的一些实际使用例子：
```javascript
// Y.Base作为YUI组件框架的核心，为继承它的子类提供了属性管理、事件、生命周期等方法。
Y.extend(Y.Anim, Y.Base);
Y.extend(ScrollView, Y.Widget);
Y.extend(ACListPlugin, Y.AutoCompleteList);
Y.extend(CacheOffline, Y.Cache);
Y.extend(Calendar, Y.CalendarBase);

// EventTarget定义了一整套自定义事件、AOP的机制，通过Y.augment可以方便的赋给接受类这些方法。
Y.augment(Y.Node, Y.EventTarget);
Y.augment(Y.DataSource.Local, Pollable);
Y.augment(Lines, Y.Attribute);
```

## 参考
- [YUI OOP API](http://yuilibrary.com/yui/docs/api/files/oop_js_oop.js.html)
- [Inheritance Patterns in YUI 3](http://www.yuiblog.com/blog/2010/01/06/inheritance-patterns-in-yui-3/)
- [More code reuse patterns in YUI3](http://www.yuiblog.com/blog/2010/01/07/more-code-reuse-patterns-in-yui3/)
- [Design Patterns](http://en.wikipedia.org/wiki/Design_Patterns)
