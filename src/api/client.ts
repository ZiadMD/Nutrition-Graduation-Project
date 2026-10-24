// client.ts — Frontend API client for Rebound Express backend.
//
// Handles baseURL resolution from VITE_API_URL, attaches Bearer token,
// and automatically handles 401 Unauthorized by clearing credentials and
// redirecting to login.

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

export class ApiError extends Error {
  code: string
  status: number
  constructor(message: string, code = 'API_ERROR', status = 500) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function getToken(): string | null {
  return localStorage.getItem('rebound_token')
}

export function setToken(token: string) {
  localStorage.setItem('rebound_token', token)
}

export function removeToken() {
  localStorage.removeItem('rebound_token')
  localStorage.removeItem('rebound_user')
}

export function getStoredUser(): any | null {
  const u = localStorage.getItem('rebound_user')
  try {
    return u ? JSON.parse(u) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: any) {
  localStorage.setItem('rebound_user', JSON.stringify(user))
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const token = getToken()

  const headers = new Headers(options.headers || {})
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers,
    })
  } catch (err: any) {
    throw new ApiError(err?.message || 'Network error occurred.', 'NETWORK_ERROR', 0)
  }

  // Handle 401 Unauthorized globally
  if (res.status === 401) {
    removeToken()
    // Avoid infinite redirect loop if already on auth page
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/signup')) {
      window.location.href = '/login'
    }
  }

  let data: any = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }

  if (!res.ok) {
    const errorObj = data?.error
    throw new ApiError(
      errorObj?.message || `Request failed with status ${res.status}`,
      errorObj?.code || 'REQUEST_FAILED',
      res.status
    )
  }

  return data?.data as T
}

// ---------------------------------------------------------------------------
// Typed API Services
// ---------------------------------------------------------------------------

