---
layout: post
title: "数据请求利器 React Query"
date: 2022-06-05 16:25:19
status: publish
tags: [React Query, React]
---

在前端项目的数据状态管理中，与服务端的交互数据往往占较大比例，尤其在诸如个人博客网站、内部管理系统这样的重数据交互、轻 UI 交互的场景。这类数据和客户端本地数据有很多差异：

- 数据持久化存储在远程服务端，不受客户端控制
- 需要通过异步请求来获取和更新
- 有可能在 Web 应用中变得"过时"

传统状态管理方案在应对这类场景时有些显得笨拙臃肿。React Hooks 推出后，逐渐有一些专注这一领域的工具出现并大放光彩。本文将着重介绍 React Query 这一代表性工具给出的简洁高效的解决方案。

## 一个例子

假设我们需要开发一个个人博客，以其中首页博客列表页为例，使用传统的 Redux 状态管理方案的话，需要先定义 actions、reducers 以及 store：

```js
// Redux actions, reducers and stores
const fetchPosts = createAsyncThunk("posts/fetchPosts", () =>
  fetch("/fakeApi/posts").then((response) => response.json())
);
const postsSlice = createSlice({
  name: "posts",
  initialState: {
    posts: [],
    status: "idle",
    error: null
  },
  extraReducers(builder) {
    builder
      .addCase(fetchPosts.pending, (state, action) => {
        state.status = "loading";
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.posts = action.payload;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      });
  },
});
const store = configureStore({
  reducer: {
    posts: postsSlice.reducer,
  }
});
```

<!--more-->

然后，定义 UI 组件并在其中调用 Redux 相关方法获取数据：

```js
// Components
const PostList = () => {
  const dispatch = useDispatch();
  // Retrieve data from Redux store state
  const { status, error, posts } = useSelector((state) => state.posts);

  useEffect(() => {
    // Start fetching data
    if (status === "idle") {
      dispatch(fetchPosts());
    }
  }, [status, dispatch]);

  let content = null;
  if (status === "loading") {
    content = <div className="loading">Loading...</div>;
  } else if (status === "succeeded") {
    content = posts.map((post) => (
      <article key={post.id}>
        <h4>{post.title}</h4>
        <div>
          <span>Author: {post.author}</span>{" "}
          <span>Date: {new Date(post.date).toLocaleDateString()}</span>
        </div>
      </article>
    ));
  } else if (status === "failed") {
    content = <div className="error">{error}</div>;
  }

  return <section className="posts-list">{content}</section>;
};
```

可以看出，我们有一半多的代码是在对服务端数据进行操作。

那么，如果用 React Query 来实现的话会是什么样呢？

首先我们完全不需要定义 actions、reducers、store 等，只要修改下 UI 组件的如下部分即可：

```js
// Components
const PostList = () => {
  // Retrieve data via React Query
  const { status, error， data: posts } = useQuery("posts", () =>
    fetch("/fakeApi/posts").then((response) => response.json())
  );

  let content = null;
  ...
}
```

React Query 只用了仅仅 3 行就完成了之前 40 行代码的所有功能，而且也像 React 本身一样非常的声明式，开发者要做的仅仅是描述好自己想要的数据即可，真是令人赞叹。

进一步地，围绕数据请求这一场景，React Query 还针对下列常见需求给出了自己的解决方案：

- 缓存......（可能是编程中最难做到的事情）
- 将对同一数据的多个请求简化为一个请求
- 在后台更新"过期"数据
- 知道数据何时"过期"
- 尽可能快地反映数据的更新
- 性能优化，如分页和懒加载数据
- 管理内存
- 共享数据

接下来就让我们更全面地了解下它吧！

## 数据请求

作为最为基础的功能，React Query 提供了`useQuery`用以获取服务端数据，它接受三个参数：

