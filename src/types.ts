export type ViewUnit = 'level' | 'custom' | 'level1' | 'level2' | 'level3';

export type GanttRow = {
  id: string;
  row_title: string;
  row_order: number;
};

export type GanttBlock = {
  block_id: string;
  block_label: string;
  level?: string;
  level1?: string;
  level2?: string;
  level3?: string;
  row_title: string;
  start_date: string;
  end_date: string;
  custom_color?: string;
  note?: string;
  progress?: number;
};

export type GanttState = {
  viewUnit: ViewUnit;
  rows: GanttRow[];
  blocks: GanttBlock[];
};

export const BLOCK_EXPORT_COLUMNS: Array<keyof GanttBlock | 'row_order'> = [
  'row_title',
  'block_label',
  'start_date',
  'end_date',
  'level',
  'block_id',
  'custom_color',
  'note',
  'progress',
  'row_order'
];
