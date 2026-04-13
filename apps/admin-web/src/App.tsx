import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./layouts/AdminLayout";
import { SettingsSectionLayout } from "./layouts/SettingsSectionLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterAdminPage } from "./pages/RegisterAdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { ListingsPage } from "./pages/ListingsPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { MunicipalitiesPage } from "./pages/MunicipalitiesPage";
import { FeaturedPage } from "./pages/FeaturedPage";
import { PlansPage } from "./pages/PlansPage";
import { ReportsPage } from "./pages/ReportsPage";
import { PremiumPaymentsPage } from "./pages/PremiumPaymentsPage";
import { PremiumPlatformAccountsPage } from "./pages/PremiumPlatformAccountsPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterAdminPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/listings" element={<ListingsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/premium-payments" element={<PremiumPaymentsPage />} />
        <Route path="/settings" element={<SettingsSectionLayout />}>
          <Route index element={<Navigate to="categories" replace />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="municipalities" element={<MunicipalitiesPage />} />
          <Route path="featured" element={<FeaturedPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="premium-accounts" element={<PremiumPlatformAccountsPage />} />
        </Route>
        <Route path="/categories" element={<Navigate to="/settings/categories" replace />} />
        <Route path="/municipalities" element={<Navigate to="/settings/municipalities" replace />} />
        <Route path="/featured" element={<Navigate to="/settings/featured" replace />} />
        <Route path="/plans" element={<Navigate to="/settings/plans" replace />} />
        <Route path="/premium-accounts" element={<Navigate to="/settings/premium-accounts" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
