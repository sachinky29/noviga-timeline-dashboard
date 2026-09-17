import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AppBar, Box, Button, CircularProgress, IconButton, Toolbar, Typography } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import FilterBar from "./components/FilterBar";
import HourlyTable from "./components/HourlyTable";
import LoginPage from "./components/LoginPage";
import TimelineChart from "./components/TimelineChart";
import { ApiError, getAssetsTree, getCurrentUser, getCycleTime, getMachineIntervals, getShifts, logout } from "./services/api";
import type { AssetOption, MachineIntervals, ShiftOption, User } from "./types";
import { buildHourlyRows, buildShiftOptions, flattenAssets } from "./utils/data";
import { shiftWindowFromIst } from "./utils/time";

const DEFAULT_DATE = "2026-06-23";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");

  const [allAssets, setAllAssets] = useState<AssetOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [assetLevel, setAssetLevel] = useState("all");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [date, setDate] = useState(DEFAULT_DATE);
  const [individual, setIndividual] = useState(false);
  const [pointLabels, setPointLabels] = useState(true);

  const [intervals, setIntervals] = useState<MachineIntervals | null>(null);
  const [cycleRows, setCycleRows] = useState<Awaited<ReturnType<typeof getCycleTime>>>([]);
  const [loadingReference, setLoadingReference] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  const assetLevels = useMemo(() => {
    const levels = Array.from(new Set(allAssets.filter((a) => a.assetlevel_id !== 50).map((a) => a.assetlevel_id))).sort((a, b) => a - b);
    return [{ value: "all", label: "All Levels" }, ...levels.map((level) => ({ value: String(level), label: `Level ${level}` }))];
  }, [allAssets]);
  const assets = useMemo(() => allAssets.filter((asset) => asset.assetlevel_id !== 50 && (assetLevel === "all" || String(asset.assetlevel_id) === assetLevel)), [allAssets, assetLevel]);
  const selectedAsset = useMemo(() => allAssets.find((asset) => asset.id === selectedAssetId), [allAssets, selectedAssetId]);
  const machines = useMemo(() => {
    if (!selectedAsset) return [];
    const prefix = `${selectedAsset.path} / `;
    return allAssets.filter((asset) => asset.id !== selectedAsset.id && asset.path.startsWith(prefix) && asset.children?.length === 0);
  }, [allAssets, selectedAsset]);
  const selectedMachine = useMemo(() => machines.find((m) => m.id === selectedMachineId), [machines, selectedMachineId]);
  const partModelLabel = useMemo(() => {
    if (!intervals) return "—";
    const ids = Array.from(new Set([...(intervals.produce_counts ?? []).map((x) => x.part_model_id), ...(intervals.produces ?? []).map((x) => x.part_model_id)]));
    return ids.length ? ids.join(", ") : "—";
  }, [intervals]);
  const queryAsset = selectedMachine ?? selectedAsset;
  const shift = useMemo(() => shifts.find((s) => s.id === shiftId), [shifts, shiftId]);
  const timeWindow = useMemo(() => shift ? shiftWindowFromIst(date, shift.start, shift.end, shift.endDateOffset) : null, [date, shift]);

  const hourlyRows = useMemo(() => {
    if (!intervals || !timeWindow) return [];
    return buildHourlyRows(timeWindow.from, timeWindow.to, intervals, cycleRows);
  }, [intervals, timeWindow, cycleRows]);

  const handleAuthExpired = useCallback(() => {
    setUser(null);
    setIntervals(null);
    setCycleRows([]);
    setSessionError("Your session has expired. Please log in again.");
  }, []);

  useEffect(() => {
    window.addEventListener("auth-expired", handleAuthExpired);
    return () => window.removeEventListener("auth-expired", handleAuthExpired);
  }, [handleAuthExpired]);

  const restoreSession = useCallback(async () => {
    if (!localStorage.getItem("access_token")) {
      setCheckingSession(false);
      return;
    }
    try {
      setSessionError("");
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem("access_token");
        setUser(null);
      } else {
        setSessionError(err instanceof Error ? err.message : "Unable to validate the session.");
      }
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => { void restoreSession(); }, [restoreSession]);

  const loadReferenceData = useCallback(async () => {
    try {
      setLoadingReference(true);
      setError("");
      setAccessDenied(false);
      const [tree, definitions] = await Promise.all([getAssetsTree(), getShifts()]);
      const flattened = flattenAssets(tree);
      const shiftOptions = buildShiftOptions(definitions);
      setAllAssets(flattened);
      setShifts(shiftOptions);
      setSelectedAssetId((current) => current && flattened.some((a) => a.id === current) ? current : (flattened.find((a) => a.assetlevel_id === 20)?.id ?? flattened.find((a) => a.assetlevel_id !== 50)?.id ?? flattened[0]?.id ?? ""));
      setShiftId((current) => current && shiftOptions.some((s) => s.id === current) ? current : (shiftOptions[0]?.id ?? ""));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setAccessDenied(true);
      else setError(err instanceof Error ? err.message : "Unable to load assets and shifts.");
    } finally {
      setLoadingReference(false);
    }
  }, []);

  useEffect(() => { if (user) void loadReferenceData(); }, [user, loadReferenceData]);

  useEffect(() => {
    if (selectedAssetId && !assets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(assets[0]?.id ?? "");
      setSelectedMachineId("");
    }
  }, [assets, selectedAssetId]);

  useEffect(() => {
    if (assetLevels.length && !assetLevels.some((level) => level.value === assetLevel)) setAssetLevel("all");
  }, [assetLevels, assetLevel]);

  useEffect(() => {
    if (assetLevel !== "all" && !assets.some((asset) => asset.id === selectedAssetId)) setSelectedAssetId(assets[0]?.id ?? "");
  }, [assetLevel, assets, selectedAssetId]);

  const fetchDashboard = useCallback(async () => {
    if (!user || !queryAsset || !shift || !timeWindow) return;
    try {
      setLoadingDashboard(true);
      setError("");
      setAccessDenied(false);
      const entity_scope = { type: "asset", asset: { asset_id: queryAsset.id, asset_level_id: queryAsset.assetlevel_id } };
      const time_range = { from_ts: timeWindow.from.toISOString(), to_ts: timeWindow.to.toISOString() };
      const [intervalData, cycleData] = await Promise.all([
        getMachineIntervals({ entity_scope, time_range, produce_counts: true, exact_produces: individual, group_produce_counts_by_part_model: true }),
        getCycleTime({ entity_scope, time_range, metrics: ["ideal_cycle_time_seconds", "actual_cycle_time_seconds"], distribution: "hourly" }),
      ]);
      setIntervals(intervalData);
      setCycleRows(cycleData);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setAccessDenied(true);
      else setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
    } finally {
      setLoadingDashboard(false);
    }
  }, [user, queryAsset, shift, timeWindow, individual]);

  useEffect(() => {
    if (user && queryAsset && shift && timeWindow && !loadingReference) void fetchDashboard();
  }, [user, queryAsset, shift, timeWindow, individual, loadingReference, fetchDashboard]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      localStorage.removeItem("access_token");
      setUser(null);
      setIntervals(null);
      setCycleRows([]);
    }
  }

  async function handleLogin() {
    setCheckingSession(true);
    await restoreSession();
  }

  if (checkingSession) return <Box className="center-page"><CircularProgress /></Box>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  const noData = intervals && !(intervals.runtimes?.length || intervals.downtimes?.length || intervals.stoppages?.length || intervals.produce_counts?.length || intervals.produces?.length);

  return (
    <Box className="app">
      <AppBar position="static" elevation={0} color="inherit" className="topbar">
        <Toolbar className="topbar-inner">
          <Box sx={{ flex: 1 }}>
            <Typography className="brand-title">Noviga Fractal Dashboard</Typography>
            <Typography className="brand-subtitle">Username · {user.username}</Typography>
          </Box>
          <IconButton onClick={() => void handleLogout()} aria-label="logout"><LogoutIcon /></IconButton>
        </Toolbar>
      </AppBar>

      <Box className="dashboard-shell">
        {sessionError && <Alert severity="warning" sx={{ mb: 2 }}>{sessionError}</Alert>}
        <FilterBar
          assets={assets}
          assetLevels={assetLevels}
          assetLevel={assetLevel}
          setAssetLevel={(value) => { setAssetLevel(value); setSelectedMachineId(""); }}
          partModelLabel={partModelLabel}
          machines={machines}
          selectedAssetId={selectedAssetId}
          setSelectedAssetId={(id) => { setSelectedAssetId(id); setSelectedMachineId(""); }}
          selectedMachineId={selectedMachineId}
          setSelectedMachineId={setSelectedMachineId}
          date={date}
          setDate={setDate}
          shifts={shifts}
          shiftId={shiftId}
          setShiftId={setShiftId}
          onRefresh={() => void fetchDashboard()}
          refreshing={loadingDashboard}
        />

        {accessDenied && <Alert severity="error" sx={{ mb: 2 }}>Access denied.</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => void fetchDashboard()}>Retry</Button>}>{error}</Alert>}

        <section className="dashboard-card timeline-card">
          {loadingReference || loadingDashboard ? (
            <Box className="section-loading"><CircularProgress size={30} /><Typography color="text.secondary">Loading production history…</Typography></Box>
          ) : !intervals ? (
            <Box className="empty-state"><Typography>No dashboard data loaded.</Typography></Box>
          ) : noData ? (
            <Box className="empty-state"><Typography fontWeight={600}>No data available for this shift.</Typography><Typography variant="body2" color="text.secondary">Try another date, shift or asset.</Typography></Box>
          ) : (
            <TimelineChart
              from={timeWindow!.from}
              to={timeWindow!.to}
              intervals={intervals}
              individual={individual}
              setIndividual={setIndividual}
              pointLabels={pointLabels}
              setPointLabels={setPointLabels}
            />
          )}
        </section>

        <section className="dashboard-card hourly-card">
          <Typography className="section-title">Hourly Production &amp; Downtime Summary</Typography>
          {loadingDashboard && !intervals ? <Box className="section-loading compact"><CircularProgress size={24} /></Box> : hourlyRows.length ? <HourlyTable rows={hourlyRows} /> : <Box className="empty-state"><Typography>No hourly data available.</Typography></Box>}
        </section>
      </Box>
    </Box>
  );
}
