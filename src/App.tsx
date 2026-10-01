import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "@/app/session";
import { AppShell } from "@/components/shell";
import { ErrorState, Loading } from "@/components/ui";
import { LoginPage, SetupPage } from "@/features/auth/AuthPages";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { EquipmentDetailPage, EquipmentListPage, FacilityDetailPage, FacilityLayoutPage, FacilityListPage, ZoneDetailPage, ZoneListPage } from "@/features/facilities/FacilityPages";
import { HomePage } from "@/features/home/HomePage";
import { ChecklistPage, FieldInspectionPage, InspectionDetailPage, InspectionListPage, InspectionWizardPage } from "@/features/inspections/InspectionPages";
import { LivePage, MissionControlPage, MissionDetailPage, MissionListPage } from "@/features/missions/MissionPages";
import { AlertsPage, DroneDetailPage, DroneListPage, HistoryPage, ReportListPage, ReportViewPage, RobotDetailPage, RobotListPage, SettingsPage, UsersPage } from "@/features/operations/OperationsPages";

function Guard() {
  const { ready, profile, error } = useSession();
  if (!ready) return <Loading />;
  if (!profile && error) return <ErrorState message={error} />;
  if (!profile) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route element={<Guard />}>
        <Route index element={<HomePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="inspections" element={<InspectionListPage />} />
        <Route path="inspections/new" element={<InspectionWizardPage />} />
        <Route path="inspections/:id" element={<InspectionDetailPage />} />
        <Route path="inspections/:id/checklist" element={<ChecklistPage />} />
        <Route path="inspections/:id/field" element={<FieldInspectionPage />} />
        <Route path="missions" element={<MissionListPage />} />
        <Route path="missions/:id" element={<MissionDetailPage />} />
        <Route path="missions/:id/control" element={<MissionControlPage />} />
        <Route path="live" element={<LivePage />} />
        <Route path="facilities" element={<FacilityListPage />} />
        <Route path="facilities/:id" element={<FacilityDetailPage />} />
        <Route path="facilities/:id/layout" element={<FacilityLayoutPage />} />
        <Route path="equipment" element={<EquipmentListPage />} />
        <Route path="equipment/:id" element={<EquipmentDetailPage />} />
        <Route path="zones" element={<ZoneListPage />} />
        <Route path="zones/:id" element={<ZoneDetailPage />} />
        <Route path="drones" element={<DroneListPage />} />
        <Route path="drones/:id" element={<DroneDetailPage />} />
        <Route path="robots" element={<RobotListPage />} />
        <Route path="robots/:id" element={<RobotDetailPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="reports" element={<ReportListPage />} />
        <Route path="reports/:id" element={<ReportViewPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
