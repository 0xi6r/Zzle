# Zzle

A programming puzzle game in TypeScript, in the style of RoboZZle. You do not steer the robot directly. You write a small program, press run, and the robot follows it. The goal of each level is to collect every star without stepping off the colored path.

The game has 50 levels, ordered by difficulty, and runs in the browser with no framework.

## Run

Requires [Bun](https://bun.sh).

```
bun run start
```

This serves `index.html` and bundles `game.ts` and its imports. Open the address Bun prints.

## Test

```
bun test.ts
```

Each level stores a reference solution. The test runs every one against the engine and prints a pass or fail line per level. It exits with a non-zero code if any level cannot be won with its stored solution.

Run this after adding or editing levels.

## How to play

1. Click a slot in the program area at the bottom.
2. Click a command in the palette to put it in that slot. The selection moves to the next slot automatically.
3. Press run. The robot starts at function 0 and executes its slots from left to right.
4. Collect every star to complete the level. If the robot moves onto an empty cell, it falls and the run ends.

### Commands

| Command | Effect |
| --- | --- |
| Up arrow | Move one tile forward |
| Left / right turn | Rotate 90 degrees |
| Digit (0, 1, 2, ...) | Call that function, then continue after the call returns. A function may call itself |
| Plus sign (colored) | Paint the current tile with that color |
| Colored square | Condition. With a slot selected, click a square to make the slot run only when the robot stands on that color. Click again to remove it |

A slot can hold one command and one condition. Which commands and conditions are available depends on the level.

### Tile colors

There are three colors: purple, teal (hatched) and orange. Colors carry no fixed meaning. They become useful through conditions, for example "turn right only on purple".

### Controls

| Control | Action |
| --- | --- |
| Run | Run or pause the program |
| Step | Execute one action |
| Restart | Reset the robot and the board, keep the program |
| Clear | Empty the program |
| Speed | Cycle through three speeds |
| Skip | Go to the next level without solving the current one |
| Previous | Go back one level |
| Level dots | Jump to any level. Solved levels are marked |
| How to play | Opens a short rules summary |
| Hint | Opens a short explanation of the current level, with a button that fills in the reference solution |

Keyboard: arrow keys move the slot selection, Backspace or Delete clears the selected slot, Enter runs or pauses, Escape closes a dialog.

After two failed runs on a level, the Hint button pulses.

Solved levels and the current level are saved in the browser's local storage.

## Rules of the engine

- Execution starts at function 0, slot 0.
- Empty slots are skipped. A slot with a condition is skipped when the robot is not standing on that color.
- Calls use a stack. A call in the last slot of a function does not grow the stack, so a function that ends by calling itself can loop indefinitely.
- Stars are collected when the robot arrives on them. A star on the starting tile is collected only when the robot returns to it.
- A run ends when all stars are collected (won), the robot leaves the path (fell), the program ends with stars remaining (done), or a limit is reached (loop).
- Limits: call stack depth of 500 and 3000 executed actions.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Page layout and styles |
| `game.ts` | User interface, canvas rendering, input, level navigation, hint dialog |
| `engine.ts` | Game rules with no DOM access: map parsing, program parsing, step function |
| `levels.ts` | Level definitions |
| `hints.ts` | One hint per level, in the same order as `levels.ts` |
| `test.ts` | Runs each level's reference solution against the engine |
| `package.json` | Scripts and dev dependency on `bun-types` |

## Adding a level

Append an entry to the array in `levels.ts` and add a matching line to `hints.ts`.

```ts
{
  name: 'Corner',
  f: [3],            // slots per function; one number per function
  a: 'ulrc',         // allowed commands: u forward, l left, r right, c calls, p paint
  k: '0',            // allowed conditions: any of 0 (purple), 1 (teal), 2 (orange)
  m: [               // map, one string per row
    'pooO',
    'o...',
    'o...',
    'o...',
  ],
  r: [0, 3, 0],      // robot start: x, y, direction (0 up, 1 right, 2 down, 3 left)
  s: ['u 0?r c0'],   // reference solution, one string per function
}
```

### Map characters

| Character | Meaning |
| --- | --- |
| `p`, `t`, `o` | Purple, teal, orange tile |
| `P`, `T`, `O` | The same tile with a star on it |
| `.` | Empty cell. The robot falls if it moves here |

Maps can be at most 16 columns by 12 rows. They are centered on the board automatically. Rows do not need equal length.

### Solution syntax

Tokens are separated by spaces, one string per function, in slot order.

| Token | Meaning |
| --- | --- |
| `u`, `l`, `r` | Forward, turn left, turn right |
| `c0`, `c1`, ... | Call function 0, 1, ... |
| `p0`, `p1`, `p2` | Paint purple, teal, orange |
| `0?` `1?` `2?` prefix | Condition, for example `0?r` means turn right if on purple |

Example: `u 0?r c0` is forward, turn right if on purple, call function 0.

After editing, run `bun test.ts` to confirm the level can be won with its stored solution.

## Levels

| Levels | Theme |
| --- | --- |
| 1 to 4 | Loops, turns, a first condition, turning around at an end tile |
| 5 to 7 | Color-driven turning on rings, zigzags and spirals |
| 8 to 10 | Painting tiles to change behavior on a second visit, helper functions |
| 11 to 14 | Serpentines, a plus shape, longer meanders |
| 15 to 20 | Recursion where calls finish after the robot has walked away, and slot-limited versions of earlier levels |
| 21 to 30 | Larger boards with many stars: spirals, rings, combs, pendulums, boomerangs |
| 31 to 35 | New shapes: square wave, diamond, outward spiral, Hilbert curve, rings with several inner rings |
| 36 to 50 | Trees explored by recursion, rings with spikes, space-filling curves, pendulum with spurs of varied length |

## License

No license has been specified.
