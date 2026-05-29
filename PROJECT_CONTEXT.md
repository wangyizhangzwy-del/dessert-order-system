# PROJECT_CONTEXT.md

## Project Overview

This is an internal dessert order management web app for parsing WeChat group order text.

The user posts dessert menus in WeChat using 接龙 format. Customers reply under the menu with their WeChat ID / nickname and order items. The app parses the pasted full 接龙 text, detects menu items, customer orders, SKU, flavors, quantity, notes, total amount, and generates editable tables and Excel-friendly output.

The app is a Next.js App Router project using TypeScript, Tailwind CSS, and localStorage. It is intended to run as a browser-based internal admin website.

Do not rewrite the project from scratch. Continue modifying the existing code.

Important commands:

```bash
npm run dev
npm run build
npm run test:parser
```

Always run `npm run test:parser` after parser changes. Always run `npm run build` before deployment-related changes.

---

## Core App Functions

The app currently needs to support:

* Paste full WeChat 接龙 text
* Parse menu section and customer order section
* Generate editable order detail table
* Generate customer summary
* Generate production summary
* Generate grouped Excel preview
* Copy grouped Excel table as TSV
* Copy order detail table as TSV
* Copy customer summary as TSV
* Copy production summary as TSV
* Save current 接龙 to localStorage
* Show saved records under “历史接龙”
* Open saved historical 接龙 back into the same editable page
* Customer management page
* Customer detail page showing historical orders
* Product analytics page
* Performance dashboard page (业绩分析): date-based KPIs + revenue/order/quantity/customer charts
* JSON backup export/import
* PasswordGate using `NEXT_PUBLIC_APP_PASSWORD`
* Warning/failed jump-to-row buttons
* Sticky table header for editable order detail table

---

## Important Naming

Use:

* “历史接龙”

Do not use:

* “历史批次”

The “客户管理” page should stay simple. It only needs:

* 客户 ID / wechat_id
* 点单次数
* 查看历史订单 button

Customer list must be sorted by order count descending. If tied, sort by most recent order date descending.

Product analytics must be sorted by total quantity descending.

---

## Data Persistence

The app uses localStorage for now.

Important saved data:

* saved jielongs / historical 接龙 records
* customers
* customer order history
* app settings

LocalStorage access must only run in browser/client-safe code. Avoid hydration errors. Do not read localStorage, window, document, sessionStorage, Date.now(), Math.random(), crypto.randomUUID() directly during server render.

Use mounted/client checks where needed.

---

## First Customer Order Rule

The first customer order row in the customer order section is always an example row.

It must be marked as example and must never count toward:

* total sales
* production summary
* customer summary
* grouped Excel output
* saved formal orders
* customer management
* customer historical orders
* product analytics
* CSV output

This rule must be permanent.

Do not show a checkbox for this rule. Do not ask the user. Always ignore the first customer order row for formal calculations.

The first row can still be displayed in the editable detail table for checking.

Implementation suggestion:

```ts
is_example: boolean
```

All summary/export/save/customer/product analytics code must filter:

```ts
!order.is_example
```

---

## Customer ID Rules

A customer ID / WeChat ID may contain:

* Chinese
* English
* numbers
* emoji
* spaces
* parentheses
* underscores
* dots
* punctuation

Examples:

```text
Lumi Sweets
LBJ 23
z     y  i
李念慈 (Claire)
爱吃酥冰🐰
🌑🌒🌓🌔🌕
🔆
..
nici_7
10000
```

Do not simply split customer ID at the first space.

The customer ID boundary is: from after the list index to the first clear order token.

Clear order tokens include:

* SKU number
* SKU with flavor, such as `1咸蛋黄`
* SKU with quantity, such as `11*3`
* SKU 8 with flavor combo
* current menu product name keyword
* SKU 1 fixed product aliases, such as 原味小贝 / 奶贝

Example:

```text
LBJ 23 焙茶草莓达克瓦滋 + 焦糖小泡芙
```

Correct:

```text
wechat_id = LBJ 23
order_text = 焙茶草莓达克瓦滋 + 焦糖小泡芙
```

Do not treat `23` as SKU 2 or SKU 3.

