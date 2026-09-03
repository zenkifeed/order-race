// Cửa chạy thật của trang đua — Order Race / M2
// Chạy: node tools/race/check-race-runtime.mjs
//
// tools/race/check-race-page.mjs BIÊN DỊCH mã của trang. Nó không CHẠY nó.
// Khoảng cách giữa hai việc đó là toàn bộ nhóm lỗi khó chịu nhất: một tên gọi
// trước khi khai báo, một thuộc tính đọc trên null, một hàm đổi chữ ký mà chỗ
// gọi thì chưa đổi. Tất cả đều biên dịch sạch sẽ, và tất cả đều làm trang chết
// trắng ở khung hình đầu tiên.
//
// Cửa này dựng một trình duyệt giả vừa đủ — DOM giả, canvas giả đếm lệnh vẽ,
// đồng hồ giả, requestAnimationFrame do mình cầm nhịp — rồi CHẠY chính khối mã
// của trang: bấm nút xuất phát, quay đủ một cuộc đua từ đếm ngược tới bục vinh
// danh, ở mọi biến thể.
//
// Nó không thay được việc mở trang bằng mắt: nó không biết cái gì đẹp, cũng
// không biết cái gì hồi hộp. Nó chỉ bảo đảm một điều mà mắt người không kiểm
// nổi trên mọi tổ hợp — trang không văng lỗi ở bất kỳ khung hình nào.

import { readFileSync } from "node:fs";
import vm from "node:vm";
import { MODES } from "./modes.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

// =====================================================================
//  Trình duyệt giả
// =====================================================================

/**
 * Ngữ cảnh canvas 2D giả: nhận mọi lệnh, đếm lại, không vẽ gì.
 *
 * Dùng Proxy chứ không liệt kê tên hàm. Bản đầu liệt kê hai chục cái tên và
 * trượt ngay ở lần chạy đầu vì tools/web/dog.mjs gọi quadraticCurveTo — một
 * hàm tôi không nghĩ tới. Liệt kê tay thì cửa này lại trở thành thứ phải bảo
 * trì mỗi lần ai đó vẽ một nét mới, và nó sẽ trượt theo kiểu tệ nhất: báo hỏng
 * trong khi trang thật vẫn chạy tốt.
 */
function fakeCtx(tally) {
  const store = {};
  return new Proxy(store, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === "measureText") {
        return (s) => {
          tally.measureText = (tally.measureText || 0) + 1;
          return { width: String(s).length * 7 };
        };
      }
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => ({ addColorStop() {} });
      }
      if (prop === "canvas") return { width: 3840, height: 1960 };
      if (typeof prop !== "string") return undefined;
      return (...args) => {
        tally[prop] = (tally[prop] || 0) + 1;
        return args.length ? undefined : undefined;
      };
    },
    set(t, prop, v) { t[prop] = v; return true; },
    has() { return true; },
  });
}

