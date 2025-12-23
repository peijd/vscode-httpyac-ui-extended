# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

httpYac UI Extended 是基于 [httpyac](https://github.com/AnWeber/httpyac) 的 VS Code 扩展，为 HTTP/REST/GraphQL/gRPC/WebSocket 请求提供了友好的可视化界面，同时保留了完整的 `.http/.rest` 文件工作流。

## 核心架构

### 扩展结构 (src/)

**核心入口点：**
- `extension.ts` - 扩展激活入口，注册所有 providers 和 commands
- `extensionApi.ts` - 暴露给外部使用的扩展 API

**核心存储层：**
- `documentStore.ts` - HTTP 文档存储和解析，管理 httpFile 的生命周期
- `responseStore.ts` - HTTP 响应历史存储
- `provider/storeController.ts` - 环境变量管理和状态控制

**Provider 系统 (src/provider/)：**
- `webviewSidebarProvider.ts` - 侧边栏 Webview 提供者（Request Builder）
- `webviewPanelProvider.ts` - 独立面板 Webview 提供者（Request Editor）
- `runnerPanelProvider.ts` - 批量运行结果面板提供者
- `codeLensProvider.ts` - CodeLens 功能（发送请求、选择环境等）
- `historyController.ts` - 请求历史管理
- `test/` - 测试控制器和测试树视图
- `requestCommandsController.ts` - 请求命令控制器
- `environmentTreeDataProvider.ts` - 环境变量树视图
- `variablesTreeDataProvider.ts` - 变量树视图
- `userSessionTreeDataProvider.ts` - 用户会话管理

**Webview 桥接 (src/webview-bridge/)：**
- `messageHandler.ts` - 处理扩展与 Webview 之间的双向消息通信
- `messageTypes.ts` - 定义消息类型和数据结构（HttpRequest, HttpResponse 等）
- `httpFileConverter.ts` - HTTP 文件与内部请求对象之间的转换

**插件系统 (src/plugin/)：**
- `vscodeHttpyacPlugin.ts` - VS Code 特定的 httpyac 插件
- `errorNotificationHandler.ts` - 错误通知处理
- `outputChannelProvider.ts` - 输出频道日志

### Webview 前端 (src/webview/)

前端是一个独立的 React + TypeScript 项目，使用 Vite 构建：

**入口文件：**
- `sidebar-main.tsx` - 侧边栏 Webview 入口
- `editor-main.tsx` - 独立面板 Webview 入口
- `runner-main.tsx` - 批量运行结果面板入口

**应用组件：**
- `SidebarApp.tsx` - 侧边栏主应用
- `EditorApp.tsx` - 独立面板主应用
- `RunnerApp.tsx` - 批量运行结果应用

**核心组件 (src/webview/src/components/)：**
- `request/` - 请求构建组件（URL栏、方法选择、头部编辑、认证、请求体）
- `response/` - 响应展示组件（状态、头部、响应体、测试结果）
- `sidebar/` - 侧边栏组件（集合树、历史列表、环境选择器、快速请求）

**状态管理：**
- 使用 Zustand 进行状态管理（`hooks/useStore.ts`）
- 通过 `useVsCodeMessages.ts` 与扩展通信

## 开发命令

### 构建与编译

```bash
# 构建前端 webview（必需）
npm run build:webview

# 编译扩展（TypeScript -> dist/）
npm run compile

# 完整构建（构建前端 + 编译扩展）
npm run compile

# 仅监听模式（开发时使用）
npm run watch           # 监听扩展代码
npm run watch:webview   # 监听前端代码
```

### 代码质量

```bash
# 运行 lint（格式化 + ESLint + 类型检查）
npm run lint

# 单独运行 ESLint
npm run eslint

# 单独格式化代码
npm run format

# 类型检查
npm run tsc
```

### 打包与发布

```bash
# 打包为 .vsix 文件
npm run package
```

## 开发工作流

### 前端开发

前端代码在 `src/webview/` 中，是一个独立的项目：

1. 进入 webview 目录：`cd src/webview`
2. 安装依赖：`npm install`
3. 开发模式：`npm run dev`（启动 Vite 开发服务器）
4. 构建：`npm run build`

**注意：** 修改前端代码后，必须运行 `npm run build:webview` 来构建前端资源，然后再运行 `npm run compile` 来编译扩展。

### 扩展开发

扩展代码在 `src/` 中（排除 `src/webview`）：

- TypeScript 配置：`tsconfig.json`（排除 `src/webview`）
- ESLint 配置：`.eslintrc.yml`
- 编译输出：`dist/` 目录

### 消息通信

扩展与 Webview 通过 `messageHandler.ts` 进行双向通信：

**Webview -> Extension：**
- `sendRequest` - 发送 HTTP 请求
- `setEnvironments` - 设置环境变量
- `saveToHttpFile` / `appendToHttpFile` / `saveRequest` - 保存请求到文件
- `getCollections` - 获取集合列表
- `runCollection` - 批量运行集合

**Extension -> Webview：**
- `requestResponse` - 返回 HTTP 响应
- `environmentsUpdated` - 环境变量更新
- `collectionsUpdated` - 集合更新
- `historyUpdated` - 历史记录更新

## 关键概念

### HttpRegion 与 HttpFile

- `HttpFile` - 一个 `.http` 文件的完整表示，包含多个 `HttpRegion`
- `HttpRegion` - 文件中的一个请求区域，包含请求行、头部、请求体、脚本等
- 每个区域可以通过 `symbol.name`、`startLine`、`endLine` 定位

### 请求源追踪

请求对象包含 `source` 字段，用于追踪其来源文件：
- `filePath` - 源 `.http` 文件路径
- `regionSymbolName` - 区域符号名称
- `regionStartLine` / `regionEndLine` - 区域位置
- `sourceHash` - 区域内容的哈希值（用于变更检测）

### 环境变量

- 支持多环境选择（通过 `environmentSelectedOnStart` 配置）
- 可以设置全局环境或文件级环境
- 环境变量通过 `StoreController` 管理

## 测试

项目包含测试框架支持：
- `src/provider/test/` - VS Code 测试控制器集成
- 支持在 `.http` 文件中编写测试脚本

## 调试

在 VS Code 中调试扩展：
1. 按 F5 启动扩展开发主机
2. 在新窗口中打开一个 `.http` 文件进行测试

调试 Webview：
- Webview 使用标准的浏览器开发工具
- 可以在 webview 中右键选择"检查元素"打开 DevTools

## 注意事项

- **构建顺序**：必须先构建前端（`npm run build:webview`），再编译扩展（`npm run compile`）
- **TypeScript 严格模式**：项目启用了严格的 TypeScript 检查（`strict: true`）
- **ESLint 规则**：代码必须通过 ESLint 检查才能提交
- **版本要求**：VS Code 1.91.0+
