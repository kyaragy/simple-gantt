import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfDay
} from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { GanttBlock, GanttRow, ViewUnit } from '../types';
import { resolveBlockColor } from '../utils/color';

type DisplayRow = {
  id: string;
  label: string;
  blocks: GanttBlock[];
  sourceRow?: GanttRow;
};

type Props = {
  chartRef: RefObject<HTMLDivElement | null>;
  viewUnit: ViewUnit;
  showWeekendColumns: boolean;
  showTodayLine: boolean;
  periodStartWeek: string;
  periodEndWeek: string;
  rows: GanttRow[];
  blocks: GanttBlock[];
  onReorderRows: (rows: GanttRow[]) => void;
  onEditRow: (row: GanttRow) => void;
  onEditBlock: (block: GanttBlock) => void;
};

const BLOCK_HEIGHT = 48;
const BLOCK_TOP_PADDING = 8;
const BLOCK_BOTTOM_PADDING = 8;
const BLOCK_ROW_GAP = 6;
const HIERARCHY_GROUP_GAP = 10;
const EMPTY_ROW_HEIGHT = 56;
const HIERARCHY_BAND_HORIZONTAL_PADDING_DAYS = 2;
const HIERARCHY_BAND_VERTICAL_PADDING_PX = 10;
const HIERARCHY_BAND_MIN_GAP_PX = 2;
const HIERARCHY_ROW_EXTRA_TOP_PX = 6;
const HIERARCHY_ROW_EXTRA_BOTTOM_PX = 6;

type PositionedBlock = {
  block: GanttBlock;
  leftPercent: number;
  widthPercent: number;
  top: number;
};

type RowLayout = {
  positioned: PositionedBlock[];
  hierarchyBands: Array<{
    key: string;
    label: string;
    leftPercent: number;
    widthPercent: number;
    top: number;
    height: number;
  }>;
  rowHeight: number;
};

function toYmd(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function parseWeekInput(value: string): Date | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
    return null;
  }
  const jan4 = new Date(year, 0, 4);
  const firstIsoWeekStart = startOfWeek(jan4, { weekStartsOn: 1 });
  return addDays(firstIsoWeekStart, (week - 1) * 7);
}

function isWeekday(date: Date): boolean {
  const day = getDay(date);
  return day !== 0 && day !== 6;
}

function findVisibleIndexOnOrAfter(
  date: Date,
  firstVisible: Date,
  lastVisible: Date,
  dayIndexMap: Map<string, number>
): number | null {
  const start = date < firstVisible ? firstVisible : date;
  for (
    let cursor = startOfDay(start);
    cursor <= lastVisible;
    cursor = addDays(cursor, 1)
  ) {
    const index = dayIndexMap.get(toYmd(cursor));
    if (index !== undefined) {
      return index;
    }
  }
  return null;
}

function findVisibleIndexOnOrBefore(
  date: Date,
  firstVisible: Date,
  lastVisible: Date,
  dayIndexMap: Map<string, number>
): number | null {
  const end = date > lastVisible ? lastVisible : date;
  for (
    let cursor = startOfDay(end);
    cursor >= firstVisible;
    cursor = addDays(cursor, -1)
  ) {
    const index = dayIndexMap.get(toYmd(cursor));
    if (index !== undefined) {
      return index;
    }
  }
  return null;
}

function getBlockLevel(block: GanttBlock): string {
  return (
    block.level?.trim() ||
    block.level1?.trim() ||
    block.level2?.trim() ||
    block.level3?.trim() ||
    ''
  );
}

function normalizeProgress(progress?: number): number {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) {
    return 0;
  }
  return Math.max(0, Math.min(100, progress));
}

function toTimelinePercent(index: number, total: number): number {
  return (index / Math.max(total, 1)) * 100;
}

