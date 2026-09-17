import type { AssetNode, CycleTimeRow, HourlyRow, MachineIntervals, TimelineSegment } from "../types";
import { addHours, floorHour, formatIstHourRange } from "./time";

export function flattenAssets(nodes: AssetNode[]) {
  const result: (AssetNode & { path: string })[] = [];
  const walk = (items: AssetNode[], parentPath = "") => {
    for (const item of items) {
      const path = parentPath ? `${parentPath} / ${item.name}` : item.name;
      result.push({ ...item, path });
      if (item.children?.length) walk(item.children, path);
    }
  };
  walk(nodes);
  return result;
}

export function buildShiftOptions(shifts: import("../types").ShiftDefinition[]) {
  return shifts
    .filter((shift) => shift.is_active !== false)
    .flatMap((definition) =>
      definition.shift_timings.map((start, index, times) => {
        const end = times[(index + 1) % times.length];
        const wraps = times.length === 1 || index === times.length - 1 || end <= start;
        return {
          id: `${definition.id}:${start}`,
          definitionId: definition.id,
          name: definition.name,
          start,
          end,
          endDateOffset: wraps ? 1 : 0,
        };
      }),
    );
}

function overlapMinutes(start: Date, end: Date, hourStart: Date, hourEnd: Date) {
  const overlapStart = Math.max(start.getTime(), hourStart.getTime());
  const overlapEnd = Math.min(end.getTime(), hourEnd.getTime());
  return Math.max(0, (overlapEnd - overlapStart) / 60_000);
}

function addSegment(rows: HourlyRow[], segment: TimelineSegment, kind: keyof Pick<HourlyRow, "runtime" | "plannedDowntime" | "unplanned" | "unknownUnplannedProduction" | "unplannedDowntime" | "stoppage" | "minorStoppage" | "unknown">) {
  const start = new Date(segment.start_at);
  const end = new Date(segment.end_at);
  for (const row of rows) {
    const minutes = overlapMinutes(start, end, row.hourStart, row.hourEnd);
    row[kind] += minutes;
  }
}

function downtimeKind(segment: TimelineSegment) {
  const text = `${segment.type} ${segment.downtime_name ?? ""}`.toLowerCase();
  if (text.includes("unplanned")) return "unplannedDowntime" as const;
  if (text.includes("planned")) return "plannedDowntime" as const;
  return "unknown" as const;
}

function stoppageKind(segment: TimelineSegment) {
  const text = `${segment.type} ${segment.downtime_name ?? ""}`.toLowerCase();
  return text.includes("minor") ? "minorStoppage" as const : "stoppage" as const;
}

export function buildHourlyRows(windowFrom: Date, windowTo: Date, intervals: MachineIntervals, cycleRows: CycleTimeRow[]) {
  const rows: HourlyRow[] = [];
  let cursor = windowFrom;
  while (cursor.getTime() < windowTo.getTime()) {
    const hourEnd = new Date(Math.min(addHours(cursor, 1).getTime(), windowTo.getTime()));
    rows.push({
      hourStart: cursor,
      hourEnd,
      label: formatIstHourRange(cursor, hourEnd),
      total: 0,
      pass: 0,
      fail: 0,
      runtime: 0,
      plannedDowntime: 0,
      unplanned: 0,
      unknownUnplannedProduction: 0,
      unplannedDowntime: 0,
      stoppage: 0,
      minorStoppage: 0,
      unknown: 0,
      idealCycle: null,
      actualCycle: null,
      future: cursor.getTime() >= Date.now(),
    });
    cursor = addHours(cursor, 1);
  }

  const rowByBucket = new Map(rows.map((row) => [floorHour(row.hourStart).getTime(), row]));

  for (const count of intervals.produce_counts ?? []) {
    const row = rowByBucket.get(floorHour(new Date(count.bucket_start)).getTime());
    if (!row || row.future) continue;
    row.pass += Number(count.ok_count || 0);
    row.fail += Number(count.ng_count || 0);
    row.total = row.pass + row.fail;
  }

  for (const segment of intervals.runtimes ?? []) {
    const text = `${segment.type} ${segment.runtime_name ?? ""}`.toLowerCase();
    if (text.includes("unknown unplanned production")) addSegment(rows, segment, "unknownUnplannedProduction");
    else addSegment(rows, segment, "runtime");
  }
  for (const segment of intervals.downtimes ?? []) addSegment(rows, segment, downtimeKind(segment));
  for (const segment of intervals.stoppages ?? []) addSegment(rows, segment, stoppageKind(segment));

  for (const cycle of cycleRows ?? []) {
    const row = rowByBucket.get(floorHour(new Date(cycle.bucket_start)).getTime());
    if (!row || row.future) continue;
    row.idealCycle = cycle.ideal_cycle_time_seconds;
    row.actualCycle = cycle.actual_cycle_time_seconds;
  }

  return rows.map((row) => ({
    ...row,
    runtime: Number(row.runtime.toFixed(2)),
    plannedDowntime: Number(row.plannedDowntime.toFixed(2)),
    unplanned: Number(row.unplanned.toFixed(2)),
    unknownUnplannedProduction: Number(row.unknownUnplannedProduction.toFixed(2)),
    unplannedDowntime: Number(row.unplannedDowntime.toFixed(2)),
    stoppage: Number(row.stoppage.toFixed(2)),
    minorStoppage: Number(row.minorStoppage.toFixed(2)),
    unknown: Number(row.unknown.toFixed(2)),
  }));
}

export function flattenProduces(intervals: MachineIntervals) {
  return (intervals.produces ?? [])
    .flatMap((bucket) => bucket.produces ?? [])
    .map((produce) => ({ ...produce, timestamp: new Date(produce.first_seen_ts) }))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function getPartModelLabels(intervals: MachineIntervals) {
  const ids = new Set<string>();
  for (const item of intervals.produce_counts ?? []) ids.add(item.part_model_id);
  for (const item of intervals.produces ?? []) ids.add(item.part_model_id);
  return Array.from(ids);
}
