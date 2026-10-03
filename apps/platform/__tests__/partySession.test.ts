import { isTerminalResumeError } from '../src/stores/party';

describe('isTerminalResumeError', () => {
  it('treats a vanished party or member as terminal', () => {
    expect(isTerminalResumeError('Party not found')).toBe(true);
    expect(isTerminalResumeError('Player not in party')).toBe(true);
    expect(isTerminalResumeError('Invalid resume token')).toBe(true);
  });

  it('keeps the session for transient failures', () => {
    expect(isTerminalResumeError('Too many requests')).toBe(false);
    expect(isTerminalResumeError('Internal error')).toBe(false);
  });
});
