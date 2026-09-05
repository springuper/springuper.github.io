---
layout: post
title: "前端中的 Monad"
date: 2018-10-23 18:30
status: publish
tags: [Functional Programming, Monad]
---

Monad 这一概念起源于上世纪五十年代末，由数学家 Roger Godement 提出并应用在范畴论中。直到上世纪九十年代，计算机科学家 Eugenio Moggi 首次将其引入到函数式编程中。由于 Monad 具备优秀的抽象和通用能力，从 Haskell 开始，众多编程语言都相继引入了这一概念，函数式编程迎来一次质的飞跃。

JavaScript 具备函数式编程的基本要素—— λ 算子，即一等公民的函数及其附属的一些性质。Monad 在 JavaScript 中也有不少应用，其中最知名的就是备受赞誉的 Promise。

然而，江湖上有句传言：

> *“Once you understand monads, you immediately become incapable of explaining them to anyone else” by Gilad Bracha*

笔者自认为虽有些愚钝，还算是勤奋，但读过诸多介绍 Monad 的文章书籍后都不得要领，浑浑噩噩。直到最近看了 Programming in Haskell 作者 Graham Hutton 教授的 [What is a Monad? - Computerphile](https://www.youtube.com/watch?v=t1e8gqXLbsU) 后，才算是焕然大悟。

本文尝试从一个实例出发，讲解遇到的问题以及 Monad 解决这些问题的思路，希望可以帮助大家领会其要义。为了清晰地标注类型，本文的代码均使用 TypeScript。

## 举个栗子

假设我们要处理这样一个问题：

实现一个求值函数`evaluate`，它可以接收类似 ![8 \div 2](../images/monad-01.jpg) 、 ![8 \div (12 \div 3)](../images/monad-02.jpg) 的只有除法的表达式，并返回最终的结果。

简便起见，我们假设已经将输入的除法表达式（字符串）进行解析，并得到类似下面这样的抽象语法树：

```ts
interface Expr {
  type: 'value' | 'division';
  value: number | DivisionExpr;
}

interface DivisionExpr {
  left: Expr;
  right: Expr;
}

// AST representation for expression '8 / (12 / 3)'
const expr: Expr = {
  type: 'division',
  value: {
    left: {
      type: 'value',
      value: 8,
    },
    right: {
      type: 'division',
      value: {
        left: {
          type: 'value',
          value: 12,
        },
        right: {
          type: 'value',
          value: 3,
        },
      },
    },
  },
};
```

## **第一版`evaluate`**

只处理除法，而且抽象语法树非常清晰，`evaluate`大家几乎都可以立马写出：

```ts
function evaluate(e: Expr): number {
  if (e.type === 'value') return <number>e.value;
  return evaluate((<DivisionExpr>e.value).left) / evaluate((<DivisionExpr>e.value).right);
}
```

逻辑非常清晰：

- 如果当前处理的抽象语法树节点类型是`value`，直接返回具体数值
- 否则，当前处理的节点类型是`division`，递归计算出`left`和`right`的最终结果，然后返回做除法后的结果

## **第二版`evaluate`**

在数学中，除法的除数是不能为 0 的。JavaScript 中的`/`[运算符](https://www.ecma-international.org/ecma-262/5.1/#sec-11.5.2)遵循了 IEEE 754 规范，当除数为 0 时行为如下：

```ts
1 / 0 // => Infinity
0 / 0 // => NaN
```

在其它语言中，例如 Haskell、Python 等，如果除数为 0 会直接抛异常。既然 JavaScript 在上述两种情况下的值也都是没有意义的，也可以将其理解为一种异常。`evaluate`可以改进为如下形式：

```ts
function evaluate(e: Expr): number {
  if (e.type === 'value') return <number>e.value;

  const left = evaluate((<DivisionExpr>e.value).left);
  const right = evaluate((<DivisionExpr>e.value).right);
  if (right === 0) throw new Error('The divisor is zero.');

  return left / right;
}
```

然而，这意味着对于调用方来说，要么需要提前检查各个除数是否为零，要么需要使用`try-catch`来确保自己的程序不会崩溃，这是一件让人崩溃的事情。

## **第三版`evaluate`**

我们可以对第二版`evaluate`进行改进，发现除数为 0 时并不是抛异常，而是返回一个无意义的结果。

如何表示有意义和无意义的结果呢？这里我们引入`Maybe`:

- `Maybe.nothing()`代表无意义的结果
- `Maybe.just(number)`代表有意义的结果

`Maybe`的实现如下：

```ts
export default class Maybe<T> {
  static nothing<T>() {
    return new Maybe<T>();
  }

  static just<T>(value: T) {
    return new Maybe(value);
  }

  public value?: T;

  constructor(value?: T) {
    if (value) {
      this.value = value;
    }
  }

  isNothing() {
    return typeof this.value === 'undefined';
  }
}
```

`Maybe`的本质是一种容器，在类似数字、字符串、布尔值等数据的表达能力欠缺的情况下可以对其进行增强。
![](../images/monad-03.jpg)

借助`Maybe`，第三版`evaluate`实现如下：

```ts
function safeDiv(x: number, y: number): Maybe<number> {
  if (y === 0) return Maybe.nothing<number>();
  return Maybe.just(x / y);
}

function evaluate(e: Expr): Maybe<number> {
  if (e.type === 'value') return Maybe.just(<number>e.value);

  const left = evaluate((<DivisionExpr>e.value).left);
  if (left.isNothing()) {
    return Maybe.nothing<number>();
  } else {
    const right = evaluate((<DivisionExpr>e.value).right);
    if (right.isNothing()) {
      return Maybe.nothing<number>();
    } else {
      return safeDiv(<number>left.value, <number>right.value);
    }
  }
}
```

首先定义了`safeDiv`函数，专门处理除法，当发现除数为 0 时，返回`Maybe.nothing()`，否则做除法并将结果放在容器中返回。

在`evaluate`函数中，如果`left`是无意义的，则直接返回`Maybe.nothing()`，否则继续对`right`进行递归求值，如果`right`是无意义的，直接返回`Maybe.nothing()`。最后，在`left`和`right`都正常求得结果的情况下，调用`safeDiv`进行除法运算并返回。

## 第四版`evaluate`

有些敏锐的同学可能已经注意到，第三版`evaluate`函数中存在逻辑重复的部分：

```ts
const left = evaluate((<DivisionExpr>e.value).left);
if (left.isNothing()) {
  return Maybe.nothing<number>();
}

const right = evaluate((<DivisionExpr>e.value).right);
if (right.isNothing()) {
  return Maybe.nothing<number>();
}
```

DRY 深入程序员心，有没有办法将其简化呢？

当！然！有！了！

细细观察后，我们可以总结出来上述逻辑重复部分的模式：

```ts
const maybe = someFunReturnsMaybeInstance(params);
return maybe.isNothing() ? Maybe.nothing<T>() : doSomething(<T>maybe.value);
```

即，在求解多个级联 Maybe 实例时：

- 只要其中一个无意义，便不再继续求解，直接返回`Maybe.nothing()`
- 所有 Maybe 实例都成功求解时，进行最终的运算（本例中是`safeDiv`）

得出这样的结论后，我们来改进下`Maybe`的实现：

```ts
export default class Maybe<T> {
  ...
  
  bind<U>(transform: (value: T) => Maybe<U>) {
    return this.isNothing() ? Maybe.nothing<U>() : transform(<T>this.value);
  }
}
```

增加`bind`方法（并非函数原型的`bind`方法）后，Maybe 进化为了一个 Monad，稍后我们详细论述。改进的第四版`evaluate`如下：

```ts
function evaluate(e: Expr): Maybe<number> {
  if (e.type === 'value') return Maybe.just(<number>e.value);

  return evaluate((<DivisionExpr>e.value).left)
    .bind(left => evaluate((<DivisionExpr>e.value).right)
      .bind(right => safeDiv(left, right)));
}
```

在和之前方法行为一致的前提下，代码变得更加简练易读，这正是 Maybe Monad 给我们带来的好处。

## Monad

从`evaluate`的案例中我们展示了 Monad 所能解决的问题，即通过包装数据并赋予其额外的链式运算能力来简化一系列多步骤的计算。下面我们比较正式的介绍一下什么是 Monad。

在函数式编程中，Monad 是一种设计模式，它的的概念定义包含三部分：

1. 类型构造器，用来指定如何从其它已知类型构造新的一元类型 例如`Maybe<number>`这一类型构造器指定了从底层`number`类型的构造方式
2. 一个一元运算符，通常称作`return`或者`unit`，用以将一个底层数据封装为 Monad。形式化定义为： ![unit (a) : T \rightarrow M\ T](../images/monad-04.jpg) （a 为类型为 T 的任意对象） 在 Maybe 中，这个一元运算符是类型的`constructor`方法，我们也可以再定义一个类方法`unit`来返回`new Maybe<number>(number)`
3. 一个连接符，通常称作`bind`，用以从 Monad 中取出数据，并将其放入一个接受这一数据并返回 Monad 的函数中。形式化定义为 ![bind (ma,f) : (M\ T,(T \rightarrow M\ U)) -> M\ U](../images/monad-05.jpg) （ma 为类型为 ![M\ T](../images/monad-06.jpg) 的 Monad 实例， ![f](../images/monad-07.jpg) 是转换函数） 在 Maybe 中，`bind`接受一个`transform`函数，该函数接受`T`类型的原始数据，并返回新的`Maybe<T>`Monad 。因为`bind`返回的仍然是一个新的 Monad，这个 Monad 也具有`bind`方法，因此可以链式调用下去，威力十足

虽然枯燥，不过有了上面实例的铺垫，相信大家对于这三个部分也有了自己的见解。

定义之外，Monad 还需要遵循三个定律：

1. ![bind (unit (a), f)     ==  f(a)](../images/monad-08.jpg)
2. ![bind (ma, unit)        ==  ma](../images/monad-09.jpg)
3. ![bind (bind (ma,f), g)  ==  bind (ma, λx.bind ( f(x), g))](../images/monad-10.jpg)

前面两条显而易见，第三条要求 Monad 的`bind`运算需要满足结合律，类似 ![(8 + 4) + 2](../images/monad-11.jpg) 与 ![8 + (4 + 2)](../images/monad-12.jpg) 等价一样，`bind`的先后次序并不改变最终结果（把`bind`想象成 ![(8 + 4) + 2](../images/monad-13.jpg) 中的加号）。

下面我们验证下 Maybe Monad 是否满足这三条定律：

```ts
const unit = (value: number) => Maybe.just<number>(value);
const f = (value: number) => Maybe.just<number>(value * 2);
const g = (value: number) => Maybe.just<number>(value - 5);
const ma = Maybe.just<number>(13);
const assertEqual = (x: Maybe<number>, y: Maybe<number>) => x.value === y.value;

// first law
assertEqual(unit(5).bind(f), f(5));

// second law
assertEqual(ma.bind(unit), ma);

// third law
assertEqual(ma.bind(f).bind(g), ma.bind(value => f(value).bind(g)));
```

事实证明 Maybe 确实是一个 Monad。

## Promise Monad

JavaScript 中的 Promise 也是一个 Monad：

- 类型构造器就是`Promise`
- `unit`为`x => Promise.resolve(x)`
- `bind`为`Promise.prototype.then`

Promise 同样满足 Monad 三定律，详见 StackOverflow 的这一[回答](https://stackoverflow.com/a/48553568/1131882)。

与 Maybe 可以表达数据有无意义两种状态不同，Promise 作为一种延续型 Monad，可以用来封装异步操作：

```js
fetch('http://example.com/movies.json')
  .then(response => response.json())
  .then(movies => fetch(`http://example.com/author/${movies[0].author}`))
  .then(response => response.json())
  .then(author => console.log(author));
```

Promise 以及在它基础上的 async/await 帮助我们避免了回调地狱以及复杂的错误处理，以一种非常优雅的方式处理各种异步操作。说到根上，这正是 Monad 的功劳。

延续型 Monad 还有另外一个[例子](https://gist.github.com/dypsilon/6b242998ba3474fc239255d42b28dd02)，感兴趣的同学可以移步。

## IO Monad

我们在前端编程中有时候遇到这样一个挑战：一些有副作用的 DOM 操作需要能够组合起来，从而灵活解决各种实际问题。一个常见的解决办法就是编写各种工具函数，然后搭配调用。

下面介绍下另外一种思路，IO Monad。我们假设现在有下面几个工具类方法：

```ts
const $ = (id: string) => <HTMLElement>document.querySelector(`#${id}`);
const read = (id: string) => $(id).value;
const write = (id: string) => (text: string) => $(id).textContent = text;
```

上述`read、write`方法因为涉及到 DOM 操作，都有副作用。假设现在需要实现一个新的方法，将一个 Input 表单项的值转化为大写并显示到另外一个展示区域，传统的实现方法是：

```ts
function syncInputToOutput(idInput: string, idOutput: string) {
  const inputValue = read(idInput);
  const outputValue = inputValue.toUpperCase();
  write(idOutput, outputValue);
}
```

基于 IO Monad 的实现则是另外一番景象：

```ts
const read = (id: string) => new IO<string>(() => $(id).value);
const write = (id: string) => (text: string) => new IO<string>(() => $(id).textContent = text);

function syncInputToOutput(idInput: string, idOutput: string) {
  read(idInput)
    .bind((value: string) => new IO<string>(() => value.toUpperCase()))
    .bind(write(idOutput)))
    .run();
}
```

代码变得更加声明式。如果直接返回 IO 实例但是不执行`run`方法，所有的副作用并不会真正发生，而且还可以继续组合其它的转换函数，函数式编程的风格非常明显。

IO Monad 的实现如下：

```ts
export default class IO<T> {
  private effectFn: () => T;

  constructor(effectFn: () => T) {
    this.effectFn = effectFn;
  }

  bind<U>(transform: (value: T) => IO<U>) {
    return new IO<U>(() => transform(this.effectFn()).run());
  }

  run(): T {
    return this.effectFn();
  }
}
```

## 更多 Monad

常见的 Monad 还有 Either、List 等，具体可以参考 [Monet.js](https://github.com/monet/monet.js#contents) 文档。

## 结语

Monad 是一个非常抽象的概念，但其也是为了解决现实问题而发明，并非空中楼阁，仅供装 X 或者学术研究所用。本文从具体问题着手，深入浅出的介绍了 Monad 的现实意义、概念定义，并在最后给出了前端中的一些具体应用。希望可以帮助和从前的我一样有着同样困惑的朋友。

## 彩蛋

Haskell 为了方便 Monad 运算，还提供了 do 符号语法糖，避免了使用`bind`+ lambda function 的复杂度：

```haskell
eval :: Expr -> Maybe Int
eval (Val n) = return n
eval (Div x y) = do m <- eval x
                    n <- eval y
                    safediv m n
```

当真是易读了不少。那么 JavaScript 也可以做到吗？

答案是肯定的，借助 generator 我们可以实现一个如下的`doM`（寓意 do for Monad）函数：

```ts
function doM<T>(generator: Iterator<Maybe<T>>) {
  function step(value?: any): Maybe<T> {
    const result = generator.next(value);
    if (result.done) {
      return result.value;
    }
    return result.value.bind(step);
  }
  return step();
}
```

最终版的`evaluate`：

```ts
function evaluate(e: Expr): Maybe<number> {
  if (e.type === 'value') return Maybe.just(<number>e.value);

  return doM(function* () {
    const left = yield evaluate((<DivisionExpr>e.value).left);
    const right = yield evaluate((<DivisionExpr>e.value).right);
    return safeDiv(left, right);
  }());
}
```

本文中所有代码均可到 [GitHub](https://github.com/springuper/js-monad) 查看。

## 参考

1. [Monad (functional programming) - Wikipedia](https://en.wikipedia.org/wiki/Monad_(functional_programming)#History)
2. [Lambda Calculus with JavaScript](https://medium.com/@ahlechandre/lambda-calculus-with-javascript-897f7e81f259)
3. [Monads in JavaScript](https://curiosity-driven.org/monads-in-javascript)
4. [JavaScript Monads Made Simple](https://medium.com/javascript-scene/javascript-monads-made-simple-7856be57bfe8)
5. [Monads and Gonads](https://www.youtube.com/watch?v=b0EF0VTs9Dc)
6. [The Continuation Monad](http://www.haskellforall.com/2012/12/the-continuation-monad.html)
7. [monet.js - IO](https://github.com/monet/monet.js/blob/develop/docs/IO.md)
