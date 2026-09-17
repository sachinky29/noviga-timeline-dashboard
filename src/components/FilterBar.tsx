import type { ReactNode } from "react";
import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { AssetOption, ShiftOption } from "../types";

type Props = {
  assets: AssetOption[];
  assetLevels: { value: string; label: string }[];
  assetLevel: string;
  setAssetLevel: (value: string) => void;
  partModelLabel: string;
  machines: AssetOption[];
  selectedAssetId: string;
  setSelectedAssetId: (value: string) => void;
  selectedMachineId: string;
  setSelectedMachineId: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  shifts: ShiftOption[];
  shiftId: string;
  setShiftId: (value: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

export default function FilterBar(p: Props) {
  const selectedAsset = p.assets.find((a) => a.id === p.selectedAssetId);
  const selectedShift = p.shifts.find((s) => s.id === p.shiftId);

  return (
    <Box className="filter-card">
      <Box className="filter-grid">
        <FilterSelect
          label="ASSET LEVEL"
          value={p.assetLevel}
          onChange={p.setAssetLevel}
          options={p.assetLevels}
        />

        <FilterSelect
          label="ASSET"
          value={p.selectedAssetId}
          onChange={p.setSelectedAssetId}
          options={p.assets.map((a) => ({ value: a.id, label: a.name }))}
        />

        <FilterSelect
          label="MACHINE (OPTIONAL)"
          value={p.selectedMachineId}
          onChange={p.setSelectedMachineId}
          options={[
            { value: "", label: "—" },
            ...p.machines.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />

        <Box>
          <Typography className="field-label">DATE</Typography>
          <TextField
            fullWidth
            size="small"
            type="date"
            value={p.date}
            onChange={(e) => p.setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>

        <FilterSelect
          label="SHIFT"
          value={p.shiftId}
          onChange={p.setShiftId}
          options={p.shifts.map((s) => ({
            value: s.id,
            label: `${s.name} (${s.start} – ${s.end})`,
          }))}
        />
      </Box>

      <Box className="filter-meta-row">
        <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
          {selectedAsset && <ChipText>{selectedAsset.name}</ChipText>}
          {selectedShift && (
            <ChipText>
              {formatDate(p.date)}, {selectedShift.start} – {formatDate(p.date, selectedShift.endDateOffset)}, {selectedShift.end}
            </ChipText>
          )}
          <ChipText>Part model: {p.partModelLabel || "—"}</ChipText>
        </Stack>

        <Button
          className="refresh-button"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={p.onRefresh}
          disabled={p.refreshing}
        >
          {p.refreshing ? "REFRESHING" : "REFRESH"}
        </Button>
      </Box>
    </Box>
  );
}

function formatDate(value: string, dayOffset = 0) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + dayOffset));
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <Box>
      <Typography className="field-label">{label}</Typography>
      <FormControl fullWidth size="small">
        <Select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          displayEmpty
        >
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}

function ChipText({ children }: { children: ReactNode }) {
  return <Box className="filter-chip">{children}</Box>;
}
