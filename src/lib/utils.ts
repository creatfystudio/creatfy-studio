// ---------- Formatação ----------

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(value) ? value : 0
  );
}

export function parseCurrencyInput(raw: string): number {
  // aceita "59,90", "R$ 59,90", "59.90" etc.
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(,|$))/g, '');
  const normalized = cleaned.replace(',', '.');
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '—';
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)} ${hh}:${min}`;
}

export function formatDateHyphen(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function maskPhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function sanitizeForPath(name: string): string {
  return name
    .replace(/[\/\\#?[\]*|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ---------- Dias úteis / feriados nacionais ----------

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Algoritmo de Meeus/Jones/Butcher para a data da Páscoa (domingo). */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getGoodFriday(year: number): Date {
  const easter = getEasterDate(year);
  const gf = new Date(easter);
  gf.setDate(gf.getDate() - 2);
  return gf;
}

function getHolidaysForYear(year: number): string[] {
  const keys: string[] = [];
  const add = (m: number, d: number) => keys.push(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  add(1, 1); // Confraternização Universal
  add(4, 21); // Tiradentes
  add(5, 1); // Dia do Trabalho
  add(9, 7); // Independência
  add(10, 12); // Nossa Senhora Aparecida
  add(11, 2); // Finados
  add(11, 15); // Proclamação da República
  add(11, 20); // Consciência Negra
  add(12, 25); // Natal
  keys.push(dateKey(getGoodFriday(year))); // Sexta-feira Santa
  return keys;
}

function getHolidaySet(fromDate: Date, toDate: Date): Set<string> {
  const years = new Set<number>();
  for (let y = fromDate.getFullYear() - 1; y <= toDate.getFullYear() + 1; y++) years.add(y);
  const set = new Set<string>();
  years.forEach((y) => getHolidaysForYear(y).forEach((k) => set.add(k)));
  return set;
}

function isBusinessDay(date: Date, holidays: Set<string>): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  if (holidays.has(dateKey(date))) return false;
  return true;
}

function addBusinessDays(start: Date, days: number, holidays: Set<string>): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result, holidays)) added++;
  }
  return result;
}

function businessDaysBetween(from: Date, to: Date, holidays: Set<string>): number {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor, holidays)) count++;
  }
  return count;
}

function pluralDiasUteis(n: number): string {
  return n === 1 ? '1 dia útil' : `${n} dias úteis`;
}

export interface SlaInfo {
  deadline: Date;
  overdue: boolean;
  label: string;
  businessDaysLate: number;
}

const PRODUCTION_DAYS = 2;

/**
 * Calcula o prazo (2 dias úteis) e o status de atraso de um pedido.
 * Só se aplica a pedidos que ainda não estão "ready" nem "delivered".
 */
export function getSlaInfo(createdAt: Date, now: Date = new Date()): SlaInfo {
  const holidays = getHolidaySet(createdAt, now);
  const deadline = addBusinessDays(createdAt, PRODUCTION_DAYS, holidays);
  const overdue = now.getTime() > deadline.getTime();

  if (overdue) {
    const late = Math.max(1, businessDaysBetween(deadline, now, holidays));
    return { deadline, overdue: true, label: `Atrasado há ${pluralDiasUteis(late)}`, businessDaysLate: late };
  }

  const sameCalendarDay = dateKey(now) === dateKey(deadline);
  if (sameCalendarDay) {
    return { deadline, overdue: false, label: 'Vence hoje', businessDaysLate: 0 };
  }
  const left = Math.max(1, businessDaysBetween(now, deadline, holidays));
  return { deadline, overdue: false, label: `Vence em ${pluralDiasUteis(left)}`, businessDaysLate: 0 };
}

// ---------- Datas auxiliares para filtros de calendário ----------

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  const day = r.getDay();
  r.setDate(r.getDate() - day);
  return r;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
