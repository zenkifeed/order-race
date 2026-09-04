// Thư viện biến thể cuộc đua — Order Race / M2
//
// Một buổi trao thưởng quay 8–12 lượt. Cùng một cỗ máy, cùng một đường đua,
// cùng một nhịp kể chuyện: tới lượt thứ tư thì cả phòng đã biết trước chuyện gì
// sắp xảy ra, và cú vượt ở giây cuối không còn ăn tiền nữa. Chiều sâu chơi lại
// không đến từ việc thêm nút bấm — nó đến từ việc đổi BIẾN SỐ của một lượt.
//
// RÀNG BUỘC TUYỆT ĐỐI (GDD §4): mọi biến thể ở đây đều là biến thể TRÌNH DIỄN.
// Không cái nào được đụng tới thứ hạng. Ở một trò chơi thường, biến thể "đối
// xứng thì xếp hạng được, bất đối xứng thì chỉ cho PvE". Ở đây luật còn chặt
// hơn một bậc: KHÔNG có biến thể nào được phép chạm vào kết quả, vì kết quả đã
// được lớp công bằng chốt từ trước khi cửa chuồng mở, và cùng một seed thì phải
// ra cùng một bảng — dù chạy ở nhà hay chạy trước cả phòng.
//
// Cách giữ ràng buộc đó bằng cấu trúc, không bằng lời hứa:
//
//   1. Biến thể chỉ trả về hai thứ — `drama` (các núm của lớp đạo diễn) và
//      `stage` (các cờ của lớp trình diễn). Không có đường nào dẫn tới finalOrder.
//   2. Mọi núm `drama` đều là HỆ SỐ NHÂN mặc định 1.0, nên "không bật biến thể
//      nào" cho ra kết quả giống hệt từng bit so với bản chưa có tính năng này.
//   3. tools/race/modes-selftest.mjs chứng minh lại điều đó bằng máy: mọi tổ hợp
//      biến thể trên cùng một seed đều về đích đúng cùng một thứ hạng.
//
// Xem tools/race/modes-selftest.mjs và GDD §15.

import { makeRng, uniformBelow } from "../fairness/fairness.mjs";
import { sha256HexOfString } from "../fairness/sha256.mjs";

export const MODES_VERSION = "order-race/modes/v1";

/**
 * Bộ núm trung tính của lớp đạo diễn.
 *
 * Nhân với 1.0 là phép toán chính xác trong dấu phẩy động, nên hồ sơ này cho ra
 * đúng từng bit cuộc đua mà bản chưa có biến thể dựng ra. Đây là bằng chứng cấu
 * trúc cho "tính năng mới không đụng được vào lõi", không phải một lời hứa.
 */
export const NEUTRAL_DRAMA = {
  /** Độ giãn của cả đàn. Nhỏ hơn 1 là bó cụm hơn. */
  spreadMult: 1,
  /** Khe hở của hai cặp quyết định lúc về đích. Nhỏ hơn 1 là sát nút hơn. */
  gapMult: 1,
  /** Biên độ xáo trộn giữa các nhịp. Lớn hơn 1 là đổi ngôi nhiều hơn. */
  chaosMult: 1,
  /** Mức tăng tốc ở đoạn nước rút. */
  sprintMult: 1,
  /** Đẩy hạng cuối của kẻ dẫn đầu giả xuống sâu hơn. 0 là như cũ. */
  falseLeaderBias: 0,
};

/** Cờ trình diễn trung tính — trang đua đọc thẳng các cờ này. */
export const NEUTRAL_STAGE = {
  /**
   * Kiểu trời: id bảng màu ở tools/race/sky.mjs.
   *
   * Nó quyết định CẢ nền ngoài sân LẪN màu mặt cỏ, vì hai thứ đó là một — xem
   * chú thích ở đầu bảng SKIES. Mặc định là trời sáng: buổi trao thưởng nào
   * cũng giữa ban ngày, còn sân tối là biến thể chứ không phải mặc định.
   */
  sky: "ngay",
  /**
   * Lớp thời tiết vẽ chồng lên sân, trong toạ độ màn hình.
   *
   * Các giá trị hợp lệ nằm ở WEATHERS trong tools/race/sky.mjs; cửa ở
   * tools/race/sky-selftest.mjs canh đúng chỗ nối đó, nên gõ sai một cái tên ở
   * đây là hỏng ở khâu kiểm thử chứ không phải giữa buổi lễ.
   */
  weather: "khong",
  /** Hệ số biên độ rung máy quay ở khung va chạm. */
  shakeMult: 1,
  /** Hệ số số hạt bụi bốc lên sau chân chó. */
  dustMult: 1,
  /** Hệ số thời gian đóng băng ở khung va chạm. */
  freezeMult: 1,
  /** Bắn giấy màu khi công bố. */
  confetti: false,
  /** Vệt tốc độ sau lưng nhóm dẫn đầu ở đoạn nước rút. */
  streaks: false,
};

