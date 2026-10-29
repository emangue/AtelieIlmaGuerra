export function todayLocalISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Lê uma data "YYYY-MM-DD" no fuso local. `new Date("2026-09-30")` é meia-noite
 * UTC, que no Brasil vira 29/09 às 21h — e ao salvar o formulário a data recua
 * um dia. Para strings com horário, cai no parse normal.
 */
export function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(value);
}

export function formatDateOnlyBR(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  try {
    return new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export function formatDateTimeBR(value: string): string {
  try {
    return new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

// ── Mês de referência no formato YYYYMM (usado nas telas mensais) ────────────

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function hojeAnomes(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function addMes(anomes: string, n: number): string {
  const y = parseInt(anomes.slice(0, 4), 10);
  const m = parseInt(anomes.slice(4, 6), 10);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function labelMes(anomes: string): string {
  return `${MESES_ABREV[parseInt(anomes.slice(4), 10) - 1]}/${anomes.slice(0, 4)}`;
}
