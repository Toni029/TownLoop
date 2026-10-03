# TownLoop rendered comparison evidence

Left: current TownLoop web reference. Right: actual React Native components rendered in the isolated Expo web preview. Both are 390×844 at the same clock/date and content. These are **not physical-device captures**. Fixture content exists only in the disposable verification browser and is not written to Firebase or bundled as production fallback data.

| View | Light comparison | Dark comparison |
| --- | --- | --- |
| Home + shared shell | [Home](home-comparison.png) | [Home dark](home-dark-comparison.png) |
| News | [News](news-comparison.png) | [News dark](news-dark-comparison.png) |
| Work Orders | [Work Orders](workorders-comparison.png) | [Work Orders dark](workorders-dark-comparison.png) |
| Social discussion | [Social](social-comparison.png) | [Social dark](social-dark-comparison.png) |
| Marketplace | [Marketplace](market-comparison.png) | [Marketplace dark](market-dark-comparison.png) |
| Recurring calendar | [Calendar](home-calendar-comparison.png) | — |
| Pinned News | [Pinned News](news-highlights-comparison.png) | — |
| Expanded work order | [Expanded ticket](workorders-expanded-comparison.png) | — |
| New work order sheet | [Request sheet](workorders-sheet-comparison.png) | [Request sheet dark](workorders-sheet-dark-comparison.png) |
| New community post sheet | [Post sheet](social-sheet-comparison.png) | [Post sheet dark](social-sheet-dark-comparison.png) |
| New listing sheet | [Listing sheet](market-sheet-comparison.png) | [Listing sheet dark](market-sheet-dark-comparison.png) |

The matching `*-web.png` and `*-native.png` files retain each original capture. Static captures use reduced motion. See [the complete review](../../VISUAL_PARITY.md) for checkpoints, validation, remaining native-rendering differences and required device acceptance.