/**
 * Thư viện biến thể.
 *
 * `tag` phân loại nguồn gốc của sự khác biệt:
 *   "chuan"  — không đổi gì, luôn có mặt, trọng số cao nhất
 *   "nhip"   — đổi NHỊP kể chuyện (đường chạy khác, kết quả y nguyên)
 *   "canh"   — chỉ đổi phần nhìn và nghe, lớp đạo diễn không hề biết
 *
 * Biến thể `canh` an toàn về kết quả theo đúng nghĩa đen: chúng còn không được
 * truyền vào buildRace. Biến thể `nhip` thì có, nên chúng phải qua lại toàn bộ
 * cửa kịch tính — xem modes-selftest.mjs.
 */
export const MODES = [
  {
    id: "chuan",
    name: "Chuẩn",
    icon: "◆",
    tag: "chuan",
    weight: 4,
    blurb: "Nhịp kể chuyện gốc: kẻ dẫn đầu giả, hạng nhì cầm cờ, vượt ở giây cuối.",
    drama: {},
    stage: {},
  },
  {
    id: "bam_duoi",
    name: "Bám đuôi",
    icon: "⇉",
    tag: "nhip",
    weight: 3,
    blurb: "Cả đàn chạy thành một khối, ngôi đầu đổi liên tục tới tận mét cuối cùng.",
    drama: { spreadMult: 0.78, chaosMult: 1.35 },
    stage: { dustMult: 1.4 },
  },
  {
    id: "nghet_tho",
    name: "Nghẹt thở",
    icon: "▮",
    tag: "nhip",
    weight: 3,
    blurb: "Khe hở về đích siết còn một nửa. Phải xem lại băng mới biết ai thắng.",
    drama: { gapMult: 0.5, sprintMult: 1.4 },
    stage: { freezeMult: 1.35, shakeMult: 1.2, streaks: true },
  },
  {
    id: "bo_troi",
    name: "Bỏ trốn",
    icon: "➤",
    tag: "nhip",
    weight: 2,
    blurb: "Một chú bứt hẳn khỏi đàn từ sớm, dẫn một mạch — rồi sụp ở nhịp cuối.",
    drama: { falseLeaderBias: 2, chaosMult: 0.82, spreadMult: 1.12 },
    stage: { streaks: true },
  },
  {
    id: "dem_mua",
    name: "Đêm mưa",
    icon: "☂",
    tag: "canh",
    weight: 2,
    blurb: "Sân ướt dưới đèn pha. Không đổi một nhịp nào của cuộc đua.",
    drama: {},
    stage: { sky: "dem", weather: "mua", dustMult: 0.25 },
  },
  {
    id: "som_mai",
    name: "Sớm mai",
    icon: "☀",
    tag: "canh",
    weight: 2,
    blurb: "Nắng sớm xiên qua màn sương còn đọng trên mặt cỏ.",
    drama: {},
    stage: { sky: "binh_minh", weather: "suong", dustMult: 0.7 },
  },
  {
    id: "chieu_vang",
    name: "Chiều vàng",
    icon: "☘",
    tag: "canh",
    weight: 2,
    blurb: "Nắng cuối ngày đổ dài trên sân, gió cuốn lá bay ngang đường chạy.",
    drama: {},
    stage: { sky: "hoang_hon", weather: "la", dustMult: 1.2 },
  },
  {
    id: "tuyet_roi",
    name: "Tuyết rơi",
    icon: "❄",
    tag: "canh",
    weight: 2,
    blurb: "Tuyết phủ mờ mặt sân. Chỉ đổi phần nhìn, thứ hạng y nguyên.",
    drama: {},
    stage: { sky: "ngay", weather: "tuyet", dustMult: 0.35 },
  },
  {
    id: "phao_hoa",
    name: "Pháo hoa",
    icon: "✷",
    tag: "canh",
    weight: 2,
    blurb: "Bậc ăn mừng kéo lên hết cỡ: chớp mạnh, giấy màu, tiếng dày.",
    drama: {},
    stage: { confetti: true, shakeMult: 1.25, freezeMult: 1.2, dustMult: 1.3 },
  },
];

const MODE_BY_ID = new Map(MODES.map((m) => [m.id, m]));

export const modeById = (id) => MODE_BY_ID.get(id) || null;

