export interface BufferedLogEntry {
  timestamp: string;
  level: string;
  msg: string;
  component?: string;
  namespace?: string;
  requestId?: string;
}

const MAX_BUFFER_SIZE = 1000;
const logBuffer: BufferedLogEntry[] = [];

export function appendLogEntry(entry: BufferedLogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.splice(0, logBuffer.length - MAX_BUFFER_SIZE);
  }
}

export function getRecentLogs(limit = 200): BufferedLogEntry[] {
  return logBuffer.slice(-limit).reverse();
}