1. `queryKey` 作为该数据请求的唯一标识，可用来重新请求、获取以及清理缓存等
2. `queryFn` 数据请求逻辑，需返回一个 Promise
3. `options` (可选） 额外配置项，可用来设置缓存时间、重试次数等

它的返回值是一个对象，常用的属性主要有：

- `status` 当前数据请求的状态，具体有 `idle`、`loading`、`error`、`success` 。此外，也可用`isIdle`、`isLoading` 、`isError`、 `isSucess`几个 flag 属性快速判断当前状态
- `error` 数据请求 Promise 失败时的错误信息
- `data` 数据请求 Promise 成功时返回的数据

接下来我们先看一个典型的应用示例：

```js
function Todos() {
  const { isLoading, isError, data, error } = useQuery('todos', () => 
    fetch('/api/todos').then(response => response.json()));
 
  if (isLoading) {
    return <span>Loading...</span>;
  }
  if (isError) {
    return <span>Error: {error.message}</span>;
  }
 
  // We can assume by this point that `isSuccess === true`
  return (
    <ul>
      {data.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

假设获取待做事项列表数据时需要额外传递已完成、未完成等状态信息以进行筛选，甚至还要考虑下分页，则需将数据获取部分改写成：

```js
const { isLoading, isError, data, error } = useQuery(
  ['todos', status, page], 
  () => fetch(`/api/todos?status=${status}&page=${page}`).then(response => response.json()),
);
```

这里我们将`queryKey`替换成了一个可以数组`['todos', status, page]`，这样一旦`status`、`page`参数发生变更的时候，React Query 通过`queryKey`的变更获悉应该重新发起请求，以此达到更新数据的目的。

实际上，React Query 对于`queryKey`的唯一要求是可以被序列化，可以根据团队的倾向选择合适的方案，如下都是一些合法的例子：

```js
useQuery(['todos', { status, page }], queryFn);
useQuery(`todos/${status}/${page}`, queryFn);
useQuery(['todos', todoId], () => fetchTodoById(todoId));
```

关于`queryFn`，我们常用的可以是浏览器内置的`fetch`API，也可以是比较流行的 API fetching library，譬如 axios，只要返回的是一个 Promise 即可：

```js
// Refined `fetch` API
useQuery(['todos', todoId], async () => {
  const response = await fetch('/todos/' + todoId);
  // Throw error if status code is not 2xx
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return response.json();
});
 
// `axios` library
useQuery(['todos', todoId], () => axios.get('/todos/' + todoId));
```

### 分页请求

请求分页数据时，我们常常遇到这样一个问题：

1. 当前页面的数据被清空
2. 显示一个 loading 提示信息
3. 获取到新数据后刷新页面

这种方式的体验并不是很理想，一种更好的方式可以是：

1. 当前页面的数据仍然保留
2. 在一个合适的位置显示 loading 提示信息，友好地给予用户反馈
3. 获取到新数据后，无缝替换掉旧数据

按照这一思路，React Query 提供了一个额外的配置项`keepPreviousData` 以及返回值的`isPreviousData` 标志属性，可以轻易实现类似体验：

```js
const { isLoading, isError, error, data, isFetching, isPreviousData } = useQuery(
  ['projects', page],
  () => fetchProjects(page),
  { keepPreviousData : true },
);
```

完整代码见：
[https://codesandbox.io/s/react-query-pagination-c5ekbg?file=/src/index.js](https://codesandbox.io/s/react-query-pagination-c5ekbg?file=/src/index.js)

### 无限列表

无限列表（Infinite List）是一种常见的数据请求场景，尤其在 Feed 流大行其道的当下。React Query 提供了`useInfiniteQuery`来处理这一需求。

首先假设我们的 API 接口类似这样：

```js
 fetch('/api/projects?cursor=0')
 // { data: [...], nextCursor: 3}
 fetch('/api/projects?cursor=3')
 // { data: [...], nextCursor: 6}
 fetch('/api/projects?cursor=6')
 // { data: [...], nextCursor: 9}
 fetch('/api/projects?cursor=9')
 // { data: [...] }
```

接下来我们展示下应用`useInfiniteQuery`获取无限列表数据的方式：

```js
function Projects() {
  const fetchProjects = ;
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery(
    'projects',
    ({ pageParam = 0 }) => fetch('/api/projects?cursor=' + pageParam), 
    { getNextPageParam: lastPage => lastPage.nextCursor },
  );
 
   return status === 'loading' ? (
     <p>Loading...</p>
   ) : status === 'error' ? (
     <p>Error: {error.message}</p>
   ) : (
     <>
       {data.pages.map((group, i) => (
         <React.Fragment key={i}>
           {group.projects.map(project => (
             <p key={project.id}>{project.name}</p>
           ))}
         </React.Fragment>
       ))}
       <div>
         <button
           onClick={() => fetchNextPage()}
           disabled={!hasNextPage || isFetchingNextPage}
         >
           {isFetchingNextPage
             ? 'Loading more...'
             : hasNextPage
             ? 'Load More'
             : 'Nothing more to load'}
         </button>
       </div>
       <div>{isFetching && !isFetchingNextPage ? 'Fetching...' : null}</div>
     </>
   )
 }
 
```

相比普通的请求，`useInfiniteQuery`主要变更有：

- 增加了一个配置项`getNextPageParam`，用以获取下次请求的游标 nextCursor 以获取正确的累加数据
- 增加了一个返回值属性`fetchNextPage`，用以触发请求，可以在按钮点击或者滚动位置接近当前数据底部等时机触发
- 增加了一个返回值属性`hasNextPage`，用以展示数据全部加载完毕等信息
- 将多批次服务端数据存储在`data.pages`数组中

有兴趣可进一步参考官方的完整示例：
[https://codesandbox.io/s/github/tannerlinsley/react-query/tree/master/examples/load-more-infinite-scroll](https://codesandbox.io/s/github/tannerlinsley/react-query/tree/master/examples/load-more-infinite-scroll)

### 失败重试

既然是向服务端请求数据，就有可能因为网络问题、反向代理或者服务器出现内部错误等问题导致请求失败。所以失败重试就是一个对于 React Query 这类工具来说非常必要的功能。

默认情况下，如果`queryFn`失败了，React Query 会自动重试 3 次，如果最终结果还是失败，则`status`变为`error`。可以通过设定`retry`配置项来改变这一行为：

```js
useQuery('todos', fetchTodoList, {
  retry: 10, // Will retry failed requests 10 times before displaying an error
});
useQuery('todos', fetchTodoList, {
  retry: false, // No retry
});
useQuery('todos', fetchTodoList, {
  // Custom retry function
  retry: (failureCount, error) => error.statusCode === '403' ? false : (failureCount < 3),
});
```

还有另一个配置项`retryDelay`可以自定义重试的间隔，以避免服务端压力过大。默认的`retryDelay`为

```js
attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
```

这个设定有些略长，可根据实际业务情况修改。

## 数据修改

数据请求的另外一个大的类别是数据提交，诸如 POST、PATCH、DELETE 这几种具有副作用的请求类型都属于此类。我们希望在处理数据修改时，也有如同前面介绍的种种数据获取工具一样的趁手方案。

针对这一诉求，React Query 提供了`useMutation`，它接受两个参数：

1. `mutationFn` 类似`useQuery`中的`queryFn`，`mutationFn` 是执行数据提交逻辑的方法，需返回一个 Promise
2. `options` 可选配置项，例如`onSucess`、`retry`等

`useMutation`返回的对象中，常用的一些属性有：

- `mutate` 触发`mutationFn`，开始提交数据到服务器端
- `status`、`error`、`data` 等 与`useQuery`返回值类似，可以用这些属性确定当前请求的状态、错误信息和返回值

让我们看一个常见的应用示例：

```js
function App() {
  const addTodoMutation = useMutation(newTodo => axios.post("/todos", newTodo));

  return (
    <div>
      {addTodoMutation.isError ? (
        <div>An error occurred: {mutation.error.message}</div>
      ) : null}
      {addTodoMutation.isSuccess ? <div>Todo added!</div> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addPostMutation.mutate(new FormData(e.currentTarget));
        }}
      >
        <div>
          <label for="todo">Todo: </label>
          <input id="todo" type="text" name="todo" />
        </div>
        <button>{addTodoMutation.isLoading ? "Creating..." : "Create"}</button>
      </form>
    </div>
  );
}
```

如上所示，一开始我们使用`useMutation`创建了一个 mutation，并在提交表单的时候调用其`mutate`方法提交用户填写的新待办事项信息，并通过`isError`、`isSuccess`、`isLoading`等标志变量展示相关进展。

### 清除数据缓存

当我们提交的新数据会导致应用中某些数据“过期”时，需要显式地清除数据缓存，以确保数据准确性。

举一个例子：

- 应用包含两部分：待办事项列表和创建待办事项的表单
- 用户提交了新待办事项后，应该重新获取待办事项列表

在这种场景下，可以使用下面这种方式来响应数据修改：

```js
const addTodoMutation = useMutation(
  useMutation(newTodo => axios.post("/todos", newTodo)),
  {
    onSuccess: () => {
      queryClient.invalidateQueries("todos");
    }
  }
);
```

创建 mutation 时，我们添加了一个`onSuccess` 配置项，它会在修改成功时执行。其中的`queryClient.invalidateQueries("todos")`正如它的名字一样，可以清理掉`queryKey`为 "todos" 的数据，在这种情况下，React Query 会自动的再次请求该数据，从而达到了更新待办事项列表的目的。

类似的，如果我们在某一个待办事项详情页进行了编辑，那么可以直接在`onSuccess`中更新这个待办事项的数据：

```js
const mutation = useMutation(editTodo, {
  onSuccess: data => {
    queryClient.setQueryData(['todo', { id: 5 }], data);
  },
});
```

完整代码见
[https://codesandbox.io/s/react-query-blog-3w24ks?file=/src/index.js](https://codesandbox.io/s/react-query-blog-3w24ks?file=/src/index.js)

## 进阶功能

围绕数据获取和数据修改两大服务端数据交互场景，React Query 还提供了非常丰富的进阶功能，进一步提高开发效率。

### 数据共享

观察比较敏锐的同学可能已经注意到：请求文章列表后，如果点击某一条具体的文章查看详情的时候，实际上不需要额外发一个单独的文章数据请求，直接读取现有的文章数据即可。即便在列表数据非完整数据的情况下，也可以先展示既有的部分数据，然后获取单项完整数据后再刷新 UI，从而达到非常顺滑的用户体验。

针对这一场景，React Query 提供了一些基础性支持：

- 通过`queryClient.getQueryData` 可以根据`queryKey`获取之前请求的数据，譬如文章列表数据
- 如果列表数据包含各项的完整数据，则可通过在`useQuery`增加`initialData`配置项来设置初始数据
- 如果列表数据只包含各项的部分数据，则可通过在`useQuery`增加`placeholderData`配置项来设置占位数据，这种情况下`useQuery`会继续请求完整数据

举一个例子：

```js
// Fetch full post data via `initialData`
function PostDetail({ id }) {
  const result = useQuery(['post', id], () => fetch(`/posts/${id}`), {
    initialData: () => { // Will not request again if there is valid query data
      return queryClient.getQueryData('posts')?.find(d => d.id === id);
    },
  });
}