/**
 * Gộp một danh sách biến thể thành một bộ núm duy nhất.
 *
 * Các hệ số NHÂN với nhau, các cờ lấy giá trị nào khác trung tính. Nhân thay vì
 * cộng vì đây là hệ số tỉ lệ: hai biến thể cùng siết độ giãn thì phải siết theo
 * tỉ lệ, còn cộng thì hai lần "−0.22" thành "−0.44" và đàn chó chồng lên nhau.
 *
 * Trần và sàn được kẹp cứng ở đây chứ không đặt niềm tin vào bảng dữ liệu: xếp
 * ba biến thể mạnh cùng lúc mà không kẹp thì độ giãn tụt xuống mức đàn chó nằm
 * đè lên nhau, và không cửa kiểm thử nào bắt được tổ hợp mà nó chưa từng thấy.
 */
export function mergeModes(ids) {
  const drama = { ...NEUTRAL_DRAMA };
  const stage = { ...NEUTRAL_STAGE };
  const chosen = [];

  for (const id of ids || []) {
    const m = MODE_BY_ID.get(id);
    if (!m) continue;
    chosen.push(m);
    for (const key of Object.keys(NEUTRAL_DRAMA)) {
      if (!(key in m.drama)) continue;
      drama[key] = key === "falseLeaderBias"
        ? drama[key] + m.drama[key]
        : drama[key] * m.drama[key];
    }
    for (const key of Object.keys(NEUTRAL_STAGE)) {
      if (!(key in m.stage)) continue;
      const v = m.stage[key];
      const neutral = NEUTRAL_STAGE[key];
      if (typeof v === "number" && typeof neutral === "number") stage[key] *= v;
      else stage[key] = v;
    }
  }

  drama.spreadMult = clampRange(drama.spreadMult, 0.6, 1.35);
  drama.gapMult = clampRange(drama.gapMult, 0.4, 1.6);
  drama.chaosMult = clampRange(drama.chaosMult, 0.7, 1.5);
  drama.sprintMult = clampRange(drama.sprintMult, 0.7, 1.6);
  drama.falseLeaderBias = Math.round(clampRange(drama.falseLeaderBias, 0, 3));
  stage.shakeMult = clampRange(stage.shakeMult, 0.5, 1.6);
  stage.dustMult = clampRange(stage.dustMult, 0, 2);
  stage.freezeMult = clampRange(stage.freezeMult, 0.8, 1.6);

  return { ids: chosen.map((m) => m.id), modes: chosen, drama, stage };
}

const clampRange = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Bốc biến thể cho một lượt quay, xác định theo seed.
 *
 * Xác định chứ không ngẫu nhiên theo đồng hồ, vì cùng một danh sách và cùng một
 * tên giải phải luôn cho ra đúng một cuộc đua — kể cả phần kể chuyện. Quản trò
 * chạy thử ở nhà rồi chạy thật trước cả phòng phải thấy y hệt nhau, nếu không
 * thì buổi chạy thử chẳng chứng minh được gì.
 *
 * Luồng ngẫu nhiên tách khỏi cả lớp xếp hạng lẫn lớp đạo diễn, nên thêm hay bớt
 * biến thể trong thư viện cũng không đổi được người thắng.
 */
export function pickModes(seedHex, count = 1) {
  const k = Math.max(0, Math.min(3, count | 0));
  if (k === 0) return mergeModes([]);

  const rng = makeRng(sha256HexOfString(seedHex + "|" + MODES_VERSION));
  const pool = MODES.slice();
  const picked = [];

  for (let i = 0; i < k && pool.length > 0; i++) {
    // Bốc theo trọng số bằng phép cộng dồn trên số nguyên. Không dùng số thực
    // vì cỗ máy công bằng chỉ cấp số nguyên đều — giữ nguyên tính tái tạo được.
    let total = 0;
    for (const m of pool) total += m.weight;
    let r = uniformBelow(rng, total);
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].weight;
      if (r < 0) break;
    }
    const m = pool[Math.min(idx, pool.length - 1)];
    picked.push(m.id);
    pool.splice(pool.indexOf(m), 1);

    // "Chuẩn" là biến thể của sự VẮNG MẶT, nên nó không xếp chồng được với cái
    // gì: bốc trúng nó ở lượt đầu thì lượt quay này chạy nhịp gốc, còn từ lượt
    // thứ hai trở đi nó bị gạt hẳn khỏi rổ. Bản đầu chỉ dừng khi bốc trúng nó ở
    // lượt đầu — bốc trúng ở lượt sau thì trang hiện ra "◆ Chuẩn · ☂ Đêm mưa",
    // một cái nhãn tự mâu thuẫn.
    if (m.id === "chuan") break;
    const plain = pool.findIndex((x) => x.id === "chuan");
    if (plain >= 0) pool.splice(plain, 1);
  }

  return mergeModes(picked);
}

/** Nhãn ngắn cho thanh trạng thái: "◆ Chuẩn · ☂ Đêm mưa". */
export function modeLabel(merged) {
  if (!merged.modes.length) return "";
  return merged.modes.map((m) => m.icon + " " + m.name).join(" · ");
}
