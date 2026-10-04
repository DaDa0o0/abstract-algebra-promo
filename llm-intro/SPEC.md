# 大语言模型 · 一分钟看懂 → the 2:50 cut — production spec (v2)

An **explainer of 2 minutes 50 seconds**, "How a large language model works and how it is trained", in the same style as
`../promo.html` (the abstract-algebra promo in this repo): dark cinematic space, glowing particles and type,
bloom + film grain, bilingual (中文 / English) subtitles, chapter labels, and a synthesized score locked to a bar grid.
No voice-over (there is no TTS here): captions + music + sound design carry it, exactly like the original.

**Why v2 exists.** A first 60 s cut was made and the feedback was: *"it looks very good, but each scene is a little too short; people do not have
enough time to understand everything on a single page"*. So v2 is about **time to understand**: every idea gets its own page, every page gets
a calm hold with everything readable, captions are slow enough to read in either language, and a few new beats (sampling randomness,
how one training step works, hallucination) were added. The 60 s cut's scene files already exist in `scenes/` and are your **starting point**:
keep their visual vocabulary and the good ideas, but re-time, split and extend them as this storyboard says. A copy of those files and the old spec is in
`/home/da/.claude/jobs/948446f1/tmp/work/snapshot2/` (read it when you need code from another scene).

Output: 1920×1080, 30 fps, 5100 frames, H.264 + AAC, produced by `../export.mjs` (every frame is drawn in JavaScript on a Canvas 2D context plus a WebGL backdrop/bloom pass).

## 1. Files and tools

```
llm-intro/core.js        shared helpers + WebGL backdrops + film post + scene API   (READ IT FIRST; do not edit)
llm-intro/timeline.js    subtitles, chapter label, letterbox, frame pipeline, player (do not edit)
llm-intro/scenes/*.js    ONE FILE PER SCENE  <- you write these
llm-intro/build.py       assembles pages (every scene file is wrapped in its own function scope + <script> tag)
llm-intro/preview.py     builds a preview page and renders still frames / timing
llm-intro/music_llm.py   the score (music agent)
../export.mjs            frame-by-frame exporter (Chrome + ffmpeg)
```

Render stills of YOUR scene (times are GLOBAL seconds; scene start = start_bar × 2.5):

```
export PATH=/home/da/.claude/jobs/948446f1/tmp/bin:$PATH        # gives you ffmpeg (only needed for full exports / audio)
python3 llm-intro/preview.py --scenes s3_attention --times 41,45,50,55,59 --out /home/da/.claude/jobs/948446f1/tmp/work/<yourname>
python3 llm-intro/preview.py --scenes s3_attention --bench 41,59 --out /home/da/.claude/jobs/948446f1/tmp/work/<yourname>      # ms per frame
```

Then **look at the JPGs with the Read tool** (it shows images). Iterate until it looks like a finished film frame.
Use your own `--out` directory under `/home/da/.claude/jobs/948446f1/tmp/work/` so parallel authors never clobber each other.
Never edit `core.js`, `timeline.js`, `build.py`, `export.mjs`, or another scene's file. If you need a helper, write it inside your scene file.

## 2. Timeline (BPM 96 → 1 beat = 0.625 s, 1 bar = 2.5 s, 68 bars = 170 s)

| file                | start bar | len | global time     | topic |
|---------------------|-----------|-----|-----------------|-------|
| `s0_hook.js`        | 0         | 4   | 0:00 – 0:10     | hook: it predicts the next word → title |
| `s1_tokens.js`      | 4         | 6   | 0:10 – 0:25     | text → tokens → IDs; the vocabulary |
| `s2_vectors.js`     | 10        | 6   | 0:25 – 0:40     | IDs → vectors; meaning space; the king/queen arithmetic |
| `s3_attention.js`   | 16        | 8   | 0:40 – 1:00     | Transformer: context, attention weights, layers and heads |
| `s4_predict.js`     | 24        | 8   | 1:00 – 1:20     | scores → probabilities → random draw → append → repeat |
| `s5_read.js`        | 32        | 6   | 1:20 – 1:35     | pretraining I: the data, "guess the next word", the loss |
| `s6_learn.js`       | 38        | 8   | 1:35 – 1:55     | pretraining II: parameters (knobs), one training step, repeat billions of times |
| `s7_teach.js`       | 46        | 10  | 1:55 – 2:20     | post-training: raw model → human examples → human preference → helpful/honest/harmless |
| `s8_chat.js` (NEW)  | 56        | 6   | 2:20 – 2:35     | using it: the chat, token by token; and it can be confidently wrong |
| `s9_finale.js`      | 62        | 6   | 2:35 – 2:50     | recap of the whole pipeline; "prediction looks like understanding"; end title |