// Fetch placeholder post data via `placeholderData`
function PostDetail({ id }) {
  const result = useQuery(['post', id], () => fetch(`/posts/${id}`), {
    placeholderData: () => { // Will always request again
      return queryClient.getQueryData('posts')?.find(d => d.id === id);
    },
  });
}
```

关于`initialData`和`placeholderData`两者的更详细分析，可以查看 Dominik 的这篇文章：
[Placeholder and Initial Data in React Query](https://tkdodo.eu/blog/placeholder-and-initial-data-in-react-query)

### 数据预获取

改善交互体验的另外一个常见优化是在用户表现出下一步动作的明确倾向时预获取相关数据（Prefetching），譬如：

- 鼠标悬浮在某个内容项 100ms 以上
- 页面焦点停止在某个内容项 100ms 以上
- 首屏着重推荐，用户点击率较大的内容

在处理这类问题的时候，我们可以直接应用 `useQuery`来请求数据，不过还有一种更好的针对性处理方式：

```js
<li
  key={post.id}
  onMouseEnter={() => {
    queryClient.prefetchQuery(
      ['post', post.id],
      () => getPost(post.id),
      { staleTime: 10 * 1000 }, // Only prefetch if there is no cache or the cache is older than 10s
    );
  }}
>
  {post.title}