Example:

```text
z     y  i 原味小贝+奶贝+3+6+7
```

Correct:

```text
wechat_id = z     y  i
items = 原味小贝 + 奶贝 + SKU 3 + SKU 6 + SKU 7
```

---

## SKU 1 Fixed Rule

SKU 1 is always 肉松小贝.

SKU 1 is one box with one flavor. Multiple flavors mean multiple boxes, not a mixed box.

Supported input forms:

```text
1
1原味
1咸蛋黄
1芋泥
1麻薯
1奶贝
1（原味）
1（麻薯）
麻薯的1
咸蛋黄的1
原味小贝
咸蛋黄小贝
芋泥小贝
麻薯小贝
奶贝
芋泥奶贝
芋泥奶贝小贝
```

Mappings:

```text
1 = SKU 1 原味
1原味 = SKU 1 原味
1咸蛋黄 = SKU 1 咸蛋黄
1芋泥 = SKU 1 芋泥
1麻薯 = SKU 1 麻薯
1奶贝 = SKU 1 奶贝
原味小贝 = SKU 1 原味
奶贝 = SKU 1 奶贝
```

### SKU 1 口味与数字/产品名顺序无关

SKU 1 的口味、数字、产品名的书写顺序不重要。以下写法都表示同一个意思：

```text
1原味
原味1
原味肉松小贝
原味小贝
肉松小贝原味
1 原味
原味 1
```

都识别为：

```text
SKU 1
variant = 原味
quantity = 1
```

其他口味同理：

```text
芋泥1 = 1芋泥 = 芋泥肉松小贝 = 芋泥小贝
咸蛋黄1 = 1咸蛋黄 = 咸蛋黄肉松小贝
麻薯1 = 1麻薯 = 麻薯肉松小贝
奶贝1 = 1奶贝 = 奶贝肉松小贝
芋泥奶贝1 = 1芋泥奶贝 = 芋泥奶贝肉松小贝
```

判定规则：

* 一个 token 含有 SKU 1 口味词（原味 / 咸蛋黄 / 芋泥 / 麻薯 / 奶贝 / 芋泥奶贝），
  并且带有 SKU 1 信号（产品名词 肉松小贝 / 小贝 / 肉松，或一个独立的数字 `1`），即判定为 SKU 1 + 对应口味，数量默认 1。
* 单纯的口味词（如裸 `原味`）若没有 SKU 1 信号，不要硬判为 SKU 1，避免误判通用口味词。
  例外：`奶贝` / `芋泥奶贝` 作为独立商品名仍直接命中 SKU 1。
* 不要把纯数字（如 11、13）拆成 SKU 1。

If input is:

```text
1（原味+咸蛋黄+奶贝+芋泥）
```

It means multiple boxes:

```text
原味小贝 x 1
咸蛋黄小贝 x 1
奶贝小贝 x 1
芋泥小贝 x 1
```

Do not treat this as flavor_combo. Do not warning. Do not fail.

Prices should be parsed from the current menu first.

Example menu:

```text
1. 肉松小贝一盒三个（原味/咸蛋黄/芋泥/麻薯/奶贝）16.9/21.9/19.9/19.9/19.9
```

Fallback prices if menu parsing fails:

```text
原味 16.9
咸蛋黄 21.9
芋泥 19.9
麻薯 19.9
奶贝 19.9
芋泥奶贝 21.9
```

Excel/display names:

```text
原味小贝
咸蛋黄小贝
芋泥小贝
麻薯小贝
奶贝小贝 or 奶贝
芋泥奶贝小贝
```

---

## SKU 8 Fixed Rule

SKU 8 is always 牛油酥皮小泡芙一盒四个.

SKU 8 is one paid item. Its flavors are stored as `flavor_combo`, not separate charged items.

This rule applies to any 4-piece flavor-combination product in the current menu (SKU 8 style),
not only SKU 8. A menu item counts as a flavor-combo box when its name says “一盒 N 个 / N个”
and it lists multiple flavors. SKU 1 is never a combo box (one box = one flavor).

Valid flavors:

```text
原味
抹茶
黑芝麻
巧克力
焙茶
```

