import Papa from 'papaparse';
import type { GanttBlock, GanttRow } from '../types';
import { isValidYmd } from './date';

export type CsvImportResult = {
  rows: GanttRow[];
  blocks: GanttBlock[];
};

const REQUIRED_FIELDS = [
  'row_title',
  'block_label',
  'start_date',
  'end_date'
] as const;

const CSV_EXPORT_COLUMNS = [
  'row_title',
  'block_group',
  'block_label',
  'start_date',
  'end_date',
  'block_id',
  'custom_color',
  'note',
  'progress',
  'row_order'
] as const;

export function parseCsvToState(text: string): CsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV解析エラー: ${parsed.errors[0]?.message ?? '不明なエラー'}`);
  }

  const rowsMap = new Map<string, GanttRow>();

  const blocks = parsed.data.map((record, idx) => {
    for (const field of REQUIRED_FIELDS) {
      if (!record[field] || !record[field].trim()) {
        throw new Error(`${idx + 2}行目: 必須項目 ${field} が不足しています`);
      }
    }

    const start = record.start_date.trim();
    const end = record.end_date.trim();

    if (!isValidYmd(start) || !isValidYmd(end)) {
      throw new Error(`${idx + 2}行目: 日付形式は YYYY-MM-DD で入力してください`);
    }

    if (end < start) {
      throw new Error(`${idx + 2}行目: end_date が start_date より前です`);
    }

    const row_title = record.row_title.trim();
    const row_order = Number(record.row_order || Number.MAX_SAFE_INTEGER);

    if (!rowsMap.has(row_title)) {
      rowsMap.set(row_title, {
        id: `r-${row_title}-${idx}`,
        row_title,
        row_order: Number.isFinite(row_order) ? row_order : Number.MAX_SAFE_INTEGER
      });
    }

    const progressNum = record.progress ? Number(record.progress) : undefined;

    return {
      block_id: record.block_id?.trim() || `blk-${Date.now()}-${idx + 1}`,
      block_label: record.block_label.trim(),
      level:
        record.block_group?.trim() ||
        record.level?.trim() ||
        record.level1?.trim() ||
        record.level2?.trim() ||
        record.level3?.trim() ||
        undefined,
      level1: record.level1?.trim() || undefined,
      level2: record.level2?.trim() || undefined,
      level3: record.level3?.trim() || undefined,
      row_title,
      start_date: start,
      end_date: end,
      custom_color: record.custom_color?.trim() || undefined,
      note: record.note?.trim() || undefined,
      progress: Number.isFinite(progressNum as number) ? progressNum : undefined
    } satisfies GanttBlock;
  });

  const rows = Array.from(rowsMap.values())
    .sort((a, b) => a.row_order - b.row_order)
    .map((row, index) => ({ ...row, row_order: index + 1 }));

  return { rows, blocks };
}

export function exportStateToCsv(rows: GanttRow[], blocks: GanttBlock[]): string {
  const rowOrderMap = new Map(rows.map((row) => [row.row_title, row.row_order]));

  const data = blocks.map((block) => {
    const rec: Record<string, string | number> = {};
    for (const column of CSV_EXPORT_COLUMNS) {
      if (column === 'row_order') {
        rec.row_order = rowOrderMap.get(block.row_title) ?? '';
      } else if (column === 'block_group') {
        rec.block_group = block.level ?? '';
      } else {
        rec[column] = (block[column as keyof GanttBlock] as string | number | undefined) ?? '';
      }
    }
    return rec;
  });

  return Papa.unparse(data, { columns: [...CSV_EXPORT_COLUMNS] });
}
