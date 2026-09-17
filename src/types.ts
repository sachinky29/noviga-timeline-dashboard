export type User = {
  id: string;
  username: string;
  name: string;
  email?: string;
  customer_id?: string;
  customer_name?: string;
  roles?: string[];
  status?: string;
};

export type AssetNode = {
  id: string;
  name: string;
  codename?: string | null;
  assetlevel_id: number;
  hierarchy?: string | null;
  children?: AssetNode[];
};

export type AssetOption = AssetNode & { path: string };

export type ShiftDefinition = {
  id: string;
  code: string;
  name: string;
  shift_timings: string[];
  is_active: boolean;
};

export type ShiftOption = {
  id: string;
  definitionId: string;
  name: string;
  start: string;
  end: string;
  endDateOffset: number;
};

export type TimelineSegment = {
  start_at: string;
  end_at: string;
  type: string;
  runtime_name?: string | null;
  downtime_name?: string | null;
};

export type ProduceCount = {
  bucket_start: string;
  part_model_id: string;
  ok_count: number;
  ng_count: number;
};

export type ProduceEvent = {
  produce_id: string;
  first_seen_ts: string;
  result: "PASS" | "FAIL" | string;
  produce_type?: string;
  part_model_id?: string;
};

export type ProduceBucket = {
  bucket_start: string;
  part_model_id: string;
  produces: ProduceEvent[];
};

export type MachineIntervals = {
  machine_ids: number[];
  runtimes: TimelineSegment[];
  downtimes: TimelineSegment[];
  stoppages: TimelineSegment[];
  produce_counts: ProduceCount[];
  produces?: ProduceBucket[];
};

export type CycleTimeRow = {
  bucket_start: string;
  ideal_cycle_time_seconds: number | null;
  actual_cycle_time_seconds: number | null;
};

export type HourlyRow = {
  hourStart: Date;
  hourEnd: Date;
  label: string;
  total: number;
  pass: number;
  fail: number;
  runtime: number;
  plannedDowntime: number;
  unplanned: number;
  unknownUnplannedProduction: number;
  unplannedDowntime: number;
  stoppage: number;
  minorStoppage: number;
  unknown: number;
  idealCycle: number | null;
  actualCycle: number | null;
  future: boolean;
};