Supported forms:

```text
8
8原味
8（黑芝麻）
8原味+8抹茶
8（原味/抹茶）
8（原味 抹茶 黑芝麻 巧克力）
8（原味/抹茶/黑芝麻/巧克力）
8（原味+抹茶+黑芝麻+巧克力）
8（原味、抹茶、黑芝麻、巧克力）
8 抹茶黑芝麻巧克力抹茶
8（2抹茶2焙茶）
8（抹茶*2 焙茶*2）
8（抹茶x2 焙茶x2）
8（抹茶×2/焙茶×2）
8（抹茶✖️2 焙茶✖️2）
8（抹茶/黑芝麻/焙茶*2）
```

Examples:

```text
8（原味 抹茶 黑芝麻 巧克力）
```

Result:

```text
SKU 8 quantity 1
flavor_combo = 原味/抹茶/黑芝麻/巧克力
status = success
```

```text
8（2抹茶2焙茶）
```

Result:

```text
SKU 8 quantity 1
flavor_combo = 抹茶/抹茶/焙茶/焙茶
```

### Even flavor distribution (fewer than 4 flavors)

When fewer than 4 flavors are specified for a 4-piece combo box, distribute the 4 pieces
evenly across the specified flavors (grouped, in order). The repeated-SKU form
`8原味+8抹茶` and the bracket form `8（原味/抹茶）` both mean the same thing.

```text
8原味+8抹茶  =>  原味/原味/抹茶/抹茶
8抹茶+8焙茶  =>  抹茶/抹茶/焙茶/焙茶
8（原味/抹茶） =>  原味/原味/抹茶/抹茶
8原味        =>  原味/原味/原味/原味
8（黑芝麻）    =>  黑芝麻/黑芝麻/黑芝麻/黑芝麻
```

Generic example (if SKU 7 is a 4-piece combo product in the current menu):

```text
7原味+7抹茶  =>  SKU 7 flavor_combo = 原味/原味/抹茶/抹茶
7原味        =>  SKU 7 flavor_combo = 原味/原味/原味/原味
```

Rules:

* 1 flavor specified  => all 4 pieces that flavor, status = success.
* 2 flavors specified => distribute evenly 2 + 2, status = success.
* 4 flavors specified => keep as written, status = success.

If the flavor count cannot be evenly distributed into the box size (e.g. 3 flavors for a
4-piece box, or more than 4 flavors):

```text
status = warning
warning_reason = "SKU 8 口味数量不是4个，请人工确认"
```

Do not fail.

SKU 8 display / Excel name:

```text
酥皮泡芙（原味/抹茶/黑芝麻/巧克力）
```

SKU 8 parser must have priority over normal product fuzzy matching and notes parsing.

---

## Notes Rules

If an order line already has at least one valid product item, remaining unrecognized trailing content should become `notes`, not failed.

These are always notes, not products:

```text
自取
取
自提
配送
送
周三送
周四送
周五送
周六送
周日送
Kurve
Figueroa Eight
the Eden
the grand
park fifth
beaudry
aven
Amp Loft
Atelier
888
825 South Hill St
addresses
building names
trailing English/number notes
```

Examples:

```text
东东 4+5 fig 8
```

Correct:

```text
items = SKU 4 + SKU 5
notes = fig 8
```

Do not parse the 8 in `fig 8` as SKU 8.

```text
Yuisum 2 Figueroa Eight
```

Correct:

```text
SKU 2
notes = Figueroa Eight
```

```text
killua 4 自取
```

Correct:

```text
SKU 4
notes = 自取
```

```text
nici_7 3+7自取
```

Correct:

```text
SKU 3 + SKU 7
notes = 自取
```

---

## Symbol Normalization

Normalize only order text, not customer ID.

### Connectors (mean “和” / plus)

Between multiple products, a space, plus sign, or hyphen all mean “和” (and):

```text
2 3
2+3
2-3
2➕3
2＋3
```

都表示：

```text
SKU 2 quantity = 1
SKU 3 quantity = 1
```

Plus/connectors:

```text
+
＋
➕
﹢
-
–
—
－
```

