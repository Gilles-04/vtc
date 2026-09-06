import { useState } from 'react'
import { Badge } from '../../components/Badge'
import { SosButton } from '../../components/Sos'
import { ReportModal } from '../../components/Report'
import { ProfileModal } from '../../components/Profile'
import { NotificationsBell } from '../../components/Notifications'
import { SupportButton } from '../../components/Support'
import { RatingModal } from '../../components/RatingModal'
import { usePassengerDashboard } from './usePassengerDashboard'
import { ActiveRideSection } from './ActiveRideSection'
import { RequestRideSection } from './RequestRideSection'
import { HistorySection } from './HistorySection'

const REPORT_CATEGORIES = [
  { value: 'comportement_chauffeur', label: 'Comportement du chauffeur' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'etat_vehicule', label: 'État du véhicule' },
  { value: 'itineraire', label: 'Itinéraire / détour' },
  { value: 'paiement', label: 'Litige de paiement' },
  { value: 'autre', label: 'Autre' },
]

export function PassengerHome() {
  const [profileOpen, setProfileOpen] = useState(false)
  const d = usePassengerDashboard()

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-600 text-lg">🚕</span>
          <span className="font-display text-lg font-bold text-ink-900">VTC Togo</span>
        </div>
        <div className="flex items-center gap-4">
          {d.userId && <NotificationsBell userId={d.userId} />}
          <SosButton rideId={d.activeRide?.id ?? null} />
          {d.userId && <SupportButton userId={d.userId} />}
          <button onClick={() => setProfileOpen(true)} className="text-sm font-medium text-ink-600 hover:underline">
            Profil
          </button>
          <button onClick={d.handleSignOut} className="text-sm font-medium text-ink-600 hover:underline">
            Se déconnecter
          </button>
        </div>
      </header>

      {d.error && (
        <div className="mx-auto mb-4 max-w-2xl px-4">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{d.error}</div>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 pb-16">
        {d.activeRide === undefined && <p className="p-8 text-center text-sm text-ink-400">Chargement…</p>}

        {d.activeRide && (
          <ActiveRideSection activeRide={d.activeRide} driverInfo={d.driverInfo} busy={d.busy} onCancel={d.cancelRide} onReport={d.setReportRideId} />
        )}

        {d.activeRide === null && (
          <RequestRideSection
            category={d.category}
            onCategoryChange={d.setCategory}
            pickup={d.pickup}
            onPickupChange={d.setPickup}
            dropoff={d.dropoff}
            onDropoffChange={d.setDropoff}
            zones={d.zones}
            zoneId={d.zoneId}
            onZoneIdChange={d.setZoneId}
            paymentMethod={d.paymentMethod}
            onPaymentMethodChange={d.setPaymentMethod}
            estimate={d.estimate}
            estimateError={d.estimateError}
            estimating={d.estimating}
            busy={d.busy}
            onEstimate={d.estimateFare}
            onConfirm={d.confirmRequest}
          />
        )}

        {d.history.length > 0 && (
          <HistorySection history={d.history} invoicesByRide={d.invoicesByRide} onDownloadInvoice={d.downloadInvoice} onReport={d.setReportRideId} />
        )}

        {d.activeRide === null && d.history.length === 0 && (
          <p className="mt-2 text-center text-xs text-ink-400">
            <Badge tone="default">Aucune course pour le moment</Badge>
          </p>
        )}
      </main>

      {d.reportRideId && d.userId && (
        <ReportModal rideId={d.reportRideId} reporterId={d.userId} categories={REPORT_CATEGORIES} onClose={() => d.setReportRideId(null)} />
      )}

      {profileOpen && d.userId && (
        <ProfileModal
          userId={d.userId}
          initialFullName={d.passengerName}
          initialLanguage={d.passengerLanguage}
          onClose={() => setProfileOpen(false)}
          onSaved={(fullName, language) => {
            d.setPassengerName(fullName || null)
            d.setPassengerLanguage(language)
          }}
        />
      )}

      {d.rideToRate && d.userId && d.rideToRate.ride.driver_id && (
        <RatingModal
          rideId={d.rideToRate.ride.id}
          raterId={d.userId}
          raterRole="passenger"
          rateeId={d.rideToRate.ride.driver_id}
          rateeName={d.rideToRate.rateeName}
          onClose={() => d.setRideToRate(null)}
        />
      )}
    </div>
  )
}
