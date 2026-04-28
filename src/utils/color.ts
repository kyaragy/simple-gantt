import type { GanttBlock } from '../types';

export const COLOR_PALETTE = [
  '#0ea5e9',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#7c3aed',
  '#ec4899',
  '#14b8a6',
  '#06b6d4'
];

export function resolveBlockColor(block: GanttBlock): string {
  if (block.custom_color && block.custom_color.trim()) {
    return block.custom_color;
  }
  return '#0ea5e9';
}
