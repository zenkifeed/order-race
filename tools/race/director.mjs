// Lớp đạo diễn — Order Race / M1
//
// Nhận thứ hạng đã chốt từ lớp Kết quả và dựng ra đường đi của từng chú chó sao
// cho tới đúng thứ hạng đó một cách kịch tính nhất. Xem GDD §5.
//
// RÀNG BUỘC KIẾN TRÚC (GDD §4): file này CHỈ ĐỌC finalOrder. Nó không được phép
// sửa, sắp xếp lại, hay ảnh hưởng ngược lại thứ hạng bằng bất cứ cách nào. Luồng
// ngẫu nhiên của nó cũng lấy từ một seed dẫn xuất riêng, nên có chỉnh tham số
// trình diễn thế nào thì người thắng vẫn không đổi.

import { makeRng, uniformBelow } from "../fairness/fairness.mjs";
import { sha256HexOfString } from "../fairness/sha256.mjs";

export const DIRECTOR_VERSION = "order-race/director/v1";

/** Mốc thời gian của 5 nhịp, theo tỉ lệ thời lượng cuộc đua. GDD §5. */
export const BEATS = [0, 0.15, 0.45, 0.75, 0.95, 1.0];

/**
 * Mức "đã ngã ngũ" tại mỗi mốc: 0 là thứ tự hoàn toàn ngẫu nhiên, 1 là đúng thứ
 * hạng cuối. Đàn chó sắp dần về đích thay vì nhảy cóc.
 */
const CONVERGE = [0.0, 0.20, 0.50, 0.85, 1.0, 1.0];

/**
 * Độ giãn của cả đàn tại mỗi mốc, tính theo tỉ lệ chiều dài đường đua. Xuất phát
 * bó cụm rồi giãn dần — đây cũng là thứ giữ cho chuyển động không bao giờ lùi:
 * độ giãn chỉ được phép tăng chậm hơn tốc độ chạy.
 */
const SPREAD = [0.015, 0.055, 0.150, 0.235, 0.295];

/**
 * Hệ số co độ giãn theo số người.
 *
 * Với 150 con, một hạng chỉ chiếm 0,2% đường đua. Với 8 con thì một hạng chiếm
 * tới 4,2% — đủ để một cú tụt hạng bình thường trở thành chuyển động lùi. Đàn
 * nhỏ vì vậy chạy bó cụm hơn, vừa đúng vật lý vừa giữ được tính đơn điệu.
 */
const spreadScale = (n) => Math.min(1, 0.45 + n / 40);

const SAMPLE_HZ = 30;

/** Lấy mẫu thêm sau khi người thắng chạm vạch, để cả tốp sau còn kịp về đích. */
const TAIL = 0.35;

const smoothstep = (u) => u * u * (3 - 2 * u);
const clamp01 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Sắp xếp chỉ số theo điểm tăng dần, hoà thì theo chỉ số — luôn xác định. */
function orderByScore(scores) {
  const idx = scores.map((_, i) => i);
  idx.sort((a, b) => scores[a] - scores[b] || a - b);
  return idx;
}

/** Nhấc một chú chó ra khỏi thứ tự rồi chèn lại đúng vị trí muốn. */
function placeAt(order, dog, target) {
  const cur = order.indexOf(dog);
  if (cur < 0) return;
  const t = Math.max(0, Math.min(order.length - 1, target));
  if (cur === t) return;
  order.splice(cur, 1);
  order.splice(t, 0, dog);
}

/**
 * Tốc độ của con dẫn đầu theo thời gian. Xuất phát chậm rồi bật lên (cửa chuồng
 * vừa mở, chó còn lấy đà), giữ đều, rồi tăng ở đoạn nước rút.
 */
function leaderSpeed(t) {
  if (t < 0.04) return 0.6 + 0.4 * smoothstep(t / 0.04);
  if (t > 0.75 && t < 1) return 1 + 0.16 * smoothstep((t - 0.75) / 0.25);
  if (t >= 1) return 1.16;
  return 1;
}

/**
 * Khoảng cách giữa các hạng tại vạch đích.
 *
 * Không chia đều: tốp đầu được giãn ra cho dễ đọc trên máy chiếu, còn hai cặp
 * quyết định — hạng 1 với hạng 2, và hạng K với hạng K+1 — được ép sát lại để
 * thành pha về đích sát nút. Đây chính là chỗ nhịp 4 và nhịp 5 ở GDD §5 sống.
 */
const DRAMA_GAP = 0.0035;

