import { isValid, parseISO } from 'date-fns';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(value: string): boolean {
  if (!DATE_RE.test(value)) {
    return false;
  }
  return isValid(parseISO(value));
}
