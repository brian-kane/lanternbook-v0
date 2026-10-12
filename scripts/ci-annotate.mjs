// Prints an error so it shows as an annotation in GitHub Actions and as plain stderr elsewhere.
export function reportError(message) {
  if (process.env.GITHUB_ACTIONS) console.log(`::error::${message.split('\n').join('%0A')}`);
  console.error(message);
}
