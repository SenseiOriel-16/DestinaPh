import { Outlet } from "react-router-dom";

/** Parent route for /settings/* configuration screens (categories, geo, featured, plans). */
export function SettingsSectionLayout() {
  return <Outlet />;
}
