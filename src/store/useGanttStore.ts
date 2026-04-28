import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GanttBlock, GanttRow, GanttState, ViewUnit } from '../types';

type GanttActions = {
  setViewUnit: (viewUnit: ViewUnit) => void;
  setAllData: (rows: GanttRow[], blocks: GanttBlock[]) => void;
  addRow: (row: Omit<GanttRow, 'id'>) => void;
  updateRow: (id: string, patch: Partial<GanttRow>) => void;
  deleteRow: (id: string) => void;
  reorderRows: (rows: GanttRow[]) => void;
  addBlock: (block: GanttBlock) => void;
  updateBlock: (blockId: string, patch: Partial<GanttBlock>) => void;
  deleteBlock: (blockId: string) => void;
};

type Store = GanttState & GanttActions;

const now = Date.now();

const sampleRows: GanttRow[] = [
  { id: 'r1', row_title: 'ログイン機能', row_order: 1 },
  { id: 'r2', row_title: '決済機能', row_order: 2 },
  { id: 'r3', row_title: '管理画面', row_order: 3 }
];

const sampleBlocks: GanttBlock[] = [
  {
    block_id: `b-${now}-1`,
    block_label: '設計',
    level: 'ログイン',
    row_title: 'ログイン機能',
    start_date: '2026-04-01',
    end_date: '2026-04-03',
    progress: 100
  },
  {
    block_id: `b-${now}-2`,
    block_label: '実装',
    level: 'ログイン',
    row_title: 'ログイン機能',
    start_date: '2026-04-04',
    end_date: '2026-04-10',
    progress: 60
  },
  {
    block_id: `b-${now}-3`,
    block_label: 'テスト',
    level: 'ログイン',
    row_title: 'ログイン機能',
    start_date: '2026-04-11',
    end_date: '2026-04-14',
    progress: 0
  },
  {
    block_id: `b-${now}-4`,
    block_label: '設計',
    level: '決済',
    row_title: '決済機能',
    start_date: '2026-04-02',
    end_date: '2026-04-06',
    progress: 100
  },
  {
    block_id: `b-${now}-5`,
    block_label: '実装',
    level: '決済',
    row_title: '決済機能',
    start_date: '2026-04-07',
    end_date: '2026-04-16',
    progress: 30
  },
  {
    block_id: `b-${now}-6`,
    block_label: '調査',
    level: '管理',
    row_title: '管理画面',
    start_date: '2026-04-01',
    end_date: '2026-04-05',
    custom_color: '#7c3aed',
    progress: 100
  }
];

export const useGanttStore = create<Store>()(
  persist(
    (set) => ({
      viewUnit: 'custom',
      rows: sampleRows,
      blocks: sampleBlocks,

      setViewUnit: (viewUnit) => set({ viewUnit }),

      setAllData: (rows, blocks) => set({ rows, blocks }),

      addRow: (row) =>
        set((state) => ({
          rows: [
            ...state.rows,
            {
              ...row,
              id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            }
          ]
        })),

      updateRow: (id, patch) =>
        set((state) => ({
          rows: state.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
          blocks:
            patch.row_title
              ? state.blocks.map((block) => {
                  const target = state.rows.find((row) => row.id === id);
                  if (!target || block.row_title !== target.row_title) {
                    return block;
                  }
                  return {
                    ...block,
                    row_title: patch.row_title ?? block.row_title
                  };
                })
              : state.blocks
        })),

      deleteRow: (id) =>
        set((state) => {
          const target = state.rows.find((row) => row.id === id);
          if (!target) {
            return state;
          }
          return {
            rows: state.rows.filter((row) => row.id !== id),
            blocks: state.blocks.filter((block) => block.row_title !== target.row_title)
          };
        }),

      reorderRows: (rows) =>
        set({
          rows: rows.map((row, index) => ({ ...row, row_order: index + 1 }))
        }),

      addBlock: (block) =>
        set((state) => ({
          blocks: [...state.blocks, block]
        })),

      updateBlock: (blockId, patch) =>
        set((state) => ({
          blocks: state.blocks.map((block) =>
            block.block_id === blockId ? { ...block, ...patch } : block
          )
        })),

      deleteBlock: (blockId) =>
        set((state) => ({
          blocks: state.blocks.filter((block) => block.block_id !== blockId)
        }))
    }),
    {
      name: 'simple-gantt-store-v1',
      partialize: (state) => ({
        viewUnit: state.viewUnit,
        rows: state.rows,
        blocks: state.blocks
      })
    }
  )
);
