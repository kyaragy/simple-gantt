import { useEffect, useMemo, useState } from 'react';
import type { GanttBlock, GanttRow } from '../types';
import { COLOR_PALETTE } from '../utils/color';

type Props = {
  initial?: GanttBlock | null;
  rows: GanttRow[];
  onClose: () => void;
  onSubmit: (payload: GanttBlock) => void;
  onDelete?: () => void;
};

function emptyBlock(rows: GanttRow[]): GanttBlock {
  const fallback = rows[0];
  const today = new Date().toISOString().slice(0, 10);
  return {
    block_id: `blk-${Date.now()}`,
    block_label: '',
    row_title: fallback?.row_title ?? '新規行',
    start_date: today,
    end_date: today,
    level: '',
    custom_color: '',
    note: '',
    progress: 0
  };
}

export function BlockModal({ initial, rows, onClose, onSubmit, onDelete }: Props) {
  const [draft, setDraft] = useState<GanttBlock>(emptyBlock(rows));

  useEffect(() => {
    if (!initial) {
      setDraft(emptyBlock(rows));
      return;
    }
    setDraft({
      ...initial,
      level:
        initial.level ??
        initial.level1?.trim() ??
        initial.level2?.trim() ??
        initial.level3?.trim() ??
        ''
    });
  }, [initial, rows]);

  const rowTitles = useMemo(() => rows.map((row) => row.row_title), [rows]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal wide">
        <h3>{initial ? 'ブロックを編集' : 'ブロックを追加'}</h3>

        <div className="grid-2">
          <label>
            ブロック名
            <input
              value={draft.block_label}
              onChange={(e) => setDraft({ ...draft, block_label: e.target.value })}
            />
          </label>

          <label>
            グループ名
            <select
              value={draft.row_title}
              onChange={(e) => setDraft({ ...draft, row_title: e.target.value })}
            >
              {rowTitles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </label>

          <label>
            開始日
            <input
              type="date"
              value={draft.start_date}
              onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
            />
          </label>

          <label>
            終了日
            <input
              type="date"
              value={draft.end_date}
              onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
            />
          </label>

          <label>
            階層
            <input value={draft.level ?? ''} onChange={(e) => setDraft({ ...draft, level: e.target.value })} />
          </label>

          <label>
            進捗 (0-100)
            <input
              type="number"
              min={0}
              max={100}
              value={draft.progress ?? 0}
              onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })}
            />
          </label>

          <label>
            カスタム色
            <input
              value={draft.custom_color ?? ''}
              onChange={(e) => setDraft({ ...draft, custom_color: e.target.value })}
              placeholder="#22c55e"
            />
            <div className="palette">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="swatch"
                  style={{ backgroundColor: c }}
                  onClick={() => setDraft({ ...draft, custom_color: c })}
                  aria-label={c}
                />
              ))}
            </div>
          </label>
        </div>

        <label>
          メモ
          <textarea value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value })} rows={3} />
        </label>

        <div className="modal-actions">
          {initial && onDelete && (
            <button
              className="danger"
              onClick={() => {
                if (confirm('このブロックを削除しますか？')) {
                  onDelete();
                }
              }}
            >
              削除
            </button>
          )}
          <button onClick={onClose}>キャンセル</button>
          <button
            className="primary"
            onClick={() => {
              if (!draft.block_label.trim()) {
                alert('ブロック名は必須です');
                return;
              }
              if (draft.end_date < draft.start_date) {
                alert('終了日は開始日以降にしてください');
                return;
              }
              onSubmit({
                ...draft,
                block_label: draft.block_label.trim(),
                level: draft.level?.trim() || undefined,
                level1: undefined,
                level2: undefined,
                level3: undefined
              });
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
