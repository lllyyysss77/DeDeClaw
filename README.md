# DeDe Desktop

一款现代化的 Discord 风格桌面客户端，专为 AI 对话和团队协作而设计

## 📸 应用截图

<!-- 
在此添加应用截图，推荐尺寸：1200x800
示例：
![主界面](docs/images/main-interface.png)
![聊天视图](docs/images/chat-view.png)
![设置页面](docs/images/settings.png)
-->

## ✨ 核心特色

- **🎨 Discord 风格界面** - 现代化、直观的用户界面设计
- **🤖 AI 智能对话** - 无缝集成多种 AI 模型和智能代理
- **📱 多频道管理** - 灵活的频道组织方式，支持群组和私聊
- **🖼️ 富媒体支持** - 图片、文件、代码块等多种消息格式
- **⚡ 实时通信** - 即时消息传递，支持输入状态提示
- **📐 响应式设计** - 专为桌面端优化（1200x800 窗口）

## 🎯 功能亮点

### 聊天体验
- **多样化消息类型** - 用户消息、AI 消息（带智能标签）、图片消息、文件消息、系统通知
- **富文本编辑器** - 基于 Tiptap 的强大编辑器，支持 Markdown、格式化文本
- **智能提示** - 支持 @Plan 提及、文件拖拽、图片粘贴
- **消息状态** - 已读未读标识、输入中状态、加载动画

### 界面设计
- **三栏布局** - 左侧群组列表、中间频道列表、右侧聊天区域
- **夜间模式** - 护眼深色主题，长时间使用不疲劳
- **自定义头像** - 支持个人资料库图片选择
- **徽章系统** - 未读消息计数、状态指示器

### AI 集成
- **多模型支持** - 兼容多种 LLM 模型
- **智能检索** - 内置知识库搜索功能
- **上下文理解** - 保持对话历史和上下文连贯性
- **工具调用** - 支持联网搜索、文件处理等扩展功能

## 🛠️ 技术栈

- **前端框架** - React 18 + TypeScript 5
- **桌面引擎** - Electron 33
- **构建工具** - Vite 5
- **样式方案** - Tailwind CSS + PostCSS
- **富文本编辑** - Tiptap Editor
- **Markdown 渲染** - React Markdown + Remark GFM
- **状态管理** - SWR 数据获取
- **国际化** - i18next 多语言支持

## 📦 安装指南

### 系统要求

- Node.js 18 或更高版本
- Windows 10+ / macOS 10.15+ / Linux
- 至少 4GB 内存

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/your-username/dede-desktop.git
cd dede-desktop

# 安装依赖
npm install
# 或者使用 pnpm
pnpm install
```

## 🏃‍♂️ 开发运行

```bash
# 启动开发服务器
npm run dev

# 这将同时启动：
# - Vite 开发服务器（端口 5173）
# - Electron 主进程
```

## 🔨 构建打包

```bash
# 生产构建
npm run build

# 打包应用
npm run package          # 当前平台
npm run package:dmg      # macOS DMG 安装包
npm run package:win      # Windows 安装程序
npm run package:win-dir  # Windows 便携版
```

## 📁 项目结构

```
dede-desktop/
├── main/                 # Electron 主进程
│   └── index.ts         # 主进程入口
├── src/                  # React 渲染进程
│   ├── components/       # UI 组件
│   │   ├── Sidebar.tsx   # 侧边栏组件
│   │   ├── ChannelList.tsx # 频道列表
│   │   ├── ChatView.tsx  # 聊天视图
│   │   ├── MessageItem.tsx # 消息项
│   │   └── MessageInput.tsx # 消息输入框
│   ├── pages/           # 页面组件
│   │   └── ChatPage.tsx # 聊天页面
│   ├── shared/          # 共享类型和工具
│   │   └── types/       # TypeScript 类型定义
│   ├── mockData.ts      # 开发模拟数据
│   ├── App.tsx          # 应用根组件
│   ├── main.tsx         # 渲染进程入口
│   └── index.css        # 全局样式
├── public/              # 静态资源
├── docs/
│   └── images/          # 截图和文档图片
├── index.html           # HTML 模板
├── package.json         # 项目配置
├── vite.config.ts       # Vite 配置
└── README_DESKTOP.md    # 项目说明
```

## � 当前功能

- ✅ Discord 风格 UI 设计
- ✅ 左侧群组列表导航
- ✅ 中间频道列表管理
- ✅ 右侧聊天区域交互
- ✅ 模拟数据展示各种场景：
  - 用户消息与 AI 消息
  - 图片和文件分享
  - 系统通知和状态提示
  - 加载状态和错误处理
  - 长文本和长用户名适配
  - 未读消息徽章计数
- ✅ 知识库检索控制图标
- ✅ 富文本消息输入（图片、文件、@Plan）
- ✅ 响应式设计（1200x800 窗口）
- ✅ 频道头像自定义功能
- ✅ 历史消息分页加载

## 🔧 配置说明

应用通过环境变量进行配置，复制 `.env.example` 到 `.env` 并根据需要修改。

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m '添加某个很棒的功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 开源协议

本项目采用 MIT 协议 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👥 开发团队

- **DeDe Team** - *初始开发*

## 📞 技术支持

如有任何问题或需要帮助，请在 GitHub 上提交 Issue。

---

由 DeDe Team 用 ❤️ 精心构建
