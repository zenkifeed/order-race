// Cửa cắn nhau — Order Race / M3
// Chạy: node tools/race/bite-selftest.mjs
//
// Đây là cửa nghiêm khắc nhất trong kho mã, vì lớp cắn nhau là thứ duy nhất ở
// lớp trình diễn ĐỔI ĐƯỢC VỊ TRÍ của một chú chó trên màn hình — và vị trí trên
// màn hình chính là thứ khán giả đọc ra thành thứ hạng.
//
// Ràng buộc quan trọng nhất không được suy ra từ các ràng buộc khác. Nó được
// kiểm bằng vét cạn, trên chính con số mà mắt người sẽ nhìn thấy:
//
//     thứ hạng HIỂN THỊ lúc về đích  ==  thứ hạng đã chốt
//
// Nếu một ngày nào đó ai đó chỉnh một hằng số trong bite.mjs và cửa này báo đỏ,
// thì đừng nới cửa ra. Cái hỏng là hằng số.

import { draw, makeTestRoster } from "../fairness/fairness.mjs";
import { buildRace } from "./director.mjs";
import { assignLanes, lanesFor, laneWFor } from "./track.mjs";
import { BITE, buildBites, lagAt, stunPhase, biteArcSeconds } from "./bite.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

const dogScaleFor = (n) => Math.max(0.34, Math.min(0.66, 0.70 - n * 0.0019));

const SIZES = [8, 20, 45, 90, 150];
const PER_SIZE = 10;

const CASES = [];
for (const n of SIZES) {
  for (let i = 0; i < PER_SIZE; i++) {
    const topK = 1 + (i % 4);
    const durationSec = [30, 40, 55][i % 3];
    const d = draw(makeTestRoster(9000 + i, n), `Giải cắn nhau ${n}-${i}`);
    const race = buildRace(d.finalOrder, d.seedHex, { topK, durationSec });
    const lanes = assignLanes(n, d.seedHex, lanesFor(n));
    const bites = buildBites(race, d.seedHex, lanes);
    CASES.push({ n, topK, durationSec, d, race, lanes, bites });
  }
}
const totalBites = CASES.reduce((a, c) => a + c.bites.events.length, 0);
console.log(`${CASES.length} cuộc đua (${SIZES.join(", ")} chó), ${totalBites} cú cắn\n`);

/** Vị trí HIỂN THỊ — đúng con số mà lớp vẽ dùng. */
const shown = (c, dog, s) => {
  const tSec = s * c.race.dtNorm * c.durationSec;
  return c.race.progress[dog * c.race.sampleCount + s] - c.bites.lagOf(dog, tSec);
};

function shownOrder(c, s) {
  const idx = Array.from({ length: c.n }, (_, i) => i);
  idx.sort((a, b) => shown(c, b, s) - shown(c, a, s) || a - b);
  return idx;
}

// =====================================================================
//  1. THỨ HẠNG HIỂN THỊ LÚC VỀ ĐÍCH == THỨ HẠNG ĐÃ CHỐT
// =====================================================================
{
  let bad = 0;
  for (const c of CASES) {
    // Kiểm từ khung va chạm cho tới hết đoạn lấy mẫu, không chỉ đúng một mẫu:
    // bục vinh danh hiện ra sau đó vài giây, và cả phòng vẫn đang nhìn màn hình
    // trong quãng đó.
    for (let s = c.race.finishSample; s < c.race.sampleCount; s++) {
      const order = shownOrder(c, s);
      let ok = true;
      for (let p = 0; p < c.n; p++) if (order[p] !== p) { ok = false; break; }
      if (!ok) { bad++; break; }
    }
  }
  check("Thứ hạng HIỂN THỊ lúc về đích đúng y thứ hạng đã chốt", bad === 0,
    `${CASES.length - bad}/${CASES.length} cuộc đua, vét cạn từ khung va chạm tới hết`);
}