function finalOffsets(n, topK) {
  const total = SPREAD[SPREAD.length - 1] * 1.02 * spreadScale(n);
  const gapCount = Math.max(1, n - 1);
  const gaps = new Float64Array(gapCount);

  // Hai cặp quyết định nhận một khoảng cách TUYỆT ĐỐI, không chia theo trọng
  // số. Nếu chia theo trọng số thì với danh sách nhỏ khe hở vẫn quá rộng và
  // pha về đích sát nút biến mất.
  const drama = new Set();
  drama.add(0);
  const boundary = topK - 1;
  if (boundary > 0 && boundary < gapCount) drama.add(boundary);

  const w = new Float64Array(gapCount);
  let sum = 0;
  for (let r = 0; r < gapCount; r++) {
    if (drama.has(r)) continue;
    w[r] = r < 12 ? 3.0 : 1.0;
    sum += w[r];
  }

  const reserved = drama.size * DRAMA_GAP;
  const unit = sum > 0 ? Math.max(0, total - reserved) / sum : 0;
  for (let r = 0; r < gapCount; r++) gaps[r] = drama.has(r) ? DRAMA_GAP : w[r] * unit;

  const offsets = new Float64Array(n);
  for (let r = 1; r < n; r++) offsets[r] = offsets[r - 1] - gaps[r - 1];
  return offsets;
}

/**
 * Chọn kẻ dẫn đầu giả: con sẽ dẫn đầu suốt nửa đầu cuộc đua rồi tụt hạng.
 * Hạng cuối của nó phải nằm trong khoảng 4–8 — đủ xa để cú tụt gây bất ngờ,
 * nhưng không xa tới mức trông vô lý.
 */
function pickFalseLeader(n, rng) {
  if (n < 8) return -1;
  // Trần phải co theo số người. Với đàn 8 con, hạng 7 chính là con về bét: nó
  // vừa vô lý về mặt kể chuyện, vừa bất khả thi về mặt chuyển động — rơi 7
  // hạng trong 25% cuộc đua là lùi nhanh hơn cả tốc độ chạy.
  const lo = 3;
  const hi = Math.min(7, Math.max(lo, Math.floor(n * 0.55)));
  return lo + uniformBelow(rng, hi - lo + 1);
}

/**
 * Dựng bảng hạng ảo tại 6 mốc nhịp.
 *
 * Chó được đánh số THEO HẠNG CUỐI: chó 0 là người thắng, chó n-1 về bét. Nhờ vậy
 * mốc cuối cùng chỉ là thứ tự 0,1,2,… và mọi ràng buộc đều viết theo hạng.
 */
