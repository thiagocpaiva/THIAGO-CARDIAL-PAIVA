
/**
 * Converte data ISO ou YYYY-MM-DD para o formato brasileiro dd/mm/aaaa
 */
export function formatDateBR(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  
  if (dateInput instanceof Date) {
    const day = String(dateInput.getDate()).padStart(2, '0');
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const year = dateInput.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(dateInput).trim();
  if (str.includes('T')) {
    // Ex: 2026-10-08T15:30:00.000Z
    const [datePart] = str.split('T');
    return formatDateBR(datePart);
  }

  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year.length === 4) {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
    }
  }

  return str;
}

/**
 * Retorna a data atual no formato YYYY-MM-DD para chaves de calendário
 */
export function getTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna a data de hoje formatada em dd/mm/aaaa
 */
export function getTodayFormattedBR(): string {
  return formatDateBR(getTodayKey());
}
