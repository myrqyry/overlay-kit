# Color-driven Emote Wall entrances and exits

Color transitions are **animation choices**, not fixed material themes.
The emote's original artwork, its transparent alpha, modifiers/overlays,
material, color treatment and edge finish remain independently configurable.

In **Emote Wall → Wall • Movement**, choose:

| Entrance | What it does |
|---|---|
| Color Bloom (`color-bloom`) | A warm/cool alpha-following glow and saturated pulse that settles into the original art |
| Prism Reveal (`prism-reveal`) | Short cyan/rose color-separated fringes and a hue sweep, then precise original pixels |
| Pigment Wash (`pigment-wash`) | Grayscale/sepia pigment develops gradually into the configured colors |

| Exit | What it does |
|---|---|
| Color Drain (`color-drain`) | Colors wash out while the silhouette becomes a pale fading trace |
| Prism Dissolve (`prism-dissolve`) | Colors split into cyan/rose fringes, then fade and drift |
| Afterglow (`afterglow`) | A warm saturated flare gives way to a soft violet halo before fading |

For independent OBS sources, for example:
`wall.html?wallEnter=color-bloom&wallExit=afterglow&wallEnterMs=600&wallExitMs=450`

## Boundaries and lifecycle

These use the **existing** one-shot entrance/expiry lifecycles, not a new
connection or message renderer. The outer sprite still owns its movement
and placement. CSS transient filters on `.overlay-wall-visual` affect the
actual alpha of the combined emote, while the inner artwork's independent
material/color/edge filters still apply.

The color accents are intentional palettes, **not** sampled from arbitrary
third-party GIFs, and no cross-origin canvas read is attempted.
At the end of an entrance, the wrapper returns to `filter:none`, so a
Wall Color setting such as Warm, Vivid or Monochrome still behaves normally.
Exit completion releases the original entity exactly as existing exits do.
Moderation/deletion and clear stay immediate; capacity eviction is bounded.
Reduced-motion preference removes one-shot animations.

Filter and drop-shadow animation can cost more GPU work than simple fade/pop,
especially with many simultaneously animated layered GIFs. Conservative
default (`none`) remains unchanged, and native OBS CEF performance needs
separate stress verification.