function buildVirtualRanks(n, topK, falseLeader, rng) {
  const startOrder = [];
  for (let i = 0; i < n; i++) startOrder.push(i);
  for (let i = n - 1; i >= 1; i--) {
    const j = uniformBelow(rng, i + 1);
    const t = startOrder[i];
    startOrder[i] = startOrder[j];
    startOrder[j] = t;
  }
  const pi0 = new Int32Array(n);
  for (let p = 0; p < n; p++) pi0[startOrder[p]] = p;

  // Mỗi chú chó có hai số ngẫu nhiên cố định, và nhiễu tại mốc k là phép nội
  // suy giữa hai số đó. Nhờ vậy nhiễu biến thiên MƯỢT theo thời gian: một chú
  // chó không thể nhảy từ đầu đoàn xuống cuối đoàn chỉ vì hai lần bốc số khác
  // nhau. Nhiễu độc lập từng mốc chính là nguyên nhân của chuyển động lùi.
  const noiseA = new Float64Array(n);
  const noiseB = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    noiseA[i] = uniformBelow(rng, 2001) / 1000 - 1;
    noiseB[i] = uniformBelow(rng, 2001) / 1000 - 1;
  }

  const jitterAmp = Math.max(1, n * 0.09);
  const vranks = [];

  for (let k = 0; k < BEATS.length; k++) {
    if (k === BEATS.length - 1) {
      const last = new Int32Array(n);
      for (let i = 0; i < n; i++) last[i] = i;
      vranks.push(last);
      continue;
    }

    const c = CONVERGE[k];
    const mix = k / (BEATS.length - 2);
    const amp = jitterAmp * (1 - c);
    const scores = new Array(n);
    for (let i = 0; i < n; i++) {
      const jitter = (noiseA[i] * (1 - mix) + noiseB[i] * mix) * amp;
      scores[i] = c * i + (1 - c) * pi0[i] + jitter;
    }
    const order = orderByScore(scores);

    // --- Ràng buộc kịch tính, áp theo đúng thứ tự này ---
    if (falseLeader >= 0 && (k === 1 || k === 2)) placeAt(order, falseLeader, 0);

    if (n >= 6) {
      if (k === 0) {
        const lo = Math.max(3, Math.round(n * 0.35));
        const hi = Math.max(lo, Math.min(n - 1, Math.round(n * 0.7)));
        placeAt(order, 0, lo + uniformBelow(rng, hi - lo + 1));
      } else if (k === 1) {
        const lo = Math.max(3, Math.round(n * 0.3));
        const hi = Math.max(lo, Math.min(n - 1, Math.round(n * 0.6)));
        placeAt(order, 0, lo + uniformBelow(rng, hi - lo + 1));
      } else if (k === 2) {
        const lo = 3;
        const hi = Math.max(lo, Math.min(n - 1, Math.round(n * 0.35)));
        placeAt(order, 0, lo + uniformBelow(rng, hi - lo + 1));
      } else if (k === 3) {
        // Ngôi đầu ở mốc 75% được trao cho HẠNG NHÌ, theo đúng thứ tự này.
        //
        // Nếu để con đang dẫn đầu là một chú về hạng sâu, nó phải tụt rất nhanh
        // trong nhịp 4 và vô tình đẩy người thắng lên đầu quá sớm — cửa kịch
        // tính bắt được 4/200 lượt lộ bài như vậy.
        //
        // Trao cờ cho hạng nhì còn kể chuyện hay hơn: khán giả có hai lần hụt
        // hẫng thay vì một. Kẻ dẫn đầu giả tàn ở mốc 75%, hạng nhì cầm cờ suốt
        // đoạn nước rút và trông hệt như người sắp thắng, rồi bị vượt ở 2 giây
        // cuối cùng.
        placeAt(order, 1, 0);
        if (falseLeader >= 0) placeAt(order, falseLeader, 1);
        placeAt(order, 0, 2);
      }
    }

    const v = new Int32Array(n);
    for (let p = 0; p < n; p++) v[order[p]] = p;
    vranks.push(v);
  }

  return vranks;
}

/**
 * Dựng toàn bộ cuộc đua thành mảng vị trí đã lấy mẫu sẵn.
 *
 * Lấy mẫu trước thay vì tính theo từng khung hình, vì ba lý do: tua lại được
 * chính xác, kiểm thử được bằng máy, và lúc chạy chỉ còn là tra bảng — đúng thứ
 * mà lớp render instanced ở GDD §11 cần.
 */
