import type { DailyAccountPayload } from '../api/accounts'

/** Non-cash collection amounts for Daily Reconciliation (card is separate from online). */
export function reconciliationDeductions(data: DailyAccountPayload) {
  const amounts: Record<string, number> = {}
  for (const row of data.cashSummary.breakdown) {
    if (!row.reducesCash || row.isCashTaken) continue
    const type = String(row.methodType || '').toLowerCase()
    if (type === 'credit' || type === 'cash') continue
    if (type === 'upi') {
      amounts.online = (amounts.online || 0) + row.amountPaise
      continue
    }
    if (type === 'card' || type === 'online' || type === 'bank') {
      amounts[type] = (amounts[type] || 0) + row.amountPaise
    }
  }
  return {
    onlinePaise: (amounts.online || 0) + (data.cashSummary.otherNonCashPaise || 0),
    cardPaise: amounts.card || 0,
    bankPaise: amounts.bank || 0,
  }
}
