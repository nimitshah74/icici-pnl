export function recordsToCsv(rows: Array<Record<string, string>>): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string) => {
    const normalized = value ?? "";
    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, "\"\"")}"`;
    }
    return normalized;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header] ?? "")).join(",")),
  ];

  return lines.join("\n");
}
