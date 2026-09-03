// Dựng các trang web tĩnh — Order Race
// Chạy: node tools/build-web.mjs
//
// Vì sao phải dựng thay vì viết tay: cả hai trang đều phải mở được bằng file://
// (ai đó tải về máy rồi mở trực tiếp), mà file:// thì chặn import module. Nên
// thuật toán phải nằm nguyên văn trong trang.
//
// Nếu chép tay thì sớm muộn hai bản cũng lệch nhau — và một trang kiểm chứng
// lệch với game còn tệ hơn là không có trang kiểm chứng nào. Vì vậy chúng được
// sinh tự động từ đúng những file .mjs mà bộ kiểm thử đang chạy.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { sha256HexOfString } from "./fairness/sha256.mjs";

/** Bỏ các câu lệnh module để mã chạy được trong một thẻ script thường. */
function stripModuleSyntax(source, fileLabel) {
  const lines = source.split("\n");
  const kept = [];
  let removedImports = 0;
  let strippedExports = 0;

  for (const line of lines) {
    if (/^\s*import\s.*from\s+".*";\s*$/.test(line)) {
      removedImports++;
      continue;
    }
    if (/^export\s+(function|const|class|let|var)\s/.test(line)) {
      kept.push(line.replace(/^export\s+/, ""));
      strippedExports++;
      continue;
    }
    if (/^\s*export\s/.test(line)) {
      throw new Error(`${fileLabel}: gặp dạng export chưa xử lý được — ${line.trim()}`);
    }
    kept.push(line);
  }

  return { code: kept.join("\n"), removedImports, strippedExports };
}

/**
 * Tên khai báo ở cấp cao nhất của một file.
 *
 * Các file nguồn được nối lại vào chung một phạm vi, nên hai file cùng khai báo
 * `clamp01` là trang trắng ngay lập tức. Lỗi này đã xảy ra một lần và chỉ lộ ra
 * lúc chạy, nên giờ nó bị chặn ngay ở khâu dựng.
 */
function topLevelNames(code) {
  const DECL = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/;
  const names = [];
  for (const line of code.split("\n")) {
    const m = line.match(DECL);
    if (m) names.push(m[1]);
  }
  return names;
}

const BANNER = [
  "// ---------------------------------------------------------------------",
  "//  SINH TỰ ĐỘNG — đừng sửa ở đây.",
  "//  Dựng lại bằng: node tools/build-web.mjs",
  "// ---------------------------------------------------------------------",
].join("\n");

/** Nối các file nguồn thành một khối chạy được trong thẻ script thường. */
function bundle(sources) {
  const parts = [BANNER, ""];
  const seen = new Map();
  let imports = 0;
  let exports = 0;

  for (const src of sources) {
    const r = stripModuleSyntax(readFileSync(src, "utf8"), src);
    for (const name of topLevelNames(r.code)) {
      if (seen.has(name)) {
        throw new Error(
          `Trùng tên ở cấp cao nhất: "${name}" khai báo cả trong ${seen.get(name)} và ${src}. ` +
          "Các file được nối vào chung một phạm vi nên trùng tên là trang trắng — hãy đổi tên một bên."
        );
      }
      seen.set(name, src);
    }
    imports += r.removedImports;
    exports += r.strippedExports;
    parts.push(r.code, "");
  }

  return { code: parts.join("\n"), imports, exports, count: sources.length };
}

// =========================================================================
//  Danh sách nhạc
//
//  Một trang web KHÔNG tự đọc được nội dung một thư mục trên máy: file:// không
//  cho liệt kê thư mục, và fetch cũng bị chặn ở đó. Đây là quy định bảo mật của
//  trình duyệt, không phải thiếu sót. Nên danh sách tên file được quét ở đây rồi
//  ghi thẳng vào trang.
//
//  Đồng thời ghi ra music/playlist.json, để khi phục vụ qua một web server thật
//  thì trang tự đọc lại được — lúc đó thêm nhạc là thấy ngay, không cần dựng lại.
// =========================================================================
const AUDIO_EXT = new Set([".mp3", ".ogg", ".wav", ".m4a", ".aac", ".opus", ".flac", ".webm"]);

function scanMusic(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && AUDIO_EXT.has(extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "vi"));
}

const tracks = scanMusic("music");
writeFileSync(join("music", "playlist.json"), JSON.stringify(tracks, null, 2) + "\n", "utf8");

const musicCode = [
  "// Sinh tự động từ thư mục music/ lúc dựng trang. Thêm bớt file rồi chạy lại:",
  "//     npm run build:web",
  `const MUSIC = ${JSON.stringify(tracks)};`,
].join("\n");

