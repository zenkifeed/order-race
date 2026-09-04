// Danh sách mẫu — tên tiếng Anh, dùng khi quản trò chưa dán danh sách thật
// ============================================================================
//
// Vì sao là một file riêng chứ không dùng lại makeTestRoster của lớp công bằng:
// hàm đó là VẬT CỐ ĐỊNH của bộ vector vàng, bản C# phải sao y từng ký tự
// (tools/csharp-check/Program.cs — TestRoster.Make). Đổi nó là phải sinh lại
// vector VÀ sửa C# cùng lúc, chỉ để đổi mấy cái tên hiển thị trên màn hình.
// Trước đây hai trang chơi gọi thẳng vào nó — chú thích ngay trên hàm đã ghi
// "CHỈ DÙNG CHO KIỂM THỬ" mà vẫn bị gọi từ giao diện.
//
// Hai ràng buộc, cả hai đều có cửa kiểm:
//
//   1. MỌI TÊN DÀI 6–9 KÝ TỰ. Biển tên trên đường đua có bề rộng cố định
//      (tools/web/labels.mjs), tên quá dài thì bị cắt hoặc đè lên nhau.
//
//   2. KHÔNG TÊN NÀO TRÙNG, tới tận trần 150 người. draw() ném lỗi khi có tên
//      trùng, nên một hồ tên thiếu là nút Bắt đầu chết ở đúng cỡ danh sách nào
//      đó — thứ chỉ lộ ra khi cả phòng đang nhìn. Hồ phải rộng hơn trần.
//
// Xác định chứ không ngẫu nhiên theo đồng hồ: cùng số người thì lượt chạy thử
// ở nhà và lượt chạy thật trước cả phòng ra đúng cùng một danh sách, nên cùng
// một seed, nên cùng một kết quả. Đây là tính chất mà cả kho mã này được dựng
// để giữ — một danh sách mẫu đổi theo mỗi lần bấm sẽ phá nó.

/**
 * Hồ tên. Rộng hơn trần danh sách (150) để phép bốc không tên nào trùng còn
 * dư chỗ. Chỉ chữ cái Latin không dấu: đây là danh sách MẪU, tên có dấu đã có
 * cửa riêng lo (tools/web/labels-selftest.mjs chạy tên tiếng Việt thật).
 */
