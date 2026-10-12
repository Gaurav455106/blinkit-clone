// Escape inside the campaign wizard used to close the whole sheet and throw away
// a half-built campaign, even when the student only meant to close a dropdown.
// The wizard's dropdowns are custom and can't be told apart reliably, so Escape
// never closes the sheet; the X button and Save as Draft still do.

/** onEscapeKeyDown for the wizard sheet. */
export function keepWizardOpenOnEscape(e: KeyboardEvent): void {
  e.preventDefault();
}
