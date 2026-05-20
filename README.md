# WWDM AI Toolkit

基于 Ostris AI Toolkit 深度定制版 — AI 模型训练与图片处理工具箱

## 功能

| 模块 | 说明 |
|------|------|
| 训练任务 | 新建/管理/监控 AI 模型训练，支持 LoRA 微调 |
| 数据集 | 数据集浏览、上传、管理 |
| 图片处理 | 批量缩放、重命名、格式转换 |
| 图片打标 | Ollama / 本地模型自动标注 |
| 模型管理 | 查看和下载训练产出的 LoRA 模型 |
| Loss Graph | 训练损失曲线可视化（平滑/对数/CSV导出） |

## 快速开始

```bash
git clone https://github.com/wwsmiao/wwdm-aitoolkit.git
cd wwdm-aitoolkit

# Python 环境
python -m venv venv
.\venv\Scripts\activate
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
pip install -r requirements.txt

# 启动 Web UI
cd ui
npm install
npm run build_and_start
```

访问 http://localhost:8675

## 环境要求

- Python >= 3.10
- NVIDIA GPU（训练建议 >= 24GB VRAM）
- Node.js >= 18

## 联系

- B站：[薇薇的猫](https://space.bilibili.com/472768517)
- 微信：weiweismiao
