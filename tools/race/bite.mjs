// Lớp cắn nhau — Order Race / M3
//
// Chó cắn nhau để vượt lên. Con bị cắn trúng ngã ra, nằm quay đơ hai giây, rồi
// bò dậy đuổi theo. Thuần tuý cho vui.
//
// ============================================================================
//  VÌ SAO CÁI NÀY LÀ PHẦN NGUY HIỂM NHẤT CỦA CẢ KHO MÃ
// ============================================================================
//
// Mọi thứ khác ở lớp trình diễn chỉ đổi cách KỂ LẠI một kết quả đã chốt. Cái
// này thì đổi VỊ TRÍ của một chú chó trên màn hình — và vị trí trên màn hình
// chính là thứ khán giả đọc ra thành thứ hạng. Làm ẩu một chút là buổi lễ công
// bố một người, còn web/verify.html tính ra một người khác.
//
// Bốn ràng buộc, giữ bằng cấu trúc chứ không bằng lời hứa:
//
//   1. ĐỘ TỤT LUÔN ÂM, KHÔNG BAO GIỜ DƯƠNG. Con bị cắn tụt lại. Không con nào
//      được đẩy lên TRƯỚC vị trí mà lớp đạo diễn đã định cho nó. Cú vượt của
//      kẻ cắn là hệ quả của việc nạn nhân tụt, không phải một khoản thưởng.
//
//   2. MỌI ĐỘ TỤT VỀ 0 TRƯỚC VẠCH ĐÍCH. Lịch cắn từ chối mọi cú cắn mà vòng
//      đời của nó chưa kịp khép lại trước lúc chạm vạch. Nên thứ hạng về đích
//      trên màn hình luôn đúng bằng thứ hạng đã chốt.
//
//   3. KHÔNG AI ĐƯỢC CẮN CON ĐANG DẪN ĐẦU — kể cả con sẽ dẫn đầu trong lúc nó
//      còn đang nằm. Nếu kẻ dẫn đầu tụt lại thì con phía sau lên dẫn đầu trên
//      màn hình mà không hề dẫn đầu trong đường chạy, và ràng buộc "không lộ
//      người thắng trước mốc 80%" của lớp đạo diễn sập ngay tại đó.
//
//   4. LỊCH CẮN TÍNH SẴN TỪ ĐƯỜNG CHẠY, KHÔNG SINH RA LÚC CHẠY. Sinh theo từng
//      khung hình thì nó phụ thuộc nhịp khung hình của máy, và hai lần mở cùng
//      một seed sẽ ra hai cuộc đua khác nhau — mất luôn tính tái tạo được, thứ
//      mà cả dự án dựng lên để có.
//
// Cả bốn đều có cửa đo bằng máy ở tools/race/bite-selftest.mjs, và ràng buộc
// thật sự quan trọng — thứ hạng HIỂN THỊ lúc về đích đúng bằng thứ hạng đã
// chốt — được kiểm bằng vét cạn trên toàn bộ đường chạy, chứ không suy ra từ
// ba ràng buộc kia.

import { makeRng, uniformBelow } from "../fairness/fairness.mjs";
import { sha256HexOfString } from "../fairness/sha256.mjs";
import { TRACK_LEN } from "./track.mjs";

export const BITE_VERSION = "order-race/bite/v1";

