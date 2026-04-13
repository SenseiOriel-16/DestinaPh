import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./layouts/AdminLayout";
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
import { SettingsPage } from "./pages/SettingsPage";
import { PremiumPaymentsPage } from "./pages/PremiumPaymentsPage";
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
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/municipalities" element={<MunicipalitiesPage />} />
        <Route path="/featured" element={<FeaturedPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/premium-payments" element={<PremiumPaymentsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
