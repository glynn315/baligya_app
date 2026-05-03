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
  subscription_plan?: SubscriptionPlan;
  subscription_ends_at?: string | null;
  has_active_subscription?: boolean;
  created_at: string;
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
export type UserRole = 'owner' | 'manager' | 'cashier' | 'admin' | string;

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

export interface Product {
  id: number;
  category?: Category;
  category_id: number | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  cost_price: number;
  stock_quantity: number;
  reorder_level: number;
  image_url?: string | null;
  is_active: boolean;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Sales ────────────────────────────────────────────────────
export type PaymentMethod = 'cash' | 'card' | 'gcash' | 'maya' | 'bank' | string;
export type SaleStatus = 'completed' | 'voided' | 'pending' | string;

export interface SaleItem {
  id?: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
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
  notes?: string | null;
  items?: SaleItem[];
  items_count?: number;
  created_at: string;
}

export interface CreateSaleDto {
  items: { product_id: number; quantity: number; unit_price?: number }[];
  discount_amount?: number;
  tax_amount?: number;
  amount_paid: number;
  payment_method: PaymentMethod;
  notes?: string | null;
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
  type: 'restock' | 'adjust' | 'sale' | 'return' | string;
  quantity_change: number;
  quantity_after: number;
  notes?: string | null;
  created_at: string;
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
