// Kiểm thử ô nhập danh sách — Order Race
// Chạy: node tools/web/roster-input-selftest.mjs
//
// Ô nhập là thứ quản trò chạm vào ngay trước mặt cả phòng, và cũng là thứ tôi
// không click thử được. Nên hành vi của nó được kiểm bằng DOM giả: chỉ cần đủ
// những gì wireRosterInput thật sự đụng tới.

import { wireRosterInput } from "./roster-input.mjs";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "  OK  " : "  SAI "} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}

/** DOM giả tối thiểu. */
function fakeField(value = "") {
  return {
    value,
    disabled: false,
    style: {},
    textContent: "",
    handlers: {},
    addEventListener(kind, fn) { this.handlers[kind] = fn; },
    type(text) { this.value = text; this.handlers.input?.(); },
  };
}

function setup(initial = "") {
  const textarea = fakeField(initial);
  const countInput = fakeField("45");
  const infoEl = fakeField();
  const update = wireRosterInput({ textarea, countInput, infoEl });
  return { textarea, countInput, infoEl, update };
}

// ------------------------------------------------- 1. Dán vào là cập nhật số
{
  const s = setup();
  check("Chưa dán gì thì ô số người vẫn mở", s.countInput.disabled === false);
  check("Chưa dán gì thì giữ nguyên số đã đặt", s.countInput.value === "45");

  s.textarea.type("Lê A\nTrần B\nPhạm C\nVũ D");
  check("Dán 4 tên thì số người thành 4", s.countInput.value === 4, `đang là ${s.countInput.value}`);
  check("Dán rồi thì khoá ô số người", s.countInput.disabled === true);
  check("Báo lại số tên hợp lệ", s.infoEl.textContent.startsWith("4 tên hợp lệ"),
    JSON.stringify(s.infoEl.textContent));
}

// ------------------------------------------------ 2. Xoá đi thì trả lại như cũ
{
  const s = setup();
  s.textarea.type("Lê A\nTrần B");
  s.textarea.type("");
  check("Xoá danh sách thì mở lại ô số người", s.countInput.disabled === false);
  check("Xoá danh sách thì quay về danh sách giả",
    s.infoEl.textContent.includes("danh sách giả"));
}

// ------------------------------------------- 3. Dòng trống không bị tính vào
{
  const s = setup();
  s.textarea.type("Lê A\n\n\nTrần B\n   \nPhạm C\n");
  check("Bỏ qua dòng trống", s.countInput.value === 3, `đang là ${s.countInput.value}`);
  check("Nói rõ đã bỏ qua bao nhiêu dòng", s.infoEl.textContent.includes("bỏ qua"),
    JSON.stringify(s.infoEl.textContent));
}

// ---------------------------------------------- 4. Rác dán từ Excel vẫn đếm đúng
{
  const s = setup();
  s.textarea.type("﻿ Lê  A \nTrần B\n\tPhạm\tC\t");
  check("BOM, khoảng trắng cứng và tab không làm sai số đếm", s.countInput.value === 3,
    `đang là ${s.countInput.value}`);
}

// -------------------------------------------------- 5. Báo lỗi ngay lúc dán
{
  const s = setup();
  s.textarea.type("Lê A\nLê  A\nTrần B");
  check("Bắt được trùng tên ngay lúc dán", s.infoEl.textContent.includes("trùng tên"),
    JSON.stringify(s.infoEl.textContent));

  const t = setup();
  t.textarea.type(Array.from({ length: 151 }, (_, i) => "NV" + i).join("\n"));
  check("Bắt được vượt trần 150", t.infoEl.textContent.includes("vượt trần 150"),
    JSON.stringify(t.infoEl.textContent));
  check("Vẫn hiện đúng số đã dán khi vượt trần", t.countInput.value === 151);

  const u = setup();
  u.textarea.type("Chỉ một người");
  check("Bắt được danh sách quá ngắn", u.infoEl.textContent.includes("ít nhất 2"),
    JSON.stringify(u.infoEl.textContent));
}

// ------------------------------------------- 6. Trả về kết quả cho nơi gọi
{
  const s = setup();
  const r = s.textarea.value === "" ? s.update() : null;
  check("Hàm cập nhật trả về trạng thái dùng được", r !== null && r.ok === true);

  s.textarea.value = "A\nA";
  const bad = s.update();
  check("Danh sách hỏng thì trả về ok = false", bad.ok === false && bad.count === 2);
}

console.log(failed === 0 ? "\nÔ NHẬP DANH SÁCH ĐẠT\n" : `\n${failed} MỤC KHÔNG ĐẠT\n`);
process.exit(failed === 0 ? 0 : 1);