export const BITE = {
  /** Giây: cú loạng choạng, nạn nhân tụt nhanh về sau. */
  LUNGE: 0.18,

  /** Giây NẰM ĐƠ. Con số này đến thẳng từ yêu cầu. */
  STUN: 2.0,

  /** Giây bò dậy và đuổi theo, cho tới khi về đúng vị trí lớp đạo diễn định. */
  RECOVER: 3.0,

  /**
   * Quãng LÙI LẠI của cú va, tính bằng GIÂY QUÃNG ĐƯỜNG bị mất.
   *
   * Đây là thứ duy nhất trong cả cú cắn thật sự đẩy con chó về phía sau. Phần
   * còn lại của độ tụt KHÔNG phải do bị đẩy — nó sinh ra từ việc con chó nằm im
   * trong khi cả đàn chạy tiếp, đúng như ngoài đời.
   *
   * Đơn vị này phải là GIÂY, không phải thân chó, và tôi đã sai hai lần trước
   * khi tới được chỗ đó:
   *
   *   lần 1  Đặt sẵn "độ tụt tối đa" rồi kéo con chó về đó trong 0,18 giây.
   *          Lùi nhanh gấp mười ba lần tốc độ chạy — teleport, không phải vấp.
   *   lần 2  Đổi sang tính theo thân chó. Vẫn lùi 6,2 lần tốc độ chạy, vì
   *          "một thân chó" chẳng liên quan gì tới việc chú chó đó chạy nhanh
   *          bao nhiêu. Ở cuộc đua 55 giây thì một thân chó là rất nhiều giây.
   *
   * Tính theo giây quãng đường thì tỉ lệ lùi trên tốc độ chạy là một hằng số ở
   * MỌI thời lượng đua: đỉnh 1,5 × 0,10 / 0,18 = 0,83 lần tốc độ chạy. Con chó
   * trượt về sau chậm hơn lúc nó đang chạy, đúng như một cú vấp.
   */
  KNOCK_LOST: 0.1,

  /** Giây giữa hai cú cắn bất kỳ. Thưa ra thì mỗi cú còn là một sự kiện. */
  GAP: 2.6,

  /** Giây một con được yên sau khi vòng đời cú cắn của nó khép lại. */
  REST: 6,

  /** Trước mốc này thì chưa cắn: cửa chuồng vừa bật, cả đàn còn đang bó cụm. */
  MIN_TN: 0.12,

  /** Biên an toàn thêm vào trước vạch đích, theo tỉ lệ thời lượng. */
  MARGIN_TN: 0.04,

  /** Hai con phải ở làn kề nhau mới cắn được — cách hai làn thì với không tới. */
  LANE_REACH: 1.35,
};

/** Tổng thời gian một vòng đời cú cắn, tính bằng giây. */
export const biteArcSeconds = () => BITE.LUNGE + BITE.STUN + BITE.RECOVER;

// Tên riêng thay vì "smoothstep": director.mjs cũng khai báo một cái, và các
// file nguồn được nối vào CHUNG một phạm vi khi dựng trang. Bộ dựng chặn được
// va chạm đó ngay lúc dựng, nhưng lỗi này thì đổi tên rẻ hơn là để nó xảy ra.
const biteEase = (u) => u * u * (3 - 2 * u);

/**
 * Độ tụt của nạn nhân, tính TỪ CHÍNH ĐƯỜNG CHẠY.
 *
 * Đây là chỗ quan trọng nhất của cả module, và bản đầu làm sai.
 *
 * Bản đầu đặt sẵn "độ tụt tối đa" rồi kéo con chó về đó trong 0,18 giây. Kết
 * quả là nó bị GIẬT NGƯỢC nhanh gấp mười ba lần tốc độ chạy — không phải một
 * cú vấp ngã, mà là một cú teleport. Cửa kiểm thử bắt được, và cái hỏng là mô
 * hình chứ không phải hằng số.
 *
 * Mô hình đúng thì ngược chiều: KHÔNG đặt trước độ tụt. Con chó bị va thì lùi
 * lại đúng một quãng ngắn, rồi ĐỨNG IM — và độ tụt lớn dần lên hoàn toàn vì cả
 * đàn vẫn đang chạy. Hai giây sau, độ tụt đúng bằng quãng đường mà lớp đạo diễn
 * đã cho nó đi trong hai giây đó. Không con số nào phải bịa ra, và cú đơ đọc ra
 * đúng như một cú đơ vì nó thật sự đứng yên trên màn hình.
 *
 * @param since        giây kể từ cú cắn
 * @param traceNow     vị trí đường chạy hiện tại của nạn nhân
 * @param trace0       vị trí đường chạy lúc bị cắn
 * @param traceWake    vị trí đường chạy tại đúng lúc hết nằm
 * @param knock        quãng lùi lại của cú va, theo tỉ lệ đường đua
 */
