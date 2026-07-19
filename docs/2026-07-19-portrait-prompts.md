# Portrait art prompts — for Mike's AI generator

*2026-07-19. The dialogue-portrait feature ships with code-drawn test art;
these prompts generate local replacements. **Policy (Mike, 2026-07-19):
generated art never ships in the repo** — drop images into the story's
gitignored `paint/assets-local/` (e.g. `penny.jpg`, `marzipan.jpg`) and the
paint module's overlay glob picks them up on your machine only (see
steep's `localPortrait` helper). The repo and the public deploy stay on the
code-drawn portraits.*

Any resolution works: the engine cover-fits into a 9:16 frame (logical
90×160) and the downscale-then-pixelated-upscale gives the chunky look for
free. Keep the face in the upper two-thirds; edges may crop.

## Shared style preamble (prepend to every prompt — Mike's working version)

> Flat green chroma key background. Pixel art character portrait, vertical
> 9:16, waist-up bust, in the style of a 1990s VGA point-and-click adventure
> dialogue close-up, limited muted colour palette, soft rim lighting,
> character turned slightly toward the viewer's right, no text, no border,
> no watermark.

The flat green background is the recommended path: `portraitImage()`
auto-detects a green screen (corner sampling) and keys it to transparency
with a despill pass, so the bust floats over the dimmed scene. Ordinary
backgrounds also work — they just render as a card.

Author everyone facing viewer-RIGHT. Under VN staging the hero stands stage
left (unmirrored, facing right toward the interlocutor) and the interlocutor
stands stage right (mirrored by the engine, facing left toward the hero) —
one authoring rule, and the pair face each other.

## Operation Steep

- **Penny Farthing** — a woman in her late twenties, short auburn crop with
  brass welding goggles pushed up into her hair, croupier's dark teal
  waistcoat over rolled-up white shirtsleeves, a few freckles, wry
  unimpressed smirk, sharp intelligent eyes. Spunky gadget genius who has
  already done the maths.
- **Baron Marzipan** — a broad gracious man in his sixties, swept silver
  hair, a moustache of some ambition, cream-coloured suit with a pink silk
  cravat and a small pink marzipan rose on the lapel, the serene smile of a
  confectionery magnate planning revenge on civilisation.
- **The barman** — a discreet man in his fifties, immaculate white bar
  jacket, black tie, silver hair with a perfect parting, the expression of
  someone who has seen everything and billed for none of it.
- **Mr. Fondant** (if he ever gets lines) — an enormous silent henchman
  nearly filling the frame, black bowler hat, tiny gentle eyes, a novelty
  necktie printed with little biscuits, faint melancholy.

## The Quince Tree (template)

- **The gardener** — a weathered patient man, wide straw hat worn low, green
  gardening apron over a faded red shirt, kind eyes under bushy grey brows,
  the calm of a slow season.

## Notes

- Static images are fine — the mouth-flap only applies to code-drawn
  portraits. (If we ever want talking images: generate a second
  mouth-open variant and extend `portraitImage` to a two-frame flip; noted
  in TODO if wanted.)
- Ask for several seeds per character and pick for palette harmony; the
  engine palette is muted VGA (wine reds, sea teals, brass golds).
