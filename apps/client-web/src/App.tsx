import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { OwnerRoute } from "./components/OwnerRoute";
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
const UpgradePage = lazy(() =>
  import("./pages/UpgradePage").then((m) => ({ default: m.UpgradePage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

function RouteFallback() {
  return (
    <div className="owner-route-loading">
      <div className="card">Loading…</div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<OwnerRoute />}>
          <Route element={<OwnerLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="listings" element={<ListingsPage />} />
            <Route path="listings/new" element={<ListingEditorPage />} />
            <Route path="listings/:id" element={<ListingEditorPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="upgrade" element={<UpgradePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
