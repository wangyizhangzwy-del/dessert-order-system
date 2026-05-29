import assert from "node:assert/strict";
import {
  buildBatchTitleMap,
  chineseWeekday,
  formatBatchListTitle,
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

assert.equal(formatBatchListTitle(2026, 3, "2026-05-28"), "2026-3-05-28-周四");

const titles = buildBatchTitleMap([
  { batch_id: "b1", order_date: "2026-05-27", created_at: "2026-01-01T00:00:00Z" },
  { batch_id: "b2", order_date: "2026-05-28", created_at: "2026-01-02T00:00:00Z" },
  { batch_id: "b3", order_date: "2026-06-01", created_at: "2026-01-03T00:00:00Z" },
]);
assert.equal(titles.get("b1"), "2026-1-05-27-周三");
assert.equal(titles.get("b2"), "2026-2-05-28-周四");
assert.equal(titles.get("b3"), "2026-3-06-01-周一");

const ts = parseOrderDateTimestamp("2026-05-28");
assert.ok(ts !== null);
const d = new Date(ts!);
assert.equal(d.getFullYear(), 2026);
assert.equal(d.getMonth(), 4);
assert.equal(d.getDate(), 28);

console.log("date-format tests passed");
