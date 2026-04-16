import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { OwnerRoute } from "./components/OwnerRoute";
import { OwnerShellSkeleton } from "./components/PageSkeletons";
import { OwnerLayout } from "./layouts/OwnerLayout";

const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("./pages/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const ListingsPage = lazy(() =>
  import("./pages/ListingsPage").then((m) => ({ default: m.ListingsPage })),
);
const ListingEditorPage = lazy(() =>
  import("./pages/ListingEditorPage").then((m) => ({ default: m.ListingEditorPage })),
);
const AnalyticsPage = lazy(() =>
  import("./pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })),
);
const OwnerSettingsLayout = lazy(() =>
  import("./layouts/OwnerSettingsLayout").then((m) => ({ default: m.OwnerSettingsLayout })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const PaymentAccountsPage = lazy(() =>
  import("./pages/PaymentAccountsPage").then((m) => ({ default: m.PaymentAccountsPage })),
);
const OwnerReservationsPage = lazy(() =>
  import("./pages/OwnerReservationsPage").then((m) => ({ default: m.OwnerReservationsPage })),
);
const OwnerMessagesPage = lazy(() =>
  import("./pages/OwnerMessagesPage").then((m) => ({ default: m.OwnerMessagesPage })),
);
const SupportPage = lazy(() =>
  import("./pages/SupportPage").then((m) => ({ default: m.SupportPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("./pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);

function RouteFallback() {
  return <OwnerShellSkeleton />;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<OwnerRoute />}>
          <Route element={<OwnerLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="listings" element={<ListingsPage />} />
            <Route path="listings/new" element={<ListingEditorPage />} />
            <Route path="listings/:id" element={<ListingEditorPage />} />
            <Route path="reservations" element={<OwnerReservationsPage />} />
            <Route path="messages" element={<OwnerMessagesPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="settings" element={<OwnerSettingsLayout />}>
              <Route index element={<SettingsPage />} />
              <Route path="e-wallet" element={<PaymentAccountsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
