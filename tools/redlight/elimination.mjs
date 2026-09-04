// Lớp đạo diễn của minigame "SquidGame" — Order Race / M1
//
// Cơ chế đèn xanh đèn đỏ: trọng tài quay lưng thì cả đàn tiến lên, trọng tài
// quay mặt lại thì ai còn nhúc nhích sẽ bị loại. Loại dần cho tới khi còn đúng
// K người, rồi K người đó chạy nước rút về đích để phân hạng.
//
// RÀNG BUỘC KIẾN TRÚC (GDD §4), giống hệt lớp đạo diễn đường đua: file này CHỈ
// ĐỌC finalOrder. Người sống sót cuối cùng luôn là hạng 1, không phải vì lớp
// này chọn, mà vì lớp Kết quả đã chốt từ trước. Luồng ngẫu nhiên cũng tách riêng.
//
// Ánh xạ thứ hạng sang thứ tự bị loại là bắt buộc và duy nhất: người hạng r bị
// loại ở đúng vòng mà số người sống sót tụt xuống dưới r + 1. Nhờ vậy toàn bộ
// diễn tiến vẫn kiểm chứng lại được từ cùng một seed.

import { makeRng, uniformBelow } from "../fairness/fairness.mjs";
import { sha256HexOfString } from "../fairness/sha256.mjs";

export const ELIMINATION_VERSION = "order-race/elimination/v1";

/** Phần đường đua mà các vòng loại đi hết; 20% còn lại dành cho nước rút cuối. */
const ROUNDS_REACH = 0.8;

/** Giây: trọng tài quay đầu — đây là đoạn chuẩn bị trước khung va chạm. */
const TURN_SEC = 0.55;

/** Giây: đứng im SAU loạt đạn, để cả phòng kịp thấy còn lại những ai. */
const RED_BASE = 0.62;

/**
 * Giây giữa hai phát bắn khi loạt đạn còn thưa.
 *
 * 0,085 là quá nhanh ở những vòng cuối, chỗ chỉ còn hai ba người bị loại và
 * mỗi cái tên đáng được nghe riêng một phát. Vòng đông thì trần VOLLEY_MAX
 * bên dưới tự siết lại, nên nới con số này chỉ nới đúng chỗ cần nới.
 */
const POP_STAGGER = 0.14;

/**
 * Trần thời gian của một loạt bắn, dù có bao nhiêu người bị loại.
 *
 * Vòng đầu với 150 người loại tới 64 người cùng lúc. Giữ nguyên 0,085 giây mỗi
 * phát thì loạt đó kéo 5,4 giây — quá dài, và cái đáng lẽ là một loạt liên thanh
 * lại thành từng phát rời rạc lê thê. Loạt đông thì bắn dày hơn, đúng như súng thật.
 */
const VOLLEY_MAX = 2.2;

// ---------------------------------------------------------------------------
// Đoạn khoá mục tiêu, tách làm hai nhịp có tên
//
// Bản trước gộp cả đoạn này vào một con số 0,22 giây. Chưa bằng một cái chớp
// mắt: khung ngắm hiện lên rồi đạn nổ gần như cùng lúc, nên cú bắn tới như một
// tai nạn chứ không như một bản án. Mà cái làm cơ chế này đáng sợ không phải
// phát đạn — nó là quãng bạn BIẾT mình đã bị nhìn thấy mà chưa chết.
//
// Hai nhịp, hai việc khác nhau:
//
//   QUÉT   khung ngắm siết dần vào từng con, so le nhau. Đây là lúc khán giả
//          đọc tên. Phải đủ dài để mắt chạy hết một lượt danh sách.
//   GHÌM   mọi khung ngắm đã khoá, không ai nhúc nhích, không một tiếng động.
//          Không có nhịp này thì quét xong là bắn luôn, và toàn bộ công dựng
//          đoạn quét bị nuốt mất.

/** Giây: khung ngắm siết dần vào từng mục tiêu. */
const SCAN_SEC = 0.42;

/** Giây: đã khoá xong, ghìm lại trước phát đầu tiên. */
const HOLD_SEC = 0.32;

const AIM_SEC = SCAN_SEC + HOLD_SEC;

/** Giây: nước rút của những người sống sót. */
const SPRINT_SEC = 4.2;

/** Khoảng cách giữa hạng 1 và hạng 2 lúc về đích — về sát nút. */
const DRAMA_GAP = 0.006;

const lerp = (a, b, u) => a + (b - a) * u;
const sat01 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);
const easeOutSine = (u) => Math.sin((u * Math.PI) / 2);

/** Số thực trong [lo, hi) lấy từ luồng ngẫu nhiên đã seed. */
const between = (rng, lo, hi) => lo + (uniformBelow(rng, 10000) / 10000) * (hi - lo);

