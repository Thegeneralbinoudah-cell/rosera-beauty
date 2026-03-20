import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { CustomerLayout } from '@/components/layout/CustomerLayout'
import SplashScreen from '@/pages/SplashScreen'
import Onboarding from '@/pages/Onboarding'
import Auth from '@/pages/Auth'
import AuthEmail from '@/pages/AuthEmail'
import VerifyOtp from '@/pages/VerifyOtp'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import RegionCities from '@/pages/RegionCities'
import CitySalons from '@/pages/CitySalons'
import SearchPage from '@/pages/Search'
import BookingFlow from '@/pages/BookingFlow'
import Bookings from '@/pages/Bookings'
import Favorites from '@/pages/Favorites'
import Profile from '@/pages/Profile'
import EditProfile from '@/pages/EditProfile'
import AiAssistant from '@/pages/AiAssistant'
import OffersPage from '@/pages/OffersPage'
import Notifications from '@/pages/Notifications'
import CompleteProfile from '@/pages/CompleteProfile'
import ProductDetail from '@/pages/ProductDetail'
import Cart from '@/pages/Cart'
import PaymentCallback from '@/pages/PaymentCallback'
import PrivacyPolicy from '@/pages/PrivacyPolicy'
import Terms from '@/pages/Terms'
import Invite from '@/pages/Invite'
import Settings from '@/pages/Settings'
import AdminLogin from '@/pages/admin/AdminLogin'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminSalons from '@/pages/admin/AdminSalons'
import AdminUsers from '@/pages/admin/AdminUsers'
import AdminBookings from '@/pages/admin/AdminBookings'
import AdminReviews from '@/pages/admin/AdminReviews'
import AdminAnalytics from '@/pages/admin/AdminAnalytics'
import AdminRevenue from '@/pages/admin/AdminRevenue'
import AdminTeam from '@/pages/admin/AdminTeam'
import OwnerLogin from '@/pages/owner/OwnerLogin'
import OwnerHome from '@/pages/owner/OwnerHome'
import OwnerBookings from '@/pages/owner/OwnerBookings'
import OwnerServices from '@/pages/owner/OwnerServices'
import OwnerSchedule from '@/pages/owner/OwnerSchedule'
import OwnerReports from '@/pages/owner/OwnerReports'
import ProtectedRoute from '@/components/ProtectedRoute'

const Home = lazy(() => import('@/pages/Home'))
const MapPage = lazy(() => import('@/pages/MapPage'))
const SalonDetail = lazy(() => import('@/pages/SalonDetail'))
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'))
const OwnerLayout = lazy(() => import('@/pages/owner/OwnerLayout'))
const Store = lazy(() => import('@/pages/Store'))
const SkinAnalysis = lazy(() => import('@/pages/SkinAnalysis'))
const AiChat = lazy(() => import('@/pages/AiChat'))
const Checkout = lazy(() => import('@/pages/Checkout'))
const Orders = lazy(() => import('@/pages/Orders'))
const AdminProviders = lazy(() => import('@/pages/admin/AdminProviders'))
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'))
const AdminShipping = lazy(() => import('@/pages/admin/AdminShipping'))
const AdminTrustOps = lazy(() => import('@/pages/admin/AdminTrustOps'))

const PageFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
  </div>
)

function OwnerDashboardRedirect() {
  const { pathname } = useLocation()
  const sub = pathname === '/dashboard' ? '' : pathname.slice('/dashboard'.length)
  return <Navigate to={`/owner${sub}`} replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/email" element={<AuthEmail />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/payment/callback" element={<PaymentCallback />} />

      <Route element={<CustomerLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/region/:regionId" element={<RegionCities />} />
        <Route path="/city/:cityId" element={<CitySalons />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/salon/:id" element={<SalonDetail />} />
        <Route path="/booking/:salonId" element={<BookingFlow />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<EditProfile />} />
        <Route path="/ai-assistant" element={<AiAssistant />} />
        <Route path="/skin-analysis" element={<SkinAnalysis />} />
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
          <ProtectedRoute allowedRoles={['admin', 'owner', 'supervisor']}>
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
        <Route path="analytics" element={<AdminAnalytics />} />
      </Route>

      <Route path="/owner/login" element={<OwnerLogin />} />
      <Route
        path="/owner"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <OwnerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OwnerHome />} />
        <Route path="bookings" element={<OwnerBookings />} />
        <Route path="services" element={<OwnerServices />} />
        <Route path="schedule" element={<OwnerSchedule />} />
        <Route path="reports" element={<OwnerReports />} />
      </Route>
      <Route path="/dashboard/*" element={<OwnerDashboardRedirect />} />

      <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Suspense>
  )
}