Important: `-` means plus only when between SKU numbers, such as:

```text
4-7 = SKU 4 + SKU 7
```

Do not break customer IDs or addresses containing hyphens.

### Quantity (SKU × quantity)

Multipliers:

```text
x
X
×
✖
✖️
*
＊
```

Quantity forms:

```text
2*2
2x2
2X2
2×2
2✖2
2 ✖️ 2
11*3
11＊3
11x3
11X3
11×3
11✖3
11✖️3
11 * 3
11 x 3
11 × 3
```

The rule is:

```text
SKU × quantity
```

第一个数字是 SKU，第二个数字是数量。

```text
2*2 = SKU 2 quantity = 2
10x2 = SKU 10 quantity = 2
11*3 = SKU 11 quantity = 3
```

Do not read `10x2` as SKU 2 quantity 10. The first number is always the SKU, the second is always the quantity.

---

## Product Name Matching

Customers may write product names instead of SKU numbers.

Example:

```text
LBJ 23 焙茶草莓达克瓦滋 + 焦糖小泡芙
```

Correct:

```text
wechat_id = LBJ 23
items = matched current menu item for 焙茶草莓达克瓦滋 + matched current menu item for 焦糖小泡芙
status = success
```

Do not parse 23 as SKU.

Product matching must use current menu items. Do not hard-code SKU meanings except SKU 1 and SKU 8 special rules.

If a product keyword uniquely matches one current menu item, success.

If ambiguous, warning.

Examples:

```text
焙茶草莓达克瓦滋
达克瓦滋
达克瓦兹
达克瓦子
焦糖小泡芙
原味小贝
奶贝
```

`泡芙` alone may be ambiguous if multiple puff products exist, so warning.

`焦糖小泡芙` should uniquely match a current menu item containing 焦糖 and 小泡芙.

---

## Excel Output

Most important output is grouped Excel TSV.

Columns:

```text
日期
客户
商品
数量
单价
客户总金额
备注
```

Each customer is a group.

First row of a customer group shows:

```text
date, customer, first product, quantity, price, customer_total, notes
```

Following rows show only product, quantity, price.

Customers are separated by one blank row.

Use TSV:

```text
\t between columns
\n between rows
```

Example:

```text
5.28	lily	焦糖脆壳泡芙	1	19.9	55.7	888
		焙茶达克瓦滋	1	15.9		
		香葱卷	1	19.9		
```

---

## Save / History

Saving current 接龙 must save the current edited state, not the raw parser result.

Save:

```text
batch_id
batch_name
order_date
raw_text
current parsed_orders
current editable detail rows
customer summary
production summary
grouped Excel preview
total sales
warning_count
failed_count
created_at
updated_at
```

The history page is called:

```text
历史接龙
```

Opening a saved historical record must return to the same editable page as after recognition.

Historical records must be editable and re-saveable.

Re-saving the same batch_id should update the record, not create duplicates.

Customer order history should upsert by batch_id, not duplicate.

---

## Customer Management

Customer management page is simple.

Show only:

```text
客户 ID / wechat_id
点单次数
查看历史订单 button
```

Sort customers by:

1. order count descending
2. most recent order date descending
3. wechat_id

Customer detail page shows all historical orders for that customer.

Customer detail order history sorted newest to oldest.

Order history fields:

```text
date
batch name
product display name
SKU
variant
flavor_combo
quantity
unit_price
line_total
customer_total
notes
```

---

## Product Analytics

Product analytics uses saved historical 接龙 records.

Fields:

```text
SKU
product name
variant
flavor_combo
total_quantity
batch_count
total_revenue
last_order_date
```

Sort by:

1. total_quantity descending
2. total_revenue descending
3. last_order_date descending

SKU 1 should be split by flavor.

SKU 8 can be split by flavor_combo.

---

## Performance Dashboard (业绩分析)

Page route: `/performance`, nav label “业绩分析”.

Uses saved historical 接龙 (`getSavedJielongs`), excludes example orders (`is_example`),
and aggregates by `order_date` in chronological (ascending) order. Same dates across
different batches are merged.

KPI cards:

```text
总销售额      = sum of non-example order customer_total
总订单数      = count of non-example orders
总客户数      = unique wechat_id across all non-example orders
平均客单价    = 总销售额 / 总订单数
总商品数量    = sum of item.quantity across non-example orders
```

Charts (numeric labels always visible, not hover-only; lightweight inline SVG):

```text
每日销售额趋势        line chart, x=date asc, y=daily revenue
每日订单数 / 商品数量   grouped bar chart, x=date asc, y=count
每日客户数            bar chart, x=date asc, y=unique customers
```

Empty state when no saved history:

```text
暂无历史接龙数据，请先保存接龙后查看业绩分析。
```

Aggregation lives in `lib/performanceAnalytics.ts` (`buildPerformanceAnalytics`),
covered by `npm run test:analytics`.

---

## Warning / Failed Jump

Recognition page top shows warning and failed counts.

Click Warning:

* scroll to next warning row
* highlight row for 2 seconds
* cycle through warning rows

Click Failed similarly.

If status is edited to success, counts update live.

---

## UI Rules

Remove the top hero/description card on recognition page.

Do not show “忽略第一行 Lumi Sweets 示例订单”.

Status colors:

```text
已送达 = blue background + white text
已付款 = red background + white text
```

Editable detail table must have sticky header.

---

## Backup

Keep:

* Export all data JSON
* Import all data JSON

Export includes:

```text
saved jielongs
customers
customer order_history
settings
version
exported_at
```

Import warns before overwrite.

Bad JSON must not crash app.

---

## PasswordGate

If `NEXT_PUBLIC_APP_PASSWORD` is not set, enter directly.

If set, show password page.

Correct password is stored in sessionStorage for current browser session.

Do not read sessionStorage during server render; use a mounted/client guard so the gate state is decided only on the client (avoids hydration mismatch).

---

## Regression Tests Must Cover

Important cases for `npm run test:parser`:

```text
First customer order is example and excluded
Rain 13 uses current menu, not hard-coded blind box
不嘻嘻 麻薯的1 + 2 + 10 + 14
Didiland 4+8（原味 抹茶 黑芝麻 巧克力）
Angia 3 + 4 + 8（抹茶/黑芝麻/焙茶*2）Kurve 周四送
Sarah 8 抹茶黑芝麻巧克力抹茶+4
… 8（2抹茶2焙茶） aven
🌑🌒🌓🌔🌕 1（原味+咸蛋黄+奶贝+芋泥）
东东 4+5 fig 8
.. 4➕11 aven
🐷YEALIM LEE 4-7
🔆7
K 1（原味）+1（麻薯）+2+11*3
LBJ 23 焙茶草莓达克瓦滋 + 焦糖小泡芙
z     y  i 原味小贝+奶贝+3+6+7
SKU 1 口味/数字/产品名顺序不限：原味1 / 1原味 / 原味肉松小贝 / 肉松小贝原味 / 原味 1 / 1 原味 / 芋泥1 / 咸蛋黄1 / 麻薯1 / 奶贝1 / 芋泥奶贝1
SKU × quantity 顺序：10x2 = SKU10 数量2（不是 SKU2 数量10）
空格/加号/横杠都表示“和”：2 3 / 2+3 / 2-3
四件组合盒口味平均分配：8原味+8抹茶 => 原味/原味/抹茶/抹茶；8原味 => 原味x4；8（原味/抹茶）=> 2+2
通用 4 件组合盒：7原味+7抹茶 => SKU7 原味/原味/抹茶/抹茶（SKU 7 为本次菜单的四件口味组合盒）
```

---

## Development Rules for Cursor Agent

Do not rewrite the project.

Do not replace the whole parser unless absolutely necessary.

Prefer small targeted changes.

After parser changes, run:

```bash
npm run test:parser
npm run build
```

If hydration error appears, check:

* localStorage/window/document/sessionStorage used during render
* Date.now/new Date/Math.random/crypto.randomUUID during render
* invalid HTML nesting, especially `<p>` containing block elements
* server/client mismatch

Use mounted/client guards when needed.

---

## 数据存储后端（localStorage / Supabase 双后端）