</li>
```

这种方式的一个主要好处是：如果用户并没有真的访问对应的页面，则一段时间后 React Query 会自动清理掉预获取的数据。

具体可以查看官方示例：
[https://codesandbox.io/s/github/tannerlinsley/react-query/tree/master/examples/prefetching](https://codesandbox.io/s/github/tannerlinsley/react-query/tree/master/examples/prefetching)

### SSR

对于一些重数据交互、轻 UI 交互的面向用户侧的展示型应用来说，服务端渲染 SSR 也是一个比较重要的诉求，这样一方面可以让用户从输入 url 到看到内容的速度更快，另一方面也方便搜索引擎进行索引。

React Query 从原理层面讲并没有特别依赖运行环境的代码，只要`queryFn`可以在客户端或者服务端正常获取数据即可。此外，它还提供了`dehydrate`、`Hydrate`等 SSR 相关 API，方便各个框架或者开发者进行整合。

下面是一个 SSR 实现的核心逻辑示例：

```js
// Server side
function ssr(req, res) {
  const queryClient = new QueryClient();
  // Fetch data
  await queryClient.prefetchQuery('key', fn);
  // Dump React Query state in order to pass to client
  const dehydratedState = dehydrate(queryClient);
  const html = ReactDOM.renderToString(
    <QueryClientProvider client={queryClient}>
      <Hydrate state={dehydratedState}>
        <App />
      </Hydrate>
    </QueryClientProvider>
  );

  res.send(`
    <html>
      <body>
        <div id="root">${html}</div>
        <script>
          window.__REACT_QUERY_STATE__ = ${JSON.stringify(dehydratedState)};
        </script>
      </body>
    </html>
  `);

  // Clear internal cache to save memory
  queryClient.clear();
}

