# chess-openings

A quiggleson.com sub-app: an installable PWA served at
**https://www.quiggleson.com/chess-openings**, from its own repo and its own Cloudflare Worker.

Scaffolded from [pilot](https://github.com/Quiggleson/pilot). [CLAUDE.md](CLAUDE.md) has the details.

```sh
nvm use            # Node 24; wrangler needs 22+
npm install
npm run preview    # build + local Worker at http://localhost:8787/chess-openings/
```

Merging to `main` deploys via GitHub Actions.

## License

GPL-3.0-or-later, because the board is [chessground](https://github.com/lichess-org/chessground).
Opening names and moves are from Lichess's [chess-openings](https://github.com/lichess-org/chess-openings)
(CC0).
