import type { ActiveSubscription, SubscriptionPayment, SubscriptionPlan } from '../../lib/types'
import { Badge } from '../../components/Badge'
import { fcfa } from '../../lib/format'

export function SubscriptionSection({
  activeSub,
  plans,
  subscriptionPayments,
  busy,
  onBuyPlan,
  onDownloadReceipt,
}: {
  activeSub: ActiveSubscription | null
  plans: SubscriptionPlan[]
  subscriptionPayments: SubscriptionPayment[]
  busy: boolean
  onBuyPlan: (planCode: string) => void
  onDownloadReceipt: (payment: SubscriptionPayment) => void
}) {
  return (
    <>
      <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Abonnement</h2>
        {activeSub ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-800">{activeSub.subscription_plans?.name}</p>
              <p className="text-xs text-ink-400">
                Expire le {new Date(activeSub.expires_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Badge tone="green">Actif</Badge>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="mb-2 text-sm text-ink-600">Aucun abonnement actif — achetez-en un pour passer disponible.</p>
            {plans.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-ink-100 p-3">
                <div>
                  <p className="text-sm font-medium text-ink-800">{p.name}</p>
                  <p className="text-xs text-ink-400">{p.price_fcfa != null ? fcfa(p.price_fcfa) : '—'}</p>
                </div>
                <button
                  disabled={busy || p.price_fcfa == null}
                  onClick={() => onBuyPlan(p.code)}
                  className="rounded-lg bg-navy-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                >
                  Acheter
                </button>
              </div>
            ))}
            {plans.length === 0 && <p className="text-sm text-ink-400">Aucun plan disponible pour votre catégorie actuellement.</p>}
          </div>
        )}
      </section>

      {subscriptionPayments.length > 0 && (
        <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Reçus</h2>
          <div className="space-y-2">
            {subscriptionPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-xl border border-ink-100 p-3">
                <div>
                  <p className="text-sm font-medium text-ink-800">
                    {plans.find((p) => p.id === payment.metadata.plan_id)?.name ?? payment.metadata.plan_code ?? 'Abonnement'}
                  </p>
                  <p className="text-xs text-ink-400">
                    {new Date(payment.confirmed_at ?? payment.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    {' — '}
                    {fcfa(payment.amount_fcfa)}
                  </p>
                </div>
                <button
                  onClick={() => onDownloadReceipt(payment)}
                  className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                >
                  Télécharger
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