为了在 Vercel 多设备共享数据，新增了 Supabase 后端，并保留 localStorage 作为默认/回退。

### 后端切换
* 由环境变量 `NEXT_PUBLIC_DATA_BACKEND` 决定：
  * `=supabase` → 走云端 API（多设备共享）。
  * 未设置 / 其他值 → 使用本机 localStorage（与旧版行为一致）。
* `lib/storage.ts` 是统一的「异步」外观层，根据上面的开关分发到：
  * `lib/storageLocal.ts`（localStorage 实现）。
  * `lib/dataClient.ts`（调用 `/api/*` 的客户端）。
* 重要：所有 storage 读写函数现在都是 `async`（返回 Promise）。页面已改为 `useEffect` 异步加载 + loading 占位。

### 架构（安全）
* 客户端 **不直接** 连接 Supabase。
* 浏览器 → Next.js Route Handlers（`app/api/*`） → Supabase（`service_role` 密钥，仅服务端）。
* `service_role` 密钥只在服务端环境变量，绝不使用 `NEXT_PUBLIC_`。
* API 路由鉴权：若服务端设置了 `APP_PASSWORD`，请求需带 `x-app-password` 头（客户端发送 `NEXT_PUBLIC_APP_PASSWORD` 的值）；未设置则放行（仅本地/开发）。
* RLS 全部开启且无公开策略，只有 `service_role`（服务端）可读写。

### Supabase 数据表
* `batches`：历史接龙，订单的唯一真源。标量列（batch_id 唯一、batch_name、order_date、total_amount、warning_count、failed_count、ignore_example_order、created_at、updated_at）+ `payload jsonb`（完整 SavedJielong）。
* `customers`：客户档案 + `order_history jsonb`（wechat_id 唯一）。
* `app_settings`：单行（id=1）共享设置。
* `app_draft`：单行（id=1）共享草稿，跨设备同步，**last-write-wins**。
* 建表脚本见 `supabase/schema.sql`。
* 客户历史的合并逻辑抽到纯函数 `lib/customerHistory.ts`，本地与服务端复用。
* 产品分析 / 业绩分析仍由 `batches` 派生（`buildProductAnalytics` / `buildPerformanceAnalytics` 未改），只是数据来源改为云端读取。

### JSON 导出 / 导入 与迁移
* 导出 / 导入在两种后端都可用：云端走 `/api/export`、`/api/import`。
* 云端导入按 `batch_id` / `wechat_id` **合并 upsert**（幂等，不产生重复，不删除未包含的数据）。
* 数据备份页提供「迁移本机数据到云端」按钮：读取本机 localStorage（始终用 `readLocalRawForMigration` 读本地）→ 上传 `/api/import`，可重复执行。

### 环境变量（见 `.env.example`）
* `NEXT_PUBLIC_APP_PASSWORD`：访问密码门（客户端）。
* `NEXT_PUBLIC_DATA_BACKEND`：`supabase` 启用云端。
* `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`：服务端（云端必填）。
* `APP_PASSWORD`：服务端授权 API 的密码（建议与 `NEXT_PUBLIC_APP_PASSWORD` 相同）。

### Supabase 启用步骤
1. 新建 Supabase 项目，记录 Project URL 与 `service_role` 密钥。
2. 在 SQL Editor 运行 `supabase/schema.sql`（建表 + 开启 RLS）。
3. 在 Vercel（及本地 `.env.local`）配置上面 4 个 Supabase 相关变量，并设 `NEXT_PUBLIC_DATA_BACKEND=supabase`。
4. 部署后用「数据备份 → 迁移本机数据到云端」把旧的本机历史上传。

---

## Current Next Priorities

When continuing development, check:

1. First customer order is always ignored from all formal stats.
2. SKU 8 flavor combo is stable.
3. Product name matching works.
4. Customer IDs with numbers/spaces are not mis-split.
5. Saved history opens back into editable page.
6. Customer management sorts by order count descending.
7. Product analytics sorts by quantity descending.
8. Editable detail table header is sticky.
9. SKU 1 flavor/number/product-name order is interchangeable.
10. SKU × quantity order is respected (first number = SKU, second = quantity).
