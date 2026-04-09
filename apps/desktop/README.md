# DeDe Desktop - Electron 客户端

## 安装依赖

```bash
cd apps/desktop
npm install
```

## 开发运行

```bash
npm run dev
```

这将同时启动：
- Vite 开发服务器（端口 5173）
- Electron 主进程

## 构建

```bash
npm run build
```

## 打包

```bash
npm run package
```

## 项目结构

```
apps/desktop/
├── main/                 # Electron 主进程
│   └── index.ts
├── src/                  # React 渲染进程
│   ├── components/       # UI 组件
│   │   ├── Sidebar.tsx
│   │   ├── ChannelList.tsx
│   │   ├── ChatView.tsx
│   │   ├── MessageItem.tsx
│   │   └── MessageInput.tsx
│   ├── pages/
│   │   └── ChatPage.tsx
│   ├── mockData.ts       # 模拟数据
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
└── vite.config.ts
```

## 当前功能

- ✅ Discord 风格的 UI 设计
- ✅ 左侧群组列表
- ✅ 中间频道列表
- ✅ 右侧聊天区域
- ✅ 模拟数据展示各种场景：
  - 用户消息
  - Agent 消息（带 AI 标签）
  - 图片消息
  - 文件消息
  - 系统消息
  - 加载中状态
  - 长文本消息
  - 长用户名
  - 未读消息徽章
- ✅ Library 检索控制图标
- ✅ 消息输入框（支持图片、文件、@Plan）
- ✅ 响应式设计（1200x800 窗口）