// Client side
function start() {
  // Read React Query state from SSR
  const dehydratedState = window.__REACT_QUERY_STATE__;
  const queryClient = new QueryClient();

  ReactDOM.hydrate(
    <QueryClientProvider client={queryClient}>
      <Hydrate state={dehydratedState}>
        <App />
      </Hydrate>
    </QueryClientProvider>,
    document.getElementById('root'),
  );
}
```

如果你恰好在使用 Next.js 的话，React Query 提供了更为多样化的 SSR 解决方案，详情可以查看[官方文档](https://react-query.tanstack.com/guides/ssr#using-nextjs)。

## 内部实现

React Query 的作者 Tanner 曾在 2021 年 React Summit 远程会议上分享了[如何用 150 行代码实现一个 Lite 版本的 React Query](https://www.youtube.com/watch?v=9SrIirrnwk0)，这对于我们了解其实现思路非常有帮助，知其然且知其所以然，之前介绍的很多功能也会应用得更加趁手。

### 全局唯一且可共享的 Query Client

借助 React Context，可以在 web 应用启动的时候创建一个 Query Client 实例，并通过`QueryClientProvider`工具组件使得所有后续`useQuery`调用都可以获取该实例。

简要代码如下：

```js
// Create a context in React Query module
const context = React.createContext();
export function QueryClientProvider({ children, client }) {
  return <context.Provider value={client}>{children}</context.Provider>;
}

export function useQuery({ queryKey, queryFn, staleTime, cacheTime }) {
  // Get the shared client instance from context
  const client = React.useContext(context);
  ...
}
```

进一步地，可以在`QueryClientProvider`组件中添加对页面窗口 focus、visibilitychange 事件的监听，来自动重新获取数据等。

### Query Client 保存着所有请求信息

Query Client 既然是唯一且被所有`useQuery`共享的实例，为了达成数据共享、请求去重等目的，在这一实例上保存所有请求信息便显得自然而然了：

```js
export class QueryClient {
  constructor() {
    this.queries = [];
  }

