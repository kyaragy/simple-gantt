import type { ViewUnit } from '../types';
import { addDays, format, startOfWeek } from 'date-fns';

type Props = {
  viewUnit: ViewUnit;
  onChangeViewUnit: (value: ViewUnit) => void;
  showWeekendColumns: boolean;
  onToggleWeekendColumns: () => void;
  showTodayLine: boolean;
  onToggleTodayLine: () => void;
  periodStartWeek: string;
  periodEndWeek: string;
  onChangePeriodStartWeek: (value: string) => void;
  onChangePeriodEndWeek: (value: string) => void;
  onResetPeriod: () => void;
  onAddRow: () => void;
  onAddBlock: () => void;
  onImportCsv: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onExportPng: () => void;
};

export function TopBar({
  viewUnit,
  onChangeViewUnit,
  showWeekendColumns,
  onToggleWeekendColumns,
  showTodayLine,
  onToggleTodayLine,
  periodStartWeek,
  periodEndWeek,
  onChangePeriodStartWeek,
  onChangePeriodEndWeek,
  onResetPeriod,
  onAddRow,
  onAddBlock,
  onImportCsv,
  onExportCsv,
  onExportJson,
  onImportJson,
  onExportPng
}: Props) {
  const normalizedViewUnit = viewUnit === 'custom' ? 'custom' : 'level';

  const parseWeekInput = (value: string): Date | null => {
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
  };

  const formatWeekRange = (value: string): string => {
    const start = parseWeekInput(value);
    if (!start) {
      return '未指定';
    }
    const end = addDays(start, 6);
    return `${format(start, 'M/d')}〜${format(end, 'M/d')}`;
  };

  return (
    <div className="topbar">
      <button onClick={onAddRow}>行追加</button>
      <button onClick={onAddBlock}>ブロック追加</button>
      <button onClick={onImportCsv}>CSVインポート</button>
      <button onClick={onExportCsv}>CSVエクスポート</button>
      <button onClick={onExportJson}>JSON保存</button>
      <button onClick={onImportJson}>JSON読み込み</button>
      <button onClick={onExportPng}>PNG出力</button>
      <button onClick={onToggleWeekendColumns}>
        土日列: {showWeekendColumns ? '表示' : '非表示'}
      </button>
      <label className="line-toggle">
        <input type="checkbox" checked={showTodayLine} onChange={onToggleTodayLine} />
        Today線を表示
      </label>

      <label className="week-range-control">
        表示期間
        <div className="week-input-wrap">
          <input
            type="week"
            value={periodStartWeek}
            onChange={(e) => onChangePeriodStartWeek(e.target.value)}
          />
          <small>{formatWeekRange(periodStartWeek)}</small>
        </div>
        <span>〜</span>
        <div className="week-input-wrap">
          <input
            type="week"
            value={periodEndWeek}
            onChange={(e) => onChangePeriodEndWeek(e.target.value)}
          />
          <small>{formatWeekRange(periodEndWeek)}</small>
        </div>
        <button type="button" onClick={onResetPeriod}>
          自動
        </button>
      </label>

      <label className="unit-select">
        表示単位
        <select value={normalizedViewUnit} onChange={(e) => onChangeViewUnit(e.target.value as ViewUnit)}>
          <option value="custom">グループ</option>
          <option value="level">階層</option>
        </select>
      </label>
    </div>
  );
}
