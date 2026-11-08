# Mailing Android — Gmail-style design system and screen specification

## 1. Purpose and design authority

This is the text specification for a future native Android UI. It is intended to tell an implementation AI what screens to build, what each screen contains, the order of content, how controls look, and what actions they perform. It does not create an Android project or implement app code.

**Visual authority:** [UiClones — Gmail Clone V1.0 (Community), Figma](https://www.figma.com/design/xDK6ikbfCD7ZQ7xVgKxid3/UiClones---Gmail-Clone---V1.0--Community-?node-id=2-16). Use its `iOS v1.0` screen page plus `Colour`, `Icons`, `Typography`, and `Components` pages as the visual source. The file is a Gmail clone; use Gmail's mobile information hierarchy and visual language throughout the Android app.

**Product authority:** Mailing's source code is consulted only to identify features, fields, routes, supported actions, and API data. Do not copy Mailing web styling, CSS tokens, screenshot, layout, component appearances, or desktop three-pane structure. Product identity and feature names stay Mailing; the UI follows Gmail.

**Screen reference:** [Gmail-style Android concept sheet](./android-screen-references-gmail-style.png) is an illustrative AI-generated concept, not an exported Figma screen. If it conflicts with Figma, follow Figma. Do not use any Mailing web screenshot as a visual reference.

The first user-facing screen without a valid session is Sign in. The launch/session gate is only a brief routing check; do not show a splash screen before auth as the normal startup UI.

See the [screen reference gallery](./SCREEN_REFERENCES.md) for visual concepts of every remaining screen family.

### What is known and what is not

- The Figma file contains a Gmail-style mobile screen family and design system pages for color, icons, typography, and components. Visible screen/component names include Inbox, Menu, Labels, Change Labels, Settings, Compose Email, Reply, Account, Add Account, Start, Create Account, and Launch Screen.
- The Figma color page visibly uses a blue project color, red, black, a gray ramp, semantic red/green/yellow/blue, and pale surfaces/effects. A screen-section fill is `#F5F4F7`; the Figma page canvas is `#F5F5F5`.
- The Figma typography page shows sans-serif text styles at 32, 26, 24, 20, 18, 16, 15, 14, and 13, with regular, bold, semibold, and light examples; Button 16; Caps 14 and 13.
- Individual color swatch values and the font family name were not readable in the reference preview. Read the actual Figma styles if available; do not substitute Mailing web colors or guess a different brand palette.
- The Figma screens are labeled iOS. Reproduce their visual language on Android while respecting Android system bars, safe insets, touch targets, keyboard, system Back, and native share/file picker behavior.

## 2. Design system

### 2.1 Visual principles

1. Make every screen look like the Gmail mobile reference: Gmail-style search, folder drawer, message rows, rounded fields/chips, blue selection and primary actions, familiar outline icons, and restrained dividers.
2. Use a bright neutral canvas with white content surfaces and a soft blue-gray selected/search surface. Use the actual Figma swatches when available.
3. Show email content with Gmail's information priority: sender and subject first, snippet second, timestamp and star aligned to the trailing edge.
4. Keep most screens single-column. Use scrolling for long content. The inbox list and message detail are different screens; never recreate the web app's desktop three-pane layout.
5. Keep the design clean and dense enough for email, but preserve readable body text and comfortable touch targets.
6. Reuse the same Gmail-style field, button, chip, row, avatar, app bar, drawer, bottom navigation, and dialog language across every feature, including Mailing-specific Contacts, Automations, Settings, Help, and Docs screens.
7. Do not use Mailing web styling, including its black/white primary-button treatment, web sidebar appearance, CSS radii, web typography tokens, or desktop panel proportions.
8. Do not use Google/Gmail logos, Gmail product name, or unsupported Gmail destinations such as Chat, Meet, or Spaces. The brand label remains Mailing.

### 2.2 Color roles

Use Figma's color styles as the source of exact values. Color names below are semantic roles; they are not new hex values.

| Role | Applied to | Appearance from reference |
|---|---|---|
| Primary blue | Send, selected destination, active icon, links, focus | Use Figma's blue project/UI swatch. |
| On-primary | Label/icon over blue action | White or Figma's paired foreground. |
| App background | Behind screens and system-safe areas | Figma pale neutral; canvas observed `#F5F5F5`. |
| Content surface | Message rows, form surfaces, cards, dialogs | White/light neutral. |
| Soft surface | Search capsules, selected rows, active nav background | Pale blue-gray; selected Inbox section fill observed `#F5F4F7`. |
| Primary text | Sender, subject, titles, field values | Near-black. |
| Secondary text | Preview, timestamp, supporting copy | Medium neutral gray. |
| Divider | Message row separators and field rules | Light, low-contrast gray. |
| Destructive | Trash/delete/error | Figma red semantic swatch. |
| Success | Verified/complete state | Figma green semantic swatch. |
| Warning | Warning/pending state | Figma yellow semantic swatch. |
| Star | Starred state | Use the Figma Gmail star icon/color treatment. |

Do not use values from `app/globals.css` as fallback tokens. If the Figma swatch itself is unavailable to the implementing AI, state that limitation and request/resolve the Figma value instead of importing Mailing's palette.

### 2.3 Typography

Use the Figma typography page's named styles and weights. Map them to Android `sp` in implementation; the numeric labels below describe the visible scale and are not claimed to be Android units in the source file.

| Purpose | Figma reference size/weight | Usage |
|---|---|---|
| Large display | Regular 32 | Optional launch/onboarding emphasis only. |
| Screen title | Regular 24/26 or Bold/Semibold 18 | Main page headings; use the Gmail screen's actual title hierarchy. |
| Section title | Semibold 14/16/18 | Settings sections, contact groups, workflow groups. |
| Main content | Regular 16 | Message body and primary field values. |
| Secondary content | Regular 14/15 | Sender email, explanatory copy, recipient details. |
| Metadata | Regular/Light 13/14 | Timestamp, preview, helper text, compact labels. |
| Button | Button 16 | Main and secondary actions. |
| Eyebrow | Caps 13/14 | Optional small section labels; use sparingly. |

Use the exact font family and style names from Figma when inspectable. If the file does not expose the family, use the platform sans-serif as a temporary implementation choice and record that choice; do not use the Mailing web font configuration as a visual requirement. Body text should wrap naturally. Truncate only inbox snippets and secondary metadata.

### 2.4 Layout, shape, and elevation

- Treat Figma's mobile frames as the layout guide; convert screen-safe areas and touch behavior to Android.
- Use a 4dp spacing rhythm as an Android implementation convention. Start with 16dp horizontal screen gutters and 8dp gaps within compact groups; refine to match the actual Figma frames.
- Search is a prominent rounded capsule. Fields and chips use the rounded treatment shown in the Figma components. Use rounded rectangles/pills for actions where shown; do not replace them with generic square web buttons.
- Inbox rows are flat, separated by subtle lines or tonal surfaces. Selected/unread emphasis must remain obvious without relying on color alone.
- Reserve elevation for floating Compose action, modal surfaces, and overlays. Prefer surface color and dividers for ordinary content.
- Use the Figma icon family consistently: familiar Gmail/mail metaphors, consistent outline weight, clean monochrome inactive icons, blue active icons. Use filled style only for selected/active states shown by the reference.
- Android touch targets should be at least 48dp even when the visible icon is smaller. Provide a spoken label for every icon-only button.
- Use native status/navigation bars, keyboard insets, Back behavior, and pickers; do not draw fake system chrome inside the app screen.

### 2.5 Shared Gmail-style components

- **Top app bar:** menu/back at start; title or search capsule; account avatar and context actions at end. On detail/compose, show navigation and message actions appropriate to that screen.
- **Search capsule:** leading search icon, query text, optional clear/filter action; rounded soft-surface container.
- **Navigation drawer:** account header/switcher; New message; folder destinations; custom labels; remaining workspace destinations. Selected item uses a pale blue shape and blue icon/text.
- **Bottom navigation:** Mailing destinations Mail, Contacts, Automations, Settings, styled like the selected/unselected navigation treatment in Figma. Do not use Gmail-only Chat/Meet/Spaces labels.
- **Conversation row:** avatar/initials, sender, subject, short snippet, trailing timestamp/star, subtle unread and selected states.
- **Message header:** sender avatar, sender name, recipient summary, timestamp, overflow; subject remains above the message thread.
- **Pill/chip:** selected filter/folder state, label, or status. Keep copy short and color restrained.
- **Compose editor:** full-height phone surface; recipient rows, subject, body, attachment/formatting toolbar, prominent Send action.
- **Feedback:** inline validation, small snackbar/toast for success, loading indicator/skeleton, focused empty state, and confirmation dialog for irreversible actions.

## 3. App navigation tree

```text
Mailing
├── Launch / session routing
├── Sign in
├── Create account
├── Workspace setup
│   ├── Profile
│   ├── Sending defaults
│   ├── Resend connection
│   └── Workspace sync
└── Main Gmail-style app shell
    ├── Bottom navigation
    │   ├── Mail
    │   ├── Contacts
    │   ├── Automations
    │   └── Settings
    ├── Navigation drawer
    │   ├── Account switch/profile menu
    │   ├── New message
    │   ├── Inbox
    │   ├── Starred
    │   ├── Sent
    │   ├── Drafts
    │   ├── Archive
    │   ├── Trash
    │   ├── Custom labels
    │   ├── Contacts
    │   ├── Automations
    │   ├── Profile
    │   ├── Help
    │   └── Docs
    ├── Mail list (folder/label/search/filter state)
    │   ├── Message/thread detail
    │   │   └── Reply / Forward compose
    │   └── New compose
    ├── Contacts list / add contact
    ├── Automations list / history
    │   └── Workflow detail / builder
    ├── Settings sections
    └── Profile / Help / Docs / Not found
```

### Navigation behavior

- Bottom navigation switches among Mail, Contacts, Automations, and Settings.
- The drawer exposes all folders, labels, and less-frequent destinations. Folder/label selection closes the drawer and updates the Mail list.
- Opening a conversation pushes Message Detail. Back returns to the same folder and restores its previous scroll position and query.
- Compose opens as a full-screen screen (preferred for Android keyboard/accessibility) or a full-height sheet. Do not use a draggable/resizable desktop compose window.
- Android Back closes an open drawer/dialog/sheet first; next it pops detail or builder; then it returns to the prior destination.

## 4. Screen-by-screen specification

For every screen, the hierarchy is top-to-bottom. `Shared shell` means Gmail-styled app bar/navigation/components described above. The behaviors and data are from Mailing product features; their appearance must still follow the Gmail design system.

### 0. Launch / session gate

**Purpose:** route the user without exposing a blank or incorrect screen.

**Hierarchy:** native system bars → centered Mailing envelope mark → short progress indicator only while checking session.

**Initial unauthenticated state:** after the brief session check, render the Sign in screen directly. The splash is only transient loading, not the app's starting page.

**Behavior:** valid and configured session → Inbox; valid but incomplete setup → Workspace Setup; no session → Sign in. Avoid decorative delay or fake progress. Figma has a Launch Screen component family; use that visual treatment.

### 1. Sign in — `/login`

**Hierarchy:** centered Mailing envelope and name → title and one-line intro → rounded form surface → Email field → Password field with reveal icon → full-width blue Sign in button → Create account text link → inline error/loading status.

**Look:** use the custom envelope hero illustration in `auth-start-screen.png` as the screen's visual anchor. Place the compact Mailing wordmark at the top, the hero in the upper third, then the title/supporting line and Gmail-style form controls. Keep the distinctive illustration on this entry screen; secondary screens can stay quieter. Use rounded fields and clear blue primary action; do not reference Mailing web login styling.

**Behavior:** require valid email and password; disable submit while empty/loading; preserve email on failure; route to setup or Inbox after successful auth. Product fields/behavior source: `app/login/page.tsx`.

### 2. Create account — `/register`

**Hierarchy:** Mailing brand mark/name → title and short intro → rounded form surface → Full name → Email → Password with reveal icon → full-width blue Create account button → Sign in link → inline error/loading status.

**Behavior:** validate required fields and the product password rule; preserve entered values on server failure; continue to Workspace Setup on success. Product source: `app/register/page.tsx`.

### 3. Workspace Setup — `/onboarding`

**Hierarchy:** Mailing mark → compact three-step progress indicator → active step title/help text → step fields → Back/Continue or Connect action → inline validation. On Android, use a compact horizontal/vertical stepper that fits the phone; match Gmail/Figma form surfaces.

1. **Your Profile:** name → optional avatar picker and preview → Continue.
2. **Sending Defaults:** sender name → from address → reply-to address → Continue.
3. **Integration:** Resend API key → inbound webhook secret (masked initially) → Connect/Save → connection result.
4. **Workspace Sync state:** title and short explanation → progress animation while existing mail sync runs.

**Behavior:** retain values between steps; validate required inputs; mask credentials; never put credentials in error copy/log output; show recoverable verification errors without clearing fields. Product source: `app/onboarding/page.tsx`.

### 4. Main application shell

**Hierarchy:** native status bar → Gmail-style top bar → current screen content → Gmail-style bottom navigation. Drawer overlays from the leading edge and contains account summary/switcher, New message, Mail folders, Labels, workspace pages, Profile, Help, Docs, and Sign out.

**Look:** use Figma's Gmail drawer and nav item treatment. Do not reuse the Mailing web sidebar or its collapse behavior.

### 5. Mail list — Inbox, Starred, Sent, Drafts, Archive, Trash, Label

**Hierarchy:**

1. App bar/search capsule: menu icon, prominent search, account avatar; active folder title can sit beneath or replace the search bar following the Figma Inbox frame.
2. Optional category/filter chips. Product filters are **All** and **Unread**; do not invent Gmail categories such as Promotions/Social unless the product data supports them.
3. Optional selection/action bar while one or more conversations are selected.
4. Scrollable conversation rows: avatar/initials → sender → subject → one-line snippet; timestamp and star aligned at trailing edge; optional label/status chip.
5. Gmail-style Compose floating pill/button above the bottom navigation.
6. Bottom navigation: Mail, Contacts, Automations, Settings.

**Row look:** compact Gmail sender-first hierarchy; use natural whitespace and subtle row dividers. Unread rows use stronger type weight; selected row uses a pale blue surface; star state is visible at a glance. Never use the web app's checkbox-first desktop row layout.

**Actions:** tap row opens Message Detail; star toggles in place; long press selects; bulk mode provides supported archive/trash/read/unread/label actions. Search matches sender name/email, subject, and preview. Pull down refreshes; scrolling to the end loads more.

**Folder differences:**

| Folder | Unique screen information/actions |
|---|---|
| Inbox | Default incoming conversations; unread emphasis; archive, trash, read/unread, star, label. |
| Starred | Starred conversations; unstar, archive, trash, read/unread, label. |
| Sent | Sent conversations; show recipient and sent time where appropriate. |
| Drafts | Draft indicator; tap opens that draft in Compose; delete draft. |
| Archive | Archived conversations; restore to Inbox, trash, read/unread, label. |
| Trash | Deleted state; Restore and Permanently Delete; Empty Trash with confirmation. |
| Custom label | Label identity and matching conversations; remove/apply labels; retain standard message actions. |

**States:** loading rows, first-use empty message with relevant next action, no search matches, refresh progress, pagination progress, retryable error. Keep folder/query/filter/scroll state when returning from details.

**Product behavior sources:** `components/mail-list-pane.tsx`, `components/mail-list/email-row-item.tsx`, `hooks/use-mail-list-data.ts`, `lib/mail-actions.ts`, `components/mail-sidebar.tsx`.

### 6. Search results / active search state

This is a Mail list state, not a separate permanent destination.

**Hierarchy:** search capsule with entered query and clear button → optional filter action → result count/status → same Gmail-style conversation rows → empty/no-results state.

**Behavior:** search sender, subject, and preview; clearing the query restores the current folder list. Changing folder clears selection and preserves product-appropriate search semantics.

### 7. Message / thread detail

**Hierarchy:**

1. App bar: Back → Archive → Trash → More. More menu contains supported read/unread, star, labels, move/restore, and delete actions for the current folder.
2. Subject → label chips → star state.
3. Thread messages in chronological order. Each message header has circular avatar, sender name, recipient summary, time, and expand/collapse control.
4. Expanded message content with readable plain text or safe HTML.
5. Attachment rows/cards with filename, type/size, and open/download action.
6. Reply and Forward actions at the end of the thread; reply editor can expand inline or open Compose.

**Look:** Gmail message-reading hierarchy from Figma. Keep the subject prominent, message body uncluttered, action icons in the top bar, sender metadata compact.

**Behavior:** opening marks unread mail read; preserve thread position; allow supported star/label/archive/trash/restore/reply/forward actions; confirm permanent deletion. Treat remote HTML as untrusted content: it must not invoke app navigation or native actions.

**Product sources:** `components/mail-detail-pane.tsx`, `components/mail-thread-hierarchy.tsx`, `components/email-html-frame.tsx`.

### 8. Compose — new, reply, and forward

**Hierarchy:**

1. Gmail-style compose top bar: Back/close → optional title → Send action → More.
2. To row; expand Cc/Bcc on request.
3. Subject row.
4. Large plain/rich message body.
5. Attachment chips/list with filename, size, and remove action.
6. Bottom formatting/attachment actions above the keyboard.

**Look:** use Figma Compose Email and Reply frames: uncluttered white editor, thin separators, clear blue Send action, full-height phone layout. Do not recreate Mailing's floating/resizable desktop panel.

**Behavior:** contact autocomplete where available; validate recipient; keep draft values after errors; disable Send when no recipient or while sending; show progress and success/error; support attach/remove and image compression; Back with unsent content saves draft or asks before discarding. Reply pre-fills the sender and thread subject; Forward includes forwarded content. Product source: `components/compose-panel.tsx`.

### 9. Labels — drawer and label management

**Drawer hierarchy:** Labels section title → Add label icon action → label rows with tag icon, name, optional count, selected state. Selecting a label opens Mail list with that label.

**Create flow:** Gmail-style dialog/sheet → label name field → Create/Cancel. Reject blank labels, show duplicate/API error inline.

**Delete flow:** confirmation dialog naming the label and stating that messages remain. System/default labels cannot be deleted. Product source: `components/mail-sidebar.tsx`.

### 10. Contacts — `/contacts`

**Hierarchy:** Gmail-style top bar → Contacts title → search capsule → Add contact action → list of contact rows/cards. Each row has avatar/initials, name, email, optional note, and More action. Empty state contains short explanation and Add contact CTA. Add form fields: Full name, Email, Notes. Delete uses confirmation.

**Behavior:** filter by name/email; show loading, no contacts, no matches, and recoverable error states. Keep only fields supported by the product. Use Gmail visual language for rows, forms, menus, and dialogs. Product source: `components/site-pages.tsx` ContactsPanel.

### 11. Automations — `/automations`

**Hierarchy:** Gmail-style app shell → Automations title and concise description → History action → blue New workflow action → optional starter-template row/cards → automation list. Each workflow row/card contains name, enabled/disabled status, summary/trigger, and More menu.

**Supported actions:** open/edit, enable/disable, duplicate, delete, test run, open history. Confirm deletion. Show loading, empty, and retryable error states. Keep the Figma Gmail typography, surfaces, row/card treatment, and icon weights even though this feature is unique to Mailing.

**Product sources:** `components/automations/automation-page.tsx`, `automation-list.tsx`, `automation-card.tsx`.

### 12. Automation builder/detail — `/automations/{automationId}`

**Hierarchy:** app bar Back → editable workflow name → enabled toggle → Save/Test/More actions → workflow steps/canvas → add-step/node control → node picker → selected node configuration → variable picker as needed.

**Look:** use Gmail surfaces, text, buttons, icons, menus, and dialogs. The Figma Gmail reference does not define a workflow editor; do not imitate Mailing web canvas styling as a shortcut.

**Mobile behavior:** the web graph canvas is not a suitable phone layout by default. Prefer a readable vertical step list with Add step and a dedicated node configuration screen. If true graph editing is required, use a separately specified zoom/pan canvas with accessible controls; do not shrink a desktop canvas to fit.

**Validation:** preserve trigger/action order; show missing or invalid fields beside the step; allow supported save/test actions; show recoverable errors. Product sources: `components/automations/automation-builder.tsx`, `workflow-canvas.tsx`, `node-picker.tsx`, `node-config-panel.tsx`, `variable-picker.tsx`.

### 13. Automation execution history and details

**Hierarchy:** app bar Back to Workflows → History title → chronological run rows with workflow name, status, time, and summary → selected run detail with step trace, inputs/outputs, and errors → Retry action if supported.

**Look:** Gmail list-row hierarchy and status chips from Figma. Use semantic color plus text/icon so success/failure is not color-only.

**Behavior:** retry only the selected eligible run; show loading, empty, and error states. Product sources: `components/automations/execution-history.tsx`, `execution-details.tsx`.

### 14. Settings — `/settings`

**Hierarchy:** app bar → Settings title → Gmail-style tab/section selector → selected settings content.

- **Sending Defaults:** sender name → from address → reply-to address → Save.
- **Resend Infrastructure:** API key with masked/reveal control → webhook secret with masked/reveal control → verification status/domain list → Verify Connection and Save.
- **Danger Zone:** visually separated destructive/reset actions → clear explanation → confirm dialog.

**Behavior:** retain unsaved values when switching sections; validate inline; mask secrets initially; never expose secrets in logs or generic error messages; show verification/saving result. Keep Mailing data/functions but render every component with Gmail Figma forms, tabs, buttons, cards, statuses, and dialogs. Product source: `components/site-pages.tsx` SettingsPanel.

### 15. Profile — `/profile`

**Hierarchy:** app bar → Profile title → avatar and change action → name fields → account email (read-only if auth provider requires) → supported credential controls → Save.

**Behavior:** validate name and image; show avatar preview; preserve edits on failure; use the existing auth provider's supported credential flow. Visual treatment must follow Gmail account/profile screens in Figma. Product source: `components/site-pages.tsx` ProfilePanel.

### 16. Help — `/help`

**Hierarchy:** app bar → Help & Resources title → short common help section → Documentation link/card → Automations help link/card.

**Behavior:** replace desktop keyboard shortcuts with Android navigation/touch guidance. Do not show Mac/Windows-only shortcuts as primary phone content. Use Gmail list/card/typography treatment. Product source: `components/site-pages.tsx` HelpPanel.

### 17. Documentation index and articles — `/docs`, `/docs/*`

**Index hierarchy:** Mailing Docs title bar → short introduction → quick links for Custom Domain, API Keys, Webhooks → next/previous article controls.

**Article hierarchy:** top bar/back → article title → ordered instructions and illustrations → previous/next navigation.

**Behavior:** render article content in a readable single column or open the existing documentation route. Style the shell and controls like Gmail; keep technical content intact. Product pages: setup domain, API keys, webhooks, and user guides for overview, inbox, contacts, automations, settings.

### 18. Not Found / unavailable content

**Hierarchy:** centered simple status icon → short title/message → blue Return to Inbox action.

**Behavior:** unknown route or deleted/missing message must show a safe recovery route instead of a blank screen.

## 5. Screen states and interaction requirements

- Every network-backed screen has loading, content, empty, and recoverable-error states.
- Search filters by sender, subject, and preview. All/Unread filter selection remains visible and accessible.
- Folder selection closes the drawer. Message detail Back restores list scroll and query.
- Long-press selection exposes supported bulk actions; selected state uses shape/surface and label as well as color.
- Pull-to-refresh and pagination are available on mail lists.
- Permanent delete, empty trash, contact delete, and custom-label delete require a confirmation dialog.
- Keep compose fields if sending fails. Do not silently discard a draft.
- Use snackbars/toasts for success and undoable actions; show inline field errors for invalid input.
- Use platform back, keyboard, file picker, and system safe areas. All icon-only actions need accessibility labels.

## 6. Product/API map for a later implementation

This section is for data/functionality only. It does not supply visual styles.

| Screen | Existing product data/action source |
|---|---|
| Sign in / Create account | Better Auth under `/api/auth/*` |
| Workspace Setup | `POST /api/v1/onboarding` |
| Mail list/detail/actions | `/api/v1/messages`; `/api/v1/messages/{id}`; action routes for archive, trash, restore, read, star, labels, and bulk |
| Compose/drafts | `POST /api/v1/messages`; `/api/v1/drafts` |
| Labels | `/api/v1/labels`, `/api/v1/labels/{label}` |
| Contacts | `/api/v1/contacts`, `/api/v1/contacts/{contactId}` |
| Settings | `/api/v1/settings` |
| Automations | `/api/v1/automations`, `/api/v1/automations/{automationId}`, `/api/v1/automations/history`, `/api/v1/automations/tools` |

The repository has no native Android project, auth strategy, networking layer, or persistence. Confirm session/token compatibility before connecting the Android client to protected endpoints or sending email.

## 7. Implementation source map

Use these paths only to understand supported product behavior, fields, labels, and actions. **Do not copy their visual styling.**

- Auth and setup behavior: `app/login/page.tsx`, `app/register/page.tsx`, `app/onboarding/page.tsx`.
- Mail data/actions: `hooks/use-mail.ts`, `hooks/use-mail-list-data.ts`, `lib/mail-actions.ts`, `components/mail-list/email-row-item.tsx`.
- Message/thread and compose behavior: `components/mail-detail-pane.tsx`, `components/mail-thread-hierarchy.tsx`, `components/compose-panel.tsx`.
- Labels: `components/mail-sidebar.tsx`.
- Contacts/Profile/Settings/Help behavior: `components/site-pages.tsx`.
- Automations behavior: `components/automations/automation-page.tsx`, `components/automations/automation-builder.tsx`, and other files in `components/automations/`.
- Docs route inventory: `app/docs/`.
- Primary visual source: the linked Gmail Clone Figma file above.

