import os
import sys
import json
import argparse
import traceback
import logging
import warnings
from pathlib import Path

# 抑制已知无害警告
# 1. torchao Triton 警告（Windows 上无 Triton 支持）
logging.getLogger('torchao.kernel.intmm').setLevel(logging.ERROR)
# 2. PyTorch 重定向警告（Windows/macOS 不支持）
os.environ.setdefault('TORCH_DISTRIBUTED_DEBUG', 'OFF')
warnings.filterwarnings('ignore', message='Redirects are currently not supported')
# 3. bitsandbytes bfloat16 → float16 转换警告
warnings.filterwarnings('ignore', message='MatMul8bitLt')
# 4. 防止 bitsandbytes/triton 其他警告渗透
os.environ.setdefault('BITSANDBYTES_NOWELCOME', '1')

import torch
from PIL import Image

IMG_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
DEFAULT_MODEL = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "models", "Qwen", "Qwen3-VL-8B-Instruct",
)

_model = None
_processor = None
_device = None


def emit(typ: str, msg: str, **kw):
    raw = json.dumps({"type": typ, "message": msg, **kw}, ensure_ascii=False).encode("utf-8") + b"\n"
    sys.stdout.buffer.write(raw)
    sys.stdout.buffer.flush()


def get_image_files(dir_path: str) -> list[str]:
    return sorted(
        os.path.join(dir_path, f)
        for f in os.listdir(dir_path)
        if Path(f).suffix.lower() in IMG_EXTENSIONS
    )


def load_model(model_path: str, quantization: str = "4bit", attn_implementation: str = "sdpa"):
    global _model, _processor, _device
    if _model is not None:
        return _model, _processor, _device

    _device = "cuda" if torch.cuda.is_available() else "cpu"

    if not os.path.isdir(model_path):
        emit("error", f"模型目录不存在: {model_path}")
        sys.exit(1)

    import transformers as _tr
    emit("info",
         f"加载模型中… 路径:{model_path} transformers:{_tr.__version__} "
         f"设备:{_device} 量化:{quantization} 注意力:{attn_implementation}")

    from transformers import BitsAndBytesConfig

    qconfig = None
    compute_dtype = torch.bfloat16

    if _device == "cuda" and quantization == "4bit":
        qconfig = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=compute_dtype,
            bnb_4bit_use_double_quant=True,
        )
        emit("info", "4-bit NF4 量化")
    elif _device == "cuda" and quantization == "8bit":
        qconfig = BitsAndBytesConfig(load_in_8bit=True)
        emit("info", "8-bit 量化")
    else:
        emit("info", "无量化 (FP16)")
        compute_dtype = torch.float32 if _device == "cpu" else torch.float16

    # ── Generic kwargs for all from_pretrained calls ─────────
    def make_kwargs(**extra):
        kw = dict(
            trust_remote_code=True,
            low_cpu_mem_usage=True,
            **extra,
        )
        if qconfig is not None:
            kw["quantization_config"] = qconfig
        if _device == "cuda" and attn_implementation:
            kw["attn_implementation"] = attn_implementation
        return kw

    # ── Try known model classes in order ────────────────────
    load_errors = []

    def _try(cls_name, import_path="transformers"):
        global _model
        if _model is not None:
            return
        try:
            exec(f"from {import_path} import {cls_name}", globals())
            cls = eval(cls_name, globals())
        except Exception as e:
            load_errors.append(f"{cls_name}: 导入失败: {e}")
            return
        try:
            _model = cls.from_pretrained(
                model_path,
                **make_kwargs(dtype=compute_dtype, device_map="auto" if _device == "cuda" else None),
            )
            emit("info", f"✓ {cls_name} 加载成功")
        except Exception as e:
            load_errors.append(f"{cls_name}: {e}")
            _model = None

    # 1. 首选: 最新 VL 模型类
    _try("AutoModelForImageTextToText")
    # 2. 备选: 用 Qwen3VLForConditionalGeneration（transformers 5.8 内置）
    _try("Qwen3VLForConditionalGeneration")
    # 3. 备选: 通用因果模型
    _try("AutoModelForCausalLM")
    # 4. 兜底: AutoModel（需验证有 generate）
    if _model is None:
        try:
            from transformers import AutoModel
            _model = AutoModel.from_pretrained(
                model_path,
                **make_kwargs(device_map="auto" if _device == "cuda" else None),
            )
            if hasattr(_model, "generate"):
                emit("info", "✓ AutoModel 加载成功")
            else:
                # If no lm_head, try loading it via AutoModelForCausalLM instead
                load_errors.append("AutoModel: 模型缺少 generate() 方法")
                _model = None
        except Exception as e:
            load_errors.append(f"AutoModel: {e}")
            _model = None

    if _model is None:
        emit("error", "模型加载失败:\n" + "\n".join(load_errors))
        sys.exit(1)

    # ── Processor ───────────────────────────────────────────
    from transformers import AutoProcessor
    try:
        _processor = AutoProcessor.from_pretrained(model_path, trust_remote_code=True)
    except Exception as e:
        emit("error", f"处理器加载失败: {e}")
        sys.exit(1)

    _model.config.use_cache = True
    _model.eval()

    if _device == "cuda":
        mem = torch.cuda.max_memory_allocated() / 1024**3
        emit("info", f"加载完成 ✅ 显存: {mem:.1f}GB")
    else:
        emit("info", "加载完成 ✅")

    return _model, _processor, _device