  getQuery = (options) => {
    // Serialize query key to get the unique ID of the specific query
    const queryHash = JSON.stringify(options.queryKey);
    let query = this.queries.find((d) => d.queryHash === queryHash);

    if (!query) {
      query = createQuery(this, options);
      this.queries.push(query);
    }

    return query;
  };
}
```

创建请求的过程略显复杂，不过简单来说就是：

- 创建一个 query 对象
- 主要包括 query 的 status、error、data 等状态信息
- 以及获取数据的`fetch`操作及对应的 Promise 等

### 应用观察者模式和 React Hooks 进行响应

为了能够在请求状态变更时刷新 UI，React Query 借助了观察者模式和 React Hooks：

- 每个 query 对象还有一个属性 `subscribers`，并在请求状态变更时触发这些订阅者
- 初次调用`useQuery`时，它会创建一个 query 对象，并添加一个强制 rerender 的回调到其`subscribers`属性中

主要代码如下：

```js
export function useQuery({ queryKey, queryFn, staleTime, cacheTime }) {
  const client = React.useContext(context);
  const [, rerender] = React.useReducer((i) => i + 1, 0);
  const observerRef = React.useRef();
  if (!observerRef.current) {
    // Query observer is a simple wrapper of query
    observerRef.current = createQueryObserver(client, {
      queryKey,
      queryFn,
      staleTime,
      cacheTime,
    });
  }

  React.useEffect(() => {
    // Trigger rerendering whenever query state changes
    return observerRef.current.subscribe(rerender);
  }, []);

  return observerRef.current.getResult();
}
```

## 结语

针对服务端数据交互这一场景应运而生的 React Query 为轻交互、重数据的业务场景提供了极大的开发上的便利。很多应用甚至可以仅需组合 React Query、Context 以及 Component state 即可实现全部的状态管理。此外，React Query 丰富的功能更是让一些最佳实践变得轻而易举，为构建愉悦的开发体验和用户体验做出了显著贡献。

在这一细分领域还有类似 [SWR](https://swr.vercel.app/zh-CN)、[RTK-Query](https://redux-toolkit.js.org/rtk-query/overview) 等方案。SWR 出自知名公司 Vercel 开发，更加轻量。RTK-Query 对于 Redux 为主的项目更加友好。各位可以根据自身业务团队偏好择优选用。

## 参考文献

- [React Query: It’s Time to Break up with your "Global State”! –Tanner Linsley](https://www.youtube.com/watch?v=seU46c6Jz7E)
- [All About React Query (with Tanner Linsley) — Learn With Jason](https://www.youtube.com/watch?v=DocXo3gqGdI)
- [Let's Build React Query in 150 Lines of Code! – Tanner Linsley, React Summit Remote Edition 2021](https://www.youtube.com/watch?v=9SrIirrnwk0)
- [Building The Real App With React Query](https://www.smashingmagazine.com/2022/01/building-real-app-react-query/)
- [Interview with React Query's creator: Tanner Linsley](https://nosleepjavascript.com/interview-tanner-linsley/)
- [How to fetch data with React Hooks](https://www.robinwieruch.de/react-hooks-fetch-data/)

## 彩蛋

太阳底下没有新鲜事，Tanner Linsley 在[一次访谈](https://nosleepjavascript.com/interview-tanner-linsley/)中介绍了 React Query 的由来：

> The pains that inspired React Query were years in the making, even before hooks. I was a heavy Redux user for a long time, but when hooks came out, I knew they would serve as a great API to finally ditch Redux in favor of something less manual. I came up with the initial inspiration for React Query when I saw a library called [Draqula](https://github.com/vadimdemedes/draqula) was released. It was almost like a lightweight Apollo and something clicked about its patterns and style. I decided to draw from its patterns a bit and React Query was born.

Apollo 几乎是 GraphQL 的标配，非常简单易用。但它要支持的功能实在是太多了，后面连本地状态管理都有了方案，堪称巨无霸。Draqula 致力于打造一个轻量版 Apollo，只有数据获取和修改，但仍然聚焦在 GraphQL 而非 RESTful API。React Query 借鉴了 Draqula 的模式，并围绕普通数据请求做了众多优化。

在访谈中，还有很多关于 Tanner 的趣闻，包括这大哥并非计算机专业出身，但非常热衷于实践中学习，甚至他的日常起居节奏、当爹经验等等，非常有趣。

最后，Tanner 还是一家致力于 SEO 解决方案的创业公司 [Nozzle.io](http://Nozzle.io) 的联合创始人之一：
![](../images/react-query-01.jpg)
