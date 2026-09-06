import { useState } from 'react'
import { DriverOnboarding } from '../DriverOnboarding'
import { CategoryBadge, DriverStatusBadge } from '../../components/Badge'
import { SosButton } from '../../components/Sos'
import { ReportModal } from '../../components/Report'
import { ProfileModal } from '../../components/Profile'
import { NotificationsBell } from '../../components/Notifications'
import { SupportButton } from '../../components/Support'
import { RatingModal } from '../../components/RatingModal'
import { useDriverDashboard } from './useDriverDashboard'
import { DocumentsSection } from './DocumentsSection'
import { SubscriptionSection } from './SubscriptionSection'
import { EarningsSection } from './EarningsSection'
import { AvailabilitySection } from './AvailabilitySection'
import { ActiveRideSection } from './ActiveRideSection'

const REPORT_CATEGORIES = [
  { value: 'comportement_passager', label: 'Comportement du passager' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'paiement', label: 'Litige de paiement' },
  { value: 'autre', label: 'Autre' },
]

export function DriverHome() {
  const [profileOpen, setProfileOpen] = useState(false)
  const d = useDriverDashboard()

  if (d.driver === undefined) {
    return <p className="p-8 text-center text-sm text-ink-400">Chargement…</p>
  }

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

      {d.driver === null && <DriverOnboarding onSubmitted={d.loadDriver} />}

      {d.driver && (
        <main className="mx-auto max-w-2xl px-4 pb-16">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <CategoryBadge category={d.driver.category} />
                <DriverStatusBadge status={d.driver.status} />
              </div>
              {d.driver.vehicles && (
                <p className="mt-2 text-sm text-ink-600">
                  {d.driver.vehicles.brand} {d.driver.vehicles.model} — {d.driver.vehicles.plate_number}
                </p>
              )}
            </div>
            {d.driver.total_rides > 0 && (
              <div className="text-right text-sm text-ink-600">
                <p>{d.driver.total_rides} course{d.driver.total_rides > 1 ? 's' : ''}</p>
                {d.driver.rating_count > 0 && <p>★ {d.driver.rating_avg.toFixed(1)}</p>}
              </div>
            )}
          </div>

          {(d.driver.acceptance_rate != null || d.driver.cancellation_rate != null) && (
            <div className="mb-6 grid grid-cols-2 gap-2">
              {d.driver.acceptance_rate != null && (
                <div className="rounded-xl border border-ink-100 bg-white p-3 text-center">
                  <p className="text-xs text-ink-400">Taux d'acceptation (30j)</p>
                  <p className="text-sm font-semibold text-ink-800">{d.driver.acceptance_rate.toFixed(0)}%</p>
                </div>
              )}
              {d.driver.cancellation_rate != null && (
                <div className="rounded-xl border border-ink-100 bg-white p-3 text-center">
                  <p className="text-xs text-ink-400">Taux d'annulation (30j)</p>
                  <p className="text-sm font-semibold text-ink-800">{d.driver.cancellation_rate.toFixed(0)}%</p>
                </div>
              )}
            </div>
          )}

          {d.driver.status !== 'approved' && d.driver.status !== 'suspended' && (
            <DocumentsSection driver={d.driver} uploadingType={d.uploadingType} onUpload={d.handleUpload} />
          )}

          {d.driver.status === 'suspended' && (
            <section className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
              Votre compte chauffeur est suspendu. Contactez le support pour plus d'informations.
            </section>
          )}

          {d.driver.status === 'approved' && (
            <>
              <SubscriptionSection
                activeSub={d.activeSub}
                plans={d.plans}
                subscriptionPayments={d.subscriptionPayments}
                busy={d.busy}
                onBuyPlan={d.buyPlan}
                onDownloadReceipt={d.downloadReceipt}
              />

              <EarningsSection
                earnings={d.earnings}
                rideHistory={d.rideHistory}
                rideInvoicesByRide={d.rideInvoicesByRide}
                onDownloadInvoice={d.downloadDriverInvoice}
                onReport={d.setReportRideId}
              />

              {d.activeSub && !d.activeRide && (
                <AvailabilitySection
                  isAvailable={d.driver.is_available}
                  locationError={d.locationError}
                  offers={d.offers}
                  busy={d.busy}
                  onToggleAvailability={d.toggleAvailability}
                  onRespondToOffer={d.respondToOffer}
                />
              )}

              {d.activeRide && (
                <ActiveRideSection
                  activeRide={d.activeRide}
                  passengerInfo={d.passengerInfo}
                  busy={d.busy}
                  onAdvanceRide={d.advanceRide}
                  onReport={d.setReportRideId}
                />
              )}
            </>
          )}
        </main>
      )}

      {d.reportRideId && d.driver && (
        <ReportModal
          rideId={d.reportRideId}
          reporterId={d.driver.id}
          categories={REPORT_CATEGORIES}
          onClose={() => d.setReportRideId(null)}
        />
      )}

      {profileOpen && d.driver && (
        <ProfileModal
          userId={d.driver.id}
          initialFullName={d.driverName}
          initialLanguage={d.driverLanguage}
          onClose={() => setProfileOpen(false)}
          onSaved={(fullName, language) => {
            d.setDriverName(fullName || null)
            d.setDriverLanguage(language)
          }}
        />
      )}

      {d.rideToRate && d.driver && d.rideToRate.ride.passenger_id && (
        <RatingModal
          rideId={d.rideToRate.ride.id}
          raterId={d.driver.id}
          raterRole="driver"
          rateeId={d.rideToRate.ride.passenger_id}
          rateeName={d.rideToRate.rateeName}
          onClose={() => d.setRideToRate(null)}
        />
      )}
    </div>
  )
}
