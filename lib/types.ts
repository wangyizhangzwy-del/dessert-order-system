export type ParseStatus = "success" | "warning" | "failed";

export interface SkuVariant {
  variant_name: string;
  price: number;
}

export interface MenuItem {
  sku_code: string;
  cake_name: string;
  price?: number;
  has_variants: boolean;
  default_variant?: string;
  variants?: SkuVariant[];
}

export interface OrderItem {
  sku_code: string;
  variant?: string;
  flavor_combo?: string;
  cake_name: string;
  display_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface ParsedOrder {
  id: string;
  raw_line: string;
  wechat_id: string;
  items: OrderItem[];
  customer_total: number;
  status: ParseStatus;
  notes: string;
  warning_reason?: string;
  is_example?: boolean;
}

export interface Customer {
  id: string;
  wechat_id: string;
  phone?: string;
  default_address?: string;
  default_delivery_method?: string;
  balance: number;
  notes?: string;
  order_history: CustomerOrderHistory[];
  created_at: string;
  updated_at: string;
}

export interface CustomerOrderHistory {
  batch_id: string;
  batch_name: string;
  order_date: string;
  raw_line: string;
  items: OrderItem[];
  customer_total: number;
  notes: string;
  status: ParseStatus;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  name: string;
  date: string;
  raw_text: string;
  menu_items: MenuItem[];
  orders: ParsedOrder[];
  created_at: string;
  updated_at: string;
}

export interface EditableOrderRow {
  row_id: string;
  sequence: number;
  raw_line: string;
  wechat_id: string;
  sku_code: string;
  variant: string;
  flavor_combo: string;
  cake_name: string;
  display_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes: string;
  status: ParseStatus;
  warning_reason: string;
  is_example: boolean;
  production_status?: string;
}

export interface AppSettings {
  ignoreExampleOrder: boolean;
}

export interface DraftPayload {
  raw_text: string;
  menu_items: MenuItem[];
  orders: ParsedOrder[];
}

export interface BackupData {
  version: string;
  exported_at: string;
  saved_jielongs: SavedJielong[];
  customers: Customer[];
  app_settings: AppSettings;
}

export interface SavedJielong {
  batch_id: string;
  batch_name: string;
  order_date: string;
  raw_text: string;
  menu_items: MenuItem[];
  parsed_orders: ParsedOrder[];
  editable_rows: EditableOrderRow[];
  customer_summary_rows: {
    wechat_id: string;
    items_summary: string;
    customer_total: number;
    notes: string;
    status: ParseStatus;
    delivery_mode?: "default" | "pickup" | "custom";
    delivery_custom?: string;
  }[];
  production_summary_rows: {
    key: string;
    sku_code: string;
    variant: string;
    cake_name: string;
    display_name: string;
    total_quantity: number;
  }[];
  grouped_excel_rows: {
    date: string;
    customer: string;
    product: string;
    quantity: string;
    unit_price: string;
    customer_total: string;
    notes: string;
    delivery_status: string;
    payment_status: string;
    production_status?: string;
  }[];
  total_amount: number;
  warning_count: number;
  failed_count: number;
  ignore_example_order: boolean;
  created_at: string;
  updated_at: string;
}
