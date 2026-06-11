# Hammett World Cup

Vercel-ready World Cup draft tracker.

## What it does
- Uses image flags instead of emoji flags
- Pulls ESPN FIFA World Cup scoreboard through `/api/worldcup`
- Computes group standings from completed group matches
- Projects current group scoring using your pot-based rules
- Fades teams that are currently out/eliminated
- Refreshes every 5 minutes

## Deploy
Upload this folder to GitHub and import it into Vercel.

## API
The frontend calls:

```txt
/api/worldcup
```

The serverless API fetches ESPN:

```txt
https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=500&dates=20260611-20260719
```

## Note
Top two advancing is built in. Best third-place advancement logic can be added once groups are fully populated and the official rules/data are stable.
