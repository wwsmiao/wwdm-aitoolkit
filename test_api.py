import os
import google.generativeai as genai

# --- 请在这里填入您的 API Key ---
# 为了测试，请直接将密钥字符串粘贴在这里
GOOGLE_API_KEY = "AIzaSyDGHjWCD8hcIGNmV7VtFRcPvT69mnJwgkQ"
# ------------------------------------

if "YOUR_GOOGLE_API_KEY_HERE" in GOOGLE_API_KEY:
    print("错误：请在代码中填入您的真实 Google API Key。")
    exit()

print("Step 1: 正在配置 API Key...")
try:
    genai.configure(api_key=GOOGLE_API_KEY)
    print("   ✓ API Key 配置成功。")
except Exception as e:
    print(f"   ✗ API Key 配置失败: {e}")
    exit()

model_name = "models/gemini-2.5-flash-image-preview"
prompt = "a photo of a blue cat eating a banana"

try:
    print(f"\nStep 2: 正在初始化模型: {model_name}...")
    model = genai.GenerativeModel(model_name)
    print("   ✓ 模型初始化成功。")

    print(f"\nStep 3: 正在发送请求，提示词: '{prompt}'...")
    # 直接生成内容
    response = model.generate_content(prompt)
    print("   ✓ API 请求已发送并收到响应。")

    print("\n--- API 响应内容 ---")
    # 打印出最原始的响应，看看它到底是什么样子的
    print(response)
    print("--------------------")

    print("\nStep 4: 尝试解析响应...")
    image_found = False
    for part in response.parts:
        # 检查 part 对象是否有名为 mime_type 的属性
        if hasattr(part, 'mime_type') and part.mime_type.startswith("image/"):
            print(f"   ✓ 成功找到图像部分！MIME Type: {part.mime_type}")
            image_found = True
            break

    if not image_found:
         print("   ✗ 未能在响应中找到有效的图像部分。")

except Exception as e:
    print(f"\n--- 测试失败 ---")
    print(f"在API调用过程中发生严重错误。")
    print(f"错误类型: {type(e).__name__}")
    print(f"错误信息: {e}")
    print("-----------------")