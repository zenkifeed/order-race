// Ô nhập danh sách — Order Race
//
// Dùng chung cho mọi minigame. Khi quản trò dán danh sách vào, số người phải tự
// cập nhật theo đúng số tên đã dán — chứ không phải để ô "số người tham gia"
// đứng yên ở một con số cũ và làm cả phòng tưởng nhầm.
//
// Đồng thời báo lỗi ngay lúc dán chứ không đợi tới lúc bấm bắt đầu: trùng tên
// và vượt trần là hai lỗi hay gặp nhất, và phát hiện muộn thì quản trò phải sửa
// giữa lúc cả phòng đang nhìn.

import { prepareRoster, sortRoster, findDuplicates, MAX_ROSTER, MIN_ROSTER } from "../fairness/fairness.mjs";

/**
 * @param textarea    ô dán danh sách
 * @param countInput  ô số người tham gia; bị khoá khi đã có danh sách thật
 * @param infoEl      chỗ hiện phản hồi
 * @returns hàm cập nhật, gọi lại được bất cứ lúc nào
 */
export function wireRosterInput({ textarea, countInput, infoEl }) {
  function update() {
    const raw = textarea.value;
    const hasText = raw.trim().length > 0;

    countInput.disabled = hasText;
    countInput.style.opacity = hasText ? "0.55" : "";

    if (!hasText) {
      infoEl.textContent = "Bỏ trống thì dùng danh sách giả theo số người ở trên.";
      infoEl.style.color = "";
      return { ok: true, count: Number(countInput.value) || 0 };
    }

    const names = prepareRoster(raw.split(/\r?\n/));
    countInput.value = names.length;

    const problems = [];
    if (names.length < MIN_ROSTER) problems.push(`cần ít nhất ${MIN_ROSTER} người`);
    if (names.length > MAX_ROSTER) problems.push(`vượt trần ${MAX_ROSTER} người`);

    const dups = findDuplicates(sortRoster(names));
    if (dups.length > 0) {
      const shown = dups.slice(0, 3).join(", ");
      problems.push(`trùng tên: ${shown}${dups.length > 3 ? ` và ${dups.length - 3} tên khác` : ""}`);
    }

    const blank = raw.split(/\r?\n/).length - names.length;
    if (problems.length > 0) {
      infoEl.textContent = `${names.length} tên — ${problems.join(" · ")}`;
      infoEl.style.color = "var(--danger)";
      return { ok: false, count: names.length };
    }

    infoEl.textContent =
      `${names.length} tên hợp lệ` +
      (blank > 0 ? `, đã bỏ qua ${blank} dòng trống` : "") +
      ". Số người ở trên đã cập nhật theo danh sách này.";
    infoEl.style.color = "var(--turf)";
    return { ok: true, count: names.length };
  }

  textarea.addEventListener("input", update);
  textarea.addEventListener("change", update);
  update();
  return update;
}
