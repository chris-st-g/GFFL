# GFFL Scoring Rules

The Graham Family Football League uses a points system based on win records, not just win/loss. Every Grahamchise picks one NFL team per week and earns points based on how evenly matched their team's game is.

---

## Point System

### Weeks 1–3 — Regular (flat scoring)

All games in weeks 1–3 are treated as Regular regardless of records, because win records aren't meaningful yet in the early season.

| Outcome | Points |
|---|---|
| Your team wins | 1 pt |
| Your team loses | 0 pts |
| Tie | 1 pt |

---

### Weeks 4–18 — Record-based scoring

Win records at game time determine the game type. The difference in wins between the two teams is what matters.

#### Deuce — Equal win records (diff = 0)

Both teams have the same number of wins. The game is a true toss-up.

| Outcome | Points |
|---|---|
| Your team wins | 2 pts |
| Your team loses | 0 pts |
| Tie | 2 pts |

#### Trey — Win records differ by exactly 1

One team is a slight underdog. If you picked the underdog, you earn more.

| Picked team | Wins | Points if win |
|---|---|---|
| Underdog | Fewer wins | 3 pts |
| Favorite | More wins | 1 pt |

#### Regular — Win records differ by 2 or more

One team is a clear favorite. Picking either team earns regular points.

| Outcome | Points |
|---|---|
| Your team wins | 1 pt |
| Your team loses | 0 pts |
| Tie | 1 pt |

---

## Ties

A tie counts the same as a win — the player earns the full point value for that game type. The team didn't lose, so the pick is rewarded.

---

## Grace Bowl — Weeks 16–18

Weeks 16–18 are called the Grace Bowl. The scoring rules are **identical** to weeks 4–18 (Deuce/Trey/Regular). The Grace Bowl label is a UI distinction only — it does not change how points are calculated.

---

## Bonus Points

The commissioner can award bonus points at any time via the Admin panel. Bonuses can be tied to a specific week or applied at the season level. They are tracked in the BonusPoints sheet tab separately from pick points.

---

## Standings

A player's total score = sum of all `PointsEarned` from picks + sum of all bonus points for the season.

---

## Examples

| Week | Your team | Opponent | Your wins | Opp wins | Game type | Result | Points |
|---|---|---|---|---|---|---|---|
| 2 | KC | LAR | 1 | 1 | Regular (week ≤3) | W | 1 |
| 5 | SF | DAL | 3 | 3 | Deuce | W | 2 |
| 7 | NYG | PHI | 2 | 5 | Regular (diff > 1) | W | 1 |
| 9 | CLE | BAL | 3 | 4 | Trey (underdog) | W | 3 |
| 9 | BAL | CLE | 4 | 3 | Trey (favorite) | W | 1 |
| 12 | MIA | BUF | 6 | 6 | Deuce | L | 0 |
| 17 | GB | MIN | 9 | 8 | Trey (Grace Bowl) | W | 3 |
