export function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Only http(s) and protocol-relative URLs are linkified/embedded — this content
// can originate from arbitrary fetched web pages or user input, so schemes like
// javascript: are deliberately excluded rather than passed through into href/src.
const SAFE_URL = "(?:https?:\\/\\/[^\\s)]+|\\/\\/[^\\s)]+)";
const IMAGE_RE = new RegExp(`!\\[([^\\]]*)\\]\\((${SAFE_URL})\\)`, "g");
const LINK_RE = new RegExp(`\\[([^\\]]+)\\]\\((${SAFE_URL})\\)`, "g");

// Expects already-HTML-escaped input; returns HTML with inline markdown applied
// (code, images, links, bold, italic, strikethrough).
export function inlineMarkdown(escaped){
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(IMAGE_RE, '<img src="$2" alt="$1" loading="lazy">')
    .replace(LINK_RE, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
}

// Escapes raw text then applies inline markdown — for rendering untrusted
// plain-text fields (e.g. a to-do item) that support a bit of inline styling.
export function renderInline(text){
  return inlineMarkdown(escapeHtml(text));
}
