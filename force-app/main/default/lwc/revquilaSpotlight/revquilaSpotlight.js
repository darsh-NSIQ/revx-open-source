// Cursor spotlight for themed cards. A page wires its root element's pointermove
// and pointerleave to these; the .rq-card surface reads --rq-mx / --rq-my (see revquilaTheme).
let lit;

function dim(card) {
  card.style.removeProperty("--rq-mx");
  card.style.removeProperty("--rq-my");
}

export function moveSpotlight(event) {
  const card = event.target.closest(".rq-card");
  if (lit && lit !== card) {
    dim(lit);
  }
  lit = card;
  if (!card) {
    return;
  }
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--rq-mx", `${event.clientX - rect.left}px`);
  card.style.setProperty("--rq-my", `${event.clientY - rect.top}px`);
}

export function clearSpotlight() {
  if (lit) {
    dim(lit);
  }
  lit = null;
}