# 大语言模型 · 一分钟看懂

一部 60 秒的科普短片：大语言模型是怎么工作的，又是怎么训练出来的。风格与上一级目录里的《抽象代数：结构之美》一致：画面由 HTML Canvas 和 WebGL 逐帧绘制，配乐与音效由 Python 合成，视频为 1920 × 1080、30 fps，中英双语字幕，没有旁白。

*A 60-second explainer on how a large language model works and how it is trained, built with the same pipeline as the abstract-algebra promo: every frame is drawn by JavaScript on a Canvas/WebGL page and exported frame by frame; the score and sound design are synthesized in Python; bilingual (中文 / English) captions, no voice-over.*

## 内容 / Storyboard

全片贯穿一句话："The cat sat on the" → "mat"。

| 时间 | 场景 | 讲什么 |
| --- | --- | --- |
| 0:00 – 0:05 | `s0_hook` | 它只做一件事：预测下一个词；标题 |
| 0:05 – 0:10 | `s1_tokens` | 文字 → 词元（token）→ 数字编号 |
| 0:10 – 0:15 | `s2_vectors` | 编号 → 向量；意思相近的词彼此靠近 |
| 0:15 – 0:22.5 | `s3_attention` | Transformer：注意力，几十层叠加 |
| 0:22.5 – 0:27.5 | `s4_predict` | 打分 → 概率 → 抽样 → 接在句末 → 重复 |
| 0:27.5 – 0:35 | `s5_read` | 预训练 I：读数万亿个词；遮住下一个词让它猜；损失 |
| 0:35 – 0:42.5 | `s6_learn` | 预训练 II：微调数十亿参数，损失一路下降 |
| 0:42.5 – 0:50 | `s7_teach` | 微调：人类示范与人类偏好反馈 |
| 0:50 – 1:00 | `s8_finale` | 对话演示、整条流水线、"预测"开始像"理解"，片尾 |

画面中的数字（编号、概率、参数量、损失）均为示意。

## 文件

| 文件 | 用途 |
| --- | --- |
| `SPEC.md` | 制作规范：时间线、接口、规则、音效词表、准确性准则、分镜 |
| `core.js` | 公共工具、WebGL 背景与胶片后期（泛光、颗粒、暗角）、场景接口 |
| `timeline.js` | 字幕、章节标签、遮幅、帧管线、播放器 |
| `scenes/*.js` | 每个场景一个文件，各自包在独立作用域里 |
| `music_llm.py` | 配乐与音效合成：96 BPM，24 小节，A 小调转 C 大调 |
| `cues.json` | 场景里声明的音效时间点（由页面导出，供 `music_llm.py` 读取） |
| `build.py` | 把 `core.js`、各场景和 `timeline.js` 拼成页面；`--embed` 生成内嵌配乐的单文件播放器 |
| `preview.py` | 渲染某个场景的静帧或测速，不影响其他文件 |
| `qa.py` | 对成片做检查：时长、响度、黑场、冻结、静音、缩略图联系表 |
| `music.mp3` | 最终配乐 |

## 重新生成

需要 Python 3（numpy、scipy）、Node.js 22+、Chrome 或 Edge，以及 `PATH` 中的 FFmpeg。字体来自 Google Fonts，所以需要联网。在仓库根目录运行：

```sh
python llm-intro/build.py                                          # 生成 llm-intro/index.html
node export.mjs --page llm-intro/index.html --cues llm-intro/cues.json    # 导出音效时间点
python llm-intro/music_llm.py                                      # 合成 llm-intro/music.mp3
node export.mjs --page llm-intro/index.html --audio llm-intro/music.mp3 \
  --workers 6 --crf 20 --out 大语言模型简介.mp4                       # 逐帧导出 MP4（约 10 分钟）
python llm-intro/build.py --embed                                  # 单文件播放器 大语言模型简介.html
```

只想检查某个场景的画面：

```sh
python llm-intro/preview.py --scenes s3_attention --times 16,18.5,21 --out /tmp/s3
python llm-intro/preview.py --scenes s3_attention --bench 15.5,22 --out /tmp/s3      # 每帧耗时
python llm-intro/qa.py check 大语言模型简介.mp4
python llm-intro/qa.py contact 大语言模型简介.mp4 --every 1 --out /tmp/sheets
```

没有 FFmpeg 时，可以下载静态版本并设置 `PATH`（或用环境变量 `FFMPEG` 指向它）。视频母版和检查帧不纳入 Git。
