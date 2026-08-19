import type { DailyAccountPayload } from '../api/accounts'
import { formatDisplayDate } from './money'

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function row(...cells: Array<string | number | null | undefined>) {
  return cells.map(csvCell).join(',')
}

function rupees(paise: number | null | undefined) {
  if (paise == null || Number.isNaN(Number(paise))) return ''
  return (Number(paise) / 100).toFixed(2)
}

export function buildDayReportCsv(
  data: DailyAccountPayload,
  stationName?: string | null
): string {
  const date = data.account.accountDate
  const lines: string[] = []
  const blank = () => lines.push('')

  lines.push(row('PetroBook'))
  if (stationName) lines.push(row('Station', stationName))
  lines.push(row('Date', formatDisplayDate(date), date))
  lines.push(row('Status', data.account.status === 'closed' ? 'Closed' : 'Open'))
  blank()

  lines.push(row('Summary'))
  lines.push(row('Total Fuel Sales', rupees(data.kpis.totalFuelSalesPaise)))
  lines.push(row('Total Credit', rupees(data.kpis.totalCreditPaise)))
  lines.push(row('Total Debit', rupees(data.kpis.totalDebitPaise)))
  lines.push(row('Total Expenses', rupees(data.kpis.totalExpensesPaise)))
  lines.push(row('Online Collections', rupees(data.kpis.onlineCollectionsPaise)))
  lines.push(row('Closing Cash', rupees(data.kpis.closingCashPaise)))
  blank()

  lines.push(row('Fuel Sales / Meter Readings'))
  lines.push(
    row('Product', 'New Reading', 'Old Reading', 'LTR', 'Testing', 'Net', 'Rate', 'Total Sale')
  )
  for (const r of data.readings) {
    lines.push(
      row(
        r.meterLabel || r.productName,
        r.newReading,
        r.oldReading,
        r.litres,
        r.testingLitres,
        r.netLitres,
        rupees(r.ratePaise),
        rupees(r.totalSalePaise)
      )
    )
  }
  lines.push(row('Total Fuel Sale', '', '', '', '', '', '', rupees(data.kpis.totalFuelSalesPaise)))
  blank()

  const credits = data.ledger.items.filter((t) => t.type === 'CREDIT')
  const debits = data.ledger.items.filter((t) => t.type === 'DEBIT')

  lines.push(row('Credit'))
  lines.push(row('Name', 'Amount'))
  if (credits.length === 0) {
    lines.push(row('(none)', ''))
  } else {
    for (const t of credits) lines.push(row(t.description, rupees(t.amountPaise)))
  }
  lines.push(
    row(
      'Total Credit',
      rupees(credits.reduce((sum, t) => sum + t.amountPaise, 0))
    )
  )
  blank()

  lines.push(row('Debit'))
  lines.push(row('Name', 'Amount'))
  if (debits.length === 0) {
    lines.push(row('(none)', ''))
  } else {
    for (const t of debits) lines.push(row(t.description, rupees(t.amountPaise)))
  }
  lines.push(
    row(
      'Total Debit',
      rupees(debits.reduce((sum, t) => sum + t.amountPaise, 0))
    )
  )
  blank()

  lines.push(row('Daily Cash Summary'))
  lines.push(row('Total Sale', rupees(data.cashSummary.totalFuelSalePaise)))
  const collections = data.collections.filter((c) => {
    const type = String(c.methodType || '').toLowerCase()
    const code = String(c.code || '').toLowerCase()
    return type !== 'credit' && code !== 'credit'
  })
  const methodNames = [...new Set(collections.map((c) => c.name))]
  for (const name of methodNames) {
    const rows = collections.filter((c) => c.name === name)
    lines.push(row(name))
    for (const c of rows) {
      lines.push(row(c.description || name, rupees(c.amountPaise)))
    }
    lines.push(
      row(`Total ${name}`, rupees(rows.reduce((sum, c) => sum + c.amountPaise, 0)))
    )
  }
  lines.push(row('Expense', rupees(data.cashSummary.totalExpensePaise)))
  lines.push(row('Total Cash', rupees(data.cashSummary.totalCashPaise)))
  lines.push(row('Cash Taken Home', rupees(data.cashSummary.cashTakenPaise)))
  lines.push(row('Closing Cash', rupees(data.cashSummary.expectedClosingCashPaise)))
  blank()

  lines.push(row('Daily Expenses'))
  lines.push(row('Expense', 'Amount'))
  if (data.expenses.length === 0) {
    lines.push(row('(none)', ''))
  } else {
    for (const e of data.expenses) lines.push(row(e.description, rupees(e.amountPaise)))
  }
  lines.push(row('Total Expense', rupees(data.kpis.totalExpensesPaise)))
  blank()

  lines.push(row('Daily Reconciliation'))
  lines.push(row('Fuel Sale', rupees(data.reconciliation.fuelSalesPaise)))
  lines.push(row('Credit (+)', rupees(data.reconciliation.creditSalesPaise)))
  lines.push(row('Debit (−)', rupees(data.kpis.totalDebitPaise)))
  lines.push(row('Online Payments', rupees(data.reconciliation.onlineCollectionsPaise)))
  const online = data.cashSummary.breakdown.reduce<Record<string, number>>((acc, row) => {
    if (!row.reducesCash || row.isCashTaken) return acc
    const type = String(row.methodType || '').toLowerCase()
    if (type === 'credit' || type === 'cash') return acc
    if (type === 'upi') {
      acc.online = (acc.online || 0) + row.amountPaise
      return acc
    }
    if (['card', 'online', 'bank'].includes(type)) {
      acc[type] = (acc[type] || 0) + row.amountPaise
    }
    return acc
  }, {})
  if (online.card) lines.push(row('  Card', rupees(online.card)))
  if (online.online) lines.push(row('  Online Payment', rupees(online.online)))
  if (online.bank) lines.push(row('  Bank Payment', rupees(online.bank)))
  lines.push(row('Expenses', rupees(data.reconciliation.expensesPaise)))
  lines.push(row('Expected Cash', rupees(data.cashSummary.totalCashPaise)))
  lines.push(row('Cash Taken', rupees(data.reconciliation.cashTakenPaise)))
  lines.push(row('Remaining Cash', rupees(data.reconciliation.expectedClosingCashPaise)))
  lines.push(row('Pending', rupees(data.reconciliation.pendingPaise)))
  lines.push(row('Advance', rupees(data.reconciliation.advancePaise)))

  return lines.join('\r\n')
}

export function downloadDayReport(
  data: DailyAccountPayload,
  stationName?: string | null
) {
  const csv = buildDayReportCsv(data, stationName)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `daily-accounts-${data.account.accountDate}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
