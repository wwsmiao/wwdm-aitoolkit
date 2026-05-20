# WWDM AI Toolkit

AI training toolkit based on Ostris AI Toolkit, with Chinese UI enhancements and additional features.

## Features

- **AI Training** — LoRA / Dreambooth training with PyTorch
- **Image Batch Processing** — resize, rename, format conversion
- **Image Tagging** — Ollama API mode + local Qwen3-VL model mode
- **Model Management** — browse and download trained LoRA models
- **Loss Graph** — real-time training loss visualization with uPlot

## Quick Start

### Requirements
- Python >= 3.10
- NVIDIA GPU (>= 24GB VRAM recommended)
- Node.js >= 18

### Install

```bash
git clone https://github.com/wwsmiao/wwdm-aitoolkit.git
cd wwdm-aitoolkit

# Python env
python -m venv venv
.\venv\Scripts\activate

# PyTorch (CUDA 12.6)
pip install --no-cache-dir torch==2.7.0 torchvision==0.22.0 torchaudio==2.7.0 --index-url https://download.pytorch.org/whl/cu126

# Dependencies
pip install -r requirements.txt
```

### Launch

```bash
cd ui
npm install
npm run build_and_start
```

Open http://localhost:8675

## Contact

- Bilibili: https://space.bilibili.com/472768517
- WeChat: weiweismiao

## License

Based on Ostris AI Toolkit. Follows original project license.
