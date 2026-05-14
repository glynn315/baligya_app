// Shared API response & domain models matching the Baligya POS backend.

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface Paginated<T> {
  data: T[];
  links?: { first?: string; last?: string; prev?: string | null; next?: string | null };
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

// ─── Auth ─────────────────────────────────────────────────────
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

// ─── Tenant ───────────────────────────────────────────────────
// Module slugs are now data-driven — see GET /admin/modules. Keep this as
// a plain string so registering a new module needs no frontend type change.
export type TenantModule = string;

export interface Module {
  module_id: number;
  name: string;            // slug used in tenants.modules JSON
  display_name: string;
  description?: string | null;
  icon?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Tenant {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  status: 'pending' | 'active' | 'suspended' | string;
  is_verified: boolean;
  modules?: TenantModule[];
  subscription_plan?: SubscriptionPlan;
  subscription_ends_at?: string | null;
  has_active_subscription?: boolean;
  created_at: string;
}

// ─── Eatery reports ───────────────────────────────────────────
export interface EateryBestSellingRow {
  menu_item_id: number;
  item_name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface EateryDailyReport {
  date: string;
  total_revenue: number;
  paid_orders: number;
  unpaid_orders: number;
  cancelled: number;
  best_selling: EateryBestSellingRow[];
}

export interface EateryMonthlyReport {
  period_start: string;
  period_end: string;
  total_revenue: number;
  paid_orders: number;
  unpaid_orders: number;
  cancelled: number;
  best_selling: EateryBestSellingRow[];
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  display_name?: string;
  price: number;
  billing_cycle?: 'monthly' | 'yearly' | string;
  max_employees?: number;
  max_products?: number;
  features?: string[];
  is_active?: boolean;
}

// ─── User / Staff ─────────────────────────────────────────────
export type UserRole = 'super_admin' | 'owner' | 'manager' | 'cashier' | 'admin' | string;

export interface Employee {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  has_pin?: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  last_login_at?: string | null;
  email_verified: boolean;
  has_pin: boolean;
  tenant?: Tenant;
  created_at: string;
}

// ─── Catalog ──────────────────────────────────────────────────
export interface Category {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  products_count?: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active: boolean;
  products_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: number;
  category?: Category;
  category_id: number | null;
  supplier?: Supplier;
  supplier_id?: number | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  cost_price: number;
  stock_quantity: number;
  reorder_level: number;
  expiration_date?: string | null;
  image_url?: string | null;
  is_active: boolean;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Sales ────────────────────────────────────────────────────
export type PaymentMethod =
  | 'cash' | 'card' | 'gcash' | 'maya' | 'bank' | 'bank_transfer' | 'other' | string;

export type SaleStatus =
  | 'completed' | 'voided' | 'pending' | 'draft' | 'refunded' | 'partially_refunded' | string;

export interface SaleItem {
  id?: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  // `subtotal` for compatibility with older code; backend now sends `total`. Mirror both.
  subtotal?: number;
  discount?: number;
  total?: number;
}

export interface SalePayment {
  id?: number;
  payment_method: PaymentMethod;
  amount: number;
  reference_no?: string | null;
  paid_at?: string | null;
}

export interface SaleRefundItem {
  id?: number;
  sale_item_id: number;
  quantity: number;
  amount: number;
}

export interface SaleRefund {
  id: number;
  sale_id: number;
  total_refunded: number;
  reason: string;
  refund_method?: PaymentMethod;
  refunded_by?: { id: number; name: string };
  items?: SaleRefundItem[];
  created_at?: string;
}

export interface Sale {
  id: number;
  transaction_number: string;
  cashier?: { id: number; name: string };
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  change_amount: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  is_draft?: boolean;
  suspended_at?: string | null;
  suspension_note?: string | null;
  notes?: string | null;
  items?: SaleItem[];
  items_count?: number;
  payments?: SalePayment[];
  refunds?: SaleRefund[];
  total_refunded?: number;
  created_at: string;
}

export interface CreateSaleDto {
  items: { product_id: number; quantity: number; unit_price?: number; discount?: number }[];
  discount_amount?: number;
  tax_amount?: number;
  amount_paid?: number;
  payment_method?: PaymentMethod;
  notes?: string | null;
  as_draft?: boolean;
  payments?: SalePayment[];
}

export interface CommitSaleDto {
  payment_method: PaymentMethod;
  amount_paid: number;
  discount_amount?: number;
  tax_amount?: number;
  payments?: SalePayment[];
  notes?: string | null;
}

export interface RefundSaleDto {
  items: { sale_item_id: number; quantity: number }[];
  reason: string;
  refund_method?: PaymentMethod;
}

export interface Receipt {
  receipt_no: string;
  transaction_number: string;
  header: {
    store_name: string;
    address?: string | null;
    phone?: string | null;
    cashier?: string | null;
    date: string;
  };
  items: {
    name: string;
    quantity: number;
    unit_price: number;
    discount: number;
    total: number;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amount_paid: number;
  change: number;
  payments: { method: PaymentMethod; amount: number; reference_no?: string | null }[];
  status: SaleStatus;
  footer: { message?: string };
}

// ─── Expenses ─────────────────────────────────────────────────
export interface Expense {
  id: number;
  category: string;
  amount: number;
  description?: string | null;
  expense_date: string;
  created_at: string;
}

// ─── Inventory ────────────────────────────────────────────────
export interface InventoryLog {
  id: number;
  product?: Pick<Product, 'id' | 'name' | 'sku'>;
  performed_by?: { id: number; name: string };
  type: 'restock' | 'adjust' | 'sale' | 'return' | 'purchase' | 'adjustment' | 'initial' | string;
  quantity_change: number;
  quantity_before?: number;
  quantity_after: number;
  reference_id?: string | null;
  reference_type?: string | null;
  notes?: string | null;
  created_at: string;
}

// ─── Audit logs ───────────────────────────────────────────────
export interface AuditLog {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  user?: { id: number; name: string };
  created_at: string;
}

// ─── Barcode scanner ──────────────────────────────────────────
export interface BarcodeScanResult {
  rawValue: string;
  format: string;
}

// ─── Dashboard ────────────────────────────────────────────────
export interface PeriodTotals {
  sales_total?: number;
  sales_count?: number;
  expenses_total?: number;
  profit?: number;
  net_income?: number;
}

export interface DashboardSummary {
  today?: PeriodTotals;
  week?: PeriodTotals;
  month?: PeriodTotals;
  low_stock_count?: number;
  out_of_stock_count?: number;
}

// ─── Billing ──────────────────────────────────────────────────
export type InvoiceStatus = 'pending' | 'submitted' | 'paid' | 'cancelled' | 'expired' | string;

export interface InvoiceMerchant {
  gcash_number?: string | null;
  gcash_name?: string | null;
  qr_path?: string | null;
  instructions?: string[];
}

export interface Invoice {
  id: number;
  invoice_number: string;
  amount: number;
  billing_cycle: 'monthly' | 'yearly' | string;
  status: InvoiceStatus;
  payment_method: string;
  gcash_number?: string | null;
  reference_number?: string | null;
  due_at?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  subscription_plan?: SubscriptionPlan;
  merchant?: InvoiceMerchant;
  created_at?: string;
  updated_at?: string;
}

// Aggregated row returned by GET /dashboard/top-products.
// Shape comes from a SaleItem GROUP BY in the backend, not the Product table —
// hence `product_name` (not `name`) and no `category` / `image_url` / `price`.
export interface TopProduct {
  product_id: number;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

// ─── Eatery: Table service POS ────────────────────────────────
export type TableStatus = 'available' | 'occupied' | 'not_yet_paid' | string;
export type OrderPaymentStatus = 'not_yet_paid' | 'paid' | 'cancelled' | string;

export interface RestaurantTable {
  restaurant_table_id: number;
  table_number: number;
  label?: string | null;
  seats: number;
  status: TableStatus;
  notes?: string | null;
  active_order?: Order | null;
  created_at?: string;
  updated_at?: string;
}

export interface MenuItem {
  menu_item_id: number;
  category_id?: number | null;
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  image_url?: string | null;
  availability: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  order_item_id?: number;
  order_id?: number;
  menu_item_id: number;
  item_name: string;
  price: number;
  quantity: number;
  subtotal: number;
  notes?: string | null;
}

export interface Order {
  order_id: number;
  order_number: string;
  restaurant_table_id: number;
  table?: { restaurant_table_id: number; table_number: number; label?: string | null };
  cashier?: { id: number; name: string } | null;
  subtotal: number;
  total_amount: number;
  payment_status: OrderPaymentStatus;
  notes?: string | null;
  items?: OrderItem[];
  items_count?: number;
  payment?: Payment | null;
  created_at?: string;
  updated_at?: string;
}

export interface Payment {
  payment_id: number;
  order_id: number;
  order?: Order;
  cashier?: { id: number; name: string } | null;
  total_amount: number;
  cash_received: number;
  change_amount: number;
  payment_method: PaymentMethod;
  payment_date?: string;
  reference?: string | null;
  notes?: string | null;
  receipt?: { receipt_no: string; print_lines: string[] };
}

export interface CreateOrderDto {
  restaurant_table_id: number;
  items: { menu_item_id: number; quantity: number; notes?: string | null }[];
  notes?: string | null;
}

export interface AddOrderItemsDto {
  items: { menu_item_id: number; quantity: number; notes?: string | null }[];
}

export interface CreatePaymentDto {
  order_id?: number;
  table_id?: number;
  cash_received: number;
  payment_method?: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
}

export interface EaterySummary {
  total_sales_today: number;
  total_orders_today: number;
  tables: {
    available: number;
    occupied: number;
    not_yet_paid: number;
    total: number;
  };
}
