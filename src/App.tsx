import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { CustomerLayout } from '@/components/layout/CustomerLayout'
import SplashScreen from '@/pages/SplashScreen'
import Onboarding from '@/pages/Onboarding'
import Auth from '@/pages/Auth'
import AuthEmail from '@/pages/AuthEmail'
import VerifyOtp from '@/pages/VerifyOtp'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Home from '@/pages/Home'
import RegionCities from '@/pages/RegionCities'
import CitySalons from '@/pages/CitySalons'
import SearchPage from '@/pages/Search'
import MapPage from '@/pages/MapPage'
import SalonDetail from '@/pages/SalonDetail'
import BookingFlow from '@/pages/BookingFlow'
import Bookings from '@/pages/Bookings'
import Favorites from '@/pages/Favorites'
import Profile from '@/pages/Profile'
import EditProfile from '@/pages/EditProfile'
import AiAssistant from '@/pages/AiAssistant'
import SkinAnalysis from '@/pages/SkinAnalysis'
import OffersPage from '@/pages/OffersPage'
import Notifications from '@/pages/Notifications'
import CompleteProfile from '@/pages/CompleteProfile'
import AiChat from '@/pages/AiChat'
import Store from '@/pages/Store'
import ProductDetail from '@/pages/ProductDetail'
import Cart from '@/pages/Cart'
import Checkout from '@/pages/Checkout'
import PrivacyPolicy from '@/pages/PrivacyPolicy'
import Terms from '@/pages/Terms'
import Invite from '@/pages/Invite'
import Settings from '@/pages/Settings'
import AdminLayout from '@/pages/admin/AdminLayout'
import AdminLogin from '@/pages/admin/AdminLogin'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminSalons from '@/pages/admin/AdminSalons'
import AdminUsers from '@/pages/admin/AdminUsers'
import AdminBookings from '@/pages/admin/AdminBookings'
import AdminReviews from '@/pages/admin/AdminReviews'
import AdminAnalytics from '@/pages/admin/AdminAnalytics'
import AdminRevenue from '@/pages/admin/AdminRevenue'
import OwnerLayout from '@/pages/owner/OwnerLayout'
import OwnerLogin from '@/pages/owner/OwnerLogin'
import OwnerHome from '@/pages/owner/OwnerHome'
import OwnerBookings from '@/pages/owner/OwnerBookings'
import OwnerServices from '@/pages/owner/OwnerServices'
import OwnerSchedule from '@/pages/owner/OwnerSchedule'
import OwnerReports from '@/pages/owner/OwnerReports'
import ProtectedRoute from '@/components/ProtectedRoute'

function OwnerDashboardRedirect() {
  const { pathname } = useLocation()
  const sub = pathname === '/dashboard' ? '' : pathname.slice('/dashboard'.length)
  return <Navigate to={`/owner${sub}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/email" element={<AuthEmail />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<CustomerLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/region/:regionId" element={<RegionCities />} />
        <Route path="/city/:cityId" element={<CitySalons />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/salon/:id" element={<SalonDetail />} />
        <Route path="/booking/:salonId" element={<BookingFlow />} />
        <Route path="/bookings" element={<Bookings />} />
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
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="reviews" element={<AdminReviews />} />
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
  )
}
