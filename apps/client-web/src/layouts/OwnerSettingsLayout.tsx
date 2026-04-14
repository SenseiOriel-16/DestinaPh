import { Outlet } from "react-router-dom";

/** Nested routes: /settings (account), /settings/e-wallet */
export function OwnerSettingsLayout() {
  return <Outlet />;
}
