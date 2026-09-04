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

// Paiements d'abonnement du chauffeur connecté (purpose='driver_subscription'),
// utilisés pour générer les reçus PDF (docs/10-paiements.md §Historique et
// reçus) — jamais la ligne `payments` complète, uniquement les champs
// nécessaires au reçu.
export interface SubscriptionPayment {
  id: string
  amount_fcfa: number
  provider: string
  provider_ref: string | null
  status: string
  metadata: { plan_id?: string; plan_code?: string }
  created_at: string
  confirmed_at: string | null
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
}

export interface RideHistoryRow {
  id: string
  category: DriverCategory
  status: RideStatus
  pickup_address: string
  dropoff_address: string
  final_fare_fcfa: number | null
  estimated_fare_fcfa: number | null
  final_distance_km: number | null
  requested_at: string
}

// Facture générée automatiquement à la complétion d'une course payée
// (trigger `generate_invoice_on_ride_success`, docs/10-paiements.md
// §Facturation) — jamais une pour toute course terminée : seulement
// `completed` + `payment_status = 'success'`.
export interface RideInvoice {
  id: string
  invoice_number: string
  ride_id: string
  transport_amount_fcfa: number
  platform_fee_fcfa: number
  total_fcfa: number
  payment_method: PaymentMethodType
  payment_reference: string | null
  issued_at: string
}

// Renvoyées par les fonctions dédiées `get_ride_driver_public_info` /
// `get_ride_passenger_public_info` (migration 13) — jamais par lecture
// directe de `drivers`/`profiles`, RLS bloquée entre passager et chauffeur
// (voir docs/11-securite.md §RLS).
export interface DriverPublicInfo {
  full_name: string | null
  rating_avg: number
  vehicle_brand: string | null
  vehicle_model: string | null
  vehicle_color: string | null
  vehicle_plate: string | null
}

export interface PassengerPublicInfo {
  full_name: string | null
}

export interface Zone {
  id: string
  name: string
  city: string
}

export interface PassengerActiveRide {
  id: string
  status: RideStatus
  category: DriverCategory
  pickup_address: string
  dropoff_address: string
  estimated_fare_fcfa: number | null
  estimated_distance_km: number | null
  payment_method: PaymentMethodType
  driver_id: string | null
}

export interface FareEstimate {
  pricing_rule_id: string
  fare_fcfa: number
  is_night: boolean
  distance_km: number
  duration_min: number
}
