import { toPng } from 'html-to-image';
import { useRef, useState } from 'react';
import { BlockModal } from './components/BlockModal';
import { GanttChart } from './components/GanttChart';
import { RowModal } from './components/RowModal';
import { TopBar } from './components/TopBar';
import { useGanttStore } from './store/useGanttStore';
import type { GanttBlock, GanttRow } from './types';
import { exportStateToCsv, parseCsvToState } from './utils/csv';

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const {
    viewUnit,
    rows,
    blocks,
    setViewUnit,
    setAllData,
    addRow,
    updateRow,
    deleteRow,
    reorderRows,
    addBlock,
    updateBlock,
    deleteBlock
  } = useGanttStore();

  const [error, setError] = useState<string>('');
  const [showWeekendColumns, setShowWeekendColumns] = useState(false);
  const [showTodayLine, setShowTodayLine] = useState(true);
  const [periodStartWeek, setPeriodStartWeek] = useState('');
  const [periodEndWeek, setPeriodEndWeek] = useState('');
  const [editingRow, setEditingRow] = useState<GanttRow | null>(null);
  const [showRowModal, setShowRowModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<GanttBlock | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);

  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);

  const closeRowModal = () => {
    setShowRowModal(false);
    setEditingRow(null);
  };

  const closeBlockModal = () => {
    setShowBlockModal(false);
    setEditingBlock(null);
  };

  return (
    <div className="app">
      <h1>簡易ガントチャート作成アプリ</h1>

      <TopBar
        viewUnit={viewUnit}
        onChangeViewUnit={setViewUnit}
        showWeekendColumns={showWeekendColumns}
        onToggleWeekendColumns={() => setShowWeekendColumns((prev) => !prev)}
        showTodayLine={showTodayLine}
        onToggleTodayLine={() => setShowTodayLine((prev) => !prev)}
        periodStartWeek={periodStartWeek}
        periodEndWeek={periodEndWeek}
        onChangePeriodStartWeek={setPeriodStartWeek}
        onChangePeriodEndWeek={setPeriodEndWeek}
        onResetPeriod={() => {
          setPeriodStartWeek('');
          setPeriodEndWeek('');
        }}
        onAddRow={() => {
          setError('');
          setEditingRow(null);
          setShowRowModal(true);
        }}
        onAddBlock={() => {
          setError('');
          if (rows.length === 0) {
            setError('先に行を追加してください');
            return;
          }
          setEditingBlock(null);
          setShowBlockModal(true);
        }}
        onImportCsv={() => csvInputRef.current?.click()}
        onExportCsv={() => {
          const csv = exportStateToCsv(rows, blocks);
          downloadText('gantt-export.csv', `\uFEFF${csv}`, 'text/csv;charset=utf-8;');
        }}
        onExportJson={() => {
          downloadText(
            'gantt-export.json',
            JSON.stringify({ rows, blocks, viewUnit }, null, 2),
            'application/json;charset=utf-8;'
          );
        }}
        onImportJson={() => jsonInputRef.current?.click()}
        onExportPng={async () => {
          if (!chartRef.current) {
            return;
          }
          try {
            const dataUrl = await toPng(chartRef.current, {
              pixelRatio: 2,
              cacheBust: true,
              backgroundColor: '#ffffff'
            });
            const link = document.createElement('a');
            link.download = 'gantt.png';
            link.href = dataUrl;
            link.click();
          } catch {
            setError('PNG出力に失敗しました');
          }
        }}
      />

      {error && <div className="error-box">{error}</div>}

      <div className="chart-scroll">
        <GanttChart
          chartRef={chartRef}
          viewUnit={viewUnit}
          showWeekendColumns={showWeekendColumns}
          showTodayLine={showTodayLine}
          periodStartWeek={periodStartWeek}
          periodEndWeek={periodEndWeek}
          rows={rows}
          blocks={blocks}
          onReorderRows={reorderRows}
          onEditRow={(row) => {
            setEditingRow(row);
            setShowRowModal(true);
          }}
          onEditBlock={(block) => {
            setEditingBlock(block);
            setShowBlockModal(true);
          }}
        />
      </div>

      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={async (e) => {
          setError('');
          const file = e.target.files?.[0];
          e.currentTarget.value = '';
          if (!file) {
            return;
          }
          try {
            const text = await file.text();
            const state = parseCsvToState(text);
            setAllData(state.rows, state.blocks);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'CSVインポートに失敗しました');
          }
        }}
      />

      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          setError('');
          const file = e.target.files?.[0];
          e.currentTarget.value = '';
          if (!file) {
            return;
          }
          try {
            const text = await file.text();
            const parsed = JSON.parse(text) as {
              rows?: GanttRow[];
              blocks?: GanttBlock[];
            };
            if (!Array.isArray(parsed.rows) || !Array.isArray(parsed.blocks)) {
              throw new Error('JSON形式が不正です (rows, blocks が必要)');
            }
            setAllData(parsed.rows, parsed.blocks);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'JSON読み込みに失敗しました');
          }
        }}
      />

      {showRowModal && (
        <RowModal
          initial={editingRow}
          onClose={closeRowModal}
          onDelete={() => {
            if (!editingRow) {
              return;
            }
            if (!confirm(`行「${editingRow.row_title}」を削除します。関連ブロックも削除されます。`)) {
              return;
            }
            deleteRow(editingRow.id);
            closeRowModal();
          }}
          onSubmit={(payload) => {
            setError('');
            const duplicate = rows.some(
              (row) => row.row_title === payload.row_title && (!editingRow || row.id !== editingRow.id)
            );
            if (duplicate) {
              setError('同じグループ名の行が既に存在します');
              return;
            }
            if (editingRow) {
              updateRow(editingRow.id, payload);
            } else {
              const maxOrder = rows.reduce((max, row) => Math.max(max, row.row_order), 0);
              addRow({ ...payload, row_order: maxOrder + 1 });
            }
            closeRowModal();
          }}
        />
      )}

      {showBlockModal && (
        <BlockModal
          rows={rows}
          initial={editingBlock}
          onClose={closeBlockModal}
          onDelete={() => {
            if (!editingBlock) {
              return;
            }
            deleteBlock(editingBlock.block_id);
            closeBlockModal();
          }}
          onSubmit={(payload) => {
            setError('');
            if (editingBlock) {
              updateBlock(editingBlock.block_id, payload);
            } else {
              addBlock({
                ...payload,
                block_id: payload.block_id || `blk-${Date.now()}`
              });
            }
            closeBlockModal();
          }}
        />
      )}
    </div>
  );
}
