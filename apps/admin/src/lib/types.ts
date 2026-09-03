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