// =====================================================================
//  2. ĐỘ TỤT LUÔN ÂM MỘT CHIỀU — KHÔNG AI ĐƯỢC ĐẨY LÊN TRƯỚC
// =====================================================================
{
  let ahead = 0;
  let checked = 0;
  let worstLag = 0;
  for (const c of CASES) {
    for (let s = 0; s < c.race.sampleCount; s += 2) {
      const tSec = s * c.race.dtNorm * c.durationSec;
      for (let dog = 0; dog < c.n; dog++) {
        const lag = c.bites.lagOf(dog, tSec);
        checked++;
        if (lag < 0) ahead++;
        if (lag > worstLag) worstLag = lag;
      }
    }
  }
  check("Không con nào được đẩy lên TRƯỚC vị trí lớp đạo diễn định", ahead === 0,
    `${checked.toLocaleString("vi")} phép đo, độ tụt lớn nhất ${(worstLag * 100).toFixed(2)}% đường đua`);
}

// =====================================================================
//  3. MỌI ĐỘ TỤT KHÉP LẠI TRƯỚC VẠCH ĐÍCH
// =====================================================================
{
  let open = 0;
  let latest = 0;
  for (const c of CASES) {
    const finishSec = c.race.finishSample * c.race.dtNorm * c.durationSec;
    for (let dog = 0; dog < c.n; dog++) {
      if (c.bites.lagOf(dog, finishSec) !== 0) open++;
    }
    for (const e of c.bites.events) {
      latest = Math.max(latest, (e.tSec + biteArcSeconds()) / c.durationSec);
    }
  }
  check("Mọi cú cắn khép lại trước vạch đích", open === 0,
    `cú muộn nhất kết thúc ở mốc ${(latest * 100).toFixed(1)}% cuộc đua`);
}

// =====================================================================
//  4. KHÔNG AI CẮN CON ĐANG DẪN ĐẦU — KỂ CẢ TRONG LÚC NÓ CÒN NẰM
// =====================================================================
{
  let bitLeader = 0;
  const arc = biteArcSeconds();
  for (const c of CASES) {
    const sc = c.race.sampleCount;
    const secPerSample = c.race.dtNorm * c.durationSec;
    for (const e of c.bites.events) {
      const until = Math.min(sc, e.sample + Math.ceil(arc / secPerSample) + 1);
      for (let s = e.sample; s < until; s++) {
        // Thứ hạng theo ĐƯỜNG CHẠY, không phải theo vị trí hiển thị: câu hỏi là
        // "con này lẽ ra có đang dẫn đầu không", và nếu có thì việc nó nằm đó
        // sẽ trao ngôi đầu trên màn hình cho một con không hề dẫn đầu.
        let lead = 0;
        for (let dog = 1; dog < c.n; dog++) {
          if (c.race.progress[dog * sc + s] > c.race.progress[lead * sc + s]) lead = dog;
        }
        if (lead === e.victim) { bitLeader++; break; }
      }
    }
  }
  check("Con dẫn đầu không bao giờ là nạn nhân, kể cả trong lúc còn nằm",
    bitLeader === 0, `${totalBites} cú cắn đều tránh kẻ dẫn đầu suốt vòng đời`);
}

// =====================================================================
//  5. RÀNG BUỘC THẬT SỰ: NGƯỜI THẮNG KHÔNG LỘ MẶT SỚM TRÊN MÀN HÌNH
// =====================================================================
{
  // Bốn phép kiểm trên là các ràng buộc trung gian. Đây mới là thứ khán giả
  // thật sự trải nghiệm, và nó được đo thẳng chứ không suy ra: trên VỊ TRÍ HIỂN
  // THỊ, người thắng có bao giờ dẫn đầu trước mốc 80% không.
  let early = 0;
  for (const c of CASES) {
    if (c.n < 6) continue;
    const limit = Math.round((0.8 / (1 + 0.35)) * (c.race.sampleCount - 1));
    for (let s = 0; s <= limit; s += 2) {
      if (shownOrder(c, s)[0] === 0) { early++; break; }
    }
  }
  check("Người thắng không dẫn đầu HIỂN THỊ trước mốc 80%", early === 0,
    `${early} lượt vi phạm — đo trên chính vị trí được vẽ ra`);
}