function layoutBlocks(
  blocks: GanttBlock[],
  dayIndexMap: Map<string, number>,
  firstVisibleDate: Date,
  lastVisibleDate: Date,
  visibleDayCount: number,
  showWeekendColumns: boolean
): {
  positioned: PositionedBlock[];
  hierarchyBands: Array<{
    key: string;
    label: string;
    leftPercent: number;
    widthPercent: number;
    top: number;
    height: number;
  }>;
  rowHeight: number;
} {
  if (blocks.length === 0 || dayIndexMap.size === 0 || visibleDayCount <= 0) {
    return { positioned: [], hierarchyBands: [], rowHeight: EMPTY_ROW_HEIGHT };
  }

  const withDates = blocks.map((block, index) => {
    const start = parseISO(block.start_date);
    const end = parseISO(block.end_date);
    const hierarchyKey = getBlockLevel(block).trim();
    return { block, index, start, end, hierarchyKey };
  });

  const grouped = new Map<string, typeof withDates>();
  for (const item of withDates) {
    const arr = grouped.get(item.hierarchyKey) ?? [];
    arr.push(item);
    grouped.set(item.hierarchyKey, arr);
  }

  const sortedGroups = Array.from(grouped.entries())
    .map(([hierarchyKey, items]) => ({
      hierarchyKey,
      items: [...items].sort((a, b) => {
        const startDiff = a.start.getTime() - b.start.getTime();
        if (startDiff !== 0) {
          return startDiff;
        }
        const endDiff = a.end.getTime() - b.end.getTime();
        if (endDiff !== 0) {
          return endDiff;
        }
        return a.index - b.index;
      }),
      minStartTime: Math.min(...items.map((item) => item.start.getTime()))
    }))
    .sort((a, b) => {
      const startDiff = a.minStartTime - b.minStartTime;
      if (startDiff !== 0) {
        return startDiff;
      }
      return a.hierarchyKey.localeCompare(b.hierarchyKey, 'ja');
    });

  const positioned: PositionedBlock[] = [];
  const hierarchyBandRaw: Array<{
    key: string;
    label: string;
    leftPercent: number;
    widthPercent: number;
    baseTop: number;
    baseBottom: number;
  }> = [];
  let groupTop = BLOCK_TOP_PADDING;

  sortedGroups.forEach((group, groupIndex) => {
    const groupStartTop = groupTop;
    const localLaneEndTimes: number[] = [];
    let visibleItemCount = 0;
    let minStartIndex = Number.POSITIVE_INFINITY;
    let maxEndIndex = Number.NEGATIVE_INFINITY;
    for (const item of group.items) {
      const startIndex = showWeekendColumns
        ? dayIndexMap.get(toYmd(item.start)) ?? null
        : findVisibleIndexOnOrAfter(
            item.start,
            firstVisibleDate,
            lastVisibleDate,
            dayIndexMap
          );
      const endIndex = showWeekendColumns
        ? dayIndexMap.get(toYmd(item.end)) ?? null
        : findVisibleIndexOnOrBefore(
            item.end,
            firstVisibleDate,
            lastVisibleDate,
            dayIndexMap
          );
      if (startIndex === null || endIndex === null || endIndex < startIndex) {
        continue;
      }
      visibleItemCount += 1;
      minStartIndex = Math.min(minStartIndex, startIndex);
      maxEndIndex = Math.max(maxEndIndex, endIndex);

      let localLane = localLaneEndTimes.findIndex(
        (laneEnd) => item.start.getTime() > laneEnd
      );
      if (localLane < 0) {
        localLane = localLaneEndTimes.length;
        localLaneEndTimes.push(item.end.getTime());
      } else {
        localLaneEndTimes[localLane] = item.end.getTime();
      }

      const leftPercent = (startIndex / visibleDayCount) * 100;
      const widthPercent = ((endIndex - startIndex + 1) / visibleDayCount) * 100;
      const top = groupTop + localLane * (BLOCK_HEIGHT + BLOCK_ROW_GAP);

      positioned.push({
        block: item.block,
        leftPercent,
        widthPercent,
        top
      });
    }

    const localLaneCount = Math.max(1, localLaneEndTimes.length);
    const groupHeight =
      localLaneCount * BLOCK_HEIGHT + Math.max(0, localLaneCount - 1) * BLOCK_ROW_GAP;
    if (visibleItemCount > 0 && group.hierarchyKey) {
      const bandStartIndex = Math.max(
        0,
        minStartIndex - HIERARCHY_BAND_HORIZONTAL_PADDING_DAYS
      );
      const bandEndExclusive = Math.min(
        visibleDayCount,
        maxEndIndex + 1 + HIERARCHY_BAND_HORIZONTAL_PADDING_DAYS
      );
      const leftPercent = (bandStartIndex / visibleDayCount) * 100;
      const widthPercent = ((bandEndExclusive - bandStartIndex) / visibleDayCount) * 100;
      hierarchyBandRaw.push({
        key: group.hierarchyKey,
        label: group.hierarchyKey,
        leftPercent,
        widthPercent,
        baseTop: groupStartTop,
        baseBottom: groupStartTop + groupHeight
      });
    }
    groupTop += groupHeight;
    if (groupIndex < sortedGroups.length - 1) {
      groupTop += HIERARCHY_GROUP_GAP;
    }
  });
  let rowHeight = Math.max(
    EMPTY_ROW_HEIGHT,
    groupTop + BLOCK_BOTTOM_PADDING
  );

  let hierarchyBands = hierarchyBandRaw.map((band, index, arr) => {
    const prev = index > 0 ? arr[index - 1] : null;
    const next = index < arr.length - 1 ? arr[index + 1] : null;
    const upperLimit = prev
      ? ((prev.baseBottom + band.baseTop) / 2) + HIERARCHY_BAND_MIN_GAP_PX / 2
      : 0;
    const lowerLimit = next
      ? ((band.baseBottom + next.baseTop) / 2) - HIERARCHY_BAND_MIN_GAP_PX / 2
      : rowHeight;

    const top = Math.max(upperLimit, band.baseTop - HIERARCHY_BAND_VERTICAL_PADDING_PX);
    const bottom = Math.min(lowerLimit, band.baseBottom + HIERARCHY_BAND_VERTICAL_PADDING_PX);
    const safeBottom = Math.max(bottom, top + 1);

    return {
      key: band.key,
      label: band.label,
      leftPercent: band.leftPercent,
      widthPercent: band.widthPercent,
      top,
      height: safeBottom - top
    };
  });

  if (hierarchyBands.length > 0) {
    for (const block of positioned) {
      block.top += HIERARCHY_ROW_EXTRA_TOP_PX;
    }
    hierarchyBands = hierarchyBands.map((band) => ({
      ...band,
      top: band.top + HIERARCHY_ROW_EXTRA_TOP_PX
    }));
    rowHeight += HIERARCHY_ROW_EXTRA_TOP_PX + HIERARCHY_ROW_EXTRA_BOTTOM_PX;
  }

  return { positioned, hierarchyBands, rowHeight };
}

