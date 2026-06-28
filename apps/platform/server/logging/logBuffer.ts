export interface BufferedLogEntry {
  timestamp: string;
  level: string;
  msg: string;
  component?: string;
  namespace?: string;
  requestId?: string;
}

const MAX_BUFFER_SIZE = 1000;
const logBuffer: BufferedLogEntry[] = new Array(MAX_BUFFER_SIZE);
let logBufferHead = 0;
let logBufferCount = 0;

export function appendLogEntry(entry: BufferedLogEntry): void {
  logBuffer[logBufferHead] = entry;
  logBufferHead = (logBufferHead + 1) % MAX_BUFFER_SIZE;
  if (logBufferCount < MAX_BUFFER_SIZE) {
    logBufferCount++;
  }
}

export function getRecentLogs(limit = 200): BufferedLogEntry[] {
  const count = Math.min(limit, logBufferCount);
  const result: BufferedLogEntry[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const idx = (logBufferHead - 1 - i + MAX_BUFFER_SIZE) % MAX_BUFFER_SIZE;
    result[i] = logBuffer[idx]!;
  }
  return result;
}
