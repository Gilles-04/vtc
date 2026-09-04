export type DriverCategory = 'car' | 'moto'
export type DriverStatus = 'pending_documents' | 'pending_review' | 'approved' | 'rejected' | 'suspended'
export type DocStatus = 'pending' | 'approved' | 'rejected'
export type DriverDocType = 'piece_identite' | 'permis_conduire' | 'carte_transport' | 'assurance' | 'carte_grise' | 'photo_vehicule'
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled'
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
export type RideOfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired'
export type PaymentMethodType = 'cash' | 'mobile_money'

export interface Vehicle {
  brand: string
  model: string
  color: string
  plate_number: string
  year: number | null
}

export interface DriverDocument {
  id: string
  doc_type: DriverDocType
  file_path: string
  status: DocStatus
  rejection_reason: string | null
  created_at: string
}

export interface DriverRecord {
  id: string
  category: DriverCategory
  status: DriverStatus
  city: string | null
  is_available: boolean
  rating_avg: number
  rating_count: number
  total_rides: number
  vehicles: Vehicle | null
  driver_documents: DriverDocument[]
}

export interface SubscriptionPlan {
  id: string
  code: string
  name: string
  duration_hours: number
  price_fcfa: number | null
}

export interface ActiveSubscription {
  id: string
  status: SubscriptionStatus
  expires_at: string
  subscription_plans: { name: string } | null
}

export interface RideOffer {
  id: string
  ride_id: string
  expires_at: string
  rides: {
    category: DriverCategory
    pickup_address: string
    dropoff_address: string
    estimated_fare_fcfa: number | null
    estimated_distance_km: number | null
  }
}

export interface ActiveRide {
  id: string
  status: RideStatus
  category: DriverCategory
  pickup_address: string
  dropoff_address: string
  estimated_fare_fcfa: number | null
  estimated_distance_km: number | null
  estimated_duration_min: number | null
  payment_method: PaymentMethodType
  profiles: { phone: string | null; full_name: string | null } | null
}

export interface RideHistoryRow {
  id: string
  category: DriverCategory
  status: RideStatus
  pickup_address: string
  dropoff_address: string
  final_fare_fcfa: number | null
  estimated_fare_fcfa: number | null
  requested_at: string
}
