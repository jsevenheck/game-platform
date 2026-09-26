// The sweep interval starts when the room module loads, so fake timers must be
// installed before a fresh import of the module.
describe('periodic room cleanup sweep', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes an ended room instead of pushing its deadline out on every pass', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const rooms = await import('../server/src/models/room');
    const { ROOM_ENDED_CLEANUP_MS } = await import('../core/src/constants');
    const { room } = rooms.createRoom('Host', 'socket-1', 'host-1');
    room.phase = 'ended';

    vi.advanceTimersByTime(ROOM_ENDED_CLEANUP_MS * 3);

    expect(rooms.getRoom(room.code)).toBeUndefined();
  });
});
