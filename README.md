# Gavel FC

A multiplayer football auction game. One person creates a private, password-protected room and shares the invite code. Everyone gets 100,000 to spend, and bids against each other in real time until every squad has exactly 26 players.

## Run it

You need Node.js 18 or newer (https://nodejs.org). There is nothing else to install.

    node server.js

On Windows you can also double-click `start.bat`.

The server prints two addresses:

- `http://localhost:3000` for this computer
- `http://192.168.x.x:3000` for phones and laptops on the same Wi-Fi

Open an address, choose **Create a room**, set a password, and send the 6-character code (or the invite link) plus the password to your friends.

### Playing over the internet

The server must be reachable by everyone. Two easy ways:

- Tunnel your computer: `npx cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`, then share the https link it prints.
- Host it: the folder runs on any Node host (Render, Railway, Fly.io, a VPS). Start command `node server.js`. It reads the `PORT` environment variable. Set `TRUST_PROXY=1` when it sits behind a proxy, so rate limiting sees real client addresses.

## Rules

- 2 to 8 managers per room. The host starts the auction.
- Budget 100,000 each. Squad size exactly 26.
- Players appear one at a time at an opening price set by rating. Bid in steps of 50.
- A lot lasts 20 seconds. Any bid leaves at least 10 seconds on the clock, so bidding can go on as long as people keep raising.
- You must keep 100 in reserve for every empty slot after the current one, so a full squad is always affordable. The game shows your current limit.
- Unsold players come back later at half price. After three passes the player is assigned to the team with the most empty slots.
- If only one team still needs players, it signs the remaining lots at the opening price.
- Winner: the best XI in a 4-3-3 (1 GK, 4 DEF, 3 MID, 3 FWD) by average rating. A missing position counts as 50, so balance your squad.
- Closed the tab? Reopen the page and you are back in. On a new device, join again with the same name and the room password.

## Change the game

- `public/players.js` is the player pool: `Name|Position|Club|Nation|Rating`. Add or edit lines freely. Keep at least 26 players per manager (8 managers need 208).
- `server.js` has the settings near the top (`CFG`): budget, squad size, timers, bid step, room size.
- Ratings and clubs in the pool are approximate, not official data.

## Files

    server.js          game server (no dependencies)
    public/index.html  page structure
    public/style.css   look and animation
    public/app.js      browser game client
    public/players.js  player pool, shared by server and browser
