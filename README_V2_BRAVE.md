# Chess Menthol V2 — Maia directly inside Brave (experimental)

This feature branch adds 5 arrows to the **original ChessMenthol side panel**.
The board reader, move tracker and original Chessground drawing API are retained.

| Arrow | Source |
| --- | --- |
| Blue | Stockfish 19 best line |
| Purple | Maia-3 5M conditioned on 1800 Elo |
| Green | Maia-3 varying human policy |
| Yellow | Maia-3 5M conditioned on 800 Elo |
| Red | EXPERIMENTAL: Maia-3 600 Elo with wider sampling (not a validated 400 Elo predictor) |

No Python, localhost bridge or other executable is needed **for the end user**.
The 5M ONNX model is packaged from the `maia3-js` npm dependency when the
extension is built. The end user receives a compiled folder and installs it
in Brave's `brave://extensions` via Developer mode / Load unpacked.

## Build in GitHub Actions

On the `feat/maia3-cinco-setas-brave` branch, open the Actions tab and select
**Build Brave V2 with Maia**. If the workflow succeeds, download the artifact
named `ChessMenthol-V2-Brave-5-Setas`, extract it, and select the extracted
folder containing `manifest.json` in Brave.

The workflow was added for verification. An existing source archive or a green
GitHub commit alone is NOT evidence that browser compilation or Maia inference
succeeded. Inspect the workflow result and run browser tests before considering
this release ready.

## Limitations

- All five arrows are displayed on the extension side-panel board, NOT over
  the chess.com webpage board.
- Maia is CPU/WASM, so inference startup and latency may be substantial.
- Maia 400 Elo accuracy is not validated. Red intentionally uses a sampled
  600-Elo human policy and is labeled experimental.
- Colors can overlap when several profiles choose the same move.
- The build and browser integration have not been validated in this session.
- Use only for study and permitted engine-assisted play.
