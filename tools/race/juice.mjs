// Lớp cảm giác, phần thân cuộc đua — Order Race / M2
//
// feel.mjs lo KHOẢNH KHẮC CHẠM VẠCH. File này lo 40 giây trước đó.
//
// Lỗ hổng nó vá: lớp đạo diễn dựng sẵn các nhịp kịch tính — trung bình 4,5 lần
// đổi ngôi đầu mỗi cuộc đua, một kẻ dẫn đầu giả sụp đổ ở nhịp 4, những cú vượt
// qua ranh giới trúng thưởng — và KHÔNG MỘT NHỊP NÀO trong số đó phát ra tiếng
// động hay chớp sáng. Chúng chỉ xảy ra, ở đâu đó giữa 150 chấm màu đang chạy,
// và ai không nhìn đúng chỗ thì không biết là vừa có chuyện gì.
//
// Điều khoản gốc của lớp cảm giác: mọi hành động đáng kể phải phản hồi trên cả
// ba kênh — nhìn, nghe, rung — và phải nổ ĐÚNG vào khoảnh khắc nó xảy ra. Cú
// đổi ngôi đầu là hành động đáng kể nhất của phần thân cuộc đua. Nó đang im
// lặng trên cả ba kênh.
//
// File này chỉ ra QUYẾT ĐỊNH ("vừa có một cú đổi ngôi, mức độ này"); trang đua
// mới là nơi bắn ba kênh kia. Tách vậy để phần khó — biết khi nào là thật, khi
// nào chỉ là hai con đang ngang nhau — kiểm thử được bằng máy.

export const JUICE = {
  /**
   * Khoảng cách tối thiểu để công nhận một cú đổi ngôi, theo tỉ lệ đường đua.
   *
   * Đây là hằng số quan trọng nhất file này. Hai chú chó chạy ngang nhau thì
   * thứ hạng của chúng đổi qua đổi lại MỖI KHUNG HÌNH — sáu chục lần một giây.
   * Không có ngưỡng này thì cú "đổi ngôi" biến thành một tràng liên thanh, và
   * một tràng liên thanh thì không còn là một sự kiện nữa.
   *
   * 0,0025 đường đua ở đàn 45 con là khoảng một phần tư thân chó: đủ để mắt
   * thấy rõ một con đã vượt lên hẳn, chưa tới mức bỏ sót cú vượt sát nút.
   */
  LEAD_MARGIN: 0.0025,

  /** Giây thời gian đua tối thiểu giữa hai lần báo, để nhịp còn đọc được. */
  COOLDOWN: 1.2,

  /**
   * Từ mốc này trở đi thì im lặng: pha về đích đã bắt đầu và nó sở hữu trọn
   * khoảnh khắc. Một tiếng "đổi ngôi" chen vào 1,5 giây trước cú va chạm chỉ
   * làm loãng đúng cái bậc mà cả buổi lễ chờ đợi.
   */
  QUIET_FROM: 0.94,

  /** Trong khoảng này mà đổi ngôi tiếp thì tính là một chuỗi, bậc đẩy lên. */
  STREAK_WINDOW: 6,

  /** Trần của chuỗi — quá mức này thì tăng nữa cũng không nghe ra khác. */
  STREAK_CAP: 4,

  /** Nhịp sải chân theo quãng đường, tính bằng radian trên một vòng đua. */
  GALLOP_FREQ: 210,

  /** Biên độ nhấp nhô của thân chó, tính bằng đơn vị sân. */
  GALLOP_BOB: 3.4,

  /** Biên độ nén giãn. Giữ nhỏ: đây là dấu hiệu của sự sống, không phải hoạt hình. */
  GALLOP_SQUASH: 0.085,

  /** Biên độ thở của máy quay, theo tỉ lệ mức phóng. */
  BREATHE: 0.012,

  /** Chu kỳ thở, tính bằng giây. */
  BREATHE_PERIOD: 7.5,
};

/**
 * Bộ canh nhịp kịch tính.
 *
 * Đọc dòng thứ hạng từng khung hình rồi báo ra những khoảnh khắc đáng ăn mừng.
 * Hai loại:
 *
 *   "dan_dau"  — có kẻ dẫn đầu mới
 *   "ranh_gioi" — có người vừa chen vào chỗ cuối cùng còn trúng thưởng
 *
 * Cả hai đều qua cùng bộ lọc: phải vượt hơn một khoảng rõ ràng (chứ không phải
 * đang ngang nhau), phải cách lần báo trước một quãng nghỉ, và phải xảy ra
 * trước lúc pha về đích bắt đầu.
 */
