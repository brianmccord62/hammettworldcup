# Hammett World Cup - Scoring Corrected

Fixes the scoring bug where completed Round of 32 matches were being treated like the World Cup Final.

Key fix:
- Knockout points are now based on exact ESPN event IDs.
- Game status "Final" is no longer used to determine round.
- Argentina after R32 win should be group advance +1 plus R32 +2 = +3, until it plays/wins R16.
