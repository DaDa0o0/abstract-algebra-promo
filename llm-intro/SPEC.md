# 大语言模型 · 一分钟看懂 — production spec

A **60-second** explainer, "How a large language model works and how it is trained", in the same style as
`../promo.html` (the abstract-algebra promo in this repo): dark cinematic space, glowing particles and type,
bloom + film grain, bilingual (中文 / English) subtitles, chapter labels, and a synthesized score locked to a bar grid.
No voice-over (there is no TTS here): captions + music + sound design carry it, exactly like the original.

Output: 1920×1080, 30 fps, 1800 frames, H.264 + AAC. Every frame is drawn by JavaScript on a Canvas 2D context
(plus a WebGL backdrop and bloom pass) and exported frame by frame with `../export.mjs`.

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
python3 llm-intro/preview.py --scenes s3_attention --times 15.2,17,19.5,22 --out /home/da/.claude/jobs/948446f1/tmp/work/s3
python3 llm-intro/preview.py --scenes s3_attention --bench 15,22.5 --out /home/da/.claude/jobs/948446f1/tmp/work/s3      # ms per frame
```

Then **look at the JPGs with the Read tool** (it shows images). Iterate until it looks like a finished film frame.
Use your own `--out` directory under `/home/da/.claude/jobs/948446f1/tmp/work/` so parallel authors never clobber each other.
Never edit `core.js`, `timeline.js`, `build.py`, `export.mjs`, or another scene's file. If you need a helper, write it inside your scene file.

## 2. Timeline (BPM 96 → 1 beat = 0.625 s, 1 bar = 2.5 s, 24 bars = 60 s)

| file                | start bar | len | global time   | topic |
|---------------------|-----------|-----|---------------|-------|
| `s0_hook.js`        | 0         | 2   | 0:00 – 0:05   | hook: it predicts the next word → title |
| `s1_tokens.js`      | 2         | 2   | 0:05 – 0:10   | text → tokens → ID numbers |
| `s2_vectors.js`     | 4         | 2   | 0:10 – 0:15   | IDs → vectors (embeddings) in a meaning space |
| `s3_attention.js`   | 6         | 3   | 0:15 – 0:22.5 | Transformer: attention, stacked layers |
| `s4_predict.js`     | 9         | 2   | 0:22.5 – 0:27.5 | scores → probabilities → sample → append → repeat |
| `s5_read.js`        | 11        | 3   | 0:27.5 – 0:35 | pretraining I: the data + the "guess the next word" exercise + loss |
| `s6_learn.js`       | 14        | 3   | 0:35 – 0:42.5 | pretraining II: nudging billions of parameters, loss falls |
| `s7_teach.js`       | 17        | 3   | 0:42.5 – 0:50 | post-training: human examples + human preference feedback |
| `s8_finale.js`      | 20        | 4   | 0:50 – 1:00   | chat demo, the whole pipeline, "prediction looks like understanding", end title |

`scene({ start, len })` are in **bars**; `draw(lt, d, T)` gets **local seconds** `lt` (0..len×2.5), `d` = duration, `T` = global time.
Subtitles and sfx times inside a scene are local seconds. Scenes tile the 24 bars exactly.

Letterbox (timeline.js): black cinema bars (138 px top and bottom) are CLOSED from 0 s to 3.1 s, open by 4.0 s, and close again from 53.8 s to 55.6 s.
So in scene 0 (before 3.1 s) and scene 8 (after 53.8 s) the picture lives in the band y = 138…942 and the subtitles sit on the black bar.

## 3. The story thread (keep it consistent!)

One sentence travels through the whole video: **"The cat sat on the"** → next word **"mat"**.
`STORY` in core.js holds it: `STORY.tokens = ['The',' cat',' sat',' on',' the']`, `STORY.ids = [464,3797,3332,319,262]` (illustrative ids),
and the illustrative next-word distribution `STORY.next`: mat 41 %, floor 19, couch 11, bed 8, sofa 7, roof 5, rug 4, other 5.
Scene 0 teases it, 1 tokenizes it, 2 embeds it, 3 runs attention over it, 4 turns it into that distribution and samples "mat",
5 shows an *untrained* model getting it wrong, 6 shows training pushing P(mat) up until it equals `STORY.next`, 8 echoes it.
Token chip colours: `HUES[i]` by token index (cyan, violet, gold, mint, pink …). **Gold (`PAL.gold`) always means "the answer / the chosen next word".**
Coral (`PAL.coral`) means wrong / error / loss; mint (`PAL.mint`) means right / success; cyan–violet–blue is the network's light.

## 4. Rules for scene files

1. **`draw(lt)` is a pure function of time.** The exporter renders any frame independently and 3 sub-frames per frame are accumulated for motion blur.
   No state kept between calls, no `Date`, no `performance.now`, no `Math.random()`, and do NOT use the shared `rnd` from core.js.
   Make constant tables ONCE at load time with your own seeded generator: `const R = mulberry(20260004);` (pick a seed unique to your scene).
2. Write plain top-level code in your file (it is wrapped for you). Name things freely. Do not use `import`/`export`/`fetch`/images/audio files; everything is drawn.
3. Fonts available: `F_ZH` (Noto Serif SC, headings 700/900), `F_UI` (Inter + Noto Sans SC, for UI/chat/labels), `F_MONO` (JetBrains Mono, tokens/code/numbers),
   `F_EN` (Cinzel, small-caps titles), `F_IT` (Cormorant Garamond italic), `F_MATH` (STIX Two Text). **No emoji** (no colour-emoji font): draw icons with paths.
4. **Legibility.** Main labels ≥ 30 px, secondary labels ≥ 22 px, nothing below 18 px. Bright text on dark; use `glow` sparingly. Keep a clear 90 px margin.
   Safe content area: x 90…1830, y 150…880 (subtitles occupy y ≥ 905). In scenes with `ch`, keep x < 700, y < 140 free for ~4 s after the scene start (chapter label).
5. **One idea per moment.** A viewer has ~2–3 s to read a caption and see the picture. Build things on screen in time with the caption: when the caption says
   "tokens" the tokens appear. Animate with easing (`eio`, `eout`, `eexpo`, `eback`, `win`, `sstep`); nothing should pop in without motion.
6. **Look.** Use `glDraw(mode, {...})` for the backdrop (0 nebula, 1 aurora, 2 grid floor — choose per scene, tint it to the scene's colour), `ctx.globalCompositeOperation = 'lighter'`
   for light, `glowDot`, thin bright lines, particles. The bloom pass makes bright things bloom: keep the average frame DARK with a few bright focal elements.
   Vary scale and depth (parallax, slow camera moves via `cam`), never leave the frame static.
7. **Transitions.** Default is a 0.25 s dip to black at each end. For a hard cut set `fi: .01` / `fo: 0` and make sure the first/last frame of adjacent scenes match
   (e.g. the same element at the same place) — then add a `whoosh` cue. The previous and next scenes are written by other people at the same time: agree through this spec only.
   Scene 0 must start from black (`fi: .01` is fine because it starts on a black frame); scene 8 ends fully black.
8. **Performance.** `node ../export.mjs --bench` must stay ≲ 1.2 s per frame at the heaviest moment (one worker, software WebGL, 3 sub-frames). Use `mb: 2` or `mb: 1` for heavy or very static scenes.
   Avoid per-frame `ctx.filter`, huge shadowBlur on thousands of elements, and thousands of gradients; batch particles as `fillRect` or one path.
9. **Land key events on the beat.** The score is at 96 BPM: beats fall at local times `k × 0.625 s` (a bar = 2.5 s). Put the big moments (title reveal, the answer landing, a chart snapping into place, a layer lighting up)
   on or just before a beat so the picture and the music lock together; in-between details may float freely. Pin `hit`/`riser` cues to those beat times.
10. **Accuracy beats flash.** See §6. If a visual would teach something false, redraw it.
11. No text may overflow the screen or overlap other text. Check every still.

## 5. Sound cue vocabulary (the ONLY names allowed in `sfx`)

`sfx: [[t, 'name', {opts}], …]` with local time `t`. The music agent implements exactly these; the cue sheet is dumped with `node ../export.mjs --page … --cues cues.json`.
Place cues exactly on the visual event (a chip appearing, a bar landing). Keep scenes tasteful: roughly ≤ 40 cues per scene (dense `step`/`tick` runs excepted).

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

## 6. Accuracy guardrails (a fact-check agent will review every scene against these)

* A **token** is a piece of text (a word, part of a word, punctuation) from a fixed vocabulary, typically tens of thousands to a few hundred thousand entries. Each has an integer **ID**.
  Tokens are not always whole words ("unbelievable" → "un" "believ" "able" is a fair illustration).
* An **embedding** turns each token ID into a learned vector (a list of numbers; thousands of dimensions in real models — show a few and say "thousands" if you label it).
  Similar meanings end up near each other. "king − man + woman ≈ queen" is the classic approximate analogy (always draw it as ≈, never =).
* A **Transformer** uses **self-attention**: each token computes weights over the tokens it may look at and mixes their information. In a chat-style (decoder-only) LLM attention is
  **causal**: a token looks only at itself and EARLIER tokens, never at later ones. So attention arcs must connect a later token to earlier ones (draw them from the later token back).
  Many layers (dozens) and many heads per layer are stacked; do not claim a specific number for a named model.
* The model's output is a **probability distribution over the whole vocabulary** (softmax over scores). The next token is **sampled** from it (not always the most likely).
  The chosen token is appended and the process repeats: **autoregressive**, one token at a time. The model predicts *likely* text; it does not look up facts.
* **Pretraining**: predict the next token over trillions of tokens of text (web, books, code, papers…). Loss = −log P(correct token) (cross-entropy); example: P = 1 % → loss ≈ 4.6.
  Training adjusts the **parameters (weights)** — billions to trillions of numbers — using **backpropagation** (computes how each parameter affected the error) and **gradient descent** (nudges each a little).
  It takes thousands of GPUs for weeks to months. Loss decreases noisily, steeply at first. Say "e.g." if you show a specific parameter count; never name a company's model.
* **Post-training**: (a) supervised fine-tuning on human-written example answers; (b) learning from human preferences (RLHF): people compare answers, a reward signal is learned, the model is
  updated to produce preferred answers. Result: an assistant that follows instructions, is more helpful, honest and harmless. A raw pretrained model just continues text.
* Do NOT claim that the model "understands" or "thinks" as fact; the finale says prediction *starts to look like* understanding, and that it can still be wrong.

## 7. Storyboard

Subtitles are `[a, b, zh, en]` in local seconds. Use EXACTLY these wordings (they were budgeted for reading time). Visuals are art direction, not a straitjacket: be inventive, keep the story beats.

### s0_hook — 0:00–0:05 (start 0, len 2) — `fi: .01`, `fo: 0` (hard cut into scene 1), no `ch`
* 0–0.5: black. A single gold caret blinks at screen centre (`caret`). `thump` at 0.
* 0.5–2.2: "The cat sat on the" is typed, large (≈ 100 px, F_UI or F_MONO, white with a soft glow), one `type` cue per character (~0.095 s apart), caret follows. Backdrop fades up slowly (nebula, deep blue).
* 2.2–3.1: candidate words unfurl as glowing horizontal probability bars (`STORY.next`, top 5 + "…") beside/below the sentence; "mat" is the longest and glows gold; then "mat" is typed into the sentence in gold (`up`/`chime`).
* 3.1–5.0 (the letterbox opens 3.1→4.0): the sentence and bars dissolve into particles that assemble into the gold title **大语言模型** (use `titleWord`, size ≈ 200) with
  **LARGE LANGUAGE MODELS** (F_EN, letter-spaced) and a smaller tagline **它如何工作 · 如何训练  /  HOW THEY WORK · HOW THEY LEARN** beneath. Add a `flare` streak across the title and a `hits` + `hit` at the title reveal exactly at **lt = 3.125 s** (bar 1, beat 2). A `riser` (`dur: 1.6`) leads into 3.125 s; start assembling the particles about 1.2 s before it so the title snaps in on the hit.
  Hold the finished title for ≥ 1.4 s so it can be read.
* Subs: `[0.5, 2.5, '大语言模型，本质上只做一件事——', 'A large language model does just one thing —']`, `[2.6, 4.9, '预测下一个词。', 'it predicts the next word.']`

### s1_tokens — 0:05–0:10 (start 2, len 2) — `ch: ['01','词元','TOKENS']`, backdrop: nebula tinted cyan/blue
* Picture: the sentence appears as ordinary text, then slides apart into five **token chips** (colour `HUES[i]`, `chip()` helper), each popping with a `chip` cue. Under each chip a thin line drops to its **ID** (F_MONO, big), numbers rolling/typing into place:
  464 · 3797 · 3332 · 319 · 262. Small labels "token" and "ID". A faint wall of thousands of tiny token labels or dots in the background hints at the vocabulary ("词表 · vocabulary ≈ 100,000 tokens", small).
* 2nd beat (≈ 7.6–9.9 s): a rarer word "unbelievable" splits into "un · believ · able" chips (sub-word pieces) with their IDs, to show tokens are not always words. Hand over to scene 2 by making the "cat" ID (3797) glow near the end.
* Subs: `[0.3, 2.4, '先把文字切成小块——词元（token）', 'Text is chopped into small pieces called tokens']`, `[2.5, 4.9, '每一块都对应一个数字编号', 'each piece is mapped to a number']`

### s2_vectors — 0:10–0:15 (start 4, len 2) — `ch: ['02','向量','VECTORS']`, backdrop: nebula or aurora tinted violet
* Picture: the ID 3797 fans out into a **vector**: a column or row of signed decimals (e.g. `[ 0.21, −0.64, 0.88, 0.05, −0.37, … ]`, ending in "…", labelled "thousands of dimensions / 数千维"), which then **becomes a glowing point** in a slowly rotating 3D cloud of word-points (use `proj`).
  Clusters with labels: animals (cat, dog, lion, tiger), places to sit (mat, rug, sofa, couch, bed, floor), royalty (king, queen, man, woman). Distance lines from "cat" to its nearest neighbours light up.
  Finish with the analogy as arrows in the cloud: king − man + woman ≈ queen (a parallelogram), ending on a gold "queen" glow. Everything gently parallax-rotates.
* Subs: `[0.3, 2.4, '再把编号变成一串数字——向量', 'Each number becomes a vector — a list of numbers']`, `[2.5, 4.9, '意思相近的词，在空间里也靠得近', 'words with similar meanings sit close together']`

### s3_attention — 0:15–0:22.5 (start 6, len 3) — `ch: ['03','注意力','ATTENTION']`, backdrop: aurora (blue → violet)
* Picture: the five token chips in a row (their vectors as small glowing bars underneath). **Attention arcs** curve above the row from later tokens back to earlier ones (causal!), thickness/brightness = weight.
  Focus on the last token " the": three bright arcs to " sat", " on" and " cat" (weights e.g. 0.38 / 0.31 / 0.19, others thin) with the numbers on the arcs; the tokens being attended to light up. `ping` cue per arc, rising pitch.
* 2nd beat (≈ from 4 s): the camera tilts/pulls back to reveal the same row repeated as **a stack of translucent layers** in perspective (6–8 shown, label "× dozens of layers / 几十层"), each with a different arc pattern (different "heads" in different hues); glowing data flows upward through the stack
  and a single bright vector emerges from the top (the hand-off to scene 4: it should leave at the same screen position where scene 4 starts, centre-top).
* Subs: `[0.3, 3.1, '核心是 Transformer：每个词都会回看前面的词', 'At its core, a Transformer: every word looks back at the words before it']`, `[3.3, 7.2, '注意力决定谁更重要；几十层叠起来，语境越来越丰富', 'Attention decides what matters — stack dozens of layers and the context gets richer']`

### s4_predict — 0:22.5–0:27.5 (start 9, len 2) — `ch: ['04','预测','PREDICTION']`, backdrop: nebula tinted violet/gold
* Picture: the vector from scene 3 lands on a field of **tiny dots = the whole vocabulary** (tens of thousands, a few thousand drawn) that light up in proportion to their score; the field condenses into the sorted **probability bars** `STORY.next` (labels + %). A gold marker/"ball" runs along the bars like a roulette and lands on **mat** (41 %) (`tick`s then `up`/`chime`).
  Then the loop: "mat" flies to the end of the sentence "The cat sat on the **mat**" (gold, then settles to white), a circular arrow shows the repeat, and new chips quickly append (`STORY.afterwards`: " and", " purred", ".") each with a mini bar-chart flicker. The sentence grows on screen.
* Subs: `[0.3, 2.6, '给词表里的每个词打分，再按概率抽出一个', 'Score every word in the vocabulary, then draw one by probability']`, `[2.7, 4.9, '接在句末，再来一遍——一次一个词', 'Append it and repeat — one token at a time']`

### s5_read — 0:27.5–0:35 (start 11, len 3) — `ch: ['05','预训练','PRETRAINING']`, backdrop: grid floor or nebula, darker/cooler, a sense of scale
* 0–3.6 s: an enormous **torrent of text** streams past in depth (columns of snippets: English prose, Chinese, code, equations, dialogue) with source tags (books 书籍, web 网页, code 代码, papers 论文, conversations 对话) and a big counter **TOKENS READ** racing up to "10,000,000,000,000+" (`count` cue, `whoosh`). Scale and speed, but readable at the key moment.
* 3.6–7.5 s: one example is pulled out of the stream: "The cat sat on the ▍" with the answer hidden as "?". The **untrained** model's guess appears as a flat, silly distribution (e.g. "banana 4 %", "quantum 4 %", "seven 3 %", "mat 1 % …"), then the true next word **mat** drops in (mint), the model's P(mat) = 1 % is highlighted and a coral **LOSS = −log P(mat) = 4.6** gauge flashes (`down`).
* Subs: `[0.3, 3.7, '它先“阅读”：书籍、网页、代码……数万亿个词', 'First it reads: books, web pages, code… trillions of words']`, `[3.9, 7.3, '练习很简单：遮住下一个词，让它去猜', 'The exercise is simple: hide the next word and let it guess']`

### s6_learn — 0:35–0:42.5 (start 14, len 3) — `ch: ['06','学习','LEARNING']`, backdrop: aurora or nebula, energetic, warm-cool contrast
* Composition (three linked elements, always legible): **left** a huge glowing neural network / matrix of **parameters** (thousands of nodes + links; counter "PARAMETERS ≈ 70,000,000,000 (e.g.)") where small ± nudges ripple through (cyan = up, coral = down); **top right** the next-word bars for "The cat sat on the ___" evolving from the flat guesses of scene 5 into `STORY.next` (mat rises 1 % → 41 %); **bottom right** a **loss curve** drawn left to right (noisy, steep at first, then flattening, ≈ 4.6 → ≈ 1.3) with a "STEP" counter running to 1,000,000 (`step` cues, dense and quiet).
* A small caption "backpropagation → gradient descent" near the network. A grid of tiny squares "GPU ×thousands · weeks to months" pulses in a corner. Build energy toward 42.5 s (`riser`, rising `step` rate).
* Subs: `[0.3, 4.3, '猜错了，就微调数十亿个参数，让正确答案的概率高一点点', 'When it guesses wrong, nudge billions of parameters so the right answer gets a little more likely']`, `[4.5, 7.3, '重复亿万次，错误一路下降', 'Repeat it billions of times — the error keeps falling']`

### s7_teach — 0:42.5–0:50 (start 17, len 3) — `ch: ['07','微调','FINE-TUNING']`, backdrop: nebula tinted warm teal / gold, calmer, human feeling
* 0–3.6 s: a prompt "How do I boil an egg?" in a glass chat panel. The **pretrained** model only continues text: it rambles on with more questions ("How do I peel a boiled egg? How long do I boil…") in a dim panel, marked "pretrained / 预训练模型". Then the **fine-tuned** answer replaces it: a clean 3-step reply (1 Put eggs in a pot, cover with water. 2 Boil 9–12 min. 3 Cool in cold water.), marked "fine-tuned / 微调后" (`swish`, `chime`). Human-written examples are drawn as small document cards feeding in.
* 3.6–7.5 s: **feedback**: two candidate answers A and B side by side; an abstract person/hand icon (drawn with paths) picks B (mint ✓), A gets a coral ✗; a **reward** bar rises; many small A/B pairs stream by quickly in the background; an arrow loops back into the model ("update"). End on three glowing chips **helpful 有用 · honest 诚实 · harmless 无害** (`ding`s).
* Subs: `[0.3, 3.7, '预训练只会“续写”。再用人类的示范和反馈来调教', 'Pretraining only continues text. Human examples and feedback then teach it to help']`, `[3.9, 7.3, '人们更喜欢的回答得高分，它就学会了更有用、更诚实', 'Answers people prefer score higher — so it learns to be more helpful and honest']`

### s8_finale — 0:50–1:00 (start 20, len 4) — no `ch`, `fo: .6` and ends fully black, backdrop: aurora → nebula, awe
* 0–3.6 s: a sleek glass **chat window** (`glass`) opens. The user line: "What is a large language model?" The answer **streams in token by token** (each token a soft fade/slide-in, `type`/`chip` cues, caret), e.g. "A language model predicts the next token, one at a time, after learning from trillions of words." (keep ≤ 2 lines).
* 3.6–7.2 s: the camera pulls back: the whole pipeline lights up as a horizontal chain of glass icons — **文字 Text → 词元 Tokens → 向量 Vectors → 注意力 Attention → 预测 Prediction**, with **预训练 Pretraining → 微调 Fine-tuning** underneath — each icon is a tiny version of the scene's key visual (draw them; you may call `SC.find(s => s.id === 'tokens')?.draw(…)` inside a clipped, scaled, dimmed region if you like, guarding for it being absent). The chain pulses once, left to right, like a signal. The letterbox closes around 53.8–55.6 s.
* 7.2–10 s: everything collapses to a single blinking gold caret (echo of scene 0), the gold title **大语言模型 / LARGE LANGUAGE MODELS** returns briefly (≈ 7.8–9.4 s) and the frame fades to black by 59.9 s. Leave the last ~0.4 s black.
* Subs: `[0.3, 2.4, '于是，你输入一句话', 'So you type a sentence']`, `[2.6, 4.7, '它一个词一个词地接下去——', 'and it continues, one word at a time —']`, `[4.9, 9.0, '规模足够大时，“预测”开始像“理解”——但它仍会出错', 'at enough scale, prediction starts to look like understanding — though it can still be wrong']`

## 8. Quality bar

Imagine this is shown on a big screen to people who have never seen how an LLM works. After 60 s they should be able to say: "text → tokens → numbers → attention → probabilities → pick a word → repeat;
it learned by guessing the next word trillions of times and being nudged; then people taught it manners." It must look **beautiful**: confident composition, restrained palette, soft light, crisp type, real depth, graceful motion, zero clutter.
Compare against `../shots/` frames of the original promo if you want a reference for the finish (render with `node ../export.mjs --shots 21,60 --shotdir <dir>`).

Before you finish, render stills at: the first 0.3 s, ~25 % , ~50 %, ~75 %, the last 0.3 s of your scene, and every key beat, view them all, and fix what is wrong:
overlaps, off-screen/cropped text, tiny text, muddy/low-contrast elements, empty-looking frames, harsh/clipped bloom, elements that appear without easing, anything inaccurate per §6, anything not matching the storyboard wording.