export const api = {
  // --- Auth ---
  async login(email: string, password: string) {
    const data = await apiFetch<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setToken(data.token)
    setStoredUser(data.user)
    return data
  },

  async register(body: {
    name: string
    email: string
    password: string
    role?: string
    type?: string
    credentials?: string
    city?: string
    bio?: string
    rateEgp?: number
    yearsExperience?: number
    languages?: string
    focusTags?: string | string[]
    nationalId?: string
    syndicateId?: string
    credentialDoc?: string
    documents?: { name: string; size?: string; type?: string; url?: string }[]
    packages?: { name: string; description?: string; sessionsCount: number; priceEgp: number }[]
  }) {
    const data = await apiFetch<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    setToken(data.token)
    setStoredUser(data.user)
    return data
  },

  async getMe() {
    const data = await apiFetch<{ user: any }>('/auth/me')
    setStoredUser(data.user)
    return data.user
  },

  logout() {
    removeToken()
  },

  // --- Profile & Onboarding ---
  async getProfile() {
    return apiFetch<{ profile: any; injuries: any[] }>('/profile')
  },

  async updateProfile(body: any) {
    return apiFetch<{ profile: any; injuries: any[] }>('/profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  async completeOnboarding() {
    return apiFetch<{ profile: any }>('/profile/complete', {
      method: 'POST',
    })
  },

  // --- Specialists ---
  async getSpecialists(params: { type?: string; q?: string; sort?: string } = {}) {
    const qs = new URLSearchParams()
    if (params.type && params.type !== 'all') qs.set('type', params.type)
    if (params.q) qs.set('q', params.q)
    if (params.sort) qs.set('sort', params.sort)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiFetch<{ specialists: any[] }>(`/specialists${query}`)
  },

  async getSpecialist(id: string | number) {
    return apiFetch<{ specialist: any }>(`/specialists/${id}`)
  },

  async getSpecialistSlots(id: string | number, params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams()
    if (params.from) qs.set('from', params.from)
    if (params.to) qs.set('to', params.to)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiFetch<{ slots: any[] }>(`/specialists/${id}/slots${query}`)
  },

  async getSpecialistReviews(id: string | number) {
    return apiFetch<{
      summary: {
        averageRating: number
        totalReviews: number
        breakdown: Record<string, number>
        clientsCount: number
      }
      reviews: Array<{
        id: number
        rating: number
        comment: string
        createdAt: string
        client: { id: number; name: string }
      }>
      eligibility: {
        canReview: boolean
        alreadyReviewed: boolean
        userReview?: { id: number; rating: number; comment: string; createdAt: string }
        reason?: string | null
      }
    }>(`/specialists/${id}/reviews`)
  },

  async submitSpecialistReview(id: string | number, body: { rating: number; comment?: string }) {
    return apiFetch<{ review: any }>(`/specialists/${id}/reviews`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  // --- Bookings ---
  async createBooking(body: { specialistId: number; slotId: number; packageId?: number; sessionType: string; notes?: string }) {
    return apiFetch<{ booking: any }>('/bookings', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  async getBookings(tab?: 'upcoming' | 'past' | 'up') {
    const query = tab ? `?tab=${tab}` : ''
    return apiFetch<{ bookings: any[] }>(`/bookings${query}`)
  },

  async cancelBooking(id: number | string) {
    return apiFetch<{ booking: any }>(`/bookings/${id}/cancel`, {
      method: 'PATCH',
    })
  },

  async rescheduleBooking(id: number | string, newSlotId: number) {
    return apiFetch<{ booking: any }>(`/bookings/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ slotId: newSlotId }),
    })
  },

  async getBookingSession(id: number | string) {
    return apiFetch<{ session: any }>(`/bookings/${id}/session`)
  },

  // --- Dashboard & Today ---
  async getTodayDashboard() {
    return apiFetch<{
      user: { name: string }
      summary: any
      plan: any[]
      nextSession: any
      specialistNote: any
    }>('/dashboard/today')
  },

  async setCompletion(planItemId: number, date: string, status: 'done' | 'skipped' | 'pending') {
    return apiFetch<{ completion: any }>('/completions', {
      method: 'PUT',
      body: JSON.stringify({ planItemId, date, status }),
    })
  },

  // --- Plans ---
  async getPlans(service?: string) {
    const query = service ? `?service=${service}` : ''
    return apiFetch<{ plans: any[]; plan?: any }>(`/plans${query}`)
  },

  // --- Progress ---
  async getProgress(range: string = '8w') {
    return apiFetch<{
      range?: string
      safeLimit: number
      weight: { date: string; value: number }[]
      pain: { date: string; value: number }[]
      workoutsPerWeek: { weekStart: string; count: number }[]
    }>(`/progress?range=${range}`)
  },

  async logProgress(body: { date?: string; weightKg?: number; workoutDone?: boolean; painLevel?: number; note?: string }) {
    return apiFetch<{ progress: any }>('/progress', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  // --- AI Planner ---
  async generateAiPlan(body: any) {
    return apiFetch<{ requestId: number; source: string; draft: any }>('/ai/plan', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  async sendAiPlan(requestId: number) {
    return apiFetch<{ message: string; plans: any[] }>(`/ai/plan/${requestId}/send`, {
      method: 'POST',
    })
  },

  // --- Checkout ---
  async checkout(planName: 'Starter' | 'Plus' | 'Full Team', method: 'card' | 'fawry' | 'vodafone_cash' | 'instapay') {
    return apiFetch<{ subscription: any }>('/checkout', {
      method: 'POST',
      body: JSON.stringify({ planName, method }),
    })
  },

  async getCurrentSubscription() {
    return apiFetch<{ subscription: any }>('/checkout/current')
  },

  // --- Specialist Portal ---
  async getSpecialistClients(q?: string) {
    const query = q ? `?q=${encodeURIComponent(q)}` : ''
    return apiFetch<{ clients: any[] }>(`/specialist/clients${query}`)
  },

  async getSpecialistClient(clientId: number | string) {
    return apiFetch<{ client: any; injuries: any[]; careTeam: any[]; plans: any[]; progress: any; notes: any[] }>(`/specialist/clients/${clientId}`)
  },

  async updateSpecialistPlan(clientId: number | string, service: string, body: any) {
    return apiFetch<{ plan: any }>(`/specialist/clients/${clientId}/plans/${service}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  async addSpecialistNote(clientId: number | string, body: { body: string; visibleToClient?: boolean }) {
    return apiFetch<{ note: any }>(`/specialist/clients/${clientId}/notes`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  async getSpecialistSchedule(params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams()
    if (params.from) qs.set('from', params.from)
    if (params.to) qs.set('to', params.to)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiFetch<{ slots: any[] }>(`/specialist/schedule${query}`)
  },

  // --- Admin Portal ---
  async getAdminOverview() {
    return apiFetch<{ counts: any; recentActivity: any[] }>('/admin/overview')
  },

  async getAdminUsers(params: { q?: string; role?: string; status?: string } = {}) {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.role) qs.set('role', params.role)
    if (params.status) qs.set('status', params.status)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiFetch<{ users: any[] }>(`/admin/users${query}`)
  },

  async updateUserStatus(userId: number | string, status: 'active' | 'suspended') {
    return apiFetch<{ user: any }>(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  async getAdminSpecialists(status?: string) {
    const query = status ? `?status=${status}` : ''
    return apiFetch<{ specialists: any[] }>(`/admin/specialists${query}`)
  },

  async updateSpecialistApproval(specialistId: number | string, status: 'approved' | 'rejected') {
    return apiFetch<{ specialist: any }>(`/admin/specialists/${specialistId}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },

  async adminCreateUser(body: { name: string; email: string; password: string; role: 'client' | 'specialist' | 'admin' | 'finance' }) {
    return apiFetch<{ user: any }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  async adminUpdateUserRole(userId: number | string, role: 'client' | 'specialist' | 'admin' | 'finance') {
    return apiFetch<{ user: any }>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  },

  // --- Finance Portal ---
  async getFinanceOverview() {
    return apiFetch<{
      metrics: {
        grossRevenue: number
        mrr: number
        subscriptionRevenue: number
        sessionRevenue: number
        specialistDisbursed: number
        specialistPending: number
        netPlatformProfit: number
        activeSubscribers: number
        completedSessions: number
        arpu: number
      }
      weeklyTrend: { weekLabel: string; date: string; revenue: number; subscriptions: number; sessions: number }[]
      revenueStreams: { subscriptions: { amount: number; percentage: number }; sessions: { amount: number; percentage: number } }
      paymentMethods: Record<string, { count: number; total: number }>
      recentTransactions: any[]
    }>('/finance/overview')
  },

  async getFinanceTransactions(params: { method?: string; type?: string; q?: string } = {}) {
    const qs = new URLSearchParams()
    if (params.method) qs.set('method', params.method)
    if (params.type) qs.set('type', params.type)
    if (params.q) qs.set('q', params.q)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiFetch<{ totalCount: number; transactions: any[] }>(`/finance/transactions${query}`)
  },

  async getFinancePayouts() {
    return apiFetch<{ specialists: any[]; history: any[] }>('/finance/payouts')
  },

  async settleFinancePayout(body: {
    specialistId: number
    amountEgp: number
    platformCutEgp?: number
    netPayoutEgp: number
    periodStart?: string
    periodEnd?: string
    reference?: string
  }) {
    return apiFetch<{ payout: any }>('/finance/payouts/settle', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  async getFinanceSubscriptions() {
    return apiFetch<{
      mrr: number
      totalActive: number
      tiers: Record<string, { count: number; price: number; revenue: number }>
      subscribers: any[]
    }>('/finance/subscriptions')
  },
}