/**
 * Số vòng loại.
 *
 * Nhắm mỗi vòng loại khoảng 43% số người còn lại — đủ để thấy đám đông vơi đi
 * rõ rệt, nhưng vẫn đủ vòng để căng thẳng leo thang. Trần 9 vòng để buổi lễ
 * không lê thê; sàn 3 vòng để danh sách nhỏ vẫn có nhịp.
 */
export function roundCount(n, topK) {
  const ideal = Math.round(Math.log(n / topK) / Math.log(1.75));
  return Math.max(3, Math.min(9, Math.min(ideal, n - topK)));
}

/**
 * Số người còn sống sau mỗi vòng. S[0] = n, S[R] = topK.
 *
 * Ép giảm dần nghiêm ngặt: mỗi vòng phải loại ít nhất một người, và trước vòng
 * cuối luôn phải còn dư đủ người để các vòng sau vẫn có việc làm. Không ép thì
 * với danh sách nhỏ sẽ xuất hiện vòng chẳng loại ai — trọng tài quay mặt rồi
 * không có gì xảy ra, hỏng hẳn nhịp.
 */
export function survivorCurve(n, topK, R) {
  const S = new Array(R + 1);
  S[0] = n;
  S[R] = topK;
  for (let i = 1; i < R; i++) S[i] = Math.round(n * Math.pow(topK / n, i / R));
  for (let i = 1; i < R; i++) {
    S[i] = Math.min(S[i - 1] - 1, Math.max(topK + (R - i), S[i]));
  }
  return S;
}