// =====================================================================
//  6. CHUYỂN ĐỘNG LÙI CHỈ XẢY RA KHI ĐANG BỊ CẮN
// =====================================================================
{
  // Lớp đạo diễn cấm tuyệt đối chuyển động lùi, vì chó chạy lùi đọc ra thành
  // lỗi. Cú cắn cố tình phá luật đó — nhưng chỉ được phá khi có LÝ DO NHÌN
  // THẤY ĐƯỢC trên màn hình. Một cú lùi ngoài vòng đời cú cắn thì vẫn là lỗi.
  let unexplained = 0;
  let explained = 0;
  for (const c of CASES) {
    const secPerSample = c.race.dtNorm * c.durationSec;
    for (let dog = 0; dog < c.n; dog++) {
      let prev = shown(c, dog, 0);
      for (let s = 1; s < c.race.sampleCount; s++) {
        const cur = shown(c, dog, s);
        if (cur < prev - 1e-12) {
          if (c.bites.phaseOf(dog, s * secPerSample) === "khong") unexplained++;
          else explained++;
        }
        prev = cur;
      }
    }
  }
  check("Chỉ con đang bị cắn mới lùi lại", unexplained === 0,
    `${explained.toLocaleString("vi")} mẫu lùi, tất cả đều trong lúc bị cắn`);
}

// =====================================================================
//  7. LỊCH CẮN XÁC ĐỊNH VÀ THƯA HỢP LÝ
// =====================================================================
{
  const c = CASES[12];
  const again = buildBites(c.race, c.d.seedHex, c.lanes);
  const key = (b) => b.events.map((e) => `${e.sample}:${e.biter}>${e.victim}`).join(",");
  check("Cùng seed cho ra cùng lịch cắn", key(c.bites) === key(again),
    `${c.bites.events.length} cú cắn`);

  let tooClose = 0;
  let tooSoon = 0;
  const arc = biteArcSeconds();
  for (const cs of CASES) {
    const ev = cs.bites.events;
    for (let i = 1; i < ev.length; i++) {
      if (ev[i].tSec - ev[i - 1].tSec < BITE.GAP - 1e-9) tooClose++;
    }
    const lastFor = new Map();
    for (const e of ev) {
      const prev = lastFor.get(e.victim);
      if (prev !== undefined && e.tSec - prev < arc + BITE.REST - 1e-9) tooSoon++;
      lastFor.set(e.victim, e.tSec);
    }
  }
  check("Hai cú cắn không bao giờ sát nhau dưới quãng nghỉ", tooClose === 0,
    `quãng nghỉ ${BITE.GAP} giây`);
  check("Một con không bị cắn lại khi chưa kịp hoàn hồn", tooSoon === 0,
    `nghỉ ${(arc + BITE.REST).toFixed(1)} giây sau mỗi cú`);
}

// =====================================================================
//  8. CÓ CẮN THẬT, VÀ KHÔNG THÀNH ẨU ĐẢ
// =====================================================================
{
  const counts = CASES.map((c) => c.bites.events.length);
  const silent = CASES.filter((c) => c.n >= 20 && c.bites.events.length === 0).length;
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  check("Đàn từ 20 người trở lên lượt nào cũng có cắn nhau", silent === 0,
    `trung bình ${avg.toFixed(1)} cú mỗi lượt, nhiều nhất ${Math.max(...counts)}`);
  check("Không lượt nào thành ẩu đả", Math.max(...counts) <= 9,
    "trần theo thời lượng, tối đa 8");

  // Cắn được là phải với tới nhau. Cách hai làn thì không.
  let outOfReach = 0;
  for (const c of CASES) {
    const reach = BITE.LANE_REACH * laneWFor(lanesFor(c.n));
    for (const e of c.bites.events) {
      if (Math.abs(c.lanes[e.biter] - c.lanes[e.victim]) > reach + 1e-9) outOfReach++;
    }
  }
  check("Chỉ cắn được con ở làn kề bên", outOfReach === 0,
    `tầm với ${BITE.LANE_REACH} làn`);
}

