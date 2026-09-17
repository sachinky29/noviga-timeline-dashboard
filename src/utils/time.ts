const IST_OFFSET_MINUTES = 330;
const HOUR_MS = 3_600_000;

function utcDateFromIstParts(dateString: string, timeString: string, dayOffset = 0) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = timeString.split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day + dayOffset, hours, minutes) - IST_OFFSET_MINUTES * 60_000,
  );
}

export function shiftWindowFromIst(dateString: string, start: string, end: string, endDateOffset: number) {
  return {
    from: utcDateFromIstParts(dateString, start),
    to: utcDateFromIstParts(dateString, end, endDateOffset),
  };
}

export function istParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function floorHour(date: Date) {
  const p = istParts(date);
  return utcDateFromIstParts(
    `${p.year.toString().padStart(4, "0")}-${p.month.toString().padStart(2, "0")}-${p.day.toString().padStart(2, "0")}`,
    `${p.hour.toString().padStart(2, "0")}:00`,
  );
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * HOUR_MS);
}

export function formatIstDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatIstDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatIstHourRange(start: Date, end: Date) {
  const format = (value: Date) =>
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(value);
  return `${format(start)} – ${format(end)}`;
}

export function formatIstHour(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatIstAxis(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatSeconds(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "";
  if (value < 60) return `${Number(value.toFixed(1))} secs`;
  return `${Number((value / 60).toFixed(1))} mins`;
}
