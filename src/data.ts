import hanaPhoto from './imports/istockphoto-2248733996-612x612.jpg'
import nourPhoto from './imports/Elite_coaches_Marissa_Hurst-1.jpeg'

export type Svc = 'move' | 'eat' | 'recover'

export const specialists = [
  {
    id: 'karim', name: 'Coach Karim Adel', initials: 'KA', svc: 'move' as Svc, role: 'Trainer',
    photo: 'https://images.unsplash.com/photo-1758875568823-34bdf47b82dc?auto=format&fit=crop&w=900&q=85',
    cred: 'Certified strength coach (NASM-CPT)', years: 9, langs: 'Arabic, English', rate: 350, sessions: 1840,
    about: 'I coach strength for people who want to train for years, not weeks. Most of my clients are coming back from a break or an injury, so we start light and add load only when your body shows it is ready.',
    how: 'I send every workout to your physical therapist before it goes live. If Dr. Mona limits a movement, I swap it the same day and tell your dietitian if the volume drops.',
    focus: ['Strength', 'Fat loss', 'Returning to training'],
  },
  {
    id: 'hana', name: 'Hana Ibrahim, RD', initials: 'HI', svc: 'eat' as Svc, role: 'Dietitian',
    photo: hanaPhoto,
    cred: 'Registered dietitian, Cairo University', years: 7, langs: 'Arabic, English', rate: 300, sessions: 1260,
    about: 'I build meal plans from the food you already like: ful, koshari, grilled chicken, lentil soup. No banned foods, just portions and protein that match your training.',
    how: 'I read your trainer and PT notes each week. When training drops because of pain, I lower calories gently and keep protein high so you recover well.',
    focus: ['Fat loss', 'Protein for recovery', 'Eating on a budget'],
  },
  {
    id: 'mona', name: 'Dr. Mona Fathy, PT', initials: 'MF', svc: 'recover' as Svc, role: 'Physical therapist',
    photo: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=900&q=85',
    cred: 'Licensed PT, knee and return-to-sport rehab', years: 11, langs: 'Arabic, English, French', rate: 450, sessions: 2310,
    about: 'I help people get back to lifting and running after knee, hip and back injuries. We use clear pain rules, so you always know what is safe to do today.',
    how: 'I set the limits, such as depth or load, and your trainer builds around them. Your dietitian sees my notes so recovery meals match the week.',
    focus: ['Knee rehab', 'Hip and back', 'Return to sport'],
  },
  {
    id: 'nour', name: 'Coach Nour Salem', initials: 'NS', svc: 'move' as Svc, role: 'Trainer',
    photo: nourPhoto,
    cred: 'Certified trainer, returning-to-training plans', years: 5, langs: 'Arabic, English', rate: 280, sessions: 740,
    about: 'I write simple home and gym plans for busy people. Three focused sessions a week, tracked in the app, with check-ins when you miss one.',
    how: 'I work with your PT when you have pain and with your dietitian when the goal is fat loss, so nothing in the plan pulls in a different direction.',
    focus: ['Home workouts', 'Beginners', 'Busy schedules'],
  },
  {
    id: 'youssef', name: 'Dr. Youssef Amin, PT', initials: 'YA', svc: 'recover' as Svc, role: 'Physical therapist',
    photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=900&q=85',
    cred: 'Licensed PT, shoulder and lower back', years: 8, langs: 'Arabic, English', rate: 400, sessions: 1520,
    about: 'I treat desk-related back and shoulder pain and help lifters get back under the bar. Expect short, specific routines you can do in ten minutes.',
    how: 'I share movement limits with your trainer in the app and flag anything your dietitian should know, like anti-inflammatory food swaps.',
    focus: ['Lower back', 'Shoulder', 'Desk posture'],
  },
  {
    id: 'nada', name: 'Nada Gamal, RD', initials: 'NG', svc: 'eat' as Svc, role: 'Dietitian',
    photo: 'https://images.unsplash.com/photo-1627161683077-e34782c24d81?auto=format&fit=crop&w=900&q=85',
    cred: 'Registered dietitian, sports nutrition', years: 4, langs: 'Arabic, English', rate: 260, sessions: 510,
    about: 'I help students and young professionals eat well on a budget, including Ramadan plans and meals for shared kitchens.',
    how: 'I match your meals to the training days your trainer sets, and adjust when your PT lowers activity for a week.',
    focus: ['Student budgets', 'Muscle gain', 'Ramadan plans'],
  },
]

