# 博客写作与发布指南

本文档说明如何添加新博客文章并发布到网站。

## 目录

- [创建新文章](#创建新文章)
- [文章格式](#文章格式)
- [添加图片](#添加图片)
- [本地预览](#本地预览)
- [发布流程](#发布流程)
- [常见问题](#常见问题)

---

## 创建新文章

### 方法一：使用 Hexo 命令（推荐）

在项目根目录下运行：

```bash
cd blog
npx hexo new "文章标题"
```

这会在 `blog/source/_posts/` 目录下创建一个新的 Markdown 文件，文件名格式为：`文章标题.md`

### 方法二：手动创建

直接在 `blog/source/_posts/` 目录下手动创建 `.md` 文件，文件名使用英文，多个单词用连字符连接，例如：`my-new-blog-post.md`

---

## 文章格式

### Front Matter（文章头部信息）

每篇文章的开头必须包含 front matter，格式如下：

```yaml
---
layout: post
title: "文章标题"
date: 2026-01-18 11:00:00
status: publish
tags:
  - Tag1
  - Tag2
  - Tag3
---
```

**字段说明：**

- `layout`: 固定为 `post`
- `title`: 文章标题（使用中文引号）
- `date`: 发布日期，格式：`YYYY-MM-DD HH:mm:ss`
- `status`: 固定为 `publish`（如果设为 `draft` 则不会发布）
- `tags`: 标签列表，每行一个，使用 `-` 开头

### 文章内容

在 front matter 之后，使用 Markdown 格式编写文章内容。

**常用功能：**

1. **摘要分隔符**：使用 `<!--more-->` 来分隔摘要和正文
   ```markdown
   这是摘要部分，会显示在首页。
   
   <!--more-->
   
   这是正文部分，点击文章后才能看到。
   ```

2. **标题**：使用 `#` 到 `######` 表示不同级别的标题

3. **代码块**：使用三个反引号包裹代码
   ```markdown
   ```javascript
   console.log('Hello World');
   ```
   ```

4. **链接**：`[链接文本](URL)`

5. **图片**：见下方[添加图片](#添加图片)章节

### 完整示例

```markdown
---
layout: post
title: "我的第一篇博客"
date: 2026-01-18 11:00:00
status: publish
tags:
  - Technology
  - Learning
---

这是文章的摘要部分，会显示在博客首页。

<!--more-->

## 正文标题

这是正文内容，可以使用 **粗体**、*斜体* 等 Markdown 语法。

### 代码示例

```javascript
function hello() {
  console.log('Hello World');
}
```

### 图片

![图片描述](/images/my-image.jpg)
```

---

## 添加图片

### 步骤

1. **将图片放到 `blog/source/images/` 目录**
   ```bash
   # 例如
   cp ~/Downloads/my-image.jpg blog/source/images/
   ```

2. **在文章中使用相对路径引用**
   ```markdown
   ![图片描述](/images/my-image.jpg)
   ```

### 图片命名建议

- 使用小写字母和连字符：`my-article-image.jpg`
- 避免使用空格和特殊字符
- 建议使用有意义的文件名，便于管理

### 支持的图片格式

- `.jpg` / `.jpeg`
- `.png`
- `.gif`

---

## 本地预览

在发布前，建议先在本地预览文章效果。

### 启动本地服务器

```bash
cd blog
npx hexo server
```

或者使用 npm script：

```bash
cd blog
npm run server
```

服务器启动后，访问 `http://localhost:4000` 查看博客。

### 重新生成静态文件

如果修改了文章但服务器没有自动刷新，可以重新生成：

```bash
cd blog
npx hexo generate
```

或者：

```bash
cd blog
npm run build
```

---

## 发布流程

### 方法一：使用 GitHub Actions（推荐，自动构建）

这是最简单的方式，GitHub Actions 会自动构建和部署。

#### 步骤

1. **提交更改到 Git**
   ```bash
   # 在项目根目录
   git add .
   git commit -m "Add new blog post: 文章标题"
   git push
   ```

2. **等待自动部署**
   - 推送后，GitHub Actions 会自动触发构建
   - 访问 `https://github.com/springuper/springuper.github.io/actions` 查看构建状态
   - 构建完成后（通常 2-5 分钟），访问 `https://springuper.github.io` 查看更新

#### 构建过程

GitHub Actions 会自动执行以下步骤：
1. 安装 Node.js 和依赖
2. 运行 Hexo 构建命令
3. 将构建结果复制到 `docs/` 目录
4. 部署到 `gh-pages` 分支
5. GitHub Pages 自动更新网站

### 方法二：手动构建和部署（不推荐）

如果需要手动构建和部署：

```bash
# 1. 构建博客
bash scripts/build.sh

# 2. 提交更改
git add .
git commit -m "Add new blog post: 文章标题"
git push
```

---

## 常见问题

### Q: 文章发布后看不到？

**A:** 检查以下几点：
1. 确认 `status` 字段为 `publish`（不是 `draft`）
2. 检查 GitHub Actions 构建是否成功
3. 等待几分钟让 GitHub Pages 更新（通常 1-5 分钟）
4. 清除浏览器缓存后重试

### Q: 图片显示不出来？

**A:** 检查：
1. 图片路径是否正确（应该以 `/images/` 开头）
2. 图片文件是否已提交到 Git
3. 图片文件名是否包含特殊字符或空格

### Q: 如何修改已发布的文章？

**A:** 
1. 直接编辑 `blog/source/_posts/` 目录下的 `.md` 文件
2. 提交并推送更改
3. GitHub Actions 会自动重新构建和部署

### Q: 如何删除文章？

**A:**
1. 删除 `blog/source/_posts/` 目录下对应的 `.md` 文件
2. 提交并推送更改
3. 重新构建后文章会被移除

### Q: 如何添加标签？

**A:** 在 front matter 的 `tags` 部分添加，例如：
```yaml
tags:
  - Technology
  - JavaScript
  - React
```

### Q: 本地预览时样式不对？

**A:** 
1. 确认已安装所有依赖：`cd blog && npm install`
2. 尝试清理缓存：`cd blog && npx hexo clean`
3. 重新生成：`cd blog && npx hexo generate`
4. 重启服务器

---

## 项目结构说明

```
springuper.github.io/
├── blog/                    # Hexo 博客目录
│   ├── source/
│   │   ├── _posts/         # 博客文章目录（在这里添加新文章）
│   │   └── images/         # 图片目录（在这里添加图片）
│   ├── themes/             # 主题目录
│   └── _config.yml         # Hexo 配置文件
├── docs/                   # GitHub Pages 部署目录（自动生成）
├── scripts/
│   └── build.sh            # 构建脚本
└── .github/
    └── workflows/
        └── main.yml        # GitHub Actions 工作流配置
```

---

## 相关链接

- [Hexo 官方文档](https://hexo.io/docs/)
- [Markdown 语法指南](https://www.markdownguide.org/)
- [GitHub Pages 文档](https://docs.github.com/pages)
- [博客地址](https://springuper.github.io)

---

## 更新日志

- 2026-01-18: 初始版本，添加博客写作与发布指南
