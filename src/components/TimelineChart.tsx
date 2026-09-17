import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { Box, Chip, Stack, Switch, Typography } from "@mui/material";

import type { MachineIntervals } from "../types";
import { flattenProduces, getPartModelLabels } from "../utils/data";
import { formatIstAxis, formatIstDateTime } from "../utils/time";

type Props = {
  from: Date;
  to: Date;
  intervals: MachineIntervals;
  individual: boolean;
  setIndividual: (value: boolean) => void;
  pointLabels: boolean;
  setPointLabels: (value: boolean) => void;
};

type Marker = {
  time: number;
  result: string;
  x: number;
  y: number;
  label?: string;
};

type Segment = {
  start: number;
  end: number;
  kind: string;
  color: string;
  label: string;
};

const COLORS = {
  // Runtime = TEAL
  runtime: "#2ca6a4",

  // Unplanned Production = YELLOW/LIME
  unplanned: "#c8d43a",

  // Planned Downtime = GREEN
  planned: "#5fae0c",

  // Unplanned Downtime = CORAL
  unknown: "#ff7d61",

  // Minor Stoppage = PURPLE
  stoppage: "#5a4bb7",

  // Production line
  line: "#1769e0",
};

function titleCase(value: string) {
  return value
    .replace(/[\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Classifies timeline segments according to their SOURCE.
 *
 * IMPORTANT:
 *
 * Runtime:
 *   planned                       -> Runtime
 *   unknown unplanned production -> Unplanned Production
 *
 * Downtime:
 *   planned / break               -> Planned Downtime
 *   unplanned / unknown           -> Unplanned Downtime
 *
 * Stoppage:
 *   -> Minor Stoppage / Stoppage
 */
function classifySegment(
  type: string,
  source: "runtime" | "downtime" | "stoppage",
  name?: string | null
) {
  const rawName = (name ?? "").trim();

  const normalizedType = (type ?? "")
    .trim()
    .toLowerCase();

  const text = `${normalizedType} ${rawName.toLowerCase()}`;

  // ==========================================================
  // STOPPAGE
  // ==========================================================

  if (source === "stoppage") {
    return [
      rawName
        ? titleCase(rawName)
        : text.includes("minor")
          ? "Minor Stoppage"
          : "Stoppage",
      COLORS.stoppage,
    ] as const;
  }

  // ==========================================================
  // RUNTIME
  // ==========================================================

  /*
   * VERY IMPORTANT:
   *
   * "planned" is a VALID RUNTIME type.
   *
   * Therefore it must NOT become Planned Downtime.
   */

  if (source === "runtime") {
    if (
      normalizedType ===
      "unknown unplanned production"
    ) {
      return [
        "Unplanned Production",
        COLORS.unplanned,
      ] as const;
    }

    return [
      "Runtime",
      COLORS.runtime,
    ] as const;
  }

  // ==========================================================
  // DOWNTIME
  // ==========================================================

  if (source === "downtime") {
    // Planned downtime / breaks
    if (
      normalizedType.includes("planned") ||
      text.includes("break")
    ) {
      return [
        rawName
          ? titleCase(rawName)
          : "Planned Downtime",
        COLORS.planned,
      ] as const;
    }

    // Unplanned / unknown downtime
    if (
      normalizedType.includes("unplanned") ||
      text.includes("unknown")
    ) {
      return [
        rawName &&
        !text.includes("unknown")
          ? titleCase(rawName)
          : "Unplanned Downtime",
        COLORS.unknown,
      ] as const;
    }

    return [
      rawName
        ? titleCase(rawName)
        : "Unplanned Downtime",
      COLORS.unknown,
    ] as const;
  }

  return [
    "Runtime",
    COLORS.runtime,
  ] as const;
}

export default function TimelineChart({
  from,
  to,
  intervals,
  individual,
  setIndividual,
  pointLabels,
  setPointLabels,
}: Props) {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const wrapRef =
    useRef<HTMLDivElement | null>(null);

  const [width, setWidth] =
    useState(1100);

  const [zoom, setZoom] =
    useState<[number, number]>([0, 1]);

  const [dragStart, setDragStart] =
    useState<number | null>(null);

  const [dragEnd, setDragEnd] =
    useState<number | null>(null);

  const [hover, setHover] =
    useState<Marker | null>(null);

  // ==========================================================
  // RESPONSIVE WIDTH
  // ==========================================================

  useEffect(() => {
    const observer =
      new ResizeObserver(() => {
        if (wrapRef.current) {
          setWidth(
            Math.max(
              760,
              wrapRef.current.clientWidth
            )
          );
        }
      });

    if (wrapRef.current) {
      setWidth(
        Math.max(
          760,
          wrapRef.current.clientWidth
        )
      );

      observer.observe(
        wrapRef.current
      );
    }

    return () =>
      observer.disconnect();
  }, []);

  // Reset zoom when filters/mode change
  useEffect(() => {
    setZoom([0, 1]);
  }, [
    from.getTime(),
    to.getTime(),
    individual,
  ]);

  const produces = useMemo(
    () => flattenProduces(intervals),
    [intervals]
  );

  const partModels = useMemo(
    () => getPartModelLabels(intervals),
    [intervals]
  );

  // ==========================================================
  // PREPARE DATA
  // ==========================================================

  const prepared = useMemo(() => {
    const fullStart =
      from.getTime();

    const fullEnd =
      to.getTime();

    const visibleStart =
      fullStart +
      (fullEnd - fullStart) *
        zoom[0];

    const visibleEnd =
      fullStart +
      (fullEnd - fullStart) *
        zoom[1];

    const span = Math.max(
      1,
      visibleEnd - visibleStart
    );

    // ========================================================
    // SEGMENTS
    // ========================================================

    const segments: Segment[] = [
      // ---------------- RUNTIME ----------------

      ...(intervals.runtimes ?? []).map(
        (s) => {
          const [
            label,
            color,
          ] = classifySegment(
            s.type,
            "runtime",
            s.runtime_name
          );

          return {
            start:
              new Date(
                s.start_at
              ).getTime(),

            end:
              new Date(
                s.end_at
              ).getTime(),

            kind: label,
            color,
            label,
          };
        }
      ),

      // ---------------- DOWNTIME ----------------

      ...(intervals.downtimes ?? []).map(
        (s) => {
          const [
            label,
            color,
          ] = classifySegment(
            s.type,
            "downtime",
            s.downtime_name
          );

          return {
            start:
              new Date(
                s.start_at
              ).getTime(),

            end:
              new Date(
                s.end_at
              ).getTime(),

            kind: label,
            color,
            label,
          };
        }
      ),

      // ---------------- STOPPAGE ----------------

      ...(intervals.stoppages ?? []).map(
        (s) => {
          const [
            label,
            color,
          ] = classifySegment(
            s.type,
            "stoppage",
            s.downtime_name
          );

          return {
            start:
              new Date(
                s.start_at
              ).getTime(),

            end:
              new Date(
                s.end_at
              ).getTime(),

            kind: label,
            color,
            label,
          };
        }
      ),
    ]
      .filter(
        (s) =>
          s.end > visibleStart &&
          s.start < visibleEnd
      )
      .map((s) => ({
        ...s,

        start: Math.max(
          s.start,
          visibleStart
        ),

        end: Math.min(
          s.end,
          visibleEnd
        ),
      }));

    // ========================================================
    // PRODUCTION MARKERS
    // ========================================================

    let markers: Marker[] = [];

    // ========================================================
    // INDIVIDUAL MODE
    // ========================================================

    if (individual) {
      const totalProduces =
        Math.max(
          1,
          produces.length
        );

      const visible =
        produces
          .map((p, index) => ({
            p,
            cumulative:
              index + 1,
          }))
          .filter(({ p }) => {
            const t =
              p.timestamp.getTime();

            return (
              t >= visibleStart &&
              t <= visibleEnd
            );
          });

      /*
       * Performance optimization.
       *
       * PASS markers may be thinned when there are thousands
       * of points.
       *
       * FAIL and WIP are ALWAYS retained.
       */

      const screenBuckets =
        Math.max(
          1,
          Math.floor(
            width / 2.5
          )
        );

      const seen =
        new Set<number>();

      const kept =
        visible.filter(
          ({ p }) => {
            if (
              p.result ===
                "FAIL" ||
              p.result ===
                "WIP"
            ) {
              return true;
            }

            const bucket =
              Math.floor(
                (
                  (p.timestamp.getTime() -
                    visibleStart) /
                  span
                ) *
                  screenBuckets
              );

            if (
              seen.has(bucket)
            ) {
              return false;
            }

            seen.add(bucket);

            return true;
          }
        );

      markers =
        kept.map(
          ({
            p,
            cumulative,
          }) => ({
            time:
              p.timestamp.getTime(),

            result: p.result,

            x:
              (
                p.timestamp.getTime() -
                visibleStart
              ) /
              span,

            y:
              0.86 -
              (cumulative /
                totalProduces) *
                0.70,

            label:
              String(cumulative),
          })
        );
    }

    // ========================================================
    // HOURLY / CUMULATIVE MODE
    // ========================================================

    else {
      let cumulative = 0;

      const buckets = [
        ...(intervals.produce_counts ??
          []),
      ].sort(
        (a, b) =>
          new Date(
            a.bucket_start
          ).getTime() -
          new Date(
            b.bucket_start
          ).getTime()
      );

      const max =
        Math.max(
          1,
          buckets.reduce(
            (sum, b) =>
              sum +
              (b.ok_count || 0) +
              (b.ng_count || 0),
            0
          )
        );

      /*
       * Explicit shift-start origin.
       *
       * This gives us:
       *
       * 07:00 -> 0
       * 08:00 -> 37
       * 09:00 -> 89
       * ...
       */

      const origin: Marker = {
        time: from.getTime(),

        result: "PASS",

        x: 0,

        y: 0.86,

        label: "0",
      };

      const productionMarkers =
        buckets.map((b) => {
          cumulative +=
            (b.ok_count || 0) +
            (b.ng_count || 0);

          /*
           * Bucket start is UTC.
           *
           * The existing application logic uses the
           * hourly bucket endpoint for the plotted point.
           */

          const t =
            new Date(
              b.bucket_start
            ).getTime() +
            3_600_000;

          return {
            time: t,

            result:
              (b.ng_count || 0) >
              0
                ? "FAIL"
                : "PASS",

            x:
              (t -
                visibleStart) /
              span,

            y:
              0.86 -
              (cumulative /
                max) *
                0.66,

            label:
              String(cumulative),
          };
        });

      markers = [
        origin,
        ...productionMarkers,
      ].filter(
        (m) =>
          m.time >=
            visibleStart &&
          m.time <=
            visibleEnd
      );
    }

    return {
      segments,
      markers,
      visibleStart,
      visibleEnd,
      span,
    };
  }, [
    from,
    to,
    intervals,
    individual,
    produces,
    width,
    zoom,
  ]);

  // ==========================================================
  // CANVAS RENDER
  // ==========================================================

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const dpr =
      window.devicePixelRatio ||
      1;

    const height = 470;

    canvas.width =
      Math.round(
        width * dpr
      );

    canvas.height =
      Math.round(
        height * dpr
      );

    canvas.style.width =
      `${width}px`;

    canvas.style.height =
      `${height}px`;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;

    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    const left = 60;

    const right =
      width - 14;

    const chartWidth =
      right - left;

    const stateTop = 78;

    const stateHeight =
      245;

    const xFor = (
      fraction: number
    ) =>
      left +
      fraction *
        chartWidth;

    // ========================================================
    // BACKGROUND
    // ========================================================

    ctx.fillStyle =
      "#ffffff";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    // Chart border
    ctx.strokeStyle =
      "#e1e5ea";

    ctx.strokeRect(
      left,
      54,
      chartWidth,
      325
    );

    // ========================================================
    // TITLES
    // ========================================================

    ctx.fillStyle =
      "#6f7680";

    ctx.font =
      "12px Arial";

    ctx.fillText(
      "Cumulative production",
      8,
      28
    );

    ctx.fillText(
      "Shift time",
      width / 2 - 24,
      438
    );

    // ========================================================
    // Y AXIS
    // ========================================================

    if (!individual) {
      const values = [
        0,
        0.5,
        1,
      ];

      const maxValue =
        Math.max(
          1,
          intervals.produce_counts.reduce(
            (sum, b) =>
              sum +
              (b.ok_count || 0) +
              (b.ng_count || 0),
            0
          )
        );

      ctx.fillStyle =
        "#666";

      values.forEach((v) => {
        ctx.fillText(
          String(
            Math.round(
              maxValue * v
            )
          ),
          18,
          stateTop +
            stateHeight -
            v *
              stateHeight
        );
      });
    }

    // ========================================================
    // HOUR GRID
    // ========================================================

    const firstHour =
      Math.ceil(
        prepared.visibleStart /
          3_600_000
      ) *
      3_600_000;

    for (
      let t = firstHour;
      t <=
      prepared.visibleEnd;
      t += 3_600_000
    ) {
      const x =
        left +
        (
          (t -
            prepared.visibleStart) /
          prepared.span
        ) *
          chartWidth;

      ctx.strokeStyle =
        "#e3e6ea";

      ctx.beginPath();

      ctx.moveTo(
        x,
        54
      );

      ctx.lineTo(
        x,
        392
      );

      ctx.stroke();

      ctx.fillStyle =
        "#666";

      ctx.font =
        "11px Arial";

      ctx.textAlign =
        "center";

      ctx.fillText(
        formatIstAxis(
          new Date(t)
        ),
        x,
        400
      );
    }

    ctx.textAlign =
      "start";

    // ========================================================
    // MACHINE STATE SEGMENTS
    // ========================================================

    prepared.segments.forEach(
      (segment) => {
        const x1 =
          left +
          (
            (segment.start -
              prepared.visibleStart) /
            prepared.span
          ) *
            chartWidth;

        const x2 =
          left +
          (
            (segment.end -
              prepared.visibleStart) /
            prepared.span
          ) *
            chartWidth;

        const w =
          Math.max(
            1,
            x2 - x1
          );

        // Actual state color
        ctx.fillStyle =
          segment.color;

        ctx.fillRect(
          x1,
          stateTop,
          w,
          stateHeight
        );

        /*
         * Only show the label when the segment is wide enough
         * to prevent unreadable overlapping text.
         */

        if (w > 48) {
          ctx.save();

          ctx.translate(
            x1 + w / 2,
            stateTop +
              stateHeight / 2
          );

          ctx.rotate(
            -Math.PI / 2
          );

          ctx.fillStyle =
            "#ffffff";

          ctx.font =
            "bold 11px Arial";

          ctx.textAlign =
            "center";

          ctx.fillText(
            segment.label.toUpperCase(),
            0,
            4
          );

          ctx.restore();
        }
      }
    );

    // ========================================================
    // INDIVIDUAL PRODUCES
    // ========================================================

    if (individual) {
      /*
       * IMPORTANT:
       *
       * There is NO connecting production line in individual
       * mode.
       *
       * Each produce is rendered independently.
       */

      prepared.markers.forEach(
        (marker) => {
          const x =
            xFor(marker.x);

          const y =
            stateTop +
            stateHeight *
              marker.y;

          // --------------------------------------------------
          // FAIL
          // --------------------------------------------------

          if (
            marker.result ===
            "FAIL"
          ) {
            ctx.strokeStyle =
              "#e05252";

            ctx.lineWidth =
              1.7;

            ctx.beginPath();

            ctx.moveTo(
              x - 3,
              y - 3
            );

            ctx.lineTo(
              x + 3,
              y + 3
            );

            ctx.moveTo(
              x + 3,
              y - 3
            );

            ctx.lineTo(
              x - 3,
              y + 3
            );

            ctx.stroke();
          }

          // --------------------------------------------------
          // WIP
          // --------------------------------------------------

          else if (
            marker.result ===
            "WIP"
          ) {
            ctx.fillStyle =
              "#8a8f98";

            ctx.beginPath();

            ctx.moveTo(
              x,
              y - 4
            );

            ctx.lineTo(
              x - 4,
              y + 3
            );

            ctx.lineTo(
              x + 4,
              y + 3
            );

            ctx.closePath();

            ctx.fill();
          }

          // --------------------------------------------------
          // PASS
          // --------------------------------------------------

          else {
            /*
             * White circle with blue border.
             */

            ctx.fillStyle =
              "#ffffff";

            ctx.strokeStyle =
              COLORS.line;

            ctx.lineWidth =
              1.5;

            ctx.beginPath();

            ctx.arc(
              x,
              y,
              3.5,
              0,
              Math.PI * 2
            );

            ctx.fill();

            ctx.stroke();
          }
        }
      );
    }

    // ========================================================
    // NORMAL / CUMULATIVE PRODUCTION
    // ========================================================

    else {
      if (
        prepared.markers.length
      ) {
        // ----------------------------------------------------
        // CUMULATIVE LINE
        // ----------------------------------------------------

        ctx.strokeStyle =
          COLORS.line;

        ctx.lineWidth = 2;

        ctx.beginPath();

        prepared.markers.forEach(
          (marker, index) => {
            const x =
              xFor(marker.x);

            const y =
              stateTop +
              stateHeight *
                marker.y;

            if (
              index === 0
            ) {
              ctx.moveTo(
                x,
                y
              );
            } else {
              ctx.lineTo(
                x,
                y
              );
            }
          }
        );

        ctx.stroke();

        // ----------------------------------------------------
        // CUMULATIVE POINTS
        // ----------------------------------------------------

        prepared.markers.forEach(
          (marker) => {
            const x =
              xFor(marker.x);

            const y =
              stateTop +
              stateHeight *
                marker.y;

            // White point
            ctx.fillStyle =
              "#ffffff";

            ctx.beginPath();

            ctx.arc(
              x,
              y,
              4.5,
              0,
              Math.PI * 2
            );

            ctx.fill();

            // Blue border
            ctx.strokeStyle =
              COLORS.line;

            ctx.lineWidth = 2;

            ctx.stroke();

            // Point label
            if (
              pointLabels &&
              marker.label
            ) {
              ctx.fillStyle =
                COLORS.line;

              ctx.font =
                "bold 11px Arial";

              ctx.fillText(
                marker.label,
                x + 7,
                y + 4
              );
            }
          }
        );
      }
    }

    // ========================================================
    // NOW INDICATOR
    // ========================================================

    const now =
      Date.now();

    if (
      now >=
        prepared.visibleStart &&
      now <=
        prepared.visibleEnd
    ) {
      const nowX =
        left +
        (
          (now -
            prepared.visibleStart) /
          prepared.span
        ) *
          chartWidth;

      ctx.strokeStyle =
        COLORS.line;

      ctx.lineWidth =
        1.5;

      ctx.beginPath();

      ctx.moveTo(
        nowX,
        50
      );

      ctx.lineTo(
        nowX,
        382
      );

      ctx.stroke();

      ctx.fillStyle =
        COLORS.line;

      ctx.fillRect(
        nowX - 18,
        35,
        36,
        16
      );

      ctx.fillStyle =
        "#ffffff";

      ctx.font =
        "bold 9px Arial";

      ctx.textAlign =
        "center";

      ctx.fillText(
        "NOW",
        nowX,
        46
      );

      ctx.textAlign =
        "start";
    }

    // ========================================================
    // AXIS LABELS
    // ========================================================

    ctx.fillStyle =
      "#202124";

    ctx.font =
      "bold 12px Arial";

    ctx.fillText(
      "Produces",
      8,
      64
    );

    ctx.fillText(
      "Machine state",
      8,
      347
    );

    // ========================================================
    // ZOOM SELECTION
    // ========================================================

    if (
      dragStart !== null &&
      dragEnd !== null
    ) {
      const x1 =
        Math.min(
          dragStart,
          dragEnd
        );

      const x2 =
        Math.max(
          dragStart,
          dragEnd
        );

      ctx.fillStyle =
        "rgba(23,105,224,0.12)";

      ctx.fillRect(
        x1,
        54,
        x2 - x1,
        325
      );

      ctx.strokeStyle =
        COLORS.line;

      ctx.strokeRect(
        x1,
        54,
        x2 - x1,
        325
      );
    }
  }, [
    width,
    prepared,
    individual,
    pointLabels,
    dragStart,
    dragEnd,
    intervals.produce_counts,
  ]);

  // ==========================================================
  // CANVAS MOUSE HELPERS
  // ==========================================================

  function canvasX(
    event: ReactMouseEvent<HTMLCanvasElement>
  ) {
    const rect =
      canvasRef.current?.getBoundingClientRect();

    if (!rect) return 0;

    return (
      event.clientX -
      rect.left
    );
  }

  // ==========================================================
  // MOUSE DOWN
  // ==========================================================

  function onMouseDown(
    event: ReactMouseEvent<HTMLCanvasElement>
  ) {
    if (
      !event.shiftKey ||
      event.button !== 0
    ) {
      return;
    }

    setHover(null);

    const x =
      canvasX(event);

    setDragStart(x);
    setDragEnd(x);
  }

  // ==========================================================
  // MOUSE MOVE
  // ==========================================================

  function onMouseMove(
    event: ReactMouseEvent<HTMLCanvasElement>
  ) {
    const x =
      canvasX(event);

    if (
      dragStart !== null
    ) {
      setDragEnd(x);
      return;
    }

    if (
      !prepared.markers.length
    ) {
      setHover(null);
      return;
    }

    const chartLeft = 60;

    const chartWidth =
      width - 74;

    const nearest =
      prepared.markers.reduce<{
        marker: Marker;
        distance: number;
      } | null>(
        (best, marker) => {
          const px =
            chartLeft +
            marker.x *
              chartWidth;

          const distance =
            Math.abs(
              px - x
            );

          return !best ||
            distance <
              best.distance
            ? {
                marker,
                distance,
              }
            : best;
        },
        null
      );

    setHover(
      nearest &&
        nearest.distance <= 12
        ? nearest.marker
        : null
    );
  }

  // ==========================================================
  // MOUSE UP / ZOOM
  // ==========================================================

  function onMouseUp() {
    if (
      dragStart === null ||
      dragEnd === null
    ) {
      return;
    }

    const left = 60;

    const chartWidth =
      width - 74;

    const a =
      Math.max(
        0,
        Math.min(
          1,
          (
            Math.min(
              dragStart,
              dragEnd
            ) - left
          ) /
            chartWidth
        )
      );

    const b =
      Math.max(
        0,
        Math.min(
          1,
          (
            Math.max(
              dragStart,
              dragEnd
            ) - left
          ) /
            chartWidth
        )
      );

    setDragStart(null);
    setDragEnd(null);

    if (
      b - a <= 0.005
    ) {
      return;
    }

    const minSpan =
      60_000 /
      (
        to.getTime() -
        from.getTime()
      );

    const selectedSpan =
      Math.max(
        minSpan,
        b - a
      );

    const center =
      (a + b) / 2;

    setZoom([
      Math.max(
        0,
        center -
          selectedSpan / 2
      ),
      Math.min(
        1,
        center +
          selectedSpan / 2
      ),
    ]);
  }

  function resetZoom() {
    setZoom([0, 1]);
  }

  // ==========================================================
  // UNKNOWN SEGMENT SUMMARY
  // ==========================================================

  const unknownSegments =
    (
      intervals.downtimes ??
      []
    ).filter((s) => {
      const text =
        `${s.type} ${
          s.downtime_name ??
          ""
        }`.toLowerCase();

      return text.includes(
        "unknown"
      );
    });

  const unknownCount =
    unknownSegments.length;

  const unknownMinutes =
    unknownSegments.reduce(
      (sum, s) => {
        const start =
          Math.max(
            from.getTime(),
            new Date(
              s.start_at
            ).getTime()
          );

        const end =
          Math.min(
            to.getTime(),
            new Date(
              s.end_at
            ).getTime()
          );

        return (
          sum +
          Math.max(
            0,
            end - start
          ) /
            60000
        );
      },
      0
    );

  const lastProduce =
    produces[
      produces.length - 1
    ];

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <Box ref={wrapRef}>
      {/* ====================================================
          HEADER
      ==================================================== */}

      <Box className="history-top-row">
        <Typography className="history-title">
          Production History
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          justifyContent="flex-end"
        >
          {[
            [
              "Runtime",
              COLORS.runtime,
            ],
            [
              "Unplanned Production",
              COLORS.unplanned,
            ],
            [
              "Planned Downtime",
              COLORS.planned,
            ],
            [
              "Unplanned Downtime",
              COLORS.unknown,
            ],
            [
              "Minor Stoppage",
              COLORS.stoppage,
            ],
          ].map(
            ([label, color]) => (
              <Chip
                key={label}
                size="small"
                className="state-legend-chip"
                label={
                  <>
                    <span
                      className="legend-dot"
                      style={{
                        background:
                          color,
                      }}
                    />

                    {label}
                  </>
                }
              />
            )
          )}
        </Stack>
      </Box>

      {/* ====================================================
          META / PRODUCTION LEGEND
      ==================================================== */}

      <Box className="history-meta-row">
        <Stack
          direction="row"
          spacing={1.8}
          alignItems="center"
          flexWrap="wrap"
        >
          <Typography
            variant="body2"
            color="text.secondary"
          >
            Part Models:{" "}
            {partModels.length
              ? partModels.map(
                  (id) => (
                    <b
                      key={id}
                      style={{
                        marginLeft: 6,
                      }}
                    >
                      {id}
                    </b>
                  )
                )
              : "—"}
          </Typography>

          <Typography
            variant="body2"
            className="result-legend pass"
          >
            ● &nbsp;OK
          </Typography>

          <Typography
            variant="body2"
            className="result-legend fail"
          >
            × &nbsp;FAIL
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            △ &nbsp;WIP
          </Typography>
        </Stack>

        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
        >
          {/* Point labels */}

          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
          >
            <Switch
              size="small"
              checked={pointLabels}
              onChange={(event) =>
                setPointLabels(
                  event.target.checked
                )
              }
            />

            <Typography variant="body2">
              Point labels
            </Typography>
          </Stack>

          {/* Individual produces */}

          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
          >
            <Switch
              size="small"
              checked={individual}
              onChange={(event) =>
                setIndividual(
                  event.target.checked
                )
              }
            />

            <Typography variant="body2">
              Show Individual produces
            </Typography>
          </Stack>
        </Stack>
      </Box>

      {/* ====================================================
          CANVAS
      ==================================================== */}

      <Box
        sx={{
          position: "relative",
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            if (
              dragStart === null
            ) {
              setHover(null);
            }
          }}
          onDoubleClick={
            resetZoom
          }
          style={{
            display: "block",
            cursor:
              dragStart !== null
                ? "crosshair"
                : "default",
          }}
        />

        {/* ==================================================
            TOOLTIP
        ================================================== */}

        {hover && (
          <Box className="chart-tooltip">
            <Typography variant="caption">
              {formatIstDateTime(
                new Date(
                  hover.time
                )
              )}
            </Typography>

            <Typography fontWeight={700}>
              {hover.result}
            </Typography>
          </Box>
        )}
      </Box>

      {/* ====================================================
          HINTS
      ==================================================== */}

      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        sx={{ mt: 1 }}
      >
        <Box className="hint-chip">
          Shift + drag to zoom into a
          time range · double-click to
          reset
        </Box>

        <Box className="hint-chip">
          Colored line = cumulative
          production (OK + NG) per part
          model
        </Box>

        <Box className="hint-chip">
          Circles = PASS · Crosses = FAIL
          · Triangles = WIP
        </Box>
      </Stack>

      {/* ====================================================
          INFORMATION
      ==================================================== */}

      <Box className="info-row">
        <span className="info-pill">
          Last observed produce at:{" "}
          {lastProduce
            ? formatIstDateTime(
                lastProduce.timestamp
              )
            : "—"}
        </span>

        {unknownCount > 0 && (
          <span className="warning-pill">
            ⚠ {unknownCount} unknown
            segments ·{" "}
            {unknownMinutes.toFixed(
              1
            )}{" "}
            min
          </span>
        )}
      </Box>
    </Box>
  );
}