export const NAME_POOL = [
  "Abigail", "Adeline", "Adrian", "Alastair", "Albert", "Alfred", "Amanda",
  "Amelia", "Andrea", "Andrew", "Angela", "Annabel", "Anthony", "Arthur",
  "Ashley", "Aubrey", "Audrey", "August", "Austin", "Barbara", "Barnaby",
  "Beatrix", "Belinda", "Bernard", "Bethany", "Beverly", "Bradley", "Brandon",
  "Brendan", "Brianna", "Bridget", "Brooke", "Bryony", "Caitlin", "Cameron",
  "Camilla", "Candice", "Carlton", "Carmen", "Caroline", "Carter", "Cassidy",
  "Cecilia", "Chandler", "Charity", "Charles", "Charlie", "Chelsea", "Christy",
  "Clarence", "Clarissa", "Claudia", "Clayton", "Clement", "Clifford",
  "Colette", "Colleen", "Connor", "Conrad", "Cordelia", "Courtney", "Crystal",
  "Curtis", "Cynthia", "Damian", "Daniel", "Danielle", "Daphne", "Darlene",
  "Darrell", "Davina", "Dawson", "Deborah", "Declan", "Delilah", "Denise",
  "Dennis", "Derrick", "Desmond", "Dexter", "Dominic", "Donald", "Dorothy",
  "Douglas", "Duncan", "Dustin", "Dwight", "Easton", "Edmund", "Edward",
  "Eleanor", "Elijah", "Elliot", "Eloise", "Emerson", "Emmett", "Ernest",
  "Esther", "Eugene", "Evelyn", "Everett", "Fabian", "Felicia", "Felicity",
  "Fletcher", "Florence", "Forrest", "Frances", "Francis", "Franklin",
  "Frazier", "Gabriel", "Gardner", "Gareth", "Garrett", "Geoffrey", "George",
  "Georgia", "Gerald", "Gilbert", "Gillian", "Gordon", "Gracie", "Graham",
  "Gregory", "Gwendolyn", "Hadley", "Hallie", "Hannah", "Harold", "Harriet",
  "Harvey", "Hayden", "Heather", "Hector", "Helena", "Herbert", "Hilary",
  "Holden", "Horace", "Howard", "Hubert", "Hunter", "Imogen", "Ingrid",
  "Irving", "Isabel", "Isabella", "Isadora", "Jackson", "Jasmine", "Jasper",
  "Jeffrey", "Jemima", "Jennifer", "Jeremy", "Jerome", "Jessica", "Joanna",
  "Jocelyn", "Jonathan", "Jordan", "Joseph", "Joshua", "Julian", "Juliana",
  "Juliet", "Justin", "Kathleen", "Kayleigh", "Keaton", "Kelsey", "Kendall",
  "Kennedy", "Kenneth", "Kimberly", "Lachlan", "Lambert", "Laurence",
  "Lavinia", "Lawrence", "Leland", "Lennon", "Leonard", "Leopold", "Lillian",
  "Lincoln", "Lindsay", "Lionel", "Lorenzo", "Loretta", "Louisa", "Lucille",
  "Lucinda", "Lyndon", "Madeline", "Madison", "Malcolm", "Mallory", "Marcus",
  "Margaret", "Marilyn", "Marion", "Marshall", "Martin", "Marvin", "Matilda",
  "Matthew", "Maurice", "Maxwell", "Meredith", "Michael", "Michelle",
  "Mildred", "Millicent", "Miranda", "Mitchell", "Monroe", "Montague",
  "Morgan", "Murray", "Myrtle", "Natalie", "Nathan", "Neville", "Nicholas",
  "Nicole", "Norbert", "Norman", "Octavia", "Olivia", "Orlando", "Osborne",
  "Oswald", "Palmer", "Pamela", "Parker", "Patricia", "Patrick", "Payton",
  "Penelope", "Percival", "Peyton", "Phoebe", "Phyllis", "Preston",
  "Priscilla", "Quentin", "Quincy", "Rachel", "Randall", "Raymond", "Rebecca",
  "Reginald", "Rhiannon", "Richard", "Roberta", "Roderick", "Rodney", "Roland",
  "Ronald", "Rosalie", "Rosalind", "Roscoe", "Rowena", "Roxanne", "Rupert",
  "Russell", "Ruthie", "Sabrina", "Samantha", "Samuel", "Sawyer", "Selina",
  "Serena", "Seymour", "Shannon", "Sheldon", "Shelley", "Sherman", "Shirley",
  "Sidney", "Silvia", "Simone", "Sinclair", "Sloane", "Solomon", "Sophia",
  "Sophie", "Spencer", "Stanley", "Stella", "Stephen", "Sterling", "Stewart",
  "Summer", "Susanna", "Sylvia", "Tabitha", "Tallulah", "Tatiana", "Taylor",
  "Terence", "Teresa", "Thelma", "Theodore", "Theresa", "Thomas", "Tiffany",
  "Timothy", "Tobias", "Tristan", "Ulysses", "Ursula", "Valerie", "Vanessa",
  "Vaughan", "Vernon", "Veronica", "Victor", "Victoria", "Vincent", "Violet",
  "Vivian", "Wallace", "Walter", "Warren", "Wendell", "Wesley", "Whitney",
  "Wilbur", "Wilfred", "William", "Willow", "Winifred", "Winston", "Xavier",
  "Yolanda", "Yvette", "Yvonne", "Zachary",
];

export const NAME_MIN = 6;
export const NAME_MAX = 9;

/**
 * n cái tên khác nhau, luôn ra cùng một danh sách với cùng một n.
 *
 * Xáo bằng Fisher–Yates trên một luồng số riêng — KHÔNG dùng cỗ máy công bằng.
 * Danh sách mẫu là đầu VÀO của phép bốc thăm; nếu nó lấy số từ chính cỗ máy đó
 * thì hai lớp quấn vào nhau mà chẳng được gì.
 *
 * Xáo rồi cắt, chứ không bốc từng cái theo băm chỉ số: bốc theo băm thì phải tự
 * dò trùng, mà dò trùng sai thì lỗi chỉ hiện ra ở đúng vài cỡ danh sách.
 */
export function makeDemoRoster(n) {
  const want = Math.max(0, Math.floor(n));
  if (want > NAME_POOL.length) {
    throw new Error(`Hồ tên chỉ có ${NAME_POOL.length}, cần ${want}.`);
  }
  const pool = NAME_POOL.slice();
  let s = 0x9e3779b9; // hằng cố định — đổi nó là đổi danh sách mẫu của mọi lượt
  for (let i = pool.length - 1; i > 0; i--) {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    const j = s % (i + 1);
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  return pool.slice(0, want);
}
