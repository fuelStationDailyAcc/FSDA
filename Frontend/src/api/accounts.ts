import { apiRequest } from "./client"

export type DailyAccountPayload = {
  account: {
    id: string
    accountDate: string
    status: "open" | "closed"
    cashTakenPaise: number
    actualClosingCashPaise: number | null
    closedAt?: string | null
    closedBy?: string | null
  }
  readings: MeterReading[]
  collections: PaymentCollection[]
  expenses: ExpenseRow[]
  ledger: {
    items: LedgerTxn[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }
  cashSummary: {
    totalFuelSalePaise: number
    creditPaise: number
    onlinePaise: number
    otherNonCashPaise: number
    totalExpensePaise: number
    totalCashPaise: number
    cashTakenPaise: number
    expectedClosingCashPaise: number
    actualClosingCashPaise: number | null
    differencePaise: number | null
    breakdown: Array<{
      paymentMethodId: string
      name: string
      methodType: string
      amountPaise: number
      reducesCash: boolean
      isCashTaken: boolean
    }>
  }
  kpis: {
    totalFuelSalesPaise: number
    totalCreditPaise: number
    totalDebitPaise: number
    totalExpensesPaise: number
    onlineCollectionsPaise: number
    closingCashPaise: number
  }
  reconciliation: {
    fuelSalesPaise: number
    creditSalesPaise: number
    onlineCollectionsPaise: number
    expensesPaise: number
    cashTakenPaise: number
    expectedClosingCashPaise: number
    actualClosingCashPaise: number | null
    differencePaise: number | null
  }
}

export type MeterReading = {
  id: string
  productId: string
  productName: string
  productType: string
  meterLabel: string | null
  newReading: number
  oldReading: number
  litres: number
  testingLitres: number
  netLitres: number
  ratePaise: number
  totalSalePaise: number
}

export type PaymentCollection = {
  id: string
  paymentMethodId: string
  name: string
  code: string
  methodType: string
  reducesCash: boolean
  isCashTaken: boolean
  amountPaise: number
}

export type ExpenseRow = {
  id: string
  categoryId: string | null
  categoryName: string | null
  description: string
  amountPaise: number
  paymentMethodId: string | null
  paymentMethodName: string | null
  notes: string | null
}

export type LedgerTxn = {
  id: string
  type: "DEBIT" | "CREDIT"
  date: string
  time: string | null
  description: string
  partyType: string | null
  partyId: string | null
  partyName: string | null
  category: string
  paymentMethodId: string | null
  paymentMethodName: string | null
  amountPaise: number
  referenceNumber: string | null
  notes: string | null
  balancePaise: number
}

export type FuelProduct = {
  id: string
  name: string
  productType: string
  currentRatePaise: number
  isActive: boolean
}

export type PaymentMethod = {
  id: string
  name: string
  code: string
  methodType: string
  reducesCash: boolean
  isCashTaken: boolean
  isActive: boolean
}

export type NamedItem = { id: string; name: string; isActive?: boolean; type?: string }

export type Party = {
  id: string
  name: string
  phone?: string | null
  outstandingPaise?: number
  totalCreditPaise?: number
  totalPaidPaise?: number
  totalPurchasesPaise?: number
}

function qs(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export type DailyAccountSummary = {
  id: string
  accountDate: string
  status: "open" | "closed"
  closedAt?: string | null
  createdAt?: string
  updatedAt?: string
  totalFuelSalesPaise: number
  totalCreditPaise: number
  totalDebitPaise: number
  totalExpensesPaise: number
  onlineCollectionsPaise: number
  closingCashPaise: number
  actualClosingCashPaise: number | null
  differencePaise: number | null
}

export async function fetchDailyAccount(
  date: string,
  filters: Record<string, string | number | undefined> = {}
) {
  return apiRequest<DailyAccountPayload>(`/accounts/daily${qs({ date, ...filters })}`)
}

export async function fetchAccountHistory(filters: {
  from?: string
  to?: string
  status?: "open" | "closed" | ""
} = {}) {
  return apiRequest<DailyAccountSummary[]>(
    `/accounts/history${qs({
      from: filters.from,
      to: filters.to,
      status: filters.status || undefined,
    })}`
  )
}

export async function updateReading(
  date: string,
  id: string,
  body: Record<string, string | number>
) {
  return apiRequest<DailyAccountPayload>(`/accounts/daily/readings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ date, ...body }),
  })
}

export async function addReading(date: string, productId: string) {
  return apiRequest<DailyAccountPayload>(`/accounts/daily/readings`, {
    method: "POST",
    body: JSON.stringify({ date, productId }),
  })
}

export async function upsertCollection(
  date: string,
  paymentMethodId: string,
  amountRupees: number | string
) {
  return apiRequest<DailyAccountPayload>(`/accounts/daily/collections`, {
    method: "PUT",
    body: JSON.stringify({ date, paymentMethodId, amountRupees }),
  })
}

export async function updateCashTaken(date: string, cashTakenRupees: number | string) {
  return apiRequest<DailyAccountPayload>(`/accounts/daily/cash-taken`, {
    method: "PATCH",
    body: JSON.stringify({ date, cashTakenRupees }),
  })
}

export async function addExpense(date: string, body: Record<string, unknown>) {
  return apiRequest<DailyAccountPayload>(`/accounts/daily/expenses`, {
    method: "POST",
    body: JSON.stringify({ date, ...body }),
  })
}

export async function deleteExpense(date: string, id: string) {
  return apiRequest<DailyAccountPayload>(`/accounts/daily/expenses/${id}${qs({ date })}`, {
    method: "DELETE",
  })
}

export async function addTransaction(
  date: string,
  body: Record<string, unknown>,
  idempotencyKey?: string
) {
  return apiRequest<DailyAccountPayload>(`/accounts/daily/transactions`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    body: JSON.stringify({ date, ...body }),
  })
}

export async function deleteTransaction(date: string, id: string) {
  return apiRequest<DailyAccountPayload>(
    `/accounts/daily/transactions/${id}${qs({ date })}`,
    { method: "DELETE" }
  )
}

export async function closeDay(date: string, actualClosingCashRupees: number | string) {
  return apiRequest<DailyAccountPayload>(`/accounts/daily/close`, {
    method: "POST",
    body: JSON.stringify({ date, actualClosingCashRupees }),
  })
}

export async function reopenDay(date: string) {
  return apiRequest<DailyAccountPayload>(`/accounts/daily/reopen`, {
    method: "POST",
    body: JSON.stringify({ date }),
  })
}

export async function fetchProducts(activeOnly = false) {
  return apiRequest<FuelProduct[]>(
    `/accounts/products${qs({ activeOnly: activeOnly ? "true" : undefined })}`
  )
}

export async function createProduct(body: Record<string, unknown>) {
  return apiRequest<FuelProduct>(`/accounts/products`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function updateProduct(id: string, body: Record<string, unknown>) {
  return apiRequest<FuelProduct>(`/accounts/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function deleteProduct(id: string) {
  return apiRequest<FuelProduct>(`/accounts/products/${id}`, {
    method: "DELETE",
  })
}

export async function fetchPaymentMethods(activeOnly = false) {
  return apiRequest<PaymentMethod[]>(
    `/accounts/payment-methods${qs({ activeOnly: activeOnly ? "true" : undefined })}`
  )
}

export async function createPaymentMethod(body: Record<string, unknown>) {
  return apiRequest<PaymentMethod>(`/accounts/payment-methods`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function updatePaymentMethod(id: string, body: Record<string, unknown>) {
  return apiRequest<PaymentMethod>(`/accounts/payment-methods/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function deletePaymentMethod(id: string) {
  return apiRequest<PaymentMethod>(`/accounts/payment-methods/${id}`, {
    method: "DELETE",
  })
}

export async function fetchExpenseCategories() {
  return apiRequest<NamedItem[]>(`/accounts/expense-categories`)
}

export async function createExpenseCategory(name: string) {
  return apiRequest<NamedItem>(`/accounts/expense-categories`, {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

export async function deleteExpenseCategory(id: string) {
  return apiRequest<NamedItem>(`/accounts/expense-categories/${id}`, {
    method: "DELETE",
  })
}

export async function fetchTxnCategories() {
  return apiRequest<NamedItem[]>(`/accounts/transaction-categories`)
}

export async function fetchLedgerNames(type?: "DEBIT" | "CREDIT", search?: string) {
  return apiRequest<string[]>(
    `/accounts/ledger-names${qs({ type, search: search || undefined })}`
  )
}

export async function fetchLedgerTotals() {
  return apiRequest<{
    totalCreditPaise: number
    totalDebitPaise: number
    totalUdhaarPaise: number
  }>(`/accounts/ledger-totals`)
}

export async function fetchCustomers() {
  return apiRequest<Party[]>(`/accounts/customers`)
}

export async function createCustomer(body: Record<string, unknown>) {
  return apiRequest<Party>(`/accounts/customers`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function deleteCustomer(id: string) {
  return apiRequest<Party>(`/accounts/customers/${id}`, {
    method: "DELETE",
  })
}

export async function fetchVendors() {
  return apiRequest<Party[]>(`/accounts/vendors`)
}

export async function createVendor(body: Record<string, unknown>) {
  return apiRequest<Party>(`/accounts/vendors`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}