export function buildElimination(finalOrder, seedHex, options = {}) {
  const n = finalOrder.length;
  if (n < 2) throw new Error("Cần ít nhất 2 người chơi.");

  const topK = Math.max(1, Math.min(n - 1, options.topK ?? 3));
  const rng = makeRng(sha256HexOfString(seedHex + "|" + ELIMINATION_VERSION));

  const R = roundCount(n, topK);
  const S = survivorCurve(n, topK, R);

  // ---- Ai bị loại ở vòng nào. Chó được đánh số theo hạng cuối: chó 0 thắng.
  const eliminatedAt = new Int32Array(n).fill(-1);
  const rounds = [];
  let clock = 0;

  // Cú doạ quay là nhịp đặc trưng của cơ chế này, không phải phần thưởng may
  // rủi. Chọn trước một vòng chắc chắn có, rồi thả thêm vài cú ngẫu nhiên.
  // Để mặc xác suất thì lượt ít vòng sẽ có 1/3 số lần chẳng doạ lần nào.
  const guaranteedFake = 2 + uniformBelow(rng, Math.max(1, R - 1));

  for (let i = 1; i <= R; i++) {
    const victims = [];
    for (let rank = S[i]; rank < S[i - 1]; rank++) {
      victims.push(rank);
      eliminatedAt[rank] = i;
    }

    // Thứ tự bay lên được xáo trộn cho đỡ đoán được, nhưng TẬP người bị loại
    // thì tuyệt đối không đổi — nó do thứ hạng quyết định.
    for (let a = victims.length - 1; a >= 1; a--) {
      const b = uniformBelow(rng, a + 1);
      const t = victims[a];
      victims[a] = victims[b];
      victims[b] = t;
    }

    // Đèn xanh dài dần qua từng vòng: càng về sau càng phải nín thở lâu hơn.
    const greenSec = between(rng, 3.0, 4.4) + (i / R) * 2.6;

    // Doạ quay: trọng tài giật đầu rồi thôi. Không loại ai, chỉ để cả phòng
    // thót tim. Không đặt ở vòng đầu — khán giả cần hiểu luật trước đã.
    const wantFake = i >= 2 && (i === guaranteedFake || uniformBelow(rng, 100) < 32);
    const fakeOutAt = wantFake ? between(rng, 0.35, 0.72) * greenSec : -1;

    const stagger = Math.min(POP_STAGGER, VOLLEY_MAX / Math.max(1, victims.length));
    const volleySec = stagger * victims.length;
    const redSec = RED_BASE + AIM_SEC + volleySec;

    rounds.push({
      index: i,
      startSec: clock,
      greenSec,
      turnSec: TURN_SEC,
      redSec,
      fakeOutAt,
      aimSec: AIM_SEC,
      scanSec: SCAN_SEC,
      holdSec: HOLD_SEC,
      stagger,
      volleySec,
      survivorsBefore: S[i - 1],
      survivorsAfter: S[i],
      eliminated: victims,
      /** Thời điểm trọng tài quay hẳn mặt lại — khung va chạm của vòng này. */
      impactSec: clock + greenSec + TURN_SEC,
    });

    clock += greenSec + TURN_SEC + redSec;
  }

  const sprintStartSec = clock;
  const totalSec = clock + SPRINT_SEC;

  // ---- Suýt bị bắt: ở ba vòng cuối, một người sống sót loạng choạng rồi kịp
  //      dừng. Đây là thứ thay cho "kẻ dẫn đầu giả" của đường đua — không có nó
  //      thì các vòng cuối chỉ còn là đếm số.
  const nearMiss = new Array(R + 1).fill(-1);
  for (let i = Math.max(1, R - 2); i <= R; i++) {
    const pool = [];
    for (let rank = 0; rank < S[i]; rank++) pool.push(rank);
    if (pool.length > 0) nearMiss[i] = pool[uniformBelow(rng, pool.length)];
  }
  // Người thắng phải suýt bị bắt ít nhất một lần — cả phòng cần một lần hụt hẫng.
  nearMiss[R] = 0;

  // ---- Quãng đường mỗi vòng. Chuẩn hoá theo từng chú chó, để ai sống hết các
  //      vòng đều tới đúng ROUNDS_REACH — K người sống sót vào nước rút ngang nhau.
  const totalGreen = rounds.reduce((a, r) => a + r.greenSec, 0);
  const jitter = new Float64Array(n * R);
  const perDogScale = new Float64Array(n);

  for (let dog = 0; dog < n; dog++) {
    let weighted = 0;
    for (let i = 0; i < R; i++) {
      const j = between(rng, 0.82, 1.18);
      jitter[dog * R + i] = j;
      weighted += (rounds[i].greenSec / totalGreen) * j;
    }
    perDogScale[dog] = weighted > 0 ? ROUNDS_REACH / weighted : 0;
  }

  const roundDist = new Float64Array(n * R);
  for (let dog = 0; dog < n; dog++) {
    for (let i = 0; i < R; i++) {
      roundDist[dog * R + i] =
        (rounds[i].greenSec / totalGreen) * jitter[dog * R + i] * perDogScale[dog];
    }
  }

  // ---- Vị trí đích của nước rút: hạng 1 chạm vạch, các hạng sau lùi dần.
  const sprintEnd = new Float64Array(n);
  for (let rank = 0; rank < topK; rank++) {
    sprintEnd[rank] = 1 - rank * DRAMA_GAP;
  }

  const race = {
    version: ELIMINATION_VERSION,
    n,
    topK,
    rounds: R,
    schedule: rounds,
    survivorCounts: S,
    eliminatedAt,
    nearMiss,
    sprintStartSec,
    totalSec,

    /** Vòng mà chú chó này bị loại, hoặc -1 nếu sống tới cuối. */
    roundOf: (dog) => eliminatedAt[dog],

    isAlive(dog, tSec) {
      const at = eliminatedAt[dog];
      if (at < 0) return true;
      return tSec < rounds[at - 1].impactSec;
    },

    survivorsAt(tSec) {
      let alive = n;
      for (const r of rounds) if (tSec >= r.impactSec) alive = r.survivorsAfter;
      return alive;
    },

    /** Pha hiện tại: "green" | "turn" | "red" | "sprint" | "done". */
    phaseAt(tSec) {
      if (tSec >= totalSec) return "done";
      if (tSec >= sprintStartSec) return "sprint";
      for (const r of rounds) {
        if (tSec < r.startSec + r.greenSec) return "green";
        if (tSec < r.impactSec) return "turn";
        if (tSec < r.startSec + r.greenSec + r.turnSec + r.redSec) return "red";
      }
      return "sprint";
    },

    /** Vòng đang diễn ra tại thời điểm này (1..R), hoặc -1 nếu đã sang nước rút. */
    roundAt(tSec) {
      for (const r of rounds) {
        if (tSec < r.startSec + r.greenSec + r.turnSec + r.redSec) return r.index;
      }
      return -1;
    },

    progressOf(dog, tSec) {
      const at = eliminatedAt[dog];
      const stopAt = at < 0 ? Infinity : rounds[at - 1].impactSec;
      const t = Math.min(tSec, stopAt);

      let p = 0;
      for (let i = 0; i < R; i++) {
        const r = rounds[i];
        const d = roundDist[dog * R + i];
        if (t >= r.impactSec) { p += d; continue; }
        if (t <= r.startSec) break;

        // 88% quãng đường đi trong đèn xanh, 12% còn lại trong lúc trọng tài
        // quay đầu — chó giảm tốc chứ không phanh cứng, nếu không nó đọc ra
        // thành rớt khung hình đúng như bản đầu của đường đua.
        if (t < r.startSec + r.greenSec) {
          p += d * 0.88 * ((t - r.startSec) / r.greenSec);
        } else {
          const u = (t - r.startSec - r.greenSec) / r.turnSec;
          p += d * (0.88 + 0.12 * easeOutSine(sat01(u)));
        }
        break;
      }

      if (at >= 0) return p;
      if (tSec <= sprintStartSec) return p;

      const u = sat01((tSec - sprintStartSec) / SPRINT_SEC);
      return lerp(p, sprintEnd[dog], easeOutSine(u));
    },
  };

  return race;
}