export function lagAt(since, traceNow, trace0, traceWake, knock) {
  if (since <= 0) return 0;
  if (since < BITE.LUNGE) {
    return traceNow - trace0 + knock * biteEase(since / BITE.LUNGE);
  }
  if (since < BITE.LUNGE + BITE.STUN) {
    // Đứng im tuyệt đối: vị trí hiển thị đóng băng ở trace0 - knock.
    return traceNow - trace0 + knock;
  }
  const u = (since - BITE.LUNGE - BITE.STUN) / BITE.RECOVER;
  if (u >= 1) return 0;
  // Đuổi theo bằng smoothstep, không phải tuyến tính. Tuyến tính thì con chó
  // lao đi ở tốc độ tối đa ngay khi vừa dậy rồi phanh khựng lúc bắt kịp — hai
  // đầu đều là bậc nhảy của vận tốc, thứ đọc ra y hệt một cú rớt khung hình.
  return (traceWake - trace0 + knock) * (1 - biteEase(u));
}

/** Giây để bò dậy, tính từ lúc hết nằm. Ngắn hơn cả đoạn đuổi theo. */
const GETUP = 0.45;

/** Góc ngã tối đa, radian. Gần 80 độ — nằm nghiêng, không phải nằm sấp. */
const FALL = -1.38;

/**
 * Góc nghiêng của con đang bị cắn.
 *
 * Ngã nhanh, nằm im, dậy chậm hơn một chút. Ngã và dậy cùng tốc độ thì đọc ra
 * như một vòng lặp hoạt hình chứ không như một tai nạn: cái làm nó thành tai
 * nạn là chuyện xảy ra nhanh hơn chuyện hồi phục.
 *
 * Hàm này ở đây chứ không ở lớp vẽ vì nó kiểm thử được, và vì nó phải khớp
 * từng mốc thời gian với đường cong độ tụt ngay bên trên — chú chó phải nằm
 * xuống đúng lúc nó đứng im và đứng dậy đúng lúc nó bắt đầu đuổi theo.
 */
export function tiltAt(since) {
  if (since <= 0) return 0;
  if (since < BITE.LUNGE) {
    const u = since / BITE.LUNGE;
    return FALL * (1 - (1 - u) * (1 - u));
  }
  const wake = since - BITE.LUNGE - BITE.STUN;
  if (wake <= 0) return FALL;
  if (wake >= GETUP) return 0;
  const u = wake / GETUP;
  return FALL * (1 - biteEase(u));
}

/** Giai đoạn của nạn nhân: "khong" | "nga" | "do" | "day". */
export function stunPhase(sinceSec) {
  if (sinceSec <= 0) return "khong";
  if (sinceSec < BITE.LUNGE) return "nga";
  if (sinceSec < BITE.LUNGE + BITE.STUN) return "do";
  if (sinceSec < biteArcSeconds()) return "day";
  return "khong";
}

/**
 * Dựng lịch cắn cho trọn một cuộc đua.
 *
 * @param race      kết quả buildRace
 * @param seedHex   seed xếp hạng — luồng ngẫu nhiên ở đây tách hẳn khỏi nó
 * @param lanes     độ lệch làn của từng con
 */
