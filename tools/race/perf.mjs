// Đường đi nóng của một khung hình — Order Race / M2
//
// Cửa hiệu năng ở GDD §11 đòi 150 chú chó giữ p99 dưới 20 ms. Trên bản web,
// chi phí một khung hình chia làm hai nửa:
//
//   nửa CPU     nội suy vị trí, xếp hạng, chiếu ra toạ độ màn hình, cắt bớt
//   nửa vẽ      số lệnh drawImage gửi xuống canvas
//
// Module này giữ CẢ HAI nửa, vì cách duy nhất để hạ nửa thứ hai là quyết định
// đúng ở nửa thứ nhất: con nào nằm ngoài khung hình thì không vẽ.
//
// Ba việc, kèm ĐÓNG GÓP ĐO ĐƯỢC của từng việc — con số lấy từ chính
// tools/race/perf-selftest.mjs, không phải từ trực giác:
//
//   1. KHÔNG CẤP PHÁT   pointAt sinh một đối tượng cho mỗi con mỗi khung, tức
//                       9 000 đối tượng rác mỗi giây ở đàn 150. Chúng chết
//                       ngay trong khung, nhưng bộ dọn rác thu chúng theo đợt
//                       — và một đợt rơi đúng giây cuối là một khung hình rớt
//                       đúng khoảnh khắc quan trọng nhất buổi lễ.
//
//   2. SẮP CHÈN         Thứ hạng khung này gần trùng khít khung trước. Sắp chèn
//                       trên dữ liệu gần đúng sẵn chạy tuyến tính.
//
//   3. CẮT BỚT          Khoản này NHỎ HƠN NHIỀU so với tôi tưởng lúc bắt đầu.
//                       Ở máy chiếu 1080p mức phóng 1,45× thì cả sân lọt trong
//                       khung hình và không có gì để cắt — 1% số con. Nó chỉ
//                       lãi trên màn hình laptop và trong pha về đích, lúc máy
//                       quay siết vào 1,9×. Giữ lại vì hai chỗ đó có thật, và
//                       vì cái giá phải trả bằng không.
//
// Hai việc đầu gộp lại làm nửa CPU nhanh gấp đôi. Nhưng cả nửa CPU chỉ tốn
// 0,014 ms ở đàn 150 — nó CHƯA BAO GIỜ là chỗ nghẽn. Chỗ nghẽn nằm ở nửa vẽ,
// và khoản lãi lớn nhất của cả đợt tối ưu này nằm ở tools/race/stage.mjs: cái
// sân tĩnh được nướng sẵn, thay vì tô lại 77 lệnh mỗi khung hình.

import { pointAtInto } from "./track.mjs";

/**
 * Sắp xếp thứ hạng giảm dần theo vị trí, sắp CHÈN tại chỗ.
 *
 * Vì sao không dùng Array.prototype.sort: thứ hạng ở khung hình này gần như
 * trùng khít khung hình trước — trong 40 giây đua chỉ có chừng 4,5 lần đổi ngôi
 * đầu, và cả đàn hầu như giữ nguyên thứ tự tương đối giữa hai khung cách nhau
 * 16 ms. Sắp chèn trên dữ liệu gần đúng sẵn chạy tuyến tính; sort tổng quát thì
 * luôn trả đủ giá cho trường hợp xấu nhất.
 *
 * PHẢI so sánh y hệt bản cũ — giảm dần theo vị trí, hoà thì chỉ số nhỏ đứng
 * trước — nếu không thì hai chú chó ngang nhau sẽ đổi chỗ qua lại mỗi khung và
 * cả cụm biển tên nhấp nháy. Đúng lỗi mà tools/web/labels-selftest.mjs canh.
 */
export function sortRankDesc(order, pos, n) {
  for (let i = 1; i < n; i++) {
    const v = order[i];
    const pv = pos[v];
    let j = i - 1;
    while (j >= 0) {
      const u = order[j];
      const pu = pos[u];
      if (pu > pv || (pu === pv && u < v)) break;
      order[j + 1] = u;
      j--;
    }
    order[j + 1] = v;
  }
  return order;
}

/**
 * Biên an toàn khi cắt bớt, tính bằng đơn vị sân.
 *
 * Một chú chó là điểm neo ở giữa thân, nhưng sprite của nó trải ra hai bên và
 * còn có biển tên treo dưới chân. Cắt đúng ở mép khung hình thì con đang nửa
 * trong nửa ngoài sẽ biến mất cả con — đọc ra thành nhấp nháy ở rìa màn hình,
 * thứ tệ hơn hẳn cái giá của vài lệnh vẽ thừa.
 *
 * Biên phải suy ra từ CỠ VẼ THẬT chứ không phải một con số cho tròn. Đàn 150
 * con vẽ ở 0,34× nên chỗ rộng nhất của một model — cái biển tên, không phải cái
 * thân — chỉ chiếm 59 đơn vị. Lấy chung một biên đủ rộng cho đàn 8 con thì đàn
 * đông phải gánh một vành đệm rộng gấp đôi mức cần, và đó đúng là chỗ mà cắt
 * bớt lẽ ra phải lãi nhất.
 *
 * 190 là bề ngang tối đa của biển tên trong tools/web/dog.mjs; 34 là nửa chiều
 * cao model cộng phần biển tên treo dưới chân, làm tròn lên.
 */
export const cullMarginFor = (dogScale) => 190 * dogScale * 0.5 + 34;

/** Biên mặc định, dùng khi chưa biết cỡ vẽ. Bằng mức của đàn nhỏ nhất. */
export const CULL_MARGIN = cullMarginFor(0.66);