function fakeElement(id, tally) {
  const el = {
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    title: "",
    href: "",
    width: 0,
    height: 0,
    clientWidth: 1920,
    clientHeight: 980,
    style: {},
    dataset: {},
    _handlers: new Map(),
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener(type, fn) {
      if (!el._handlers.has(type)) el._handlers.set(type, []);
      el._handlers.get(type).push(fn);
    },
    removeEventListener() {},
    dispatch(type, ev = {}) {
      for (const fn of el._handlers.get(type) || []) fn({ preventDefault() {}, ...ev });
    },
    focus() {},
    blur() {},
    insertAdjacentHTML() {},
    appendChild() {},
    getContext: () => fakeCtx(tally),
    getBoundingClientRect: () => ({ width: 1920, height: 980, left: 0, top: 0 }),
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  return el;
}

function makeBrowser() {
  const tally = {};
  const els = new Map();
  const get = (id) => {
    if (!els.has(id)) els.set(id, fakeElement(id, tally));
    return els.get(id);
  };

  let clockMs = 0;
  const rafQueue = [];

  // Canvas nướng ngầm có bộ đếm RIÊNG.
  //
  // Bản đầu dùng chung một bộ đếm cho tất cả, và phép kiểm "có con nào bị cắn
  // ngã không" — đếm số lần gọi arc() — báo dương tính ngay cả ở đàn ba người,
  // nơi lớp cắn nhau đã tự tắt. Thủ phạm là tools/web/dog.mjs: nướng sprite
  // cũng gọi arc(). Một phép đếm gộp cả hai nguồn thì không chứng minh được
  // điều nó tuyên bố, và một phép kiểm như vậy còn tệ hơn là không có.
  const offTally = {};

  const doc = {
    getElementById: get,
    createElement: () => fakeElement("(nướng ngầm)", offTally),
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    body: fakeElement("body", tally),
    documentElement: fakeElement("html", tally),
  };

  const win = {
    devicePixelRatio: 2,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    AudioContext: undefined,
    innerWidth: 1920,
    innerHeight: 980,
  };

  const sandbox = {
    window: win,
    document: doc,
    navigator: { vibrate: () => true },
    // protocol phải có thật: sound.mjs đọc nó để quyết định có đi tìm
    // music/playlist.json không. "file:" là đúng trạng thái mặc định — trang
    // được tải về rồi mở thẳng, không qua web server nào.
    location: { hash: "", href: "", protocol: "file:" },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    performance: { now: () => clockMs },
    // Trang gọi addEventListener trần, tức là gọi trên window. Trong một vm
    // context thì phải cấp nó ở cấp cao nhất, đúng như trình duyệt làm.
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame() {},
    setTimeout: () => 0,
    clearTimeout() {},
    // Không có mạng và không có nhạc: đúng trạng thái của một máy mở trang bằng
    // file:// với thư mục music/ trống, tức là trạng thái mặc định.
    fetch: () => Promise.reject(new Error("không có mạng")),
    Audio: function () { return { play: () => Promise.resolve(), pause() {}, addEventListener() {}, volume: 1, currentTime: 0 }; },
    console,
    Math,
    TextEncoder,
    JSON,
    Set, Map, Array, Object, String, Number, Boolean, Error, Promise, Date,
    Float32Array, Float64Array, Int32Array, Uint8Array, Uint32Array,
    isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  Object.assign(win, { document: doc });

  return {
    sandbox,
    tally,
    offTally,
    el: get,
    /** Cho đồng hồ chạy tiếp và gọi hết các khung hình đang xếp hàng. */
    tick(ms) {
      clockMs += ms;
      const due = rafQueue.splice(0, rafQueue.length);
      for (const fn of due) fn(clockMs);
      return due.length;
    },
    pending: () => rafQueue.length,
    now: () => clockMs,
  };
}

// =====================================================================
//  Chạy trọn một cuộc đua
// =====================================================================
const html = readFileSync("web/race.html", "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

/**
 * @param modeValue  giá trị của ô chọn biến thể
 * @param roster     danh sách người tham gia
 * @returns { frames, tally, phaseSeen, error }
 */
function runRace(modeValue, roster, durationSec = 40) {
  const br = makeBrowser();
  const result = { frames: 0, tally: br.tally, error: null, podium: false, drawn: 0, variant: "" };

  try {
    vm.createContext(br.sandbox);
    new vm.Script(script, { filename: "race.html" }).runInContext(br.sandbox);
  } catch (e) {
    result.error = "lúc nạp trang: " + e.message;
    return result;
  }

  br.el("roster").value = roster.join("\n");
  br.el("n").value = String(roster.length);
  br.el("k").value = "3";
  br.el("dur").value = String(durationSec);
  br.el("prize").value = "Giải kiểm tra chạy thật";
  br.el("mode").value = modeValue;

  try {
    br.el("go").dispatch("click");
  } catch (e) {
    result.error = "lúc bấm xuất phát: " + e.message;
    return result;
  }

  // Đếm ngược 3,6 giây + cuộc đua + pha về đích, cộng dư ra hai giây. Nhịp 16
  // ms là 60 khung hình mỗi giây, đúng nhịp mà trình duyệt sẽ gọi.
  const totalMs = (3.6 + durationSec * 1.05 + 3) * 1000;
  try {
    while (br.now() < totalMs && br.pending() > 0) {
      result.frames += br.tick(16);
    }
  } catch (e) {
    result.error = `ở khung hình ${result.frames} (giây ${(br.now() / 1000).toFixed(1)}): ${e.message}`;
    return result;
  }

  result.podium = br.el("podium").classList.contains("on");
  result.drawn = br.tally.drawImage || 0;
  // Vòng sao quay trên đầu con đang đơ là thứ DUY NHẤT trong trang gọi arc().
  // Nhờ vậy một con số đếm được chứng minh lớp cắn nhau chạy tới tận lớp vẽ,
  // chứ không chỉ chạy tới lớp tính rồi dừng ở đó.
  result.stunDraws = br.tally.arc || 0;
  result.variant = br.el("variant").textContent;
  return result;
}

const roster45 = Array.from({ length: 45 }, (_, i) => `Người thứ ${i + 1}`);
const roster150 = Array.from({ length: 150 }, (_, i) => `Nhân viên ${i + 1}`);

// ---------------------------------------------------------------- 1. chạy nổi
{
  const r = runRace("tat", roster45);
  check("Trang chạy trọn một cuộc đua mà không văng lỗi", r.error === null, r.error || `${r.frames} khung hình`);
  check("Cuộc đua đi tới bục vinh danh", r.podium,
    r.podium ? `${r.frames} khung hình, ${r.drawn.toLocaleString("vi")} lệnh drawImage` : "không thấy bục");
  check("Có vẽ thật, không phải chạy suông", r.drawn > 10000,
    `${r.drawn.toLocaleString("vi")} lệnh drawImage trong ${r.frames} khung hình`);
}

// ------------------------------------------------- 2. mọi biến thể đều chạy nổi
{
  // Đây là lý do cửa này tồn tại. Một biến thể chỉ hỏng khi nó được bật, và
  // không ai mở trang mười lần để thử từng cái một trước mỗi buổi lễ.
  const broken = [];
  const seen = [];
  for (const value of ["tat", "tu", ...MODES.filter((m) => m.id !== "chuan").map((m) => m.id)]) {
    const r = runRace(value, roster45, 25);
    if (r.error || !r.podium) broken.push(`${value}: ${r.error || "không tới bục"}`);
    else seen.push(value);
  }
  check("Mọi biến thể đều chạy trọn cuộc đua", broken.length === 0,
    broken.length ? broken.join(" · ") : `${seen.length} lựa chọn: ${seen.join(", ")}`);
}

// ------------------------------------------------------- 3. biển báo biến thể
{
  const r = runRace("dem_mua", roster45, 25);
  check("Biến thể được bật thì cả phòng nhìn thấy", r.variant.includes("Đêm mưa"),
    `biển báo hiện "${r.variant}"`);
  const off = runRace("tat", roster45, 25);
  check("Tắt biến thể thì không có biển báo nào", off.variant === "", `"${off.variant}"`);
}

// ------------------------------------------------------------- 4. đàn đông nhất
{
  const r = runRace("tu", roster150, 40);
  check("Đàn 150 người chạy trọn cuộc đua", r.error === null && r.podium,
    r.error || `${r.frames} khung hình, ${r.drawn.toLocaleString("vi")} lệnh drawImage`);

  // Cắt bớt phải THẬT SỰ cắt: 150 con × 3 lệnh × số khung hình là trần trên.
  // Con số thật phải thấp hơn trần đó, nếu không thì đường cắt chưa hề chạy.
  //
  // Ba lệnh chứ không phải hai kể từ khi bốn cái chân biết cử động: chân, thân,
  // biển tên. Chân là một sprite riêng vì nó là thứ duy nhất trên con chó phải
  // đổi theo từng khung hình — xem chú thích ở phần nhịp chân trong dog.mjs.
  const ceiling = 150 * 3 * r.frames;
  check("Cắt bớt ngoài khung hình có chạy thật", r.drawn < ceiling * 0.98,
    `${r.drawn.toLocaleString("vi")} lệnh so với trần ${ceiling.toLocaleString("vi")} — ` +
    `bớt ${((1 - r.drawn / ceiling) * 100).toFixed(1)}%`);
}

// ------------------------------------------ 5. các đường ít ai đi qua khi thử tay
{
  const two = runRace("tu", ["Người A", "Người B"], 22);
  check("Danh sách nhỏ nhất (2 người) vẫn chạy", two.error === null && two.podium,
    two.error || "2 người, đủ nhịp");

  const utf = runRace("nghet_tho", ["Nguyễn Thị Ánh Nguyệt", "Đỗ Bảo Trâm", "Lê Hoàng Việt Anh",
                                    "Phạm Thuỳ Dương", "Trần Quốc Đạt"], 22);
  check("Tên tiếng Việt có dấu vẫn chạy", utf.error === null && utf.podium, utf.error || "5 tên có dấu");
}

// -------------------------------------------------------- 6. lớp cắn nhau
{
  const r = runRace("tat", roster45, 40);
  check("Có chó bị cắn ngã và được vẽ ra thật", r.stunDraws > 0,
    r.stunDraws
      ? `${r.stunDraws.toLocaleString("vi")} lần vẽ vòng sao quay trên đầu con đang đơ`
      : "không con nào nằm — lớp cắn nhau không tới được lớp vẽ");

  // Ở đàn ba người thì lớp cắn nhau tự tắt. Nếu vẫn có con nằm ra thì hoặc nó
  // không tắt thật, hoặc arc() đã bị một chỗ khác trong trang dùng tới và phép
  // đếm ở trên không còn chứng minh được điều nó nói.
  const tiny = runRace("tat", ["Người A", "Người B", "Người C"], 22);
  check("Đàn ba người thì không có ai bị cắn", tiny.stunDraws === 0,
    tiny.error || "lớp cắn nhau tự tắt, và phép đếm ở trên vẫn nói đúng thứ nó nói");
}

console.log(failed === 0 ? "\nTRANG ĐUA CHẠY ĐƯỢC THẬT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