export function buildRace(finalOrder, seedHex, options = {}) {
  const n = finalOrder.length;
  if (n < 2) throw new Error("Cuộc đua cần ít nhất 2 chú chó.");

  const topK = Math.max(1, Math.min(n, options.topK ?? 3));
  const durationSec = options.durationSec ?? 40;

  // Luồng ngẫu nhiên RIÊNG của lớp đạo diễn. Dẫn xuất từ seed xếp hạng nhưng
  // tách hẳn, nên chỉnh tham số trình diễn không bao giờ đổi được người thắng.
  const rng = makeRng(sha256HexOfString(seedHex + "|" + DIRECTOR_VERSION));

  const falseLeader = pickFalseLeader(n, rng);
  const vranks = buildVirtualRanks(n, topK, falseLeader, rng);
  const endOffsets = finalOffsets(n, topK);

  const totalNorm = 1 + TAIL;
  const sampleCount = Math.round(durationSec * totalNorm * SAMPLE_HZ) + 1;
  const dt = totalNorm / (sampleCount - 1);

  // --- Vị trí của con dẫn đầu: tích phân số học tốc độ, rồi chuẩn hoá để đúng
  //     bằng 1.0 tại thời điểm t = 1 (khoảnh khắc người thắng chạm vạch).
  const base = new Float64Array(sampleCount);
  for (let j = 1; j < sampleCount; j++) {
    const tMid = (j - 0.5) * dt;
    base[j] = base[j - 1] + leaderSpeed(tMid) * dt;
  }
  const jAtOne = 1 / dt;
  const j0 = Math.floor(jAtOne);
  const frac = jAtOne - j0;
  const baseAtOne = base[j0] + (base[Math.min(j0 + 1, sampleCount - 1)] - base[j0]) * frac;
  const scale = baseAtOne > 0 ? 1 / baseAtOne : 1;
  for (let j = 0; j < sampleCount; j++) base[j] *= scale;

  // --- Độ lệch của từng chú chó so với con dẫn đầu, nội suy giữa các mốc nhịp.
  const denom = Math.max(1, n - 1);
  const spread = spreadScale(n);

  // Tại mốc 95%, cả đàn đã đứng ĐÚNG vị trí đích — trừ người thắng và hạng nhì,
  // hai con này đổi chỗ cho nhau. Nhờ vậy đoạn 5% cuối chỉ còn đúng một việc:
  // cú vượt quyết định. Mọi chú chó khác không phải di chuyển hạng nào nữa.
  //
  // Đây là chỗ sửa quan trọng nhất của lớp đạo diễn. Bản đầu bắt tất cả phải về
  // đúng chỗ trong 5% cuối, khiến tốp giữa phải tụt hạng nhanh hơn tốc độ chạy —
  // tức là chạy lùi. Cửa kịch tính bắt được: 23/200 lượt sai thứ hạng về đích.
  const preFinal = new Float64Array(n);
  for (let i = 0; i < n; i++) preFinal[i] = endOffsets[i];
  if (n >= 2) {
    preFinal[0] = endOffsets[1];
    preFinal[1] = endOffsets[0];
  }

  const offsetAtKeyframe = (k, dog) => {
    if (k === BEATS.length - 1) return endOffsets[dog];
    if (k === BEATS.length - 2) return preFinal[dog];
    return -SPREAD[k] * spread * (vranks[k][dog] / denom);
  };

  const progress = new Float32Array(n * sampleCount);
  let worstBackstep = 0;
  let backstepCount = 0;

  for (let dog = 0; dog < n; dog++) {
    const row = dog * sampleCount;
    let prev = -Infinity;
    for (let j = 0; j < sampleCount; j++) {
      const t = j * dt;
      let off;
      if (t >= 1) {
        off = endOffsets[dog];
      } else {
        let k = 0;
        while (k < BEATS.length - 2 && t >= BEATS[k + 1]) k++;
        const span = BEATS[k + 1] - BEATS[k];
        const u = smoothstep(clamp01((t - BEATS[k]) / span));
        off = offsetAtKeyframe(k, dog) * (1 - u) + offsetAtKeyframe(k + 1, dog) * u;
      }

      let p = base[j] + off;
      if (p < prev) {
        // Lưới an toàn: chó không bao giờ được chạy lùi. Bộ tự kiểm khẳng định
        // lưới này gần như không bao giờ phải hoạt động — nếu nó hoạt động
        // nhiều thì nghĩa là hồ sơ độ giãn ở trên đã bị chỉnh sai.
        const back = prev - p;
        if (back > worstBackstep) worstBackstep = back;
        backstepCount++;
        p = prev;
      }
      prev = p;
      progress[row + j] = p;
    }
  }

  const winnerRow = 0;
  let finishSample = sampleCount - 1;
  for (let j = 0; j < sampleCount; j++) {
    if (progress[winnerRow + j] >= 1) {
      finishSample = j;
      break;
    }
  }

  return {
    version: DIRECTOR_VERSION,
    n,
    topK,
    durationSec,
    sampleHz: SAMPLE_HZ,
    sampleCount,
    dtNorm: dt,
    finalOrder,
    falseLeader,
    finishSample,
    progress,
    diagnostics: { worstBackstep, backstepCount, totalSamples: n * sampleCount },

    /** Vị trí của một chú chó tại một mẫu, theo tỉ lệ chiều dài đường đua. */
    progressOf(dog, sample) {
      return progress[dog * sampleCount + Math.max(0, Math.min(sampleCount - 1, sample))];
    },

    /** Vị trí tại một thời điểm bất kỳ (giây), nội suy tuyến tính giữa hai mẫu. */
    progressAtTime(dog, seconds) {
      const x = (seconds / durationSec) / dt;
      const a = Math.max(0, Math.min(sampleCount - 1, Math.floor(x)));
      const b = Math.min(sampleCount - 1, a + 1);
      const f = x - a;
      const row = dog * sampleCount;
      return progress[row + a] * (1 - f) + progress[row + b] * f;
    },

    /** Thứ hạng tại một mẫu: mảng chỉ số chó, phần tử 0 là con đang dẫn đầu. */
    rankingAt(sample) {
      const s = Math.max(0, Math.min(sampleCount - 1, sample));
      const idx = new Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      idx.sort((a, b) => progress[b * sampleCount + s] - progress[a * sampleCount + s] || a - b);
      return idx;
    },
  };
}
