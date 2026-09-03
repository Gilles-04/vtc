export type DriverCategory = 'car' | 'moto'
export type DriverStatus = 'pending_documents' | 'pending_review' | 'approved' | 'rejected' | 'suspended'
export type DocStatus = 'pending' | 'approved' | 'rejected'
export type DriverDocType = 'piece_identite' | 'permis_conduire' | 'carte_transport' | 'assurance' | 'carte_grise' | 'photo_vehicule'
export type RideStatus =
  | 'requested'
  | 'searching'
  | 'accepted'
  | 'driver_arriving'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_passenger'
  | 'cancelled_by_driver'
  | 'cancelled_by_system'
export type PaymentMethodType = 'cash' | 'mobile_money'
export type PaymentStatus = 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'refunded'
export type PaymentPurpose = 'driver_subscription' | 'ride_fare'
export type PaymentProvider = 'flooz' | 'tmoney' | 'manual'
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled'
export type SettlementStatus = 'pending' | 'settled'
export type AppUserRole = 'passenger' | 'driver'

export interface DriverListRow {
  id: string
  category: DriverCategory
  status: DriverStatus
  city: string | null
  rating_avg: number
  rating_count: number
  total_rides: number
  created_at: string
  profiles: { phone: string | null; full_name: string | null } | null
}

export interface Vehicle {
  id: string
  brand: string
  model: string
  color: string
  plate_number: string
  year: number | null
  photo_path: string | null
}

export interface DriverDocument {
  id: string
  doc_type: DriverDocType
  file_path: string
  status: DocStatus
  rejection_reason: string | null
  reviewed_at: string | null
  created_at: string
}

export interface DriverDetail {
  id: string
  category: DriverCategory
  status: DriverStatus
  city: string | null
  rating_avg: number
  rating_count: number
  total_rides: number
  created_at: string
  profiles: { phone: string | null; full_name: string | null } | null
  vehicles: Vehicle[]
  driver_documents: DriverDocument[]
}

export interface Zone {
  id: string
  name: string
  city: string
  night_start_time: string
  night_end_time: string
  is_active: boolean
  created_at: string
}

export interface RideListRow {
  id: string
  category: DriverCategory
  status: RideStatus
  pickup_address: string
  dropoff_address: string
  estimated_fare_fcfa: number | null
  final_fare_fcfa: number | null
  payment_method: PaymentMethodType
  payment_status: PaymentStatus
  zone_id: string | null
  requested_at: string
  completed_at: string | null
  profiles: { phone: string | null; full_name: string | null } | null
  drivers: { profiles: { phone: string | null; full_name: string | null } | null } | null
}

export interface PaymentListRow {
  id: string
  user_id: string
  purpose: PaymentPurpose
  amount_fcfa: number
  provider: PaymentProvider
  provider_ref: string | null
  status: PaymentStatus
  created_at: string
  confirmed_at: string | null
  ride_id: string | null
  profiles: { phone: string | null; full_name: string | null } | null
}

export interface InvoiceListRow {
  id: string
  invoice_number: string
  transport_amount_fcfa: number
  platform_fee_fcfa: number
  total_fcfa: number
  payment_method: PaymentMethodType
  issued_at: string
  profiles: { phone: string | null; full_name: string | null } | null
  drivers: { profiles: { phone: string | null; full_name: string | null } | null } | null
}

export interface SubscriptionPlan {
  id: string
  code: string
  name: string
  category: DriverCategory
  duration_hours: number
  price_fcfa: number | null
  is_active: boolean
  sort_order: number
}

export interface SubscriptionListRow {
  id: string
  status: SubscriptionStatus
  started_at: string
  expires_at: string
  drivers: { category: DriverCategory; profiles: { phone: string | null; full_name: string | null } | null } | null
  subscription_plans: { name: string; duration_hours: number; price_fcfa: number | null } | null
}

export interface DriverForSettlement {
  id: string
  category: DriverCategory
  profiles: { phone: string | null; full_name: string | null } | null
}

export interface SettlementListRow {
  id: string
  period_start: string
  period_end: string
  rides_count: number
  gross_transport_fcfa: number
  platform_fees_fcfa: number
  status: SettlementStatus
  settlement_method: string | null
  settled_at: string | null
  drivers: { category: DriverCategory; profiles: { phone: string | null; full_name: string | null } | null } | null
}

export interface UserListRow {
  id: string
  full_name: string | null
  phone: string | null
  is_suspended: boolean
  created_at: string
  user_roles: { role: AppUserRole }[]
}

export interface UserDetail {
  id: string
  full_name: string | null
  phone: string | null
  language: string
  is_suspended: boolean
  suspended_reason: string | null
  created_at: string
  user_roles: { role: AppUserRole }[]
}

export interface UserRideHistoryRow {
  id: string
  category: DriverCategory
  status: RideStatus
  pickup_address: string
  dropoff_address: string
  final_fare_fcfa: number | null
  estimated_fare_fcfa: number | null
  requested_at: string
}

export interface VehicleListRow {
  id: string
  brand: string
  model: string
  color: string
  plate_number: string
  year: number | null
  drivers: { id: string; category: DriverCategory; profiles: { phone: string | null; full_name: string | null } | null } | null
}

export interface PricingRule {
  id: string
  category: DriverCategory
  zone_id: string | null
  base_fare_fcfa: number
  price_per_km_fcfa: number
  price_per_min_fcfa: number
  minimum_fare_fcfa: number
  night_multiplier_percent: number
  effective_from: string
  zones: { name: string; city: string } | null
}

export interface AdminStatsOverview {
  rides_today: number
  rides_today_car: number
  rides_today_moto: number
  rides_completed_today: number
  active_drivers_car: number
  active_drivers_moto: number
  approved_drivers_car: number
  approved_drivers_moto: number
  pending_kyc: number
  active_subscriptions_car: number
  active_subscriptions_moto: number
  subscription_revenue_today_car_fcfa: number
  subscription_revenue_today_moto_fcfa: number
  platform_fees_today_car_fcfa: number
  platform_fees_today_moto_fcfa: number
  platform_fees_pending_settlement_fcfa: number
  rides_volume_today_fcfa: number
  payments_cash_today_count: number
  payments_cash_today_fcfa: number
  payments_mobile_money_today_count: number
  payments_mobile_money_today_fcfa: number
  payments_failed_today_count: number
  refunds_today_count: number
  refunds_today_fcfa: number
  driver_earnings_today_fcfa: number
  open_sos: number
  open_reports: number
  open_support_tickets: number
  open_fraud_flags: number
}
