import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { CustomerLayout } from '@/components/layout/CustomerLayout'
import SplashScreen from '@/pages/SplashScreen'
import SalonPortalRoute from '@/components/SalonPortalRoute'
import ProtectedRoute from '@/components/ProtectedRoute'
import { usePreferences } from '@/contexts/PreferencesContext'
/** استيراد ثابت للصفحة الرئيسية فقط — يقلّل حجم الحزمة الأولى بعد التقسيم */
import Home from '@/pages/Home'

const Onboarding = lazy(() => import('@/pages/Onboarding'))
const Auth = lazy(() => import('@/pages/Auth'))
const AuthCallback = lazy(() => import('@/pages/AuthCallback'))
const AuthEmail = lazy(() => import('@/pages/AuthEmail'))
const VerifyOtp = lazy(() => import('@/pages/VerifyOtp'))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const RegionCities = lazy(() => import('@/pages/RegionCities'))
const CitySalons = lazy(() => import('@/pages/CitySalons'))
const SearchPage = lazy(() => import('@/pages/Search'))
const BookingFlow = lazy(() => import('@/pages/BookingFlow'))
const Bookings = lazy(() => import('@/pages/Bookings'))
const Favorites = lazy(() => import('@/pages/Favorites'))
const Profile = lazy(() => import('@/pages/Profile'))
const EditProfile = lazy(() => import('@/pages/EditProfile'))
const OffersPage = lazy(() => import('@/pages/OffersPage'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const CompleteProfile = lazy(() => import('@/pages/CompleteProfile'))
const PaymentCallback = lazy(() => import('@/pages/PaymentCallback'))
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'))
const Terms = lazy(() => import('@/pages/Terms'))
const Invite = lazy(() => import('@/pages/Invite'))
const Settings = lazy(() => import('@/pages/Settings'))
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminSalons = lazy(() => import('@/pages/admin/AdminSalons'))
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'))
const AdminBookings = lazy(() => import('@/pages/admin/AdminBookings'))
const AdminReviews = lazy(() => import('@/pages/admin/AdminReviews'))
const AdminOffers = lazy(() => import('@/pages/admin/AdminOffers'))
const AdminMonetization = lazy(() => import('@/pages/admin/AdminMonetization'))
const AdminTeam = lazy(() => import('@/pages/admin/AdminTeam'))
const OwnerLogin = lazy(() => import('@/pages/owner/OwnerLogin'))
const SalonLayout = lazy(() => import('@/pages/salon/SalonLayout'))
const SalonDashboard = lazy(() => import('@/pages/salon/SalonDashboard'))
const SalonBookings = lazy(() => import('@/pages/salon/SalonBookings'))
const SalonServices = lazy(() => import('@/pages/salon/SalonServices'))
const SalonSubscription = lazy(() => import('@/pages/salon/SalonSubscription'))
const SalonFeaturedAds = lazy(() => import('@/pages/salon/SalonFeaturedAds'))
const SalonAnalytics = lazy(() => import('@/pages/salon/SalonAnalytics'))
const SalonProfile = lazy(() => import('@/pages/salon/SalonProfile'))
const OwnerLegacyRedirect = lazy(() => import('@/pages/salon/OwnerLegacyRedirect'))
const TopSalons = lazy(() => import('@/pages/TopSalons'))
const RecommendedSalons = lazy(() => import('@/pages/RecommendedSalons'))
const SalonOnboarding = lazy(() => import('@/pages/onboarding/SalonOnboarding'))
const ForSalonsLanding = lazy(() => import('@/pages/for-salons/ForSalonsLanding'))

const SalonDetail = lazy(() => import('@/pages/SalonDetail'))
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'))
const Store = lazy(() => import('@/pages/Store'))
const SkinAnalysis = lazy(() => import('@/pages/SkinAnalysis'))
const RosyVision = lazy(() => import('@/pages/RosyVision'))
const AiChat = lazy(() => import('@/pages/AiChat'))
const Checkout = lazy(() => import('@/pages/Checkout'))
const Orders = lazy(() => import('@/pages/Orders'))
const AdminProviders = lazy(() => import('@/pages/admin/AdminProviders'))
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'))
const AdminShipping = lazy(() => import('@/pages/admin/AdminShipping'))
const AdminTrustOps = lazy(() => import('@/pages/admin/AdminTrustOps'))
const MapPage = lazy(() => import('@/pages/MapPage'))
const InstallOnboarding = lazy(() => import('@/pages/InstallOnboarding'))
const ProductDetail = lazy(() => import('@/pages/ProductDetail'))
const Cart = lazy(() => import('@/pages/Cart'))
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'))
const AdminRevenue = lazy(() => import('@/pages/admin/AdminRevenue'))

function PageFallback() {
  const { lang } = usePreferences()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6">
      <div className="flex w-full max-w-xs flex-col gap-4 animate-page-enter motion-reduce:animate-none">
        <div className="h-4 w-[60%] rounded-lg bg-muted/60" />
        <div className="h-24 w-full rounded-2xl bg-gradient-to-br from-primary/15 via-pink-100/40 to-amber-100/20 shadow-inner">
          <div className="relative h-full w-full overflow-hidden rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-map-shimmer opacity-70" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded-md bg-muted/50" />
          <div className="h-3 w-4/5 rounded-md bg-muted/40" />
          <div className="h-3 w-3/5 rounded-md bg-muted/35" />
        </div>
        <p className="text-center text-body-sm text-muted-foreground" role="status" aria-live="polite">
          {lang === 'ar' ? 'جاري التحميل…' : 'Loading…'}
        </p>
      </div>
    </div>
  )
}

function OwnerDashboardRedirect() {
  const { pathname } = useLocation()
  const sub = pathname === '/dashboard' ? '' : pathname.slice('/dashboard'.length)
  const map: Record<string, string> = {
    '': '/salon/dashboard',
    '/bookings': '/salon/bookings',
    '/services': '/salon/services',
    '/ads': '/salon/ads',
  }
  return <Navigate to={map[sub] ?? '/salon/dashboard'} replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/email" element={<AuthEmail />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/payment/callback" element={<PaymentCallback />} />
        <Route path="/onboarding/salon" element={<SalonOnboarding />} />
        <Route path="/for-salons" element={<ForSalonsLanding />} />
        <Route path="/for-salons/onboard" element={<SalonOnboarding />} />
        <Route path="/install" element={<InstallOnboarding />} />

        <Route
          element={
            <SalonPortalRoute>
              <SalonLayout />
            </SalonPortalRoute>
          }
        >
          <Route path="/salon/dashboard" element={<SalonDashboard />} />
          <Route path="/salon/bookings" element={<SalonBookings />} />
          <Route path="/salon/services" element={<SalonServices />} />
          <Route path="/salon/subscription" element={<SalonSubscription />} />
          <Route path="/salon/ads" element={<SalonFeaturedAds />} />
          <Route path="/salon/analytics" element={<SalonAnalytics />} />
          <Route path="/salon/profile" element={<SalonProfile />} />
        </Route>
        <Route path="/salon" element={<Navigate to="/salon/dashboard" replace />} />

        <Route element={<CustomerLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/region/:regionId" element={<RegionCities />} />
          <Route path="/city/:cityId" element={<CitySalons />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/top-salons" element={<TopSalons />} />
          <Route path="/recommended-salons" element={<RecommendedSalons />} />
          <Route path="/salon/:id" element={<SalonDetail />} />
          <Route path="/booking/:salonId" element={<BookingFlow />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/skin-analysis" element={<SkinAnalysis />} />
          <Route path="/rosy-vision" element={<RosyVision />} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/chat" element={<AiChat />} />
          <Route path="/store" element={<Store />} />
          <Route path="/product/:productId" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/invite" element={<Invite />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
        </Route>

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requirePrivilegedStaff>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="salons" element={<AdminSalons />} />
          <Route path="businesses" element={<Navigate to="/admin/salons" replace />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="team" element={<AdminTeam />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="shipping" element={<AdminShipping />} />
          <Route path="trust-ops" element={<AdminTrustOps />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="providers" element={<AdminProviders />} />
          <Route path="revenue" element={<AdminRevenue />} />
          <Route path="monetization" element={<AdminMonetization />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="offers" element={<AdminOffers />} />
        </Route>

        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route
          path="/owner/*"
          element={
            <SalonPortalRoute>
              <OwnerLegacyRedirect />
            </SalonPortalRoute>
          }
        />
        <Route path="/dashboard/*" element={<OwnerDashboardRedirect />} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Suspense>
  )
}
