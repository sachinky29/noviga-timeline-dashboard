import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import type { HourlyRow } from "../types";
import { formatSeconds } from "../utils/time";

export default function HourlyTable({ rows }: { rows: HourlyRow[] }) {
  const metrics: { label: string; get: (r: HourlyRow) => string | number | null }[] = [
    { label: "Total", get: (r) => r.total },
    { label: "Pass", get: (r) => r.pass },
    { label: "Fail", get: (r) => r.fail },
    { label: "Actual Cycle Time", get: (r) => formatSeconds(r.actualCycle) },
    { label: "Ideal Cycle Time", get: (r) => formatSeconds(r.idealCycle) },
    { label: "Runtime", get: (r) => r.runtime === 0 ? "0 mins" : `${r.runtime} mins` },
    { label: "Planned Downtime", get: (r) => `${r.plannedDowntime} mins` },
    { label: "Minor Stoppage", get: (r) => `${r.minorStoppage} mins` },
    { label: "Unknown Downtime", get: (r) => `${r.unknown} mins` },
    { label: "Unplanned Downtime", get: (r) => `${r.unplannedDowntime} mins` },
    { label: "Unplanned Production", get: (r) => `${r.unplanned} mins` },
    { label: "Unknown Unplanned Production", get: (r) => `${r.unknownUnplannedProduction} mins` },
  ];

  return (
    <TableContainer className="hourly-wrap">
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell className="metric-head">Param</TableCell>
            {rows.map((row) => <TableCell key={row.hourStart.toISOString()} align="center" className="hour-head">{row.label}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {metrics.map((metric) => (
            <TableRow key={metric.label}>
              <TableCell className="metric-cell">{metric.label}</TableCell>
              {rows.map((row) => <TableCell key={`${metric.label}-${row.hourStart.toISOString()}`} align="center">{row.future ? "" : metric.get(row)}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