export const week: { day: string; blocks: { svc: Svc; text: string; adjusted?: boolean }[] }[] = [
  { day: 'Mon', blocks: [{ svc: 'move', text: 'Upper push, 40 min' }, { svc: 'eat', text: 'Ful with eggs, 18 g protein' }, { svc: 'recover', text: 'Shoulder mobility, 10 min' }] },
  { day: 'Tue', blocks: [{ svc: 'eat', text: 'Grilled chicken with rice, 42 g protein' }, { svc: 'move', text: 'Lower body, 45 min', adjusted: true }, { svc: 'recover', text: 'Knee mobility, 10 min' }] },
  { day: 'Wed', blocks: [{ svc: 'eat', text: 'Lentil soup and salad' }, { svc: 'recover', text: 'Foam roll and walk, 20 min' }] },
  { day: 'Thu', blocks: [{ svc: 'move', text: 'Upper pull, 40 min' }, { svc: 'eat', text: 'Tuna wrap, 35 g protein' }, { svc: 'recover', text: 'Knee strength, 15 min' }] },
  { day: 'Fri', blocks: [{ svc: 'move', text: 'Full body, 45 min' }, { svc: 'eat', text: 'Koshari, lighter portion' }] },
  { day: 'Sat', blocks: [{ svc: 'move', text: 'Easy walk, 40 min' }, { svc: 'eat', text: 'Batch cook for the week' }] },
  { day: 'Sun', blocks: [{ svc: 'eat', text: 'Family lunch, no tracking' }, { svc: 'recover', text: 'Check-in with Dr. Mona, 20 min' }] },
]

export const days = [
  { d: 'Wed', n: 15 }, { d: 'Thu', n: 16 }, { d: 'Fri', n: 17 }, { d: 'Sat', n: 18 }, { d: 'Sun', n: 19 }, { d: 'Mon', n: 20 }, { d: 'Tue', n: 21 },
]
const times = ['10:00', '11:30', '13:00', '15:30', '17:00', '18:30', '20:00']
export const t12 = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
export function slotsFor(id: string, di: number): string[] {
  const seed = id.length + di
  if (seed % 5 === 0) return []
  return times.filter((_, i) => (i + seed) % 3 !== 0)
}
export function nextSlots(id: string, count = 4) {
  const out: { di: number; t: string }[] = []
  for (let di = 0; di < 7 && out.length < count; di++) for (const t of slotsFor(id, di)) if (out.length < count) out.push({ di, t })
  return out
}
export const slotLabel = (s: { di: number; t: string }) => `${days[s.di].d} ${days[s.di].n} Oct, ${t12(s.t)}`
export const egp = (n: number) => `${n.toLocaleString('en-US')} EGP`
const r10 = (x: number) => Math.round(x / 10) * 10
export const packagesFor = (rate: number) => [
  { id: 'single', name: 'Single session', n: 1, price: rate, note: 'One 30 minute session. Good for a first chat or a one-off question.' },
  { id: 'month', name: 'Monthly check-ins', n: 4, price: r10(rate * 4 * 0.9), note: 'Four sessions over a month, 10% off. Plan updates between calls.' },
  { id: 'block', name: '8-week block', n: 8, price: r10(rate * 8 * 0.85), note: 'Eight sessions, 15% off. Best for a full rehab or fat-loss phase.' },
]
export const sessionPrice = (price: number, type: string) => r10(type === 'Video call' ? price : price * 0.6)

export type Client = {
  id: string
  name: string
  initials: string
  age: number
  goal: string
  injury: string
  area: 'knee' | 'back' | 'shoulder'
  week: number
  of: number
  pain: number[]
  workouts: number[]
  limit: number
  lastCheckin: string
  lastCheckinAgo: number
  email: string
  phone: string
}

