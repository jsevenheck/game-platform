# Scout Architecture

Scout follows the same drop-in module shape as Flip 7: shared core types, Socket.IO server handlers, and a Vue platform adapter.

The room phase is `lobby`, `playing`, or `ended`. Setup flipping is represented while `playing` by `setupComplete=false`; each player confirms keep/flip once, then the first trick starts. The trick manager owns contiguous-play validation, ladder comparison, scouting, trick resolution, and final scoring.

Room broadcasts are personalized so only the receiving player gets their private row. Played table cards and show-pile cards are public.
