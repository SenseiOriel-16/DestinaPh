export type UserRole = "admin" | "business_owner" | "consumer";

export type BusinessStatus = "pending" | "approved" | "rejected";

export type SubscriptionPlanCode = "free" | "premium";

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  color_token: string | null;
}

export interface Municipality {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  category_id: string;
  subcategory: string | null;
  municipality_id: string;
  description: string | null;
  pricing_text: string | null;
  latitude: number | null;
  longitude: number | null;
  status: BusinessStatus;
  is_featured: boolean;
  is_premium: boolean;
  views: number;
  clicks: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessPhoto {
  id: string;
  business_id: string;
  storage_path: string;
  public_url: string | null;
  sort_order: number;
}

export interface SubscriptionPlan {
  id: string;
  code: SubscriptionPlanCode;
  name: string;
  price_monthly_cents: number;
  description: string | null;
  booking_enabled: boolean;
}

export interface BusinessSubscription {
  id: string;
  business_id: string;
  plan_id: string;
  started_at: string;
  expires_at: string | null;
}

export interface Booking {
  id: string;
  business_id: string;
  user_id: string;
  status: string;
  notes: string | null;
  requested_at: string;
}

export interface RoutePoint {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}
