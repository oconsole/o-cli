// OdooCLI brand logo. Renders "O-CLI" in opencode's block-letter style.
// Right half is intentionally blank — the brand fits in the left 19 cols.
// No shadow markers (_/^/~) since this brand doesn't use the 3D effect;
// the renderer falls back to flat colored text when no markers are present.
export const logo = {
  left: [
    "                   ",
    "█▀▀█    █▀▀▀ █   █ ",
    "█  █ ▀▀ █    █   █ ",
    "▀▀▀▀    ▀▀▀▀ ▀▀▀ ▀ ",
  ],
  right: [
    "                   ",
    "                   ",
    "                   ",
    "                   ",
  ],
}

export const marks = "_^~"