// =========================================================================
function build({ template, output, injections }) {
  let html = readFileSync(template, "utf8");
  const notes = [];

  for (const inj of injections) {
    if (!html.includes(inj.marker)) {
      throw new Error(`Không tìm thấy mốc chèn trong ${template}: ${inj.marker}`);
    }
    html = html.replace(inj.marker, inj.code);
    if (inj.note) notes.push(inj.note);
  }

  writeFileSync(output, html, "utf8");
  console.log(`Đã dựng ${output}`);
  for (const note of notes) console.log("  " + note);
  console.log(`  ${(html.length / 1024).toFixed(1)} KB · mã băm: ${sha256HexOfString(html).slice(0, 16)}`);
}

const verifyBundle = bundle(["tools/fairness/sha256.mjs", "tools/fairness/fairness.mjs"]);
build({
  template: "web/verify.template.html",
  output: "web/verify.html",
  injections: [{
    marker: "/* INJECT:FAIRNESS */",
    code: verifyBundle.code,
    note: `${verifyBundle.count} file nguồn · gỡ ${verifyBundle.imports} câu import · ` +
          `bỏ export ở ${verifyBundle.exports} khai báo`,
  }],
});

// Trang chọn trò chơi không còn nhập liệu nên không cần cỗ máy công bằng lẫn ô
// nhập danh sách. Gói nhẹ đi đáng kể, và bớt luôn một đường để trang này lỡ tay
// đụng vào thuật toán bốc thăm.
const hubBundle = bundle([
  "tools/web/icons.mjs",
  "tools/web/handoff.mjs",
  "tools/web/sound.mjs",
  "tools/web/tap.mjs",
  "tools/web/boot.mjs",
]);
build({
  template: "web/index.template.html",
  output: "web/index.html",
  injections: [{
    marker: "/* INJECT:HUB */",
    code: hubBundle.code,
    note: `${hubBundle.count} file nguồn · gỡ ${hubBundle.imports} câu import · ` +
          `bỏ export ở ${hubBundle.exports} khai báo`,
  }],
});

const raceBundle = bundle([
  "tools/fairness/sha256.mjs",
  "tools/fairness/fairness.mjs",
  "tools/race/director.mjs",
  "tools/race/modes.mjs",
  "tools/race/feel.mjs",
  "tools/race/track.mjs",
  "tools/race/perf.mjs",
  "tools/race/sky.mjs",
  "tools/race/stage.mjs",
  "tools/race/bite.mjs",
  "tools/race/juice.mjs",
  "tools/web/sound.mjs",
  "tools/web/roster-input.mjs",
  "tools/web/labels.mjs",
  "tools/web/icons.mjs",
  "tools/web/handoff.mjs",
  "tools/web/tap.mjs",
  "tools/web/boot.mjs",
  "tools/web/dog.mjs",
]);
build({
  template: "web/race.template.html",
  output: "web/race.html",
  injections: [
    {
      marker: "/* INJECT:RACE */",
      code: raceBundle.code,
      note: `${raceBundle.count} file nguồn · gỡ ${raceBundle.imports} câu import · ` +
            `bỏ export ở ${raceBundle.exports} khai báo`,
    },
    {
      marker: "/* INJECT:MUSIC */",
      code: musicCode,
      note: tracks.length
        ? `${tracks.length} bài nhạc: ${tracks.slice(0, 3).join(", ")}${tracks.length > 3 ? "…" : ""}`
        : "thư mục music/ đang trống — cuộc đua sẽ chạy không nhạc nền",
    },
  ],
});

const redlightBundle = bundle([
  "tools/fairness/sha256.mjs",
  "tools/fairness/fairness.mjs",
  "tools/race/feel.mjs",
  // Nhịp sải chân dùng chung với sân đua: cùng một chú chó thì phải chạy cùng
  // một kiểu ở cả hai trò, và có đúng một chỗ định nghĩa nó.
  "tools/race/juice.mjs",
  "tools/redlight/elimination.mjs",
  "tools/web/sound.mjs",
  "tools/web/roster-input.mjs",
  "tools/web/labels.mjs",
  "tools/web/icons.mjs",
  "tools/web/handoff.mjs",
  "tools/web/tap.mjs",
  "tools/web/boot.mjs",
  "tools/web/dog.mjs",
]);
build({
  template: "web/redlight.template.html",
  output: "web/redlight.html",
  injections: [
    {
      marker: "/* INJECT:REDLIGHT */",
      code: redlightBundle.code,
      note: `${redlightBundle.count} file nguồn · gỡ ${redlightBundle.imports} câu import · ` +
            `bỏ export ở ${redlightBundle.exports} khai báo`,
    },
    { marker: "/* INJECT:MUSIC */", code: musicCode },
  ],
});