function SortableRow({
  row,
  layout,
  visibleDayCount,
  todayLinePercent,
  showTodayLine,
  weekendColumnIndexes,
  showWeekendColumns,
  onEditRow,
  onEditBlock,
  showRowActions
}: {
  row: DisplayRow;
  layout: RowLayout;
  visibleDayCount: number;
  todayLinePercent: number | null;
  showTodayLine: boolean;
  weekendColumnIndexes: number[];
  showWeekendColumns: boolean;
  onEditRow: (row: GanttRow) => void;
  onEditBlock: (block: GanttBlock) => void;
  showRowActions: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: !showRowActions
  });
  const { positioned, hierarchyBands, rowHeight } = layout;

  return (
    <div
      ref={setNodeRef}
      className="gantt-row"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1
      }}
    >
      <div className="row-title-cell">
        {showRowActions && (
          <button className="drag-handle" aria-label="row drag handle" {...attributes} {...listeners}>
            ≡
          </button>
        )}
        <div className="row-main">
          {showRowActions && row.sourceRow ? (
            <button className="row-label-button" onClick={() => onEditRow(row.sourceRow!)}>
              {row.label}
            </button>
          ) : (
            <div className="row-label">{row.label}</div>
          )}
        </div>
      </div>

      <div className="row-timeline-cell">
        <div
          className="row-grid-bg"
          style={{ minHeight: rowHeight, ['--day-count' as string]: Math.max(visibleDayCount, 1) }}
        >
          {hierarchyBands.map((band) => (
            <div
              key={`${row.id}-${band.key}`}
              className="hierarchy-band"
              style={{
                left: `${band.leftPercent}%`,
                width: `${band.widthPercent}%`,
                top: band.top,
                height: band.height
              }}
              aria-hidden="true"
            >
              <span className="hierarchy-band-label">{band.label}</span>
            </div>
          ))}
          {showTodayLine && todayLinePercent !== null && (
            <div
              className="timeline-today-line"
              style={{ left: `${todayLinePercent}%` }}
              aria-hidden="true"
            />
          )}
          {showWeekendColumns &&
            weekendColumnIndexes.map((index) => (
              <div
                key={`${row.id}-weekend-${index}`}
                className="weekend-column"
                style={{
                  left: `${(index / visibleDayCount) * 100}%`,
                  width: `${(1 / visibleDayCount) * 100}%`
                }}
              />
            ))}
          {positioned.map(({ block, leftPercent, widthPercent, top }) => {
            const color = resolveBlockColor(block);
            const progress = normalizeProgress(block.progress);
            const progressBackground =
              progress <= 0
                ? color
                : `linear-gradient(to right, #9ca3af 0%, #9ca3af ${progress}%, ${color} ${progress}%, ${color} 100%)`;
            return (
              <button
                key={block.block_id}
                className="gantt-block"
                style={{
                  left: `${leftPercent}%`,
                  width: `calc(${widthPercent}% - 4px)`,
                  top,
                  background: progressBackground
                }}
                onClick={() => onEditBlock(block)}
                title={`${block.block_label} (${block.start_date} - ${block.end_date})`}
              >
                <span>{block.block_label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function GanttChart({
  chartRef,
  viewUnit,
  showWeekendColumns,
  showTodayLine,
  periodStartWeek,
  periodEndWeek,
  rows,
  blocks,
  onReorderRows,
  onEditRow,
  onEditBlock
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor));

  const orderedRows = useMemo(
    () => [...rows].sort((a, b) => a.row_order - b.row_order),
    [rows]
  );

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (viewUnit === 'custom') {
      return orderedRows.map((row) => ({
        id: row.id,
        label: row.row_title,
        blocks: blocks.filter((b) => b.row_title === row.row_title),
        sourceRow: row
      }));
    }
    const grouped = new Map<string, GanttBlock[]>();
    for (const block of blocks) {
      const groupKey = getBlockLevel(block) || '(未設定)';
      const arr = grouped.get(groupKey) ?? [];
      arr.push(block);
      grouped.set(groupKey, arr);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ja'))
      .map(([key, list], idx) => ({
        id: `${viewUnit}-${idx}-${key}`,
        label: key,
        blocks: list
      }));
  }, [blocks, orderedRows, viewUnit]);

  const allVisibleBlocks = displayRows.flatMap((row) => row.blocks);

  const [autoTimelineStart, autoTimelineEnd] = useMemo(() => {
    if (allVisibleBlocks.length === 0) {
      const today = startOfDay(new Date());
      return [
        startOfWeek(today, { weekStartsOn: 1 }),
        endOfWeek(addDays(today, 13), { weekStartsOn: 1 })
      ];
    }

    let minDate = parseISO(allVisibleBlocks[0].start_date);
    let maxDate = parseISO(allVisibleBlocks[0].end_date);
    for (const block of allVisibleBlocks) {
      const s = parseISO(block.start_date);
      const e = parseISO(block.end_date);
      if (s < minDate) {
        minDate = s;
      }
      if (e > maxDate) {
        maxDate = e;
      }
    }
    return [
      startOfWeek(minDate, { weekStartsOn: 1 }),
      endOfWeek(maxDate, { weekStartsOn: 1 })
    ];
  }, [allVisibleBlocks]);

  const [timelineStart, timelineEnd] = useMemo(() => {
    const startWeek = parseWeekInput(periodStartWeek);
    const endWeek = parseWeekInput(periodEndWeek);
    const start = startWeek ?? autoTimelineStart;
    const end = endWeek ? endOfWeek(endWeek, { weekStartsOn: 1 }) : autoTimelineEnd;
    if (start > end) {
      return [autoTimelineStart, autoTimelineEnd];
    }
    return [start, end];
  }, [autoTimelineEnd, autoTimelineStart, periodEndWeek, periodStartWeek]);

  const allDays = useMemo(
    () => eachDayOfInterval({ start: timelineStart, end: timelineEnd }),
    [timelineEnd, timelineStart]
  );
  const visibleDays = useMemo(() => {
    const days = showWeekendColumns ? allDays : allDays.filter(isWeekday);
    if (days.length > 0) {
      return days;
    }
    return [timelineStart];
  }, [allDays, showWeekendColumns, timelineStart]);
  const weekendColumnIndexes = useMemo(() => {
    if (!showWeekendColumns) {
      return [];
    }
    return visibleDays
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => !isWeekday(day))
      .map(({ index }) => index);
  }, [showWeekendColumns, visibleDays]);

  const visibleDayCount = visibleDays.length;
  const dayIndexMap = useMemo(
    () => new Map(visibleDays.map((day, index) => [toYmd(day), index])),
    [visibleDays]
  );
  const firstVisibleDate = visibleDays[0];
  const lastVisibleDate = visibleDays[visibleDays.length - 1];
  const [today, setToday] = useState(() => startOfDay(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = startOfDay(new Date());
      setToday((prev) => (prev.getTime() === now.getTime() ? prev : now));
    }, 60_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const todayLinePercent = useMemo(() => {
    if (visibleDayCount <= 0) {
      return null;
    }
    const todayKey = toYmd(today);
    const exact = dayIndexMap.get(todayKey);
    if (exact !== undefined) {
      return toTimelinePercent(exact, visibleDayCount);
    }

    const next = findVisibleIndexOnOrAfter(today, firstVisibleDate, lastVisibleDate, dayIndexMap);
    if (next !== null) {
      return toTimelinePercent(next, visibleDayCount);
    }

    const prev = findVisibleIndexOnOrBefore(today, firstVisibleDate, lastVisibleDate, dayIndexMap);
    if (prev !== null) {
      return toTimelinePercent(prev, visibleDayCount);
    }
    return null;
  }, [dayIndexMap, firstVisibleDate, lastVisibleDate, today, visibleDayCount]);

  const rowLayouts = useMemo(() => {
    const map = new Map<string, RowLayout>();
    for (const row of displayRows) {
      map.set(
        row.id,
        layoutBlocks(
          row.blocks,
          dayIndexMap,
          firstVisibleDate,
          lastVisibleDate,
          visibleDayCount,
          showWeekendColumns
        )
      );
    }
    return map;
  }, [
    dayIndexMap,
    displayRows,
    firstVisibleDate,
    lastVisibleDate,
    showWeekendColumns,
    visibleDayCount
  ]);

  const weekSegments = useMemo(() => {
    const segments: Array<{ key: string; label: string; days: number }> = [];
    for (const day of visibleDays) {
      const weekStart = startOfWeek(day, { weekStartsOn: 1 });
      const key = `w-${toYmd(weekStart)}`;
      const last = segments[segments.length - 1];
      if (last && last.key === key) {
        last.days += 1;
      } else {
        segments.push({
          key,
          label: `${format(weekStart, 'd')}日`,
          days: 1
        });
      }
    }
    return segments;
  }, [visibleDays]);

  const monthSegments = useMemo(() => {
    const segments: Array<{ key: string; label: string; days: number }> = [];
    for (const day of visibleDays) {
      const monthStart = startOfMonth(day);
      const key = `m-${toYmd(monthStart)}`;
      const last = segments[segments.length - 1];
      if (last && last.key === key) {
        last.days += 1;
      } else {
        segments.push({
          key,
          label: format(day, 'M月'),
          days: 1
        });
      }
    }
    return segments;
  }, [visibleDays]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (viewUnit !== 'custom') {
      return;
    }
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedRows.findIndex((row) => row.id === active.id);
    const newIndex = orderedRows.findIndex((row) => row.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onReorderRows(arrayMove(orderedRows, oldIndex, newIndex));
  };

  return (
    <div className="gantt-wrapper" ref={chartRef}>
      <div className="gantt-header-row">
        <div className="left-header" aria-label="row header" />
        <div className="timeline-header">
          {showTodayLine && todayLinePercent !== null && (
            <div
              className="timeline-today-line timeline-today-line-header"
              style={{ left: `${todayLinePercent}%` }}
              aria-hidden="true"
            />
          )}
          <div className="month-header-row">
            {monthSegments.map((segment) => (
              <div
                key={segment.key}
                className="month-cell"
                style={{ width: `${(segment.days / visibleDayCount) * 100}%` }}
              >
                {segment.label}
              </div>
            ))}
          </div>
          <div className="week-header-row">
            {weekSegments.map((segment) => (
              <div
                key={segment.key}
                className="week-cell"
                style={{ width: `${(segment.days / visibleDayCount) * 100}%` }}
              >
                {segment.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={displayRows.map((row) => row.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="gantt-body">
            {displayRows.map((row) => (
              <SortableRow
                key={row.id}
                row={row}
                layout={
                  rowLayouts.get(row.id) ?? {
                    positioned: [],
                    hierarchyBands: [],
                    rowHeight: EMPTY_ROW_HEIGHT
                  }
                }
                visibleDayCount={visibleDayCount}
                todayLinePercent={todayLinePercent}
                showTodayLine={showTodayLine}
                weekendColumnIndexes={weekendColumnIndexes}
                showWeekendColumns={showWeekendColumns}
                onEditRow={onEditRow}
                onEditBlock={onEditBlock}
                showRowActions={viewUnit === 'custom'}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
