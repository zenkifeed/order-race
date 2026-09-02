// Sàn phản hồi khi chạm — Order Race
//
// Quy tắc của lớp cảm giác: không hành động nào được diễn ra trong im lặng.
// Nhưng đi nối tiếng cho từng cái nút thì kiểu gì cũng sót — nhất là những nút
// dựng bằng JS sau khi trang đã chạy.
//
// Nên thay vì nối từng nút, đặt MỘT bộ nghe ở pha bắt (capture) trên document.
// Mọi thứ bấm được đều đi qua đó, kể cả nút sinh ra về sau. Không bao giờ ship
// ra một cái nút câm.
//
// Tiếng phân theo loại chứ không phải theo từng nút: nút chính nặng và ấm, nút
// phụ nhẹ, nút bị khoá kêu cụt một tiếng trầm để báo "bấm rồi nhưng chưa được".

const KINDS = {
  primary: { freq: 320, sweepTo: 470, dur: 0.09, type: "triangle", gain: 0.13, buzz: 14 },
  select:  { freq: 660, sweepTo: 880, dur: 0.07, type: "triangle", gain: 0.09, buzz: 8 },
  soft:    { freq: 520, dur: 0.05, type: "sine", gain: 0.07, buzz: 6 },
  denied:  { freq: 180, sweepTo: 120, dur: 0.12, type: "square", gain: 0.09, buzz: 0 },
};

const CLICKABLE = 'button, a[href], [role="button"], input[type="checkbox"], .pick';

/**
 * @param audio  đối tượng âm thanh từ sound.mjs
 * @param buzz   hàm rung tay từ sound.mjs
 * @param onFirstGesture  gọi một lần ở cú chạm đầu tiên — chỗ mở khoá AudioContext
 */
export function installTapFeedback(audio, buzz, onFirstGesture) {
  let unlocked = false;

  document.addEventListener("pointerdown", (e) => {
    if (!unlocked) {
      unlocked = true;
      audio.unlock();
      if (onFirstGesture) onFirstGesture();
    }

    const el = e.target.closest ? e.target.closest(CLICKABLE) : null;
    if (!el) return;

    const disabled = el.disabled || el.getAttribute("aria-disabled") === "true";
    const kind = disabled ? "denied" : (el.dataset.tap || defaultKind(el));
    const spec = KINDS[kind] || KINDS.soft;

    audio.tone({
      freq: audio.vary(spec.freq),
      sweepTo: spec.sweepTo ?? null,
      dur: spec.dur,
      type: spec.type,
      gain: spec.gain,
    });
    if (spec.buzz) buzz(spec.buzz);
  }, true);
}

function defaultKind(el) {
  if (el.classList.contains("btn")) return "primary";
  if (el.classList.contains("pick")) return "select";
  return "soft";
}

export const tapKinds = () => Object.keys(KINDS);
