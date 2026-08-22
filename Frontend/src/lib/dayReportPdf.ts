import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DailyAccountPayload } from '../api/accounts'
import { formatDisplayDate } from './money'
import { reconciliationDeductions } from './reconciliationBreakdown'

function rupees(paise: number | null | undefined) {
  if (paise == null || Number.isNaN(Number(paise))) return '—'
  return `₹${(Number(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function buildDayReportPdf(
  data: DailyAccountPayload,
  stationName?: string | null
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const date = data.account.accountDate
  let y = 14

  doc.setFontSize(16)
  doc.text('PetroBook', 14, y)
  y += 7

  doc.setFontSize(10)
  if (stationName) {
    doc.text(`Station: ${stationName}`, 14, y)
    y += 5
  }
  doc.text(`Date: ${formatDisplayDate(date)} (${date})`, 14, y)
  y += 5
  doc.text(`Status: ${data.account.status === 'closed' ? 'Closed' : 'Open'}`, 14, y)
  y += 8

  autoTable(doc, {
    startY: y,
    head: [['Summary', 'Amount']],
    body: [
      ['Total Fuel Sales', rupees(data.kpis.totalFuelSalesPaise)],
      ['Total Credit', rupees(data.kpis.totalCreditPaise)],
      ['Total Debit', rupees(data.kpis.totalDebitPaise)],
      ['Total Expenses', rupees(data.kpis.totalExpensesPaise)],
      ['Online Collections', rupees(reconciliationDeductions(data).onlinePaise)],
      ['Closing Cash', rupees(data.kpis.closingCashPaise)],
    ],
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  autoTable(doc, {
    startY: y,
    head: [['Product', 'New', 'Old', 'LTR', 'Test', 'Net', 'Rate', 'Sale']],
    body: [
      ...data.readings.map((r) => [
        r.meterLabel || r.productName,
        String(r.newReading),
        String(r.oldReading),
        String(r.litres),
        String(r.testingLitres),
        String(r.netLitres),
        rupees(r.ratePaise),
        rupees(r.totalSalePaise),
      ]),
      ['Total', '', '', '', '', '', '', rupees(data.kpis.totalFuelSalesPaise)],
    ],
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [40, 40, 40] },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  const credits = data.ledger.items.filter((t) => t.type === 'CREDIT')
  const debits = data.ledger.items.filter((t) => t.type === 'DEBIT')

  autoTable(doc, {
    startY: y,
    head: [['Credit', 'Amount']],
    body:
      credits.length === 0
        ? [['(none)', '—']]
        : [
            ...credits.map((t) => [t.description, rupees(t.amountPaise)]),
            [
              'Total Credit',
              rupees(credits.reduce((sum, t) => sum + t.amountPaise, 0)),
            ],
          ],
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  if (y > 240) {
    doc.addPage()
    y = 14
  }

  autoTable(doc, {
    startY: y,
    head: [['Debit', 'Amount']],
    body:
      debits.length === 0
        ? [['(none)', '—']]
        : [
            ...debits.map((t) => [t.description, rupees(t.amountPaise)]),
            [
              'Total Debit',
              rupees(debits.reduce((sum, t) => sum + t.amountPaise, 0)),
            ],
          ],
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  const cashRows: string[][] = [
    ['Total Sale', rupees(data.cashSummary.totalFuelSalePaise)],
    ['Expense', rupees(data.cashSummary.totalExpensePaise)],
    ['Total Cash', rupees(data.cashSummary.totalCashPaise)],
    ['Cash Taken Home', rupees(data.cashSummary.cashTakenPaise)],
    ['Closing Cash', rupees(data.cashSummary.expectedClosingCashPaise)],
  ]

  autoTable(doc, {
    startY: y,
    head: [['Daily Cash Summary', 'Amount']],
    body: cashRows,
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  if (y > 230) {
    doc.addPage()
    y = 14
  }

  autoTable(doc, {
    startY: y,
    head: [['Daily Expenses', 'Amount']],
    body:
      data.expenses.length === 0
        ? [['(none)', '—']]
        : [
            ...data.expenses.map((e) => [e.description, rupees(e.amountPaise)]),
            ['Total Expense', rupees(data.kpis.totalExpensesPaise)],
          ],
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  const deductions = reconciliationDeductions(data)
  const reconRows: string[][] = [
    ['Fuel Sale', rupees(data.reconciliation.fuelSalesPaise)],
    ['Credit (+)', rupees(data.reconciliation.creditSalesPaise)],
    ['Debit (−)', rupees(data.kpis.totalDebitPaise)],
    ['Online Payments', rupees(deductions.onlinePaise)],
    ['Expenses', rupees(data.reconciliation.expensesPaise)],
    ['Expected Cash', rupees(data.cashSummary.totalCashPaise)],
    ['Cash Taken', rupees(data.reconciliation.cashTakenPaise)],
    ['Remaining Cash', rupees(data.reconciliation.expectedClosingCashPaise)],
    ['Pending', rupees(data.reconciliation.pendingPaise)],
    ['Advance', rupees(data.reconciliation.advancePaise)],
  ]

  if (y > 220) {
    doc.addPage()
    y = 14
  }

  autoTable(doc, {
    startY: y,
    head: [['Daily Reconciliation', 'Amount']],
    body: reconRows,
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
  })

  return doc
}

export function downloadDayReportPdf(
  data: DailyAccountPayload,
  stationName?: string | null
) {
  buildDayReportPdf(data, stationName).save(`daily-account-${data.account.accountDate}.pdf`)
}

export function printDayReportPdf(
  data: DailyAccountPayload,
  stationName?: string | null
) {
  const doc = buildDayReportPdf(data, stationName)
  doc.autoPrint()
  window.open(doc.output('bloburl'), '_blank')
}
