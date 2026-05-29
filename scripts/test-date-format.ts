import assert from "node:assert/strict";
import {
  chineseWeekday,
  formatDateWithWeekday,
  generateBatchName,
  parseLocalDate,
  parseOrderDateTimestamp,
} from "../lib/dateFormat";

assert.deepEqual(parseLocalDate("2026-05-28"), { year: 2026, month: 5, day: 28 });
assert.deepEqual(parseLocalDate("5.28"), { year: new Date().getFullYear(), month: 5, day: 28 });
assert.equal(chineseWeekday("2026-05-28"), "周四");
assert.equal(formatDateWithWeekday("2026-05-28"), "2026-05-28 周四");
assert.equal(formatDateWithWeekday("5.28"), `5/28 周四`);
assert.match(generateBatchName("2026-05-28"), /^接龙-2026-05-28-周/);

const ts = parseOrderDateTimestamp("2026-05-28");
assert.ok(ts !== null);
const d = new Date(ts!);
assert.equal(d.getFullYear(), 2026);
assert.equal(d.getMonth(), 4);
assert.equal(d.getDate(), 28);

console.log("date-format tests passed");
