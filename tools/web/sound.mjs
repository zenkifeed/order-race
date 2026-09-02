// Lớp âm thanh dùng chung — Order Race
//
// Thiếu một kênh là lý do phổ biến nhất khiến một hành động đọc ra "phẳng".
// Toàn bộ hiệu ứng ở đây sinh bằng WebAudio, không có file nào — trang vẫn tự
// chứa và vẫn mở được bằng file://.
//
// Dùng chung cho mọi minigame. Nhân đôi sang từng trang thì sớm muộn hai bản
// cũng lệch nhau, và lúc đó sửa một chỗ sẽ chỉ sửa được một nửa.

export const audio = {
  ctx: null,
  muted: false,

  /** AudioContext chỉ được phép tạo từ một cú chạm của người dùng. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },

  /**
   * Ghi nhớ lựa chọn tắt tiếng.
   *
   * Bọc try/catch vì khi mở bằng file:// thì mỗi trình duyệt xử lý localStorage
   * một kiểu, có nơi ném lỗi thẳng. Không đọc/ghi được thì coi như đang bật
   * tiếng — không bao giờ được để chuyện lưu tuỳ chọn làm hỏng cả trang.
   */
  MUTE_KEY: "order-race/muted",
  restoreMuted() {
    try { this.muted = localStorage.getItem(this.MUTE_KEY) === "1"; } catch { /* kệ */ }
    return this.muted;
  },
  setMuted(v) {
    this.muted = !!v;
    try { localStorage.setItem(this.MUTE_KEY, this.muted ? "1" : "0"); } catch { /* kệ */ }
  },

  /** Lệch cao độ mỗi lần phát — âm giống hệt nhau lặp lại gây mệt rất nhanh. */
  vary: (f) => f * (0.97 + Math.random() * 0.06),

  tone({ freq, dur = 0.12, type = "sine", gain = 0.16, sweepTo = null, at = 0 }) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  noise({ dur = 0.25, gain = 0.14, cutoff = 1400, at = 0 }) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + at;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t0);
  },
};

/** Rung tay, cùng khung với hình và tiếng. Tôn trọng nút tắt tiếng. */
export function buzz(ms) {
  if (!audio.muted && navigator.vibrate) navigator.vibrate(ms);
}

/**
 * Nhạc nền lấy từ thư mục music/.
 *
 * @param tracks    danh sách tên file, nhúng sẵn lúc dựng trang
 * @param onChange  gọi lại với tên bài đang phát, hoặc null khi dừng
 */
export function makeMusic(tracks, onChange) {
  return {
    el: null,
    name: null,
    vol: 0,
    duckUntil: 0,
    list: tracks.slice(),

    BASE: 0.55,
    DUCK: 0.16,   // hạ khoảng 11 dB — đủ để tiếng va chạm và tên người trúng nổi lên

    /**
     * Khi trang được phục vụ qua một web server thật thì đọc lại danh sách, để
     * thêm nhạc là thấy ngay mà không phải dựng lại trang. Mở bằng file:// thì
     * fetch bị chặn, và lúc đó dùng danh sách đã nhúng lúc dựng.
     */
    refresh() {
      if (!location.protocol.startsWith("http")) return;
      fetch("music/playlist.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((arr) => {
          if (Array.isArray(arr)) this.list = arr.filter((x) => typeof x === "string");
        })
        .catch(() => {});
    },

    start() {
      this.stop();
      if (!this.list.length) return;
      this.name = this.list[Math.floor(Math.random() * this.list.length)];
      // encodeURIComponent để tên file có dấu tiếng Việt và khoảng trắng vẫn tải được.
      const el = new Audio("music/" + encodeURIComponent(this.name));
      el.loop = true;
      el.volume = 0;
      el.addEventListener("error", () => this.stop());
      el.play().catch(() => this.stop());
      this.el = el;
      this.vol = 0;
      if (onChange) onChange(this.name);
    },

    /** Hạ nền ở khoảnh khắc lớn, rồi tự trả lại mức thường. */
    duck(seconds) {
      this.duckUntil = performance.now() / 1000 + seconds;
    },

    /** Tăng tốc độ phát — dùng để leo căng thẳng qua từng vòng. */
    setRate(rate) {
      if (this.el) this.el.playbackRate = Math.max(0.5, Math.min(2, rate));
    },

    /** Tạm dừng và phát tiếp — dùng cho nút dừng của quản trò. */
    pause() { if (this.el) this.el.pause(); },
    resume() { if (this.el) this.el.play().catch(() => {}); },

    stop() {
      if (this.el) { this.el.pause(); this.el = null; }
      this.name = null;
      this.vol = 0;
      this.duckUntil = 0;
      if (onChange) onChange(null);
    },

    tick(dtReal) {
      if (!this.el) return;
      const ducking = performance.now() / 1000 < this.duckUntil;
      const want = audio.muted ? 0 : ducking ? this.DUCK : this.BASE;
      // Hạ nhanh, lên chậm: nền tụt xuống phải dứt khoát để nhường chỗ, còn dâng
      // lên thì phải êm, nếu không chính nó lại thành một sự kiện gây chú ý.
      const rate = want < this.vol ? 9 : 2.6;
      this.vol += (want - this.vol) * Math.min(1, dtReal * rate);
      this.el.volume = Math.max(0, Math.min(1, this.vol));
    },
  };
}
