# Accessibility and feature access

This revision addresses both meanings of access: the app's supported workflows are reachable from the interface, and the interface is designed for keyboard and screen-reader use. This document describes the intended behavior and a practical verification path. It is not a WCAG conformance certificate.

## Keyboard path

1. Open the app through its local server. Press `Tab` to reach the skip link and `Enter` to move to the main content.
2. Use `Tab` and `Shift+Tab` to move between links, buttons, and fields. Activate buttons with `Enter` or `Space`; use the arrow keys within native select controls. A visible outline identifies the current focus.
3. Create a session. Each field has a label; related fields are grouped. Use the guided evidence form to avoid composing JSON for routine input.
4. Load an example, submit a diagnosis, and read the resulting message and heading. Open disclosure controls with `Enter` or `Space` to inspect additional details.
5. Record a revision, open saved sessions, resume the session, view history, and activate the JSON export button. The browser controls where the downloaded file is saved.
6. Navigate to the knowledge library, browse and search its entries, then open help and service status. Use ordinary links to open API documentation.

No drag action, hover-only menu, or pointer gesture is required for these workflows. Advanced JSON remains available for full evidence structures and integration work.

## Screen-reader and display considerations

- The page identifies its Chinese language and uses headings, navigation, a main landmark, native controls, and named form fields.
- Status and error messages use live announcement regions. Messages describe the result in text; color is supplementary.
- Validation feedback should identify the field or input that needs attention. Preserve entered data while correcting an error.
- Content is arranged to reflow on narrow screens. Long identifiers and JSON should remain inspectable without making the whole page unnecessarily wide.
- Keyboard focus must remain visible, including after navigating between views. Motion is limited and reduced-motion preferences are respected where animation is present.
- The API documentation is supplied by third-party Swagger UI/ReDoc. Its accessibility may differ from the custom app; the guided app is the main path for routine use.

These patterns draw on W3C guidance for [form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/) and [content reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## Validation scope

Automated browser and API checks can catch missing names, broken controls, and common accessibility violations. They cannot establish the quality of every spoken announcement, every keyboard sequence, or compatibility with every assistive-technology combination.

Before classroom deployment, repeat the workflow above with the screen readers and browsers your students use, such as VoiceOver with Safari and NVDA with Firefox or Chrome. Also check 200% zoom, a 320 CSS-pixel viewport (or equivalent 400% zoom), system high-contrast settings, and keyboard-only use. Confirm that:

- Every visible action can be reached and activated without a mouse.
- Labels, required fields, errors, loading states, and success messages are understandable when spoken.
- Focus moves predictably when a view changes or validation fails, with no keyboard trap.
- Text and controls remain visible and usable when zoomed; no content is clipped.
- The entire diagnosis-to-revision-to-history workflow works in rules mode with no API key.

No formal WCAG audit or full manual screen-reader compatibility certification has been performed. Include the browser, assistive technology, view, and reproduction steps when reporting an access problem.