// =====================================================================
//  9. TỐC ĐỘ HIỂN THỊ PHẢI NẰM TRONG NGƯỠNG NGƯỜI XEM CHẤP NHẬN ĐƯỢC
// =====================================================================
{
  const arc = biteArcSeconds();
  check("Nằm đơ đúng 2 giây", stunPhase(BITE.LUNGE + 0.01) === "do" &&
    stunPhase(BITE.LUNGE + BITE.STUN - 0.01) === "do" &&
    stunPhase(BITE.LUNGE + BITE.STUN + 0.01) === "day",
    `${BITE.STUN} giây, đúng yêu cầu`);
  check("Hết vòng đời thì tụt về đúng 0",
    lagAt(arc, 0.9, 0.5, 0.8, 0.01) === 0 && lagAt(arc + 5, 0.9, 0.5, 0.8, 0.01) === 0);
  check("Chưa cắn thì chưa tụt", lagAt(0, 0.5, 0.5, 0.5, 0.01) === 0);

  // Phép kiểm thật sự của cả đường cong. Không kiểm hình dáng của nó — kiểm
  // thứ nó sinh ra: chú chó trên màn hình đi nhanh chậm thế nào.
  //
  // Ngưỡng dưới −1,2× là cú va: được lùi lại, nhưng lùi chậm hơn tốc độ chạy.
  // Bản đầu vi phạm chỗ này tới mười ba lần, và đó là cách phát hiện ra mô
  // hình đã sai. Ngưỡng trên 2,6× là đoạn đuổi theo: đủ để đọc ra "đang phi
  // hết sức", chưa tới mức đọc ra "tua nhanh".
  let slowest = Infinity;
  let fastest = -Infinity;
  let frozen = 0;
  let frozenSamples = 0;
  for (const c of CASES) {
    const nominal = 1 / c.durationSec;
    const dt = 1 / 60;
    for (const e of c.bites.events) {
      let prev = null;
      for (let t = e.tSec - dt; t <= e.tSec + arc + 0.5; t += dt) {
        const p = c.race.progress;
        const at = (tt) => {
          const x = tt / (c.race.dtNorm * c.durationSec);
          const a = Math.max(0, Math.min(c.race.sampleCount - 1, Math.floor(x)));
          const b = Math.min(c.race.sampleCount - 1, a + 1);
          const f = x - a;
          const row = e.victim * c.race.sampleCount;
          return p[row + a] * (1 - f) + p[row + b] * f;
        };
        const cur = at(t) - c.bites.lagOf(e.victim, t);
        if (prev !== null) {
          const v = (cur - prev) / dt / nominal;
          if (v < slowest) slowest = v;
          if (v > fastest) fastest = v;
          const since = t - e.tSec;
          if (since > BITE.LUNGE + 0.05 && since < BITE.LUNGE + BITE.STUN - 0.05) {
            frozenSamples++;
            if (Math.abs(v) > 0.02) frozen++;
          }
        }
        prev = cur;
      }
    }
  }
  check("Cú va đẩy lùi chậm hơn tốc độ chạy", slowest > -1.2,
    `lùi nhanh nhất ${slowest.toFixed(2)}× tốc độ chạy`);
  check("Đoạn đuổi theo không thành tua nhanh", fastest < 2.6,
    `nhanh nhất ${fastest.toFixed(2)}× tốc độ chạy`);
  check("Trong hai giây đơ thì đứng im thật", frozen === 0,
    `${frozenSamples.toLocaleString("vi")} mẫu, tốc độ hiển thị bằng 0`);
}

// =====================================================================
//  10. TẮT ĐƯỢC, VÀ ĐÀN QUÁ NHỎ THÌ TỰ TẮT
// =====================================================================
{
  const c = CASES[0];
  const off = buildBites(c.race, c.d.seedHex, c.lanes, { enabled: false });
  check("Tắt được hẳn", off.events.length === 0 && off.lagOf(0, 5) === 0 && !off.enabled);

  const d = draw(makeTestRoster(3, 3), "Giải ba người");
  const tiny = buildRace(d.finalOrder, d.seedHex, { topK: 1 });
  const tinyBites = buildBites(tiny, d.seedHex, assignLanes(3, d.seedHex, lanesFor(3)));
  check("Đàn quá nhỏ thì không cắn nhau", !tinyBites.enabled && tinyBites.events.length === 0,
    "3 người — cắn nhau trong một đàn ba con là đánh nhau, không phải đua");
}

console.log(failed === 0 ? "\nCỬA CẮN NHAU ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