export function makeBeatWatcher(options = {}) {
  const topK = Math.max(1, options.topK ?? 3);
  const margin = options.margin ?? JUICE.LEAD_MARGIN;
  const cooldown = options.cooldown ?? JUICE.COOLDOWN;
  const quietFrom = options.quietFrom ?? JUICE.QUIET_FROM;

  let leader = -1;
  let edge = -1;
  let lastAt = -Infinity;
  let streak = 0;
  let started = false;

  return {
    /**
     * @param order  thứ hạng hiện tại, phần tử 0 là con đang dẫn đầu
     * @param pos    vị trí của từng con
     * @param tSec   giây THỜI GIAN ĐUA đã trôi qua
     * @param tNorm  cùng thời điểm đó theo tỉ lệ thời lượng
     * @returns sự kiện, hoặc null
     */
    feed(order, pos, tSec, tNorm) {
      const lead = order[0];

      // Khung hình đầu tiên chỉ để ghi nhận hiện trạng. Không có nó thì cuộc
      // đua nào cũng mở màn bằng một cú "đổi ngôi" giả, ngay lúc cửa chuồng bật.
      if (!started) {
        started = true;
        leader = lead;
        edge = order[Math.min(topK - 1, order.length - 1)];
        return null;
      }

      if (tNorm >= quietFrom) return null;

      if (lead !== leader) {
        // Ngưỡng khoảng cách, không phải ngưỡng thời gian. Hai con ngang nhau
        // đổi chỗ liên tục nhưng không bao giờ vượt hẳn nhau một khoảng — nên
        // ngưỡng khoảng cách lọc đúng thứ cần lọc, còn ngưỡng thời gian thì
        // vẫn cho lọt một cú báo mỗi lần hết giờ nghỉ.
        if (pos[lead] - pos[leader] >= margin) {
          const gap = tSec - lastAt;
          if (gap >= cooldown) {
            streak = gap <= JUICE.STREAK_WINDOW ? Math.min(streak + 1, JUICE.STREAK_CAP) : 1;
            leader = lead;
            lastAt = tSec;
            return { kind: "dan_dau", dog: lead, rank: 0, tSec, streak };
          }
          // Đã đổi thật nhưng đang trong quãng nghỉ: ghi nhận kẻ dẫn đầu mới
          // mà không báo. Không ghi nhận thì hết quãng nghỉ nó lại báo về một
          // cú vượt đã xảy ra từ lâu.
          leader = lead;
        }
        return null;
      }

      if (topK < order.length) {
        const cur = order[topK - 1];
        if (cur !== edge && pos[cur] - pos[edge] >= margin) {
          const gap = tSec - lastAt;
          if (gap >= cooldown) {
            edge = cur;
            lastAt = tSec;
            return { kind: "ranh_gioi", dog: cur, rank: topK - 1, tSec, streak };
          }
          edge = cur;
        }
      }

      return null;
    },

    reset() {
      leader = -1;
      edge = -1;
      lastAt = -Infinity;
      streak = 0;
      started = false;
    },
  };
}

/**
 * Hệ số cao độ theo chuỗi đổi ngôi.
 *
 * Chuỗi càng dài thì tiếng báo càng cao — đà của cuộc đua trở thành thứ NGHE
 * được, không chỉ thứ đếm được. Có trần, vì quá một mức thì tai không phân biệt
 * nổi và nó chỉ còn chói.
 */
export const streakPitch = (streak) => 1 + 0.11 * Math.min(streak, JUICE.STREAK_CAP);

/**
 * Nhịp sải chân: nhấp nhô cộng nén giãn, suy ra từ QUÃNG ĐƯỜNG chứ không từ
 * đồng hồ.
 *
 * Suy từ quãng đường nên nhịp chân tự khớp với tốc độ — chạy nhanh thì sải mau,
 * và trong lúc đóng băng ở khung va chạm thì chân cũng đứng yên. Nếu suy từ
 * đồng hồ thì đàn chó vẫn nhún nhảy trong khi cả màn hình đã đứng hình, và cú
 * đóng băng mất sạch sức nặng.
 *
 * Nén giãn giữ nguyên thể tích: bè ngang bao nhiêu thì thấp xuống bấy nhiêu.
 * Không giữ thể tích thì con chó phồng lên xẹp xuống như quả bóng.
 *
 * @param phase quãng lệch pha riêng của từng con, để cả đàn không nhún cùng nhịp
 * @param dist  quãng đường đã chạy, theo tỉ lệ đường đua
 * @param amp   biên độ, 0 là tắt hẳn (dùng cho giảm chuyển động)
 */
export function gallopAt(phase, dist, amp = 1) {
  if (amp <= 0) return { bob: 0, sx: 1, sy: 1 };
  const u = dist * JUICE.GALLOP_FREQ + phase;
  const bob = -Math.abs(Math.sin(u)) * JUICE.GALLOP_BOB * amp;
  const sy = 1 + JUICE.GALLOP_SQUASH * amp * Math.cos(u * 2);
  return { bob, sx: 1 / sy, sy };
}

/** Lệch pha cố định của một chú chó, để đàn chó không nhún như một khối. */
export const gallopPhase = (dog) => ((dog * 2654435761) % 1000) / 1000 * Math.PI * 2;

