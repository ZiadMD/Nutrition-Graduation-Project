import React, { createContext, useContext, useEffect, useState } from 'react'

export type Language = 'en' | 'ar'

export interface LanguageContextType {
  lang: Language
  dir: 'ltr' | 'rtl'
  isRtl: boolean
  setLang: (lang: Language) => void
  toggleLang: () => void
  t: (key: string, fallback?: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav & Shell
    'nav.today': 'Today',
    'nav.specialists': 'Specialists',
    'nav.bookings': 'Bookings',
    'nav.plan': 'My plan',
    'nav.progress': 'Progress',
    'nav.ai_plan': 'AI plan',
    'nav.clients': 'Clients',
    'nav.schedule': 'Schedule',
    'nav.overview': 'Overview',
    'nav.users': 'Users',
    'nav.approvals': 'Approvals',
    'nav.ledger': 'Ledger',
    'nav.payouts': 'Payouts',
    'nav.subscriptions': 'Subscriptions',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',
    'nav.logout': 'Log out',
    'nav.notifications': 'Notifications',
    'nav.menu': 'Menu',
    'nav.demo_role': 'Demo role',

    // Specialist directory
    'specialists.filter_all': 'All',
    'specialists.filter_trainers': 'Trainers',
    'specialists.filter_dietitians': 'Dietitians',
    'specialists.filter_pts': 'Physical therapists',
    'specialists.search_placeholder': 'Search by name or focus',
    'specialists.sort_by': 'Sort by',
    'specialists.sort_soonest': 'Next available',
    'specialists.sort_low': 'Price: low to high',
    'specialists.sort_high': 'Price: high to low',
    'specialists.sort_exp': 'Most experience',
    'specialists.sort_rating': 'Highest rated',
    'specialists.count_label': 'specialists',
    'specialists.no_match': 'No specialists match',
    'specialists.no_match_sub': 'Try a different name or a wider filter. Everyone here is licensed or certified.',
    'specialists.clear_filters': 'Clear filters',
    'specialists.view_profile': 'View profile',
    'specialists.per_session': 'per session',
    'specialists.next_available': 'Next available',
    'specialists.no_open_slots': 'No open slots',
    'specialists.years_experience': 'years experience',
    'specialists.experience': 'Experience',
    'specialists.languages': 'Languages',
    'specialists.years': 'years',
    'specialists.all_specialists': 'All specialists',
    'specialists.book_session': 'Book a session',
    'specialists.next_free_slots': 'Next free slots',
    'specialists.cairo_time': 'Cairo time',
    'specialists.sessions_completed': 'sessions completed',
    'specialists.clients_worked_with': 'clients worked with',
    'specialists.clients': 'clients',
    'specialists.worked_with': 'Worked with',
    'specialists.reviews': 'reviews',
    'specialists.review': 'review',
    'specialists.rating': 'Rating',

    // Specialist Profile Tabs & Content
    'profile.tab_about': 'About',
    'profile.tab_avail': 'Availability',
    'profile.tab_pack': 'Packages',
    'profile.tab_reviews': 'Reviews & Ratings',
    'profile.how_i_work': 'How I work with your other specialists',
    'profile.open_slots_week': 'Open slots this week, Cairo time.',
    'profile.no_free_times': 'No free times',

    // Reviews & Ratings
    'reviews.title': 'Ratings & Client Reviews',
    'reviews.summary_title': 'Reviews summary',
    'reviews.overall_rating': 'Overall rating',
    'reviews.based_on': 'Based on',
    'reviews.verified_reviews': 'verified client reviews',
    'reviews.breakdown_title': 'Rating distribution',
    'reviews.stars_count': '{count} stars',
    'reviews.star': 'star',
    'reviews.stars': 'stars',
    'reviews.write_review': 'Leave a Rating & Review',
    'reviews.edit_review': 'Update Your Review',
    'reviews.your_rating': 'Your rating',
    'reviews.your_feedback': 'Your feedback & experience',
    'reviews.feedback_placeholder': 'Share how this specialist helped your health, training, nutrition, or rehab journey...',
    'reviews.submit': 'Submit Review',
    'reviews.update': 'Update Review',
    'reviews.submitting': 'Submitting...',
    'reviews.success': 'Thank you! Your review has been saved.',
    'reviews.verified_badge': 'Verified Client',
    'reviews.verified_desc': 'Booked sessions or active care team client',
    'reviews.locked_title': 'Verified Client Reviews Only',
    'reviews.locked_desc': 'To prevent spam and fake reviews, only clients who have booked sessions or worked with this specialist during a subscription are permitted to leave a rating and review.',
    'reviews.no_reviews': 'No reviews yet',
    'reviews.be_first': 'Be the first verified client to leave a review after your session!',

    // Common
    'common.language': 'Language',
    'common.switch_to_arabic': 'العربية 🇪🇬',
    'common.switch_to_english': 'English 🇬🇧',
    'common.back': 'Back',
    'common.close': 'Close',
    'common.loading': 'Loading...',
  },
  ar: {
    // Nav & Shell
    'nav.today': 'اليوم',
    'nav.specialists': 'المختصون',
    'nav.bookings': 'الحجوزات',
    'nav.plan': 'خطتي',
    'nav.progress': 'التقدم',
    'nav.ai_plan': 'خطة الذكاء الاصطناعي',
    'nav.clients': 'العملاء',
    'nav.schedule': 'الجدول',
    'nav.overview': 'نظرة عامة',
    'nav.users': 'المستخدمون',
    'nav.approvals': 'الموافقات',
    'nav.ledger': 'سجل المعاملات',
    'nav.payouts': 'المدفوعات',
    'nav.subscriptions': 'الاشتراكات',
    'nav.profile': 'الملف الشخصي',
    'nav.settings': 'الإعدادات',
    'nav.logout': 'تسجيل الخروج',
    'nav.notifications': 'الإشعارات',
    'nav.menu': 'القائمة',
    'nav.demo_role': 'نوع الحساب التجريبي',

    // Specialist directory
    'specialists.filter_all': 'الكل',
    'specialists.filter_trainers': 'مدربون',
    'specialists.filter_dietitians': 'أخصائيو تغذية',
    'specialists.filter_pts': 'علاج طبيعي',
    'specialists.search_placeholder': 'ابحث بالاسم أو التخصص',
    'specialists.sort_by': 'ترتيب حسب',
    'specialists.sort_soonest': 'الموعد المتاح التالي',
    'specialists.sort_low': 'السعر: من الأقل للأعلى',
    'specialists.sort_high': 'السعر: من الأعلى للأقل',
    'specialists.sort_exp': 'الأكثر خبرة',
    'specialists.sort_rating': 'الأعلى تقييماً',
    'specialists.count_label': 'مختصاً',
    'specialists.no_match': 'لا يوجد مختصون مطابقون',
    'specialists.no_match_sub': 'جرّب البحث باسم آخر أو وسّع نطاق التصفية. جميع المتخصصين هنا معتمدون ومرخصون.',
    'specialists.clear_filters': 'إلغاء التصفية',
    'specialists.view_profile': 'عرض الملف',
    'specialists.per_session': 'لكل جلسة',
    'specialists.next_available': 'الموعد المتاح التالي',
    'specialists.no_open_slots': 'لا توجد مواعيد شاغرة',
    'specialists.years_experience': 'سنوات خبرة',
    'specialists.experience': 'الخبرة',
    'specialists.languages': 'اللغات',
    'specialists.years': 'سنوات',
    'specialists.all_specialists': 'جميع المختصين',
    'specialists.book_session': 'حجز جلسة',
    'specialists.next_free_slots': 'المواعيد المتاحة القادمة',
    'specialists.cairo_time': 'توقيت القاهرة',
    'specialists.sessions_completed': 'جلسة مكتملة',
    'specialists.clients_worked_with': 'عملاء عمل معهم',
    'specialists.clients': 'عميل',
    'specialists.worked_with': 'عمل مع',
    'specialists.reviews': 'تقييم',
    'specialists.review': 'تقييم',
    'specialists.rating': 'التقييم',

    // Specialist Profile Tabs & Content
    'profile.tab_about': 'نبذة عن المختص',
    'profile.tab_avail': 'المواعيد المتاحة',
    'profile.tab_pack': 'الباقات',
    'profile.tab_reviews': 'التقييمات والمراجعات',
    'profile.how_i_work': 'كيف أتعاون وأنسق مع باقي فريقك الطبي والرياضي',
    'profile.open_slots_week': 'المواعيد المتاحة هذا الأسبوع، بتوقيت القاهرة.',
    'profile.no_free_times': 'لا توجد مواعيد شاغرة',

    // Reviews & Ratings
    'reviews.title': 'التقييمات وآراء العملاء',
    'reviews.summary_title': 'ملخص التقييمات',
    'reviews.overall_rating': 'التقييم العام',
    'reviews.based_on': 'بناءً على',
    'reviews.verified_reviews': 'تقييمات من عملاء حقيقيين وموثقين',
    'reviews.breakdown_title': 'توزيع درجات التقييم',
    'reviews.stars_count': '{count} نجوم',
    'reviews.star': 'نجمة',
    'reviews.stars': 'نجوم',
    'reviews.write_review': 'أضف تقييمك ورأيك',
    'reviews.edit_review': 'تعديل تقييمك السابق',
    'reviews.your_rating': 'تقييمك للمختص',
    'reviews.your_feedback': 'رأيك وملاحظاتك حول الجلسة والبرنامج',
    'reviews.feedback_placeholder': 'شارك تجربتك مع هذا المختص وكيف ساعدك في رحلتك الصحية أو الرياضية أو العلاجية...',
    'reviews.submit': 'إرسال التقييم',
    'reviews.update': 'تحديث التقييم',
    'reviews.submitting': 'جاري الإرسال...',
    'reviews.success': 'شكراً لك! تم حفظ تقييمك بنجاح.',
    'reviews.verified_badge': 'عميل موثق',
    'reviews.verified_desc': 'حجز جلسات سابقة أو عضو ضمن الفريق الطبي المتابع',
    'reviews.locked_title': 'التقييم مخصص للعملاء المشتركين فقط',
    'reviews.locked_desc': 'لمنع التقييمات العشوائية والمزيفة، يحق حصرياً للعملاء الذين حجزوا جلسات أو تدربوا مع المختص خلال فترة الاشتراك كتابة مراجعة وتقييم.',
    'reviews.no_reviews': 'لا توجد تقييمات حتى الآن',
    'reviews.be_first': 'كن أول عميل موثق يشارك تجربته بعد انتهاء جلستك!',

    // Common
    'common.language': 'اللغة',
    'common.switch_to_arabic': 'العربية 🇪🇬',
    'common.switch_to_english': 'English 🇬🇧',
    'common.back': 'رجوع',
    'common.close': 'إغلاق',
    'common.loading': 'جاري التحميل...',
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem('rebound_lang')
      return stored === 'ar' ? 'ar' : 'en'
    } catch {
      return 'en'
    }
  })

  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const isRtl = dir === 'rtl'

  useEffect(() => {
    try {
      localStorage.setItem('rebound_lang', lang)
    } catch {
      // ignore
    }
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const setLang = (newLang: Language) => {
    setLangState(newLang)
  }

  const toggleLang = () => {
    setLangState((prev) => (prev === 'en' ? 'ar' : 'en'))
  }

  const t = (key: string, fallback?: string): string => {
    return translations[lang]?.[key] ?? translations.en?.[key] ?? fallback ?? key
  }

  return (
    <LanguageContext.Provider value={{ lang, dir, isRtl, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
