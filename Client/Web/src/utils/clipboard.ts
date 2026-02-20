/**
 * Clipboard API with fallback for non-secure contexts (HTTP + IP address).
 * navigator.clipboard is undefined outside Secure Context.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback: execCommand (deprecated but works in non-secure contexts)
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
