# Sign-in screen assets

## Reusable hero illustration

- File: [`assets/auth-envelope-hero.png`](./assets/auth-envelope-hero.png)
- Format: PNG with transparent background
- Use: the envelope artwork above the sign-in heading
- Suggested Compose size: `Modifier.fillMaxWidth().heightIn(max = 300.dp)` with `ContentScale.Fit`; adjust for short screens and avoid cropping the orbit.
- Suggested Android resource location when implementing: `app/src/main/res/drawable-nodpi/auth_envelope_hero.png`.
- Compose usage: `Image(painterResource(R.drawable.auth_envelope_hero), contentDescription = "Open blue envelope with a message")`.

Keep the Mailing wordmark, form labels, text fields, buttons, status bar, and navigation bar as native Compose elements. Use Material icons for the email, password, and visibility controls so they stay sharp, accessible, and interactive. The sign-in reference screenshot itself is not a screen background asset.

This is a generated recreation of the supplied hero artwork, not an export of the original Figma layer. The Figma reference remains the authority if exact source artwork becomes available.

## Mailing app mark

- File: [`assets/mailing-app-icon.png`](./assets/mailing-app-icon.png)
- Format: PNG with transparent corners around the blue rounded-square mark
- Use: compact icon next to the native “Mailing” wordmark in the sign-in header
- Suggested display size: `56.dp` square; use `ContentScale.Fit`.
- Suggested Android resource location: `app/src/main/res/drawable-nodpi/mailing_app_icon.png`.
- Compose usage: `Image(painterResource(R.drawable.mailing_app_icon), contentDescription = null)` when the adjacent “Mailing” wordmark already names the brand.

This is a generated recreation of the mark in the supplied screenshot, not an original logo export. For the launcher icon, create Android adaptive icon foreground/background resources from the approved brand mark instead of using this rounded-square PNG as a launcher foreground.
