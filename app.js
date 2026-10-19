/* ═══════════ 灵犀 · AI 工具集 · 逻辑层 ═══════════ */
"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ── 页签切换 ── */
$("#menu").addEventListener("click", (e) => {
  const btn = e.target.closest(".item");
  if (!btn) return;
  $$(".item").forEach((x) => x.classList.remove("active"));
  btn.classList.add("active");
  $$(".tool").forEach((t) => (t.hidden = t.id !== btn.dataset.t));
  const cur = $("#" + btn.dataset.t);
  cur.hidden = false;
  cur.style.animation = "none";
  void cur.offsetWidth; // 重触发动画
  cur.style.animation = "";
});

/* ═════════ ① 智能摘要（TextRank 简化版） ═════════ */
const STOP = new Set("的了着是在和与及对对于把被就也都很还又再一个一些一种这样那样什么怎么如何因此但是然而所以因为如果虽然不过于是然后此外其中之一以上以下我们你们他们它这那有没无为更最都很般被说说道知道觉得".split(""));

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？!?；;\n])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
}

function tokenSet(sen) {
  // 中文按 2 字滑窗 + 英文单词
  const set = new Set();
  const en = sen.match(/[a-zA-Z][a-zA-Z\-']{2,}/g) || [];
  en.forEach((w) => set.add(w.toLowerCase()));
  for (let i = 0; i < sen.length - 1; i++) {
    const bi = sen.slice(i, i + 2);
    if (!/[，。！？、；：""''\s]/.test(bi)) set.add(bi);
  }
  return set;
}

function summarize(text, ratio) {
  const sens = splitSentences(text);
  if (sens.length <= 2) return { sens, picked: sens, total: sens.length };

  const sets = sens.map(tokenSet);
  const N = sens.length;
  // 句间相似度矩阵（词汇重叠 / 归一化）
  const sim = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      let inter = 0;
      sets[i].forEach((w) => { if (sets[j].has(w)) inter++; });
      const s = inter / (Math.log(sets[i].size + 1) + Math.log(sets[j].size + 1) + 1);
      sim[i][j] = sim[j][i] = s;
    }
  }
  // 幂迭代求权重
  let w = new Array(N).fill(1 / N);
  const d = 0.85;
  for (let it = 0; it < 30; it++) {
    const nw = new Array(N).fill((1 - d) / N);
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let j = 0; j < N; j++) if (j !== i) sum += sim[i][j] * w[j];
      nw[i] = (1 - d) / N + d * (sum || 0);
    }
    const tot = nw.reduce((a, b) => a + b, 0) || 1;
    w = nw.map((x) => x / tot);
  }
  const ranked = sens.map((s, i) => ({ s, w: w[i], i }))
    .sort((a, b) => b.w - a.w);
  const keep = Math.max(1, Math.round(N * ratio / 100));
  const picked = ranked.slice(0, keep).sort((a, b) => a.i - b.i).map((x) => x.s);
  return { sens, picked, total: N };
}

$("#sumRun").addEventListener("click", () => {
  const text = $("#sumIn").value.trim();
  const out = $("#sumOut");
  if (text.length < 50) { out.hidden = true; alert("文本太短啦，贴 50 字以上试试～"); return; }
  const { picked, total } = summarize(text, +$("#sumRatio").value);
  $("#sumText").textContent = picked.join(" ");
  $("#sumMeta").textContent = `原文 ${total} 句 → 摘要 ${picked.length} 句 · 压缩率 ${Math.round(picked.length / total * 100)}%`;
  out.hidden = false;
});
$("#sumRatio").addEventListener("input", (e) => { $("#sumRatioOut").textContent = e.target.value; });