`scene({ start, len })` are in **bars**; `draw(lt, d, T)` gets **local seconds** `lt` (0..len×2.5), `d` = duration, `T` = global time.
Subtitles and sfx times inside a scene are local seconds. Scenes tile the 68 bars exactly. Give each scene `id`: hook, tokens, vectors, attention, predict, read, learn, teach, chat, finale.
`s9_finale.js` was `s8_finale.js` in the 60 s cut (renamed already); the chat window of the old finale becomes the hero of the new `s8_chat.js`.

Letterbox (timeline.js): black cinema bars (138 px top and bottom) are CLOSED from 0 s to 6.2 s, open by 7.1 s, and close again from global 164.8 s to 166.4 s
(= local 9.8–11.4 s in `s9_finale`). Chapter labels (`ch`) show top-left from 0.35 s to about 5.5 s of a scene.

**Hand-offs between scenes.** Default: a 0.25–0.4 s dip to black at each edge (`fo`/`fi`). Two hand-offs are HARD CUTS with matched frames:
`tokens → vectors` (tokens ends on the glowing ID 3797 at x 960, y 470, 210 px; vectors opens on the same number in the same place; tokens `fo: 0`, vectors `fi: .01`) and
`attention → predict` (attention ends with the bright context vector leaving the top-centre of the frame, about x 960, y 220, on the beat at local 19.375 s; predict opens receiving that same vector there; attention `fo: 0`, predict `fi: .01`).
Copy the vector values EXACTLY (read the neighbour's file in `snapshot2/` for the table; the attention author keeps the table and its exit position/timing unchanged, the predict author copies it).

## 3. The story thread (keep it consistent!)

One sentence travels through the whole video: **"The cat sat on the"** → next word **"mat"**.
`STORY` in core.js holds it: `STORY.tokens = ['The',' cat',' sat',' on',' the']`, `STORY.ids = [464,3797,3332,319,262]` (illustrative ids),
the illustrative next-word distribution `STORY.next` (mat 41 %, floor 19, couch 11, bed 8, sofa 7, roof 5, rug 4, other 5), `STORY.untrained` (an untrained model's flat guess, P(mat) = 1 %),
`STORY.afterwards = [' and',' purred','.']`.
Scene 0 teases it, 1 tokenizes it, 2 embeds it, 3 runs attention over it, 4 turns it into that distribution, draws "mat" and keeps writing, 5 shows an *untrained* model getting it wrong,
6 shows training pushing P(mat) up until it equals `STORY.next`, 7 uses a different prompt (boiling an egg), 8 uses a chat prompt, 9 echoes the sentence and the caret.
Token chip colours: `HUES[i]` by token index (cyan, violet, gold, mint, pink …). **Gold (`PAL.gold`) always means "the answer / the chosen next word".**
Coral (`PAL.coral`) means wrong / error / loss; mint (`PAL.mint`) means right / success; cyan–violet–blue is the network's light.
The probability-bar look (label left, glowing bar, percentage right) is shared by scenes 0, 4, 5, 6: keep it consistent with `s4_predict.js`.

## 4. PACING: this is the point of v2

1. **One page = one idea.** Each scene is a sequence of pages (the storyboard names them, with their time ranges). Within a page: **build (≤ 35 % of the page) → hold (≥ 45 %) → exit (≤ 20 %)**.
   During the *hold* everything the caption talks about is fully formed, legible, and nearly still (slow drift, glow pulses and parallax are fine; nothing important moves fast).
   The hold must last **≥ 2.5 s** on the main pages and **≥ 1.5 s** on the shortest ones. Never start the next page's build before the previous page's exit has finished.
2. **Captions are fixed.** The storyboard gives the exact bilingual wording and local times (≤ 15 English characters per second; they were checked). Do not change wording or times.
   The thing a caption names must appear within ~0.4 s after the caption appears, and be fully formed by ~40 % of the caption's duration, and stay for the rest of it.
3. **At most ~3 new things per second**, and never two big things at once. When something replaces something, the outgoing element is fully gone (or far away) before the incoming one is visible.
4. **Orient first.** A page begins by showing what we are looking at (a label, a recognizable object from the previous page), then adds the new idea.
5. **Make it explain itself.** Small labels in both languages (中文 first, English second, e.g. `向量 · vector`) name every new object the first time it appears. Numbers on screen must be consistent and meaningful.

## 5. Rules for scene files

1. **`draw(lt)` is a pure function of time.** The exporter renders any frame independently and 3 sub-frames per frame are accumulated for motion blur.
   No state kept between calls, no `Date`, no `performance.now`, no `Math.random()`, and do NOT use the shared `rnd` from core.js.
   Make constant tables ONCE at load time with your own seeded generator (`const R = mulberry(seed)`; keep the scene's existing seed).
   Static art may be pre-rendered at load time into offscreen canvases (`document.createElement('canvas')`) and drawn per frame: this is the way to keep heavy scenes fast.
2. Write plain top-level code in your file (it is wrapped for you). No `import`/`export`/`fetch`/images/audio files; everything is drawn.
3. Fonts available: `F_ZH` (Noto Serif SC, headings 700/900), `F_UI` (Inter + Noto Sans SC, for UI/chat/labels), `F_MONO` (JetBrains Mono, tokens/code/numbers),
   `F_EN` (Cinzel, small-caps titles), `F_IT` (Cormorant Garamond italic), `F_MATH` (STIX Two Text). **No emoji** (no colour-emoji font): draw icons with paths.
4. **Legibility.** Main labels ≥ 32 px, secondary labels ≥ 24 px, nothing below 20 px (the 60 s cut had tiny labels that nobody could read: fix that). Bright text on dark; use `glow` sparingly. Keep a clear 90 px margin.
   Safe content area: x 90…1830, y 150…880 (subtitles occupy y ≥ 905). In scenes with `ch`, keep x < 700, y < 140 free for ~5 s after the scene start (chapter label).
5. **Look.** Use `glDraw(mode, {...})` for the backdrop (0 nebula, 1 aurora, 2 grid floor — choose per scene, tint it to the scene's colour), `ctx.globalCompositeOperation = 'lighter'`
   for light, `glowDot`, thin bright lines, particles. The bloom pass makes bright things bloom: keep the average frame DARK with a few bright focal elements.
   Vary scale and depth, use slow camera moves via `cam`, never leave the frame dead static during a long hold (breathing glow, drifting particles, a slow push-in).
6. **Motion-blur ghosting.** Text or thin lines that move faster than ~400 px/s smear into ghosts ("wvoman"): slow them down, cross-fade instead of sliding, or lower the scene's `mb` (1 or 2).
7. **Land key events on the beat.** Beats fall at local times `k × 0.625 s`. Put the big moments (answer landing, chart snapping into place, layer lighting up) on or just before a beat so the picture locks with the music;
   pin `hit`/`riser` cues to those beat times.
8. **Performance.** `node ../export.mjs --bench` must stay ≲ 1.0 s per frame at the heaviest moment (one worker, software WebGL, 3 sub-frames; the machine can be busy so take the minimum of several runs).
   Use `mb: 2` or `mb: 1` for heavy or static scenes; avoid per-frame `ctx.filter`, huge shadowBlur on many elements, and thousands of gradients; cache static layers offscreen.
9. **Accuracy beats flash.** See §7. If a visual would teach something false, redraw it.
10. No text may overflow the screen or overlap other text. Check every still, including the first and last 0.3 s of the scene (fades) and the instants inside each page transition (0.1 s steps).

## 6. Sound cue vocabulary (the ONLY names allowed in `sfx`)

`sfx: [[t, 'name', {opts}], …]` with local time `t`. The music agent implements exactly these; the cue sheet is dumped with `node ../export.mjs --page … --cues cues.json`.
Place cues exactly on the visual event (a chip appearing, a bar landing). Keep scenes tasteful: roughly ≤ 60 cues per scene (dense `step`/`tick` runs excepted).

| name | what it sounds like / when to use | opts |
|------|-----------------------------------|------|
| `type`    | one soft keystroke | |
| `chip`    | a token / label snaps into place (short bright pluck-pop) | `midi` |
| `tick`    | tiny UI tick (counters, small steps) | `hi` (bool) |
| `pop`     | bubble pop (something appears) | |
| `blip`    | short synth data blip | `midi` |
| `ping`    | glassy attention-link ping | `midi` |
| `whoosh`  | air sweep for a transition / camera move | `dur`, `rev` (1 = reversed) |
| `swish`   | short fast swipe | `pitch` |
| `hit`     | impact (kick + boom + noise), pair with `hits` for flash/shake | `k` 0..1 |
| `boom`    | big low boom | |
| `thump`   | single heartbeat | |
| `riser`   | tension riser that peaks at `t + dur` | `dur` |
| `swell`   | pad swell | `dur` |
| `sparkle` | cloud of twinkles | `dur` |
| `shimmer` | bright shimmer hit | |
| `chime`   | bell chime | `midi` |
| `ding`    | short bell | `midi` |
| `down`    | wrong / error: low falling blip | |
| `up`      | right / success: rising two-note | |
| `step`    | very quiet training-step tick, may be dense (up to ~20 per second) | |
| `scan`    | scanner sweep | `dur` |
| `stamp`   | heavy UI stamp | |
| `glitch`  | digital glitch burst | |
| `count`   | counter roll: ticks that speed up | `dur` |

## 7. Accuracy guardrails (a fact-check agent will review every scene against these)

* A **token** is a piece of text (a word, part of a word, punctuation) from a fixed vocabulary, typically tens of thousands to a few hundred thousand entries. Each has an integer **ID**.
  Tokens are not always whole words ("unbelievable" → "un" "believ" "able" is a fair illustration).
* An **embedding** turns each token ID into a learned vector (a list of numbers; thousands of dimensions in real models — show a few and say "thousands" if you label it).
  Similar meanings end up near each other. "king − man + woman ≈ queen" is the classic approximate analogy (always draw it as ≈, never =).
* A **Transformer** uses **self-attention**: each token computes weights over the tokens it may look at and mixes their information (a weighted sum; weights are non-negative and sum to 1 per token).
  In a chat-style (decoder-only) LLM attention is **causal**: a token looks only at itself and EARLIER tokens, never at later ones. So attention arcs connect a later token back to earlier ones.
  Many layers (dozens) and many heads per layer are stacked; do not claim a specific number for a named model.
* The model's output is a **probability distribution over the whole vocabulary** (scores → softmax → probabilities that sum to 100 %). The next token is **sampled** from it (not always the most likely),
  which is why the same prompt can give different answers. The chosen token is appended and the process repeats: **autoregressive**, one token at a time.
  The model predicts *likely* text; it does not look up facts and has no built-in fact-check, so it can produce fluent, confident, wrong answers ("hallucination").
* **Pretraining**: predict the next token over trillions of tokens of text (web, books, code, papers…). Loss = −log P(correct token) (cross-entropy); example: P = 1 % → loss ≈ 4.6.
  A rough anchor if you show one: a few trillion words is on the order of **tens of thousands of years** of nonstop human reading (at ~250 words per minute); label it "roughly".
  Training adjusts the **parameters (weights)** — billions to trillions of numbers — using **backpropagation** (computes how each parameter affected the error, working backwards from the output)
  and **gradient descent** (nudges each a little in the direction that lowers the error). Thousands of GPUs for weeks to months. Loss decreases noisily, steeply at first.
  Say "e.g." if you show a specific parameter count; never name a company's model.
* **Post-training**: (a) supervised fine-tuning on human-written example answers; (b) learning from human preferences (RLHF): people compare answers, a reward signal is learned, the model is
  updated to produce preferred answers. Result: an assistant that follows instructions and is more helpful, honest and harmless. A raw pretrained model just continues text.
* Do NOT claim that the model "understands" or "thinks" as fact; the finale says prediction *starts to look like* understanding.
* Anything made up for the demo (a book title, a number) must be labelled as an example/illustration on screen.

## 8. Storyboard

Subtitles are `[a, b, zh, en]` in local seconds. Use EXACTLY these wordings and times. Visuals are art direction, not a straitjacket: be inventive, keep the story beats and the holds.
Every bullet with a time range is a PAGE or a beat inside a page.

### s0_hook — 0:00–0:10 (start 0, len 4) — `fi: .01`, `fo: .4`, no `ch`
* 0–0.5: black; a single gold caret blinks at screen centre (`caret`); `thump` at 0.
* 0.5–2.7: "The cat sat on the" is typed, large (≈ 100 px, F_UI or F_MONO, white, soft glow), one `type` cue per character (~0.12 s apart), caret follows; the nebula backdrop fades up slowly (deep blue).
* 2.8–3.8: candidate words unfurl as glowing horizontal probability bars (`STORY.next`, top 5 + a fan for "…"), "mat" the longest and gold. 3.8–4.3: "mat" is typed into the sentence in gold (`up`/`chime`).
  **Hold 4.3–5.2: the complete picture (sentence with gold mat + all bars + percentages) readable.**
* 5.0–6.25: the sentence and bars dissolve into particles that assemble into the gold title **大语言模型** (use the title glyph code in the existing file), a `riser` (`dur: 1.6`) ends exactly on the hit at **lt = 6.25 s** (bar 2, beat 2).
* 6.25: `hit` + `hits` flash, `flare` streak, the title snaps in; letterbox opens 6.2→7.1 (timeline). 6.7: **LARGE LANGUAGE MODELS** (F_EN, letter-spaced). 7.3: tagline **它如何工作 · 如何训练  /  HOW THEY WORK · HOW THEY LEARN**.
  **Hold the complete title ≥ 2.5 s (7.3–9.6)**, then fade (fo .4).
* Subs: `[0.5, 4.5, '大语言模型，本质上只做一件事——', 'A large language model does just one thing —']`, `[4.8, 9.7, '预测下一个词。', 'it predicts the next word.']`

### s1_tokens — 0:10–0:25 (start 4, len 6) — `ch: ['01','词元','TOKENS']`, `fo: 0`, backdrop: nebula tinted cyan/blue
* **Page A (0–8.5): chop and number.** 0–0.9 the sentence "The cat sat on the" appears as plain white text (the same size/position the hook typed it). 0.9–2.4 it slides apart into five **token chips** (`chip()` helper, colour `HUES[i]`), one `chip` cue each on beats. 2.4–4.6 **hold**: five chips, label "词元 · token".
  4.8–6.6 the **IDs** roll into place under each chip (464 · 3797 · 3332 · 319 · 262; label "编号 · ID"; F_MONO, ≥ 54 px). **Hold 6.6–8.5**: chips + IDs all readable.
* **Page B (8.5–15): the vocabulary and sub-words.** The chips move to a top row. 9.3–11 "unbelievable" appears and splits into "un · believ · able" chips with IDs 403 · 6481 · 540 (label "子词 · sub-word pieces"). A dim wall of thousands of tiny token labels rises behind (the vocabulary), with the label "词表 · vocabulary ≈ 100,000 tokens (e.g.)".
  **Hold 12–14.2.** From 14.2 the ID 3797 (cat) glows and grows to the hand-off pose (x 960, y 470, 210 px, cyan glow, small label "cat" below) exactly at the last frame (hard cut into scene 2).
* Subs: `[0.4, 4.6, '先把文字切成小块——词元（token）', 'Text is first chopped into small pieces called tokens']`, `[4.8, 8.9, '每一块都有自己的编号', 'and every piece gets its own number, its ID']`,
  `[9.3, 14.8, '词表是一份固定清单；生僻词会被拆成更小的片', 'The vocabulary is a fixed list; rare words are split into smaller pieces']`

### s2_vectors — 0:25–0:40 (start 10, len 6) — `ch: ['02','向量','VECTORS']`, `fi: .01`, backdrop: nebula or aurora tinted violet
* **Page A (0–6.6): an ID becomes a vector.** Open on the big **3797** exactly as scene 1 ended. 0.6–2.4 it fans out into a **vector**: a column of signed decimals (e.g. `[ 0.21, −0.64, 0.88, 0.05, −0.37, 0.52, … ]`, ending in "…", label "向量 · vector" and "数千维 · thousands of dimensions"). **Hold 3–6.2**: readable vector with the label; show that other tokens get their own vectors too (a second and third small column, "dog", "car", appear beside it).
* **Page B (6.6–15): meaning space.** The vectors collapse into glowing points in a slowly rotating 3D cloud of word-points (`proj`), with clusters labelled: animals (cat, dog, lion, tiger), places to sit (mat, rug, sofa, couch, bed, floor), royalty (king, queen, man, woman). Distance lines from "cat" to its nearest neighbours light up. **Hold 8.5–11** (cloud + labels readable, a slow rotation only).
  11.4–14.8 the analogy as arrows in the cloud: king − man + woman ≈ queen (a parallelogram), the equation under it, ending on a gold "queen" glow. **Hold the finished analogy ≥ 2 s** (12.6–14.8).
* Subs: `[0.4, 6.4, '编号本身没有意义——模型把每个编号变成一串数字，叫向量', 'An ID means nothing by itself, so each token becomes a vector: a long list of numbers']`,
  `[6.8, 11.2, '意思相近的词，向量也相近，在空间里靠得近', 'Similar meanings get similar vectors, so they sit close together']`,
  `[11.4, 14.8, '甚至能做“算术”：国王 − 男人 + 女人 ≈ 女王', 'Even arithmetic works: king − man + woman ≈ queen']`

### s3_attention — 0:40–1:00 (start 16, len 8) — `ch: ['03','注意力','ATTENTION']`, `fo: 0`, backdrop: aurora (blue → violet)
* **Page A (0–9.2): look back.** The five token chips in a row (same order and colours as scene 1) with small vector bars under them. 0.4–4.4: the idea of context: the last token " the" glows and a question mark/"?" hints it needs more information ("the … what?").
  4.7–7.4 **attention arcs** curve above the row from " the" back to " sat", " on", " cat" (causal!); `ping` cues. **Hold 7.4–9.2.**
* **Page B (9.2–14.4): weights.** The arcs get their weights on tags (0.07 / 0.19 / 0.38 / 0.31; tokens being attended to light up proportionally; thickness = weight; the weights are visibly a distribution that sums to 1). A "weighted mix" vector forms from the attended vectors (sum of weighted bars). **Hold 11.4–14.2.**
* **Page C (14.4–20): layers and heads.** The camera tilts/pulls back to reveal the row repeated as **a stack of translucent layers** in perspective (6–8 shown, label "× 几十层 · dozens of layers"), each layer with several differently coloured arc patterns (label "许多个“头” · many heads"). Data flows upward through the stack. **Hold the full stack 16.5–18.8** with its labels.
  A single bright context vector leaves the top-centre of the frame (about x 960, y 220) on the beat at local **19.375 s** (the last frame; hard cut into scene 4).
* Subs: `[0.4, 4.4, '光知道词义还不够，还得结合上下文', 'Knowing each word is not enough: it must be read in context']`, `[4.7, 9.0, 'Transformer 里，每个词都会回看前面的词', 'In a Transformer, each word looks back at the words before it']`,
  `[9.4, 14.2, '注意力决定谁更重要：权重越大，影响越大', 'Attention decides who matters: a bigger weight means more influence']`, `[14.6, 19.6, '几十层叠加，每层有许多个“头”，语境越来越丰富', 'Dozens of layers, each with many heads: the context grows richer']`

### s4_predict — 1:00–1:20 (start 24, len 8) — `ch: ['04','预测','PREDICTION']`, `fi: .01`, backdrop: nebula tinted violet/gold
* **Page A (0–8): scores to probabilities.** The context vector arrives at the top-centre (about x 960, y 220) and lands on a **field of dots = the vocabulary** (several thousand drawn, brighter and labelled for the top candidates: mat, floor, couch, bed, sofa, roof, rug, with raw scores such as 5.1, 4.4, 3.9 …).
  0.4–4.0 the field lights up by score ("给每个词打分"). 4.3–6 the field condenses into the sorted **probability bars** `STORY.next` (label "分数 → softmax → 概率", sum 100 %). **Hold 6–7.9** with all bars and numbers readable.
* **Page B (8–14): draw one at random.** A gold marker runs along the bars like a roulette and lands on **mat** (41 %) (`tick`s then `up`/`chime`); then two ghost branches show other draws that could have happened ("…on the floor", "…on the couch" with their %), with the label "每次抽样都可能不同 · each draw can differ". **Hold 11.5–14.**
* **Page C (14–20): append and repeat.** "mat" flies to the end of the sentence "The cat sat on the **mat**" (gold, then settles to white); a circular arrow shows the repeat; new chips append (`STORY.afterwards`: " and", " purred", ".") each with a mini bar-chart flicker; label "自回归 · autoregressive". **Hold the finished sentence 17.5–19.8.**
* Subs: `[0.4, 4.0, '最后，给词表里的每一个词打分', 'Finally, it scores every word in its vocabulary']`, `[4.3, 7.9, '分数换算成概率，总和是 100%', 'The scores become probabilities that add up to 100%']`,
  `[8.3, 14.0, '再按概率随机抽一个——所以每次的回答可能不同', 'Then it draws one at random by probability, so answers can differ each time']`, `[14.3, 19.7, '把它接在句末再来一遍——一次一个词，写出整段话', 'Append it and go again: one token at a time, until a whole reply is written']`

### s5_read — 1:20–1:35 (start 32, len 6) — `ch: ['05','预训练','PRETRAINING']`, backdrop: grid floor or nebula, darker/cooler, a sense of scale
* **Page A (0–7): the data.** A torrent of text streams past in depth (columns of snippets: English prose, Chinese, code, equations, dialogue; **clean, no overprinted lines**, only a few layers) with source tags (书籍 books, 网页 web, 代码 code, 论文 papers, 对话 conversations) and a big counter **已读词元 · TOKENS READ** racing up to "10,000,000,000,000+" (`count` cue, `whoosh`).
  **Hold 4.2–6.9** on the final counter, the source tags and the roughly-labelled anchor "≈ 一个人不眠不休读数万年 · roughly tens of thousands of years of nonstop human reading".
* **Page B (7–15): the exercise.** One example is pulled out of the stream: "The cat sat on the ▍" with the answer hidden as "?". The **untrained** model's guess appears as a flat, silly distribution (`STORY.untrained`: banana 4 %, quantum 4 %, seven 3 %, purple 3 %, mat 1 % …); **hold ≥ 1.5 s**.
  Then the true next word **mat** drops in (mint), P(mat) = 1 % is highlighted and a coral **损失 LOSS = −ln P(mat) = −ln 0.01 = 4.6** gauge fills (`down`). **Hold 12.6–14.8.**
* Subs: `[0.4, 3.7, '它是怎么学会的？先读——', 'How did it learn? First, by reading —']`, `[3.9, 6.9, '书籍、网页、代码……数万亿个词', 'books, web pages, code… trillions of words']`,
  `[7.3, 11.7, '练习很简单：遮住下一个词，让它去猜', 'The exercise is simple: hide the next word and let it guess']`, `[12.0, 14.8, '猜得越离谱，“损失”越大', 'The further off, the bigger the loss']`

### s6_learn — 1:35–1:55 (start 38, len 8) — `ch: ['06','学习','LEARNING']`, backdrop: aurora or nebula, energetic, warm-cool contrast
* **Page A (0–6.5): parameters are knobs.** The big layered network (clear left-to-right layers) fades up; a zoom into a few nodes shows their connections as small **dials/knobs** with values; counter "参数 · PARAMETERS ≈ 70,000,000,000 (e.g.)". **Hold 3.5–6.3.**
* **Page B (6.5–13.75): one training step.** The same network, a four-beat loop with labels: ① forward: a glowing pulse runs left → right and the output reads the untrained guess; ② compare: the true answer "mat" and the loss; ③ backward: coral/cyan pulses flow right → left ("反向传播 · backpropagation: 每个旋钮该往哪边拧");
  ④ nudge: knobs turn a tiny bit (+0.003 / −0.007 …) ("梯度下降 · gradient descent"). Each step ≥ 1.2 s, the loop shown at least once slowly and once faster. **Hold on ④ ≥ 1.5 s.**
* **Page C (13.75–20): repeat billions of times.** The full dashboard as in the 60 s cut: network (left), next-word bars for "The cat sat on the ___" evolving from `STORY.untrained` to `STORY.next` (mat 1 % → 41 %), a **loss curve** (noisy, ≈ 4.6 → ≈ 1.3) with a STEP counter to 1,000,000 (`step` cues, quiet and dense), a corner badge "数千块 GPU · 数周到数月 · thousands of GPUs, weeks to months".
  Build energy toward the end (`riser` over the last bar). **Hold the end state 18.2–19.8.**
* Subs: `[0.4, 6.4, '模型里有数十亿个可调的数字，叫参数——像一块块旋钮', 'Inside are billions of adjustable numbers called parameters: think of them as knobs']`,
  `[6.9, 13.5, '每猜错一次，就算出每个旋钮该往哪边拧，再各拧一点点', 'After each wrong guess it works out which way to turn every knob, then turns each a tiny bit']`,
  `[14.0, 19.7, '重复亿万次：错误一路下降，正确答案越来越可能', 'Repeat billions of times: the error falls and the right answer grows likelier']`

### s7_teach — 1:55–2:20 (start 46, len 10) — `ch: ['07','微调','FINE-TUNING']`, backdrop: nebula tinted warm teal / gold, calmer, human feeling
* **Page A (0–6.7): the raw model only continues.** A glass chat panel with the prompt "How do I boil an egg?" The **pretrained** model (tag "预训练模型 · pretrained") just continues the text with more questions ("How do I peel a boiled egg? How long do I boil an egg for? How do I make egg salad? …"), typed at a readable pace. **Hold the whole ramble 3.5–6.5 (≥ 3 s, text ≥ 32 px).**
* **Page B (6.7–13.9): human examples.** The ramble clears completely. Small document cards written by a person (draw a person/hands with paths) feed into the model ("人类写的范例 · human-written examples"); the model's reply becomes a clean 3-step answer
  (1 Put eggs in a pot, cover with water. 2 Boil 9–12 minutes. 3 Cool in cold water.) with the tag "微调后 · fine-tuned" (`swish`, `chime`). **Hold the finished answer 10.5–13.7.**
* **Page C (13.9–21.1): human preference.** Two candidate answers A and B side by side (A is poor, B is good); an abstract person/hand icon picks B (mint ✓), A gets a coral ✗; a **reward** bar rises; a stream of many small A/B pairs passes in the background; an arrow loops back into the model ("更新 · update"). Do this slowly and clearly once, then show it repeating. **Hold 18–21.**
* **Page D (21.1–25): the result.** Everything clears except the model; three glowing chips appear one by one: **有用 helpful · 诚实 honest · 无害 harmless** (`ding`s). **All three together ≥ 1.8 s.**
* Subs: `[0.4, 6.6, '但刚练完的模型只会“续写”，还不懂怎样回答问题', 'But a freshly pretrained model only continues text; it has not learned how to answer']`,
  `[6.9, 13.7, '于是人类写下大量范例：一个好回答该是什么样', 'So people write many examples of what a good answer looks like, and the model learns from them']`,
  `[14.0, 21.0, '再让人比较它的几个回答：更受欢迎的得高分，模型朝高分调整', 'Then people compare its answers: preferred ones score higher, and the model is tuned toward them']`,
  `[21.3, 24.8, '于是它更有用、更诚实、更无害', 'and it becomes more helpful, honest and harmless']`

### s8_chat — 2:20–2:35 (start 56, len 6) — NEW — `ch: ['08','对话','CHAT']`, backdrop: aurora → nebula, calm
* **Page A (0–8.2): the loop in use.** A sleek glass **chat window** (reuse the chat UI from the old `s9_finale.js` in `snapshot2/`). 0.4–3.4: the user types "What is a large language model?" and sends. 3.6–8.2: the answer **streams in token by token**
  ("A large language model predicts the next token, one at a time, after learning from trillions of words."; ≤ 2 lines, each token a soft slide/fade-in, `type`/`chip` cues, caret). A slim **next-token strip** under the answer flickers its top-3 candidates for each new token (the loop from scene 4). **Hold the finished answer ≥ 1.5 s (6.4–8.2).**
* **Page B (8.2–15): it can be wrong.** A new chat: user "Who wrote the novel *The Glass Orchard of Mars*?" (a made-up title; tag "示例：这本书并不存在 · example: this book does not exist"). The model answers instantly and fluently: "It was written by Elena Marchetti and published in 1974." (made up),
  with a calm confident look, then a coral dashed outline, a "?" badge and a chip "听起来很对 ≠ 一定是对的 · sounds right ≠ is right" fade in. **Hold the wrong answer + warning ≥ 2.5 s (11.5–14.8).**
* Subs: `[0.4, 3.4, '现在，你输入一句话', 'Now you type a sentence']`, `[3.6, 8.2, '它一个词一个词地接下去，直到写完整段回答', 'and it continues one token at a time until the reply is complete']`,
  `[8.5, 14.8, '但它预测的是“最可能的话”，并不查证事实——所以会一本正经地出错', 'But it predicts likely text and does not check facts, so it can be confidently wrong']`

### s9_finale — 2:35–2:50 (start 62, len 6) — no `ch`, `fo: .8`, ends fully black by local 14.9; backdrop: aurora → nebula, awe
* **Page A (0–8.5): the whole pipeline.** The pipeline lights up as a horizontal chain of glass icons — **文字 Text → 词元 Tokens → 向量 Vectors → 注意力 Attention → 预测 Prediction** (each icon a tiny version of the scene's key visual, drawn; you may reuse the old chain code) — one icon lighting per ~0.7 s while the first caption plays (0.4–4.2), then the row underneath **预训练 Pretraining → 微调 Fine-tuning** lights during the second caption (4.5–8.8).
  A signal pulses along the chain once. **Hold the complete chain ≥ 2 s (6.5–8.5)**; it must not be covered by anything.
* **Page B (8.5–15): closing.** The chain collapses into a single blinking gold caret (echo of scene 0, 9–9.8; the letterbox closes 9.8→11.4 per timeline), the gold title **大语言模型 / LARGE LANGUAGE MODELS** returns at **local 10.0 s** (beat 16) with a `hit`, held ≥ 3.4 s (10.6–14.0), then fades to black by 14.9. The last ~0.2 s are black.
* Subs: `[0.4, 4.2, '文字 → 词元 → 向量 → 注意力 → 预测', 'text → tokens → vectors → attention → a prediction']`, `[4.5, 8.8, '先大量预训练，再靠人类反馈调教', 'first pretrained on vast text, then taught by human feedback']`,
  `[9.2, 14.2, '规模足够大时，“预测”开始像“理解”', 'At enough scale, prediction starts to look like understanding']`

## 9. Quality bar

Imagine this is shown on a big screen to people who have never seen how an LLM works, and they must be able to follow every page *without pausing*. After 2:50 they should be able to say:
"text → tokens → numbers (vectors) → attention over earlier words → probabilities → draw a word → repeat; it learned by guessing the next word trillions of times and being nudged a tiny bit each time;
then people taught it to answer helpfully; but it predicts likely text, so it can still be wrong." It must look **beautiful**: confident composition, restrained palette, soft light, crisp type, real depth, graceful motion, zero clutter.

Before you finish, render stills at: the first 0.3 s, the middle of each page's build, the middle of each page's hold, the end of each exit, the last 0.3 s, and 0.1 s steps through every page transition. View them ALL, and fix what is wrong:
overlaps, off-screen/cropped text, tiny text, muddy/low-contrast elements, empty-looking frames, harsh/clipped bloom, elements that appear without easing, holds that are too short, anything inaccurate per §7, anything not matching the storyboard wording or times.
