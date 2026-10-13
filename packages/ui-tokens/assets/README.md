# App icon source

`Milo.icon` is the one source for the macOS and iOS icons. Edit it in Icon Composer (Xcode 26+).

Exports to refresh after changing it:

| File | What it is |
| --- | --- |
| `apps/desktop/assets/icon-macos.png` | 1024px pre-Tahoe macOS icon, with Dock margins |
| `apps/mobile/assets/icon.png` | 1024px opaque square, no mask or margins |
| `apps/mobile/assets/adaptive-icon.png` | Android foreground, transparent; bot 820px wide, centered, 179px from the top |
| `apps/mobile/assets/icon-background.png` | Android background in the dark background token |
| `apps/mobile/assets/monochrome-icon.png` | Android themed-icon silhouette with transparent eyes |

Android applies its own mask, so don't bake corners, a rim, or a shadow into the adaptive layers.
