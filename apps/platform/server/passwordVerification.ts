import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(__filename);
const BCRYPT_PATH = nodeRequire.resolve('bcryptjs');
const VERIFICATION_TIMEOUT_MS = 10_000;

export class PasswordVerificationBusyError extends Error {
  constructor() {
    super('Password verification capacity exceeded');
  }
}

// Static worker code avoids a separate TS worker entry that would need
// different paths/loaders under tsx development and compiled production.
const WORKER_CODE = `
  const { parentPort, workerData } = require('node:worker_threads');
  const bcrypt = require(workerData.bcryptPath);
  parentPort.postMessage(bcrypt.compareSync(workerData.password, workerData.hash));
`;

function compareInWorker(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_CODE, {
      eval: true,
      workerData: { bcryptPath: BCRYPT_PATH, password, hash },
    });
    const finish = (error?: Error, result = false) => {
      clearTimeout(timer);
      worker.removeAllListeners();
      void worker.terminate();
      if (error) reject(error);
      else resolve(result);
    };
    const timer = setTimeout(
      () => finish(new Error('Password verification timed out')),
      VERIFICATION_TIMEOUT_MS
    );
    worker.once('message', (result: unknown) => finish(undefined, result === true));
    worker.once('error', (error) => finish(error));
    worker.once('exit', () => finish(new Error('Password verifier exited without a result')));
  });
}

/** No unbounded queue: reject excess work before allocating a worker. */
export function createPasswordVerifier(
  compare: (password: string, hash: string) => Promise<boolean> = compareInWorker,
  maxConcurrent = 2
) {
  let active = 0;
  return async (password: string, hash: string): Promise<boolean> => {
    if (active >= maxConcurrent) throw new PasswordVerificationBusyError();
    active++;
    try {
      return await compare(password, hash);
    } finally {
      active--;
    }
  };
}