/**
 * Khung tư thế chân trong dải đã nướng, cũng suy ra từ QUÃNG ĐƯỜNG.
 *
 * Cùng một biến u với gallopAt, và một sải chân dài đúng π — tức là đúng một
 * vòng nhấp nhô của thân. Phải khớp: thân hạ xuống là lúc chân chạm đất, thân
 * vươn lên là lúc cả bốn chân rời cỏ. Lệch nhịp thì con chó nhún một đằng, đạp
 * một nẻo, và mắt đọc ra ngay dù không chỉ được ra là sai chỗ nào.
 *
 * Suy từ quãng đường nên nó thừa hưởng nguyên tính chất của gallopAt: chạy
 * nhanh thì sải mau, và đứng yên — kể cả lúc đóng băng ở khung va chạm — thì
 * chân đứng yên theo.
 *
 * @param phase  lệch pha riêng của con chó, từ gallopPhase
 * @param dist   quãng đường đã chạy, theo tỉ lệ đường đua
 * @param frames số tư thế trong một sải, từ GALLOP_FRAMES của dog.mjs
 */
export function gallopFrame(phase, dist, frames) {
  const u = dist * JUICE.GALLOP_FREQ + phase;
  const f = Math.floor((u / Math.PI) * frames) % frames;
  return f < 0 ? f + frames : f;
}

/**
 * Máy quay thở.
 *
 * Một máy quay đứng chết cứng đọc ra như ảnh chụp màn hình, kể cả khi mọi thứ
 * trong khung đang chạy. Biên độ phải nhỏ tới mức không ai chỉ ra được — chỉ đủ
 * để khung hình không bao giờ thật sự đứng yên.
 */
export function breatheAt(tSec, motionScale = 1) {
  return 1 + JUICE.BREATHE * motionScale * Math.sin((tSec / JUICE.BREATHE_PERIOD) * Math.PI * 2);
}

/**
 * Bụi bốc lên sau chân chó — hồ chứa cố định, vòng tròn ghi đè.
 *
 * Sức chứa cố định và ghi đè con cũ nhất, nên hàm này KHÔNG BAO GIỜ cấp phát
 * sau lúc dựng. Đây đúng là điều khoản "đừng dựng mới trên đường đi nóng của
 * hiệu ứng" của lớp cảm giác: nguyên nhân phổ biến nhất của "thêm juice thì
 * game giật" không phải bản thân hiệu ứng, mà là việc cấp phát mỗi khung hình.
 */
export function makeDust(cap = 160) {
  const x = new Float32Array(cap);
  const y = new Float32Array(cap);
  const vx = new Float32Array(cap);
  const vy = new Float32Array(cap);
  const life = new Float32Array(cap);
  const born = new Float32Array(cap);
  const size = new Float32Array(cap);
  let head = 0;
  let seed = 0x2545f491;

  // Bộ sinh số ngẫu nhiên riêng, hạng nhẹ. Không dùng cỗ máy công bằng: hạt bụi
  // không cần tái tạo được, và mỗi lần gọi nó là một lần băm SHA-256.
  const rand = () => {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    return seed / 4294967296;
  };

  return {
    cap,
    x, y, vx, vy, life, born, size,

    /** Bắn `count` hạt tại (px, py), thổi ngược hướng chạy `(dirX, dirY)`. */
    spawn(px, py, count, dirX, dirY, power = 1) {
      for (let i = 0; i < count; i++) {
        const k = head;
        head = (head + 1) % cap;
        const spread = (rand() - 0.5) * 1.4;
        const speed = (26 + rand() * 46) * power;
        x[k] = px + (rand() - 0.5) * 6;
        y[k] = py + (rand() - 0.5) * 6;
        vx[k] = (-dirX + spread * -dirY) * speed;
        vy[k] = (-dirY + spread * dirX) * speed - 12 * power;
        const ttl = 0.32 + rand() * 0.34;
        life[k] = ttl;
        born[k] = ttl;
        size[k] = (1.6 + rand() * 2.6) * power;
      }
    },

    /** Chạy trên thời gian ĐÃ LÀM CHẬM: bụi phải đứng yên khi cuộc đua đứng yên. */
    update(dt) {
      for (let k = 0; k < cap; k++) {
        if (life[k] <= 0) continue;
        life[k] -= dt;
        if (life[k] <= 0) { life[k] = 0; continue; }
        x[k] += vx[k] * dt;
        y[k] += vy[k] * dt;
        vx[k] *= 1 - 2.6 * dt;
        vy[k] = vy[k] * (1 - 2.6 * dt) + 34 * dt;
      }
    },

    /** Số hạt còn sống — chỉ dùng cho kiểm thử và chẩn đoán. */
    alive() {
      let c = 0;
      for (let k = 0; k < cap; k++) if (life[k] > 0) c++;
      return c;
    },

    clear() {
      life.fill(0);
      head = 0;
    },
  };
}
