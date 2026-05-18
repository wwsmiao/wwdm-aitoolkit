import React from 'react';
import { ConfigDoc } from '@/types';
import { IoFlaskSharp } from 'react-icons/io5';

const docs: { [key: string]: ConfigDoc } = {
  'config.name': {
    title: '任务名称 (Training Name)',
    description: (
      <>
        训练任务的名称。该名称将用于在系统中标识此任务，并且通常会作为最终生成的模型文件名。名称必须唯一，且只能包含字母、数字、下划线和连字符，不能包含空格或特殊字符。
      </>
    ),
  },
  gpuids: {
    title: '显卡选择 (GPU ID)',
    description: (
      <>
        选择用于此次训练的显卡。目前通过 UI 界面，每个任务只能使用一张显卡。不过，你可以同时开启多个训练任务，让它们分别使用不同的显卡并行运行。
      </>
    ),
  },
  'config.process[0].trigger_word': {
    title: '触发词 (Trigger Word)',
    description: (
      <>
        可选：这是用于激活你训练的角色或概念的特定词汇（Token）。
        <br />
        <br />
        如果你设置了触发词，但你的数据集标签（Caption）里没有包含它，系统会自动把它加到标签的开头。如果你完全没有标签，标签就会直接变成这个触发词。
        如果你希望在标签的不同位置插入触发词，可以使用 <code>{'[trigger]'}</code> 占位符，它会自动被替换为你设置的触发词。
        <br />
        <br />
        注意：触发词不会自动添加到你的“采样预览提示词”里，所以在那边你需要手动输入触发词，或者同样使用 <code>{'[trigger]'}</code> 占位符。
      </>
    ),
  },
  'config.process[0].model.name_or_path': {
    title: '模型路径/名称 (Name or Path)',
    description: (
      <>
        这里填写你想基于哪个底模进行训练。可以填 Huggingface 上的 diffusers 仓库名称，也可以填本地底模的绝对路径。
        大多数情况下，文件夹需要是 diffusers 格式。对于某些模型（如 SDXL 和 SD1），你也可以直接填 .safetensors 单文件的路径。
      </>
    ),
  },
  'datasets.control_path': {
    title: '控制集路径 (Control Dataset)',
    description: (
      <>
        控制数据集中的文件必须与训练数据集中的文件名一一对应（匹配的文件对）。
        这些图像将在训练过程中作为控制/输入图像使用。控制图像会被自动缩放以匹配训练图像的尺寸。
      </>
    ),
  },
  'datasets.multi_control_paths': {
    title: '多重控制集 (Multi Control Dataset)',
    description: (
      <>
        控制数据集中的文件必须与训练数据集中的文件名一一对应。这些图像将在训练过程中作为控制/输入图像使用。
        <br />
        <br />
        对于多重控制集，控制效果将按照列出的顺序依次应用。如果模型（例如 Qwen/Qwen-Image-Edit-2509）不需要图像具有相同的长宽比，
        那么控制图像不需要匹配目标图像的尺寸或比例，它们会自动缩放至该模型的理想分辨率。
      </>
    ),
  },
  'datasets.num_frames': {
    title: '帧数 (Number of Frames)',
    description: (
      <>
        设置从视频数据集中提取并缩放的帧数。如果你的数据集是图片，请设为 1。如果全是视频，系统会从视频中均匀提取指定数量的帧。
        <br />
        <br />
        最好在训练前就把视频剪辑到合适的长度。以 Wan 模型为例，它是 16 帧/秒。如果你设为 81 帧，那就是 5 秒的视频。所以为了最佳效果，建议把素材都剪辑成 5 秒左右。
        <br />
        <br />
        举例：如果你设为 81 帧，但素材里有一个 2 秒的视频和一个 90 秒的视频，结果就是 2 秒的视频被拉伸成慢动作，而 90 秒的视频变成了超级快进。
      </>
    ),
  },
  'datasets.do_i2v': {
    title: '执行图生视频 (Do I2V)',
    description: (
      <>
        对于同时支持 I2V（图生视频）和 T2V（文生视频）的模型，勾选此项会将该数据集视为 I2V 数据集进行训练。这意味着系统会提取视频的第一帧作为起始图像。如果不勾选，数据集将被视为普通的 T2V 数据集。
      </>
    ),
  },
  'datasets.flip': {
    title: '水平/垂直翻转 (Flip X/Y)',
    description: (
      <>
        你可以通过水平（X轴）或垂直（Y轴）翻转来实时增强数据集。翻转一个轴相当于把数据量翻倍，模型既会学习原图，也会学习翻转后的图。
        这很有用，但也可能是破坏性的。例如：没必要训练倒立的人；翻转人脸可能会让模型困惑（因为人的左右脸并不完全对称）；对于包含文字的图片，翻转显然是个坏主意。
        <br />
        <br />
        如果使用了控制图像（Control Images），它们也会被同步翻转，以保证像素级的匹配。
      </>
    ),
  },
  'train.unload_text_encoder': {
    title: '卸载文本编码器 (Unload Text Encoder)',
    description: (
      <>
        启用后，系统会缓存触发词和采样提示词，然后从显存中卸载文本编码器（Text Encoder）。
        注意：这样一来，数据集中的文本标签（Captions）将会被忽略。
      </>
    ),
  },
  'train.cache_text_embeddings': {
    title: '缓存文本嵌入 (Cache Text Embeds)',
    description: (
      <>
        <small>(实验性功能)</small>
        <br />
        此选项会将所有文本嵌入（Text Embeddings）预处理并缓存到硬盘上，然后从显存中卸载文本编码器。
        这可以节省显存，但不支持任何动态改变提示词的功能（如动态触发词、Caption Dropout 等）。
      </>
    ),
  },
  'model.multistage': {
    title: '多阶段训练 (Stages to Train)',
    description: (
      <>
        某些模型拥有多阶段网络（通常是两个阶段：高噪点阶段和低噪点阶段），它们在去噪过程中是分开使用的。
        你可以选择同时训练两个阶段，或者分开训练。如果同时训练，训练器会交替训练每个阶段，最终输出 2 个不同的 LoRA。
        如果你只选一个阶段，训练器就只训练那个阶段，输出 1 个 LoRA。
      </>
    ),
  },
  'train.switch_boundary_every': {
    title: '阶段切换间隔 (Switch Boundary Every)',
    description: (
      <>
        当训练多阶段模型时，此设置控制训练器在不同阶段之间切换的频率（步数）。
        <br />
        <br />
        在低显存模式下，未被训练的模型阶段会被卸载到内存中以节省显存。这个加载/卸载过程需要时间，所以低显存时建议不要切换得太频繁（建议设为 10 或 20）。
        <br />
        <br />
        切换发生在批次（Batch）级别，也就是在梯度累积步骤之间。如果你想在一个步骤内同时训练两个阶段，可以将此值设为 1，并将梯度累积设为 2。
      </>
    ),
  },
  'train.force_first_sample': {
    title: '强制首次采样 (Force First Sample)',
    description: (
      <>
        此选项会强制训练器在启动时立即生成一次采样预览。
        通常情况下，只有在从头开始训练时才会生成首次采样；如果是从断点恢复训练，默认不会生成。
        勾选此项可以强制生成，方便你在修改了采样提示词后立即查看效果。
      </>
    ),
  },
  'model.layer_offloading': {
    title: (
      <>
        层卸载 (Layer Offloading){' '}
        <span className="text-yellow-500">
          ( <IoFlaskSharp className="inline text-yellow-500" name="Experimental" /> 实验性功能)
        </span>
      </>
    ),
    description: (
      <>
        这是一个基于{' '}
        <a className="text-blue-500" href="https://github.com/lodestone-rock/RamTorch" target="_blank">
          RamTorch
        </a>
        的实验性功能。目前处于早期阶段，更新可能会导致行为不一致，且仅支持特定模型。
        <br />
        <br />
        层卸载使用 CPU 内存（RAM）代替 GPU 显存来存储大部分模型权重。这允许你在小显存显卡上训练大模型（前提是你的内存够大）。
        这比纯 GPU 训练要慢，但内存比显存便宜且易于升级。不过，你仍然需要一定的显存来存储优化器状态和 LoRA 权重。
        <br />
        <br />
        你可以调整卸载层数的百分比。通常来说，卸载越少（接近 0%）性能越好；如果显存不足，可以调高这个比例。
      </>
    ),
  },
  'model.qie.match_target_res': {
    title: '匹配目标分辨率 (Match Target Res)',
    description: (
      <>
        此设置会让控制图像的分辨率匹配目标图像。Qwen-Image-Edit-2509 的官方推理示例总是传入 1MP 分辨率的控制图，无论生成尺寸多大。
        这导致低分辨率训练很困难。勾选此项后，控制图的分辨率会调整为与目标图一致，从而允许你在训练较小分辨率时节省显存。
        你仍然可以使用不同的长宽比，图像只是会调整像素总数以匹配目标。
      </>
    ),
  },
  'train.diff_output_preservation': {
    title: '差异输出保留 (DOP)',
    description: (
      <>
        差异输出保留 (DOP) 是一种在训练中保留概念类别特征的技术。为此，你必须设置一个触发词来区分你的概念及其类别。
        <br />
        例如：你在训练一个叫“Alice”的女性。触发词是“Alice”，类别是“woman”。我们希望模型在学习 Alice 独特特征的同时，保留它对“woman”的既有认知。
        <br />
        训练时，系统会将提示词中的触发词替换为类别词（如把“photo of Alice”变成“photo of woman”），并在禁用 LoRA 的情况下进行一次预测（先验预测）。
        然后，训练器不仅执行正常的训练步骤，还会额外执行一步，目标是让模型在输入类别词时，输出结果尽可能接近这个先验预测。
        这不仅能提高训练效果，还能防止过拟合（例如防止“Alice站在一个女人旁边”这种提示词生成出两个长得像 Alice 的人）。
      </>
    ),
  },
  'train.blank_prompt_preservation': {
    title: '空提示词保留 (BPP)',
    description: (
      <>
        空提示词保留 (BPP) 旨在保护模型在无提示词（空提示）情况下的原始知识。
        这不仅能让模型更灵活，还能提高推理质量，特别是在使用 CFG（无分类器引导）时。
        <br />
        在每一步训练中，系统会在禁用 LoRA 的情况下，使用空提示词做一个先验预测。然后，这个预测值会被用作额外训练步骤的目标。
        这样做可以防止模型对提示词过拟合，保留其泛化能力。
      </>
    ),
  },
  'train.do_differential_guidance': {
    title: '差分引导 (Differential Guidance)',
    description: (
      <>
        差分引导会在训练过程中放大“模型预测”与“目标”之间的差异，以此构建一个新的训练目标。
        “差分引导系数 (Scale)”就是这个差异的放大倍数。
        <br />
        <br />
        这还是个实验性功能，但在测试中，它能显著加快训练速度，并且在各种场景下都能让模型更好地学习细节。
        <br />
        <br />
        原理简述：正常的训练是让模型一步步“靠近”目标，但受限于学习率，永远无法完全到达。
        差分引导通过放大差异，把目标设定在比实际目标更远的地方，这会迫使模型尝试“冲过头”或更用力地击中目标，从而抵消学习率的限制。
        <br />
        <br />
        <img src="/imgs/diff_guidance.png" alt="差分引导示意图" className="max-w-full mx-auto" />
      </>
    ),
  },
};

export const getDoc = (key: string | null | undefined): ConfigDoc | null => {
  if (key && key in docs) {
    return docs[key];
  }
  return null;
};

export default docs;