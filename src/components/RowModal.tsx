import { useEffect, useState } from 'react';
import type { GanttRow } from '../types';

type Props = {
  initial?: GanttRow | null;
  onClose: () => void;
  onSubmit: (payload: { row_title: string }) => void;
  onDelete?: () => void;
};

export function RowModal({ initial, onClose, onSubmit, onDelete }: Props) {
  const [rowTitle, setRowTitle] = useState('');

  useEffect(() => {
    setRowTitle(initial?.row_title ?? '');
  }, [initial]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h3>{initial ? '行を編集' : '行を追加'}</h3>
        <label>
          グループ名
          <input value={rowTitle} onChange={(e) => setRowTitle(e.target.value)} />
        </label>
        <div className="modal-actions">
          {initial && onDelete && (
            <button className="danger" onClick={onDelete}>
              削除
            </button>
          )}
          <button onClick={onClose}>キャンセル</button>
          <button
            className="primary"
            onClick={() => {
              const normalizedTitle = rowTitle.trim();
              if (!normalizedTitle) {
                alert('グループ名は必須です');
                return;
              }
              onSubmit({ row_title: normalizedTitle });
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
