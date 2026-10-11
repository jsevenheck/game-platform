import bcrypt from 'bcryptjs';
import {
  createPasswordVerifier,
  PasswordVerificationBusyError,
} from '../server/passwordVerification';

describe('isolated and bounded password verification', () => {
  afterEach(() => vi.restoreAllMocks());

  it('verifies valid and invalid credentials in a worker while the event loop remains responsive', async () => {
    const hash = bcrypt.hashSync('correct-password', 10);
    const syncSpy = vi.spyOn(bcrypt, 'compareSync');
    const verify = createPasswordVerifier();
    let finished = false;
    const pending = verify('correct-password', hash).then((result) => {
      finished = true;
      return result;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(finished).toBe(false);
    expect(await pending).toBe(true);
    expect(await verify('wrong-password', hash)).toBe(false);
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('rejects excess work without queueing and releases capacity after completion', async () => {
    let complete!: (result: boolean) => void;
    const compare = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          complete = resolve;
        })
    );
    const verify = createPasswordVerifier(compare, 1);
    const first = verify('password', 'hash');
    await expect(verify('another', 'hash')).rejects.toBeInstanceOf(PasswordVerificationBusyError);
    expect(compare).toHaveBeenCalledTimes(1);
    complete(true);
    expect(await first).toBe(true);
    const next = verify('next', 'hash');
    complete(false);
    expect(await next).toBe(false);
  });

  it('releases capacity after a verifier failure', async () => {
    const compare = vi
      .fn()
      .mockRejectedValueOnce(new Error('Worker failed'))
      .mockResolvedValueOnce(true);
    const verify = createPasswordVerifier(compare, 1);
    await expect(verify('password', 'hash')).rejects.toThrow('Worker failed');
    expect(await verify('password', 'hash')).toBe(true);
  });
});