def process_image(model, processor, image_path, prompt, trigger_word, device, max_new_tokens=2048):
    text = prompt.replace("{chufaci}", trigger_word) if prompt else trigger_word
    if not text.strip():
        text = "Describe this image in detail."

    image = Image.open(image_path).convert("RGB")
    messages = [{
        "role": "user",
        "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": text},
        ],
    }]

    inputs = processor.apply_chat_template(
        messages, tokenize=True, add_generation_prompt=True,
        return_dict=True, return_tensors="pt",
    ).to(device)

    with torch.no_grad():
        generated_ids = model.generate(
            **inputs, max_new_tokens=max_new_tokens,
            do_sample=True, top_p=0.8, temperature=0.7,
            pad_token_id=processor.tokenizer.eos_token_id,
        )

    input_len = inputs["input_ids"].shape[1]
    generated_ids = generated_ids[:, input_len:]

    caption = processor.batch_decode(
        generated_ids, skip_special_tokens=True,
    )[0].strip()

    return caption


def main():
    parser = argparse.ArgumentParser(description="本地模型图片打标")
    parser.add_argument("--image-dir", required=True)
    parser.add_argument("--prompt", default="")
    parser.add_argument("--trigger-word", default="[trigger]")
    parser.add_argument("--model-path", default=DEFAULT_MODEL)
    parser.add_argument("--quantization", default="4bit", choices=["4bit", "8bit", "none"])
    parser.add_argument("--attn-implementation", default="sdpa", choices=["sdpa", "flash_attention_2", "eager"])
    parser.add_argument("--max-new-tokens", type=int, default=2048)
    args = parser.parse_args()

    if not os.path.isdir(args.image_dir):
        emit("error", f"目录不存在: {args.image_dir}")
        sys.exit(1)

    image_files = get_image_files(args.image_dir)
    if not image_files:
        emit("error", "目录中未找到图片文件")
        sys.exit(1)

    emit("start", f"找到 {len(image_files)} 张图片，准备开始…", total=len(image_files))

    try:
        model, processor, device = load_model(
            args.model_path, args.quantization, args.attn_implementation)
    except Exception as e:
        emit("error", f"模型加载失败: {e}\n{traceback.format_exc()}")
        sys.exit(1)

    success = fail = 0

    for i, img_path in enumerate(image_files):
        fname = os.path.basename(img_path)
        txt_path = str(Path(img_path).with_suffix(".txt"))

        if os.path.exists(txt_path):
            success += 1
            emit("skip", f"跳过 {fname}（已存在标注）",
                 current=i + 1, total=len(image_files), file=fname)
            continue

        emit("progress", f"处理 {fname} ({i + 1}/{len(image_files)})…",
             current=i + 1, total=len(image_files), file=fname)

        try:
            caption = process_image(
                model, processor, img_path,
                args.prompt, args.trigger_word, device,
                max_new_tokens=args.max_new_tokens,
            )
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(caption)
            success += 1
            emit("success", f"✓ {fname} 完成",
                 current=i + 1, total=len(image_files),
                 file=fname, caption=caption)
        except torch.cuda.OutOfMemoryError:
            fail += 1
            emit("error", f"✗ {fname} 显存不足",
                 current=i + 1, total=len(image_files), file=fname)
            torch.cuda.empty_cache()
        except Exception as e:
            fail += 1
            emit("error", f"✗ {fname} 失败: {e}",
                 current=i + 1, total=len(image_files), file=fname)

    emit("complete", f"处理完成  成功:{success}  失败:{fail}",
         total=len(image_files), success=success, fail=fail)


if __name__ == "__main__":
    main()