/* ═════════ ② 关键词提取 ═════════ */
function extractKeywords(text, topN = 10) {
  const freq = new Map();
  const count = (w) => { if (!STOP.has(w) && !/^\d+$/.test(w)) freq.set(w, (freq.get(w) || 0) + 1); };
  // 英文词
  (text.match(/[a-zA-Z][a-zA-Z\-']{2,}/g) || []).forEach((w) => count(w.toLowerCase()));
  // 中文 2 字窗（相邻频次聚合近似分词）
  for (let i = 0; i < text.length - 1; i++) {
    const bi = text.slice(i, i + 2);
    if (!/[\u4e00-\u9fff]{2}/.test(bi)) continue;
    if (STOP.has(bi)) continue;
    freq.set(bi, (freq.get(bi) || 0) + 1);
  }
  return [...freq.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, topN);
}

$("#kwRun").addEventListener("click", () => {
  const text = $("#kwIn").value.trim();
  const out = $("#kwOut");
  if (text.length < 20) { out.hidden = true; alert("文本太短，关键词提取不出来～"); return; }
  const kws = extractKeywords(text, 10);
  const max = kws[0]?.[1] || 1;
  const list = $("#kwList");
  list.innerHTML = "";
  kws.forEach(([w, c], idx) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${w}</b><div class="kw-bar"><i data-w="${Math.round(c / max * 100)}"></i></div><em>${c} 次</em>`;
    li.style.animation = `rise .3s ease ${idx * 0.06}s both`;
    list.appendChild(li);
  });
  requestAnimationFrame(() => list.querySelectorAll(".kw-bar i").forEach((i) => (i.style.width = i.dataset.w + "%")));
  $("#kwMeta").textContent = `统计 ${text.length} 字符 · 过滤停用词后取 Top ${kws.length}`;
  $("#kwText").dataset.val = kws.map(([w]) => w).join("、");
  out.hidden = false;
});

/* ═════════ ③ 情感分析 ═════════ */
const POS_WORDS = "喜欢 喜欢 赞 优秀 便利 推荐 舒适 安静 干净 好吃 好看 惊喜 满意 温柔 热情 周到 快 认真 负责 完美 棒 极佳 出色 划算 实惠 开心 幸福 治愈 温暖 惊艳 顺畅 贴心 耐心 专业".split(/\s+/);
const NEG_WORDS = "讨厌 差劲 失望 难吃 难看 吵闹 脏 慢 敷衍 态度差 翻车 坑 贵 麻烦 糟糕 崩溃 卡顿 骗 生气 郁闷 冷漠 宰客 偷工减料 破损 遗憾 可惜 一般 普通 无聊 平庸".split(/\s+/);
const PSET = new Set(POS_WORDS), NSET = new Set(NEG_WORDS);

$("#sentiRun").addEventListener("click", () => {
  const text = $("#sentiIn").value.trim();
  const out = $("#sentiOut");
  if (!text) { out.hidden = true; return; }
  const hits = [];
  const scan = (dict, polarity) => {
    dict.forEach((w) => {
      let idx = text.indexOf(w);
      while (idx !== -1) {
        // 检查前缀是否有「不 / 没 / 别」反转
        const pre = text.slice(Math.max(0, idx - 2), idx);
        const flipped = /不|没有|别|毫不|毫无$/.test(pre);
        hits.push({ w, pol: flipped ? -polarity : polarity, pre: flipped });
        idx = text.indexOf(w, idx + w.length);
      }
    });
  };
  scan(PSET, 1);
  scan(NSET, -1);
  const score = hits.reduce((a, h) => a + h.pol, 0);
  const norm = Math.max(-1, Math.min(1, score / 4)); // ±4 词封顶
  const needle = 50 + norm * 50;
  $("#sentiNeedle").style.left = needle + "%";

  const v = $("#sentiVerdict");
  const badge = (t, c) => `<b style="color:${c}">${t}</b>`;
  if (score > 1) v.innerHTML = `整体情绪偏 ${badge("积极 😊", "#3ce8a4")} · 得分 +${score}`;
  else if (score < -1) v.innerHTML = `整体情绪偏 ${badge("消极 😕", "#ff5c6e")} · 得分 ${score}`;
  else if (hits.length === 0) v.innerHTML = `未检出情感词 · ${badge("中性 😐", "#8b93ad")}`;
  else v.innerHTML = `情感词相互抵消 · ${badge("褒贬参半 🤔", "#f5c451")} · 得分 ${score > 0 ? "+" + score : score}`;

  const hl = $("#sentiHits");
  hl.innerHTML = "";
  hits.forEach((h) => {
    const li = document.createElement("li");
    li.className = h.pol > 0 ? "pos" : "neg";
    li.textContent = (h.pre ? "「" + h.pre + "」反转 → " : "") + h.w;
    hl.appendChild(li);
  });
  out.hidden = false;
});

/* ═════════ ④ 智能配色 ═════════ */
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const readable = (hex) => (lum(hex) > 0.42 ? "#14192e" : "#f4f7ff");

const HARMONY = {
  ana: [0, 24, -24, 48, -48],
  comp: [0, 180, 150, 210, 30],
  tri: [0, 120, 240, 60, 180],
  split: [0, 150, 210, 30, 330],
};

function buildPalette(seed, mode) {
  const [h, s, l] = hexToHsl(seed);
  return HARMONY[mode].map((dh, i) => {
    const hh = h + dh;
    const ss = Math.min(1, Math.max(0.12, s + (i % 2 ? -0.1 : 0.05)));
    const ll = [0.28, 0.5, 0.66, 0.4, 0.78][i] * (0.6 + l * 0.55);
    return hslToHex(hh, ss, Math.min(0.9, Math.max(0.15, ll)));
  });
}

let curPalette = [];
function renderPalette(pal) {
  curPalette = pal;
  const box = $("#palette");
  box.innerHTML = "";
  const roles = ["主色 Primary", "辅色 Secondary", "强调 Accent", "深色 Dark", "浅色 Light"];
  pal.forEach((hex, i) => {
    const sw = document.createElement("div");
    sw.className = "swatch";
    sw.style.background = hex;
    sw.style.color = readable(hex);
    sw.style.animationDelay = i * 0.07 + "s";
    sw.innerHTML = `<b>${hex.toUpperCase()}</b><small>${roles[i]}</small>`;
    sw.title = "点击复制 HEX";
    sw.addEventListener("click", () => {
      navigator.clipboard?.writeText(hex.toUpperCase());
      const b = sw.querySelector("b");
      const old = b.textContent;
      b.textContent = "已复制 ✓";
      setTimeout(() => (b.textContent = old), 900);
    });
    box.appendChild(sw);
  });
  // 页面示例
  const [p, s, a, dk, lt] = pal;
  const card = $(".pv-card:not(.dark)");
  card.style.background = lt; card.style.color = readable(lt);
  const btn = card.querySelector(".pv-btn");
  btn.style.background = p; btn.style.color = readable(p);
  card.querySelector("h4").style.color = p;
  const dark = $(".pv-card.dark");
  dark.style.background = dk; dark.style.color = readable(dk);
  const gbtn = dark.querySelector(".pv-btn");
  gbtn.style.color = a;
  dark.querySelector("h4").style.color = a;
  $("#palPreview").hidden = false;
}

$("#colorRun").addEventListener("click", () => {
  renderPalette(buildPalette($("#seedColor").value, $("#harmony").value));
});

/* ═════════ ⑤ 灵感生成器 ═════════ */
const IDEAS = {
  主语: ["夜市摊主", "地铁通勤者", "楼下橘猫", "退休天文老师", "便利店夜班店员", "独立游戏开发者", "早八大学生", "胡同修表匠", "远洋船员", "宠物殡葬师", "高原邮递员", "天文台守夜人"],
  动作: ["记录", "交换", "收藏", "驯服", "翻译", "重新发明", "打包", "直播", "给……办展览", "给……写传记", "倒卖", "破译"],
  载体: ["城市噪音", "过期车票", "陌生人的梦", "凌晨四点的云", "老楼电梯里的对话", "雨天的伞骨", "无人认领的快递", "便利店小票", "路灯下的影子", "断网的周末", "旧手机里的短信", "地铁末班风"],
  风格: ["像素游戏风", "纪录片质感", "手账拼贴", "赛博霓虹", "水墨留白", "昭和复古", "蒸汽波", "粗野主义", "极简黑白", "儿童绘本"],
};
const SLOT_KEYS = ["主语", "动作", "载体", "风格"];
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

function renderSlots(vals) {
  $("#ideaSlots").innerHTML = SLOT_KEYS.map((k, i) =>
    `<div class="slot" data-k="${k}"><span><small style="display:block;font-size:10px;opacity:.5;letter-spacing:2px">${k}</small>${vals[i]}</span></div>`
  ).join("");
}

$("#ideaRun").addEventListener("click", () => {
  const slots = $$(".slot");
  slots.forEach((s) => s.classList.add("rolling"));
  let n = 0;
  const timer = setInterval(() => {
    renderSlots(SLOT_KEYS.map((k) => rnd(IDEAS[k])));
    if (++n >= 12) {
      clearInterval(timer);
      const vals = SLOT_KEYS.map((k) => rnd(IDEAS[k]));
      renderSlots(vals);
      $$(".slot").forEach((s) => s.classList.remove("rolling"));
      const sentence = `${vals[0]}试图${vals[1]}${vals[2]}—— 用${vals[3]}呈现。`;
      $("#ideaText").textContent = sentence;
      $("#ideaText").dataset.val = sentence;
      $("#ideaOut").hidden = false;
      $("#ideaOut").style.animation = "none"; void $("#ideaOut").offsetWidth; $("#ideaOut").style.animation = "";
    }
  }, 90);
});

const favs = [];
$("#ideaCopy").addEventListener("click", () => {
  const t = $("#ideaText").dataset?.val || $("#ideaText").textContent;
  if (!t) return;
  favs.unshift(t);
  renderFavs();
});
function renderFavs() {
  const ul = $("#favList");
  ul.innerHTML = "";
  favs.forEach((t, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>★ ${t}</span><button data-i="${i}" title="删除">×</button>`;
    ul.appendChild(li);
  });
}
$("#favList").addEventListener("click", (e) => {
  if (e.target.tagName !== "BUTTON") return;
  favs.splice(+e.target.dataset.i, 1);
  renderFavs();
});

/* ── 通用：复制按钮 ── */
$$(".copy").forEach((btn) => {
  btn.addEventListener("click", () => {
    const el = $("#" + btn.dataset.from);
    const text = el.dataset?.val ?? el.textContent;
    navigator.clipboard?.writeText(text.trim());
    btn.textContent = "已复制 ✓";
    setTimeout(() => (btn.textContent = "复制"), 900);
  });
});

/* ── 初始化 ── */
renderPalette(buildPalette("#7c5cff", "ana"));
renderSlots(SLOT_KEYS.map((k) => rnd(IDEAS[k])));
