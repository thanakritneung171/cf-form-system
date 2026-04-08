// ===== Logger =====

export function log(level: 'INFO' | 'WARN' | 'ERROR', context: string, msg: string, extra?: unknown) {
  const line = `[W2][${level}][${context}] ${msg}`;
  if (extra !== undefined) {
    if (level === 'ERROR') console.error(line, extra);
    else if (level === 'WARN') console.warn(line, extra);
    else console.log(line, extra);
  } else {
    if (level === 'ERROR') console.error(line);
    else if (level === 'WARN') console.warn(line);
    else console.log(line);
  }
}

// ===== Array helpers =====

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
