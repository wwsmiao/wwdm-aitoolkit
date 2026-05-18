# WWDM AI Toolkit

> 基于 Ostris AI Toolkit 深度定制的中文增强版 — 专为 AI 训练与图片标注优化

---

## ✨ 新增功能

### 🖼️ 图片处理 (Image Batch Processing)

前端 "图片处理" 页面支持三种批量操作：

| 功能 | 说明 |
|------|------|
| **批量缩放** | 5 种模式：指定宽度、指定高度、等比例、硬限、百分比 |
| **批量重命名** | 前缀 + 序号（如 my_image_001.jpg） |
| **格式转换** | JPEG / PNG / WebP / GIF 相互转换 |

- 基于 sharp 库，快速高效
- SSE 流式进度显示，支持中途停止

### 🏷️ 图片打标 (Image Tagging)

支持 **两种打标模式**：

#### Ollama API 模式
- 调用本地 Ollama 服务中的多模态模型（llava、moondream、minicpm-v 等）
- 可自定义提示词模板，支持 {chufaci} 占位符
- 模板管理：创建、选择、删除

#### 本地模型模式
- 直接通过 GPU 运行 Qwen3-VL-8B-Instruct 等模型进行标注
- 支持 4-bit / 8-bit 量化，显存需求低（~6GB）
- 可配置注意⼒算法（SDPA / Flash Attention 2 / Eager）
- 完善的警告抑制处理，运行更清爽

### 👤 继续开发

侧边栏 "设置" 菜单下方新增 **"继续开发"** 面板，包含：

- **作者信息**：薇薇的猫
- **B站主页**：[space.bilibili.com/472768517](https://space.bilibili.com/472768517)
- **联系方式**：微信 weiweismiao / QQ 1579493251
- **更新日志**：2026.5.18 — 增加图片处理功能、增加图片打标功能

---

## 📋 页面导航

| 菜单 | 路径 | 说明 |
|------|------|------|
| 仪表盘 | /dashboard | 系统状态总览 |
| 新建任务 | /jobs/new | 创建训练任务 |
| 训练任务 | /jobs | 管理和监控任务 |
| 数据集 | /datasets | 数据集浏览与管理 |
| 图片处理 | /image-batch | 批量图片处理 |
| 图片打标 | /ollama-tagging | 自动生成图片标注 |
| 设置 | /settings | 系统设置 |
| 继续开发 | 侧边栏底部 | 作者信息与更新日志 |

---

## 🚀 快速开始

### 环境要求

- Python > 3.10
- NVIDIA GPU（建议 ≥ 24GB VRAM 用于训练）
- Node.js > 18
- Git

### 安装

`ash
git clone https://github.com/wwsmiao/wwdm-aitoolkit.git
cd wwdm-aitoolkit

# Python 虚拟环境
python -m venv venv
.\venv\Scripts\activate

# 安装 PyTorch
pip install --no-cache-dir torch==2.7.0 torchvision==0.22.0 torchaudio==2.7.0 --index-url https://download.pytorch.org/whl/cu126

# 安装依赖
pip install -r requirements.txt
`

### 启动 Web UI

`ash
cd ui
npm run build_and_start
`

访问 http://localhost:8675 即可使用。

### 设置登录密码（可选）

`powershell
="your_password"; npm run build_and_start
`

---

## 💬 联系与反馈

- **作者**：薇薇的猫
- **B站**：[space.bilibili.com/472768517](https://space.bilibili.com/472768517)
- **微信**：weiweismiao
- **QQ**：1579493251

如有问题或建议，欢迎通过以上方式联系！

---

## 📄 许可

本项目基于 Ostris AI Toolkit 修改，遵循原项目许可证。