export function buildBites(race, seedHex, lanes, options = {}) {
  const n = race.n;
  const durationSec = race.durationSec;
  const events = [];
  const perDog = [];
  for (let i = 0; i < n; i++) perDog.push([]);

  const knock = BITE.KNOCK_LOST / durationSec;
  const arc = biteArcSeconds();
  const sc = race.sampleCount;
  const secPerSample = race.dtNorm * durationSec;

  /** Vị trí đường chạy của một con tại một giây bất kỳ, nội suy giữa hai mẫu. */
  const traceAt = (dog, tSec) => {
    const x = tSec / secPerSample;
    const a = x < 0 ? 0 : x > sc - 1 ? sc - 1 : Math.floor(x);
    const b = a + 1 < sc ? a + 1 : sc - 1;
    const f = x - a;
    const row = dog * sc;
    return race.progress[row + a] * (1 - f) + race.progress[row + b] * f;
  };

  /**
   * Tầm với, suy ra từ CHÍNH mảng làn thay vì từ một hằng số.
   *
   * Bản đầu nhân tầm với cho 46 — bề rộng làn lớn nhất có thể — nên ở đàn 150,
   * nơi làn chỉ rộng 27 đơn vị, "một làn kề bên" hoá ra thành hai làn rưỡi. Cửa
   * kiểm thử bắt được. Đo lại từ dữ liệu thật thì không có cách nào lệch.
   */
  let laneW = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.abs(lanes[i] - lanes[j]);
      if (d > 1e-9 && d < laneW) laneW = d;
    }
  }
  if (!Number.isFinite(laneW)) laneW = 26;
  const reach = BITE.LANE_REACH * laneW;

  // Mốc muộn nhất được phép cắn: vòng đời phải khép lại TRƯỚC vạch đích, cộng
  // một biên an toàn. Với cuộc đua 40 giây thì mốc này rơi vào khoảng 87%.
  const lastTn = 1 - arc / durationSec - BITE.MARGIN_TN;

  const enabled = options.enabled !== false && n >= 4 && lastTn > BITE.MIN_TN + 0.05;
  const result = {
    version: BITE_VERSION,
    events,
    knock,
    lastTn,
    enabled,

    /** Độ tụt hiển thị của một con tại một thời điểm. Luôn ≥ 0. */
    lagOf(dog, tSec) {
      const list = perDog[dog];
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        const since = tSec - e.tSec;
        if (since < 0) continue;
        if (since >= arc) break;
        return lagAt(since, traceAt(dog, tSec), e.trace0, e.traceWake, knock);
      }
      return 0;
    },

    /** Giai đoạn của một con, để lớp vẽ biết vẽ nằm hay vẽ đứng. */
    phaseOf(dog, tSec) {
      const list = perDog[dog];
      for (let i = list.length - 1; i >= 0; i--) {
        const since = tSec - list[i].tSec;
        if (since < 0) continue;
        if (since >= arc) break;
        return stunPhase(since);
      }
      return "khong";
    },

    /** Số giây tính từ cú cắn gần nhất còn hiệu lực, hoặc -1. */
    sinceOf(dog, tSec) {
      const list = perDog[dog];
      for (let i = list.length - 1; i >= 0; i--) {
        const since = tSec - list[i].tSec;
        if (since < 0) continue;
        if (since >= arc) break;
        return since;
      }
      return -1;
    },
  };

  if (!enabled) return result;

  // Luồng ngẫu nhiên RIÊNG, dẫn xuất từ seed nhưng tách hẳn khỏi cả lớp xếp
  // hạng lẫn lớp đạo diễn. Chỉnh tham số cắn nhau không đổi được người thắng,
  // và cũng không đổi được đường chạy.
  const rng = makeRng(sha256HexOfString(seedHex + "|" + BITE_VERSION));

  const step = Math.max(1, Math.round(0.2 / secPerSample));
  const arcSamples = Math.ceil(arc / secPerSample);

  const maxBites = Math.min(options.maxBites ?? 8, Math.max(2, Math.round(durationSec / 6)));
  const busyUntil = new Float64Array(n).fill(-Infinity);
  let lastBiteAt = -Infinity;

  // Bảng thứ hạng theo đường chạy, dựng lại tại mỗi mẫu được xét. Dùng đường
  // chạy chứ không dùng vị trí hiển thị: lịch cắn phải tính được TRƯỚC khi
  // biết độ tụt, nếu không thì nó tự tham chiếu vào chính mình.
  const scratch = new Int32Array(n);
  const posAt = (dog, s) => race.progress[dog * sc + s];
  const rankAt = (s) => {
    for (let i = 0; i < n; i++) scratch[i] = i;
    Array.prototype.sort.call(scratch, (a, b) => posAt(b, s) - posAt(a, s) || a - b);
    return scratch;
  };

  const back = Math.max(1, Math.round(0.5 / secPerSample));

  for (let s = back; s < sc && events.length < maxBites; s += step) {
    const tSec = s * secPerSample;
    const tn = tSec / durationSec;
    if (tn < BITE.MIN_TN) continue;
    if (tn > lastTn) break;
    if (tSec - lastBiteAt < BITE.GAP) continue;

    const order = rankAt(s);
    const leader = order[0];

    // Tìm những cặp VỪA THẬT SỰ VƯỢT NHAU trong nửa giây qua. Cú cắn là lời
    // giải thích cho một cú vượt vốn đã sắp xảy ra, không phải nguyên nhân tạo
    // ra nó — nên nó không bịa thêm chuyển động nào mà đường chạy chưa có.
    let pickBiter = -1;
    let pickVictim = -1;
    let seen = 0;

    for (let p = 1; p < n; p++) {
      const a = order[p - 1];
      const b = order[p];
      if (b === leader || a === leader) continue;
      if (posAt(a, s - back) >= posAt(b, s - back)) continue;          // chưa đổi chỗ
      if (Math.abs(lanes[a] - lanes[b]) > reach) continue;
      if (tSec < busyUntil[b] || tSec < busyUntil[a]) continue;

      // Nạn nhân không được lên dẫn đầu TRONG LÚC còn đang nằm. Đây là ràng
      // buộc số 3, và nó phải nhìn TỚI TRƯỚC chứ không chỉ nhìn hiện tại: một
      // con đang hạng ba lúc bị cắn hoàn toàn có thể lên hạng nhất ở giây thứ
      // hai của cú đơ, và lúc đó con phía sau lên dẫn đầu trên màn hình mà
      // không hề dẫn đầu trong đường chạy.
      let leads = false;
      for (let k = s; k < Math.min(sc, s + arcSamples); k += step) {
        if (rankAt(k)[0] === b) { leads = true; break; }
      }
      if (leads) continue;

      // Bốc đều trong số các cặp hợp lệ bằng phép lấy mẫu hồ chứa, để không
      // phải dựng thêm một mảng nào trên đường quét.
      seen++;
      if (uniformBelow(rng, seen) === 0) { pickBiter = a; pickVictim = b; }
    }

    if (pickVictim < 0) continue;
    // Một phần ba số cơ hội bị bỏ qua: nếu cú vượt nào cũng kèm một cú cắn thì
    // cắn nhau thành luật vật lý của cuộc đua chứ không còn là chuyện bất ngờ.
    if (uniformBelow(rng, 3) === 0) continue;

    const ev = {
      sample: s, tSec, tn, biter: pickBiter, victim: pickVictim,
      // Chốt sẵn hai mốc đường chạy mà đường cong tụt cần. Tính sẵn ở đây chứ
      // không tra lúc vẽ: lúc vẽ là đường đi nóng, còn ở đây là một lần duy nhất.
      trace0: traceAt(pickVictim, tSec),
      traceWake: traceAt(pickVictim, tSec + BITE.LUNGE + BITE.STUN),
    };
    events.push(ev);
    perDog[pickVictim].push(ev);
    busyUntil[pickVictim] = tSec + arc + BITE.REST;
    busyUntil[pickBiter] = tSec + BITE.GAP;
    lastBiteAt = tSec;
  }

  return result;
}