export const clients: Client[] = [
  { id: 'sara', name: 'Sara Hassan', initials: 'SH', age: 26, goal: 'Lose fat, knee rehab', injury: 'Right knee, meniscus strain', area: 'knee', week: 3, of: 8, pain: [5, 5, 4, 4, 3, 3, 3, 3], workouts: [2, 3, 3, 4, 3, 4, 4, 3], limit: 4, lastCheckin: 'Today, 9:10 AM', lastCheckinAgo: 0, email: 'sara.hassan@example.com', phone: '0100 555 0142' },
  { id: 'omar', name: 'Omar Khaled', initials: 'OK', age: 34, goal: 'Lower back strength', injury: 'Lower back, L4-L5 stiffness', area: 'back', week: 5, of: 10, pain: [4, 3, 3, 3, 2, 2, 2, 2], workouts: [3, 3, 3, 3, 4, 3, 4, 4], limit: 4, lastCheckin: 'Today, 7:45 AM', lastCheckinAgo: 0, email: 'omar.khaled@example.com', phone: '0111 555 0188' },
  { id: 'laila', name: 'Laila Mostafa', initials: 'LM', age: 41, goal: 'Shoulder mobility', injury: 'Left shoulder, rotator cuff', area: 'shoulder', week: 3, of: 12, pain: [3, 4, 4, 5, 6, 6, 7, 8], workouts: [3, 3, 2, 2, 2, 1, 1, 1], limit: 4, lastCheckin: 'Today, 8:30 AM', lastCheckinAgo: 0, email: 'laila.mostafa@example.com', phone: '0122 555 0107' },
  { id: 'youssef', name: 'Youssef Nabil', initials: 'YN', age: 29, goal: 'Return to football', injury: 'Left knee, ACL reconstruction', area: 'knee', week: 9, of: 16, pain: [2, 2, 3, 3, 3, 4, 5, 6], workouts: [4, 4, 4, 4, 3, 3, 3, 2], limit: 4, lastCheckin: 'Yesterday', lastCheckinAgo: 1, email: 'youssef.nabil@example.com', phone: '0100 555 0163' },
  { id: 'mariam', name: 'Mariam Adel', initials: 'MA', age: 52, goal: 'Walk without pain', injury: 'Both knees, osteoarthritis', area: 'knee', week: 6, of: 12, pain: [5, 5, 5, 4, 4, 4, 3, 3], workouts: [2, 2, 3, 3, 3, 3, 3, 3], limit: 4, lastCheckin: 'Yesterday', lastCheckinAgo: 1, email: 'mariam.adel@example.com', phone: '0109 555 0120' },
  { id: 'tarek', name: 'Tarek Samir', initials: 'TS', age: 38, goal: 'Desk-related neck and back pain', injury: 'Upper back and neck tension', area: 'back', week: 2, of: 6, pain: [5, 5, 5, 4, 4, 4, 4, 3], workouts: [1, 2, 2, 3, 3, 3, 3, 3], limit: 4, lastCheckin: '2 days ago', lastCheckinAgo: 2, email: 'tarek.samir@example.com', phone: '0128 555 0175' },
  { id: 'nour', name: 'Nour El-Din', initials: 'NE', age: 23, goal: 'Build muscle after shoulder surgery', injury: 'Right shoulder, labrum repair', area: 'shoulder', week: 11, of: 14, pain: [4, 3, 3, 2, 2, 2, 1, 1], workouts: [3, 3, 4, 4, 4, 5, 5, 5], limit: 3, lastCheckin: '3 days ago', lastCheckinAgo: 3, email: 'nour.eldin@example.com', phone: '0115 555 0151' },
  { id: 'dina', name: 'Dina Fouad', initials: 'DF', age: 31, goal: 'Postpartum core and back', injury: 'Lower back, diastasis recti', area: 'back', week: 4, of: 10, pain: [4, 4, 3, 3, 3, 3, 4, 4], workouts: [2, 2, 3, 3, 3, 3, 2, 3], limit: 4, lastCheckin: '5 days ago', lastCheckinAgo: 5, email: 'dina.fouad@example.com', phone: '0100 555 0199' },
]

export const painTrend = (c: Client) => {
  const n = c.pain[c.pain.length - 1]
  const d = n - c.pain[c.pain.length - 2]
  return { now: n, delta: d, dir: d > 0 ? 'up' : d < 0 ? 'down' : 'flat' } as const
}
export const overLimit = (c: Client) => painTrend(c).now > c.limit
