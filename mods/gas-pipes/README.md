# Gas Pipes 1.4.1

Lets the ordinary **Pump -> Pipe(s) -> Liquid Vent** network carry gas as well
as liquid. There is no separate gas pipe.

## What changed in 1.4.1

Sandustry 0.5.7 replaced the water counter. The pump keeps a `liquidBuffer`
keyed by element type, and its intake predicate is "not Lava, and the cell's
`matterType` is Liquid". 1.4.0 anchored on the old `waterBuffer` path, so on
0.5.7 it resolved nothing and installed no patch.

1.4.1 widens that one predicate to Liquid or Gas, still refusing Lava. The
buffer, the vent and the pipe graph are the game's. A network that moves gas
takes the gas element's own `metaColor` for a couple of seconds, which is the
same overlay the game already uses for the last liquid.

1.4.1 keeps the pump's own rectangle. Gas is taken from those cells and no
others, the same way water is. Put the pump in the steam, under the ceiling,
the way you put it in a pool on the floor. The build category is renamed from
Fluids to Liquids and gases while the mod is loaded.

Steam and Fire are whatever the live matter table says is Gas. The patch does
not hardcode their ids.

## Install

Install the ZIP through **SandLoader Mods -> Install from ZIP**, replace the old
Gas Pipes version, then completely restart Sandustry.

Use the exact same setup that already transports Water:

`Gas -> Pump -> Pipe(s) -> Liquid Vent`

For diagnostics, run `gaspipes` in the SandLoader console after the Pump has
been active for a moment.
