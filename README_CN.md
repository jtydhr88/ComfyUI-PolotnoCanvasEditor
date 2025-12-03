# ComfyUI-PolotnoCanvasEditor

**中文 | [English](README.md)**

一个 ComfyUI 扩展插件，集成了 [Polotno](https://polotno.com) 画布编辑器，可在 ComfyUI 中直接进行高级图像编辑和设计。

![img.png](docs/img.png)

## 功能特点

- **完整的 Polotno 编辑器**：访问完整的 Polotno 画布编辑器及其所有功能
- **图像编辑**：从 ComfyUI 节点加载图像，使用专业工具进行编辑
- **文字与元素**：向图像添加文字、形状和其他设计元素
- **模板系统**：使用 Polotno 的模板系统快速创建设计
- **保存回 ComfyUI**：将编辑后的图像直接导出回 ComfyUI 工作流
- **右键菜单集成**：在任意图像节点上右键单击即可在 Polotno 中打开
- **顶部菜单按钮**：通过顶部菜单的 Polotno Canvas 按钮快速访问

## 安装

### 通过 ComfyUI Manager 安装

在 ComfyUI Manager 中搜索 "Polotno Canvas Editor" 并安装。

### 手动安装

1. 将此仓库克隆到 `ComfyUI/custom_nodes` 目录：
   ```bash
   cd ComfyUI/custom_nodes
   git clone https://github.com/jtydhr88/ComfyUI-PolotnoCanvasEditor.git
   ```

2. 重启 ComfyUI

## 配置

### API 密钥（可选）

Polotno 商业使用需要 API 密钥。对于开源和非营利项目，可以使用随机密钥（会显示 Polotno 品牌水印）。

设置 API 密钥的方法：
1. 进入 ComfyUI 的 **Settings（设置）**
2. 导航到 **Polotno Canvas Editor**
3. 在 **Polotno API Key** 字段中输入您的 API 密钥

从 [https://polotno.com](https://polotno.com) 获取 API 密钥

## 使用方法

### 打开编辑器

**方法一：顶部菜单按钮**
- 点击顶部菜单中的 "Polotno Canvas" 按钮打开新画布

**方法二：右键菜单**
- 在任意图像节点（LoadImage、PreviewImage、SaveImage 等）上右键单击
- 选择 "Open in Polotno Canvas Editor"
- 图像将被加载到编辑器中

### 编辑

进入编辑器后，您可以：
- 从侧边栏添加文字、形状和其他元素
- 调整大小和变换元素
- 应用滤镜和效果
- 使用图层进行复杂的合成

### 保存

点击 "Save to ComfyUI" 按钮可以：
- 将当前画布导出为 PNG 图像
- 上传到 ComfyUI 的 input 文件夹
- 更新源节点的图像（如果是从节点打开的）

## 开发

### 前置要求

- Node.js 18+
- npm 或 pnpm

### 构建

```bash
npm run install:all
npm run build:all
```

### 开发模式

```bash
npm run dev
```

这将监听文件变化并自动重新构建。

## 依赖

- [Polotno](https://polotno.com) - 画布编辑器库
- [Vue 3](https://vuejs.org) - UI 框架
- [PrimeVue](https://primevue.org) - UI 组件库
- [React](https://reactjs.org) - Polotno 需要

## 许可证

MIT

## 致谢

- [Polotno](https://polotno.com) 提供的出色画布编辑器
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) 工作流平台
- [ComfyUI-AudioMass](https://github.com/jtydhr88/ComfyUI-AudioMass) 插件结构参考