/**
 * Nửa chiều rộng và nửa chiều cao của khung hình, tính bằng đơn vị sân.
 *
 * Tỉ lệ điểm ảnh của màn hình TRIỆT TIÊU: canvas rộng `clientWidth * dpr` điểm
 * ảnh và ma trận vẽ nhân `dpr * zoom`, nên vùng nhìn thấy chỉ phụ thuộc mức
 * phóng. Nhờ vậy quyết định cắt bớt giống hệt nhau trên màn hình thường và màn
 * hình Retina — nếu không thì lỗi cắt nhầm chỉ hiện ra trên một loại máy.
 */
export function viewHalfExtent(clientW, clientH, zoom, dogScale) {
  return {
    halfW: clientW / (2 * zoom),
    halfH: clientH / (2 * zoom),
    margin: dogScale === undefined ? CULL_MARGIN : cullMarginFor(dogScale),
  };
}

/** Bộ đệm của một cuộc đua. Cấp phát MỘT LẦN lúc bắt đầu lượt, không phải mỗi khung. */
export function makeFrameState(n) {
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  return {
    n,
    pos: new Float64Array(n),
    order,
    px: new Float64Array(n),
    py: new Float64Array(n),
    pa: new Float64Array(n),
    /** Chỉ số các con còn nằm trong khung hình, theo thứ tự vẽ (xa → gần). */
    vis: new Int32Array(n),
    visCount: 0,
    camX: 0,
    camY: 0,
    scratch: { x: 0, y: 0, a: 0 },
  };
}

/**
 * Tính trọn một khung hình: vị trí, thứ hạng, máy quay, toạ độ, cắt bớt.
 *
 * @param fs      bộ đệm từ makeFrameState
 * @param race    kết quả buildRace
 * @param tn      thời điểm, theo tỉ lệ thời lượng đua (1.0 là lúc chạm vạch)
 * @param lanes   độ lệch làn của từng con
 * @param view    { halfW, halfH } từ viewHalfExtent
 * @param bites   lịch cắn nhau từ buildBites, hoặc null
 */
export function stepFrame(fs, race, tn, lanes, view, bites) {
  const n = fs.n;
  const pos = fs.pos;
  const sc = race.sampleCount;

  // --- Vị trí liên tục, nội suy giữa hai mẫu. Làm tròn về mẫu gần nhất là lỗi
  //     lấy mẫu đã từng làm đàn chó nhảy giữa các ô lúc chạy chậm — xem GDD §5.
  const x = tn / race.dtNorm;
  const a = x < 0 ? 0 : x > sc - 1 ? sc - 1 : Math.floor(x);
  const b = a + 1 < sc ? a + 1 : sc - 1;
  const f = x - a;
  const prog = race.progress;
  for (let dog = 0; dog < n; dog++) {
    const row = dog * sc;
    pos[dog] = prog[row + a] * (1 - f) + prog[row + b] * f;
  }

  // Độ tụt của con đang nằm đơ. Trừ SAU khi nội suy và TRƯỚC khi xếp hạng, nên
  // mọi thứ phía sau — thứ hạng, bảng bên phải, biển tên, bộ canh nhịp — đều
  // đọc cùng một vị trí với thứ mắt người nhìn thấy. Nếu bảng xếp hạng đọc
  // đường chạy còn màn hình vẽ vị trí hiển thị thì hai bên nói khác nhau ngay
  // giữa lúc cả phòng đang nhìn.
  //
  // Độ tụt luôn KHÔNG ÂM và luôn về 0 trước vạch đích, nên thứ hạng về đích
  // hiển thị vẫn đúng bằng thứ hạng đã chốt — xem tools/race/bite.mjs.
  if (bites && bites.enabled) {
    const tSec = tn * race.durationSec;
    for (let dog = 0; dog < n; dog++) pos[dog] -= bites.lagOf(dog, tSec);
  }

  sortRankDesc(fs.order, pos, n);

  // --- Máy quay bám nhóm dẫn đầu, kéo lùi lại một chút để thấy cả tốp bám sau.
  const order = fs.order;
  const lead = pos[order[0]];
  const back = pos[order[n > 8 ? 7 : n - 1]];
  const camAt = lead - (lead - back) * 0.45;
  const cam = pointAtInto(fs.scratch, camAt, 0);
  fs.camX = cam.x;
  fs.camY = cam.y;

  // --- Chiếu ra toạ độ sân rồi cắt bớt phần nằm ngoài khung hình.
  const margin = view.margin ?? CULL_MARGIN;
  const limX = view.halfW + margin;
  const limY = view.halfH + margin;
  const px = fs.px, py = fs.py, pa = fs.pa, vis = fs.vis;
  const pt = fs.scratch;
  let visCount = 0;

  // Duyệt từ hạng bét lên hạng nhất, để con dẫn đầu được vẽ SAU CÙNG và nằm
  // trên cùng. Cùng thứ tự với bản trước — đây là thứ tự chồng lớp, không phải
  // chuyện hiệu năng, và đổi nó thì người thắng bị con về bét che mất.
  for (let p = n - 1; p >= 0; p--) {
    const dog = order[p];
    const clamped = pos[dog] < 1.03 ? pos[dog] : 1.03;
    pointAtInto(pt, clamped, lanes[dog]);
    px[dog] = pt.x;
    py[dog] = pt.y;
    pa[dog] = pt.a;
    const dx = pt.x - fs.camX;
    const dy = pt.y - fs.camY;
    if (dx > -limX && dx < limX && dy > -limY && dy < limY) vis[visCount++] = dog;
  }
  fs.visCount = visCount;
  return fs;
}
