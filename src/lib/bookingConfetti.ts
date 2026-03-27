import confetti from 'canvas-confetti'

const COLORS = ['#C9963F', '#8B1A4A', '#F5EEE8', '#FF6B9D']

/** Rose-gold celebration — one burst, scheduled with requestAnimationFrame. */
export function fireBookingConfetti(): void {
  requestAnimationFrame(() => {
    confetti({
      particleCount: 110,
      spread: 78,
      origin: { y: 0.58 },
      colors: COLORS,
      ticks: 220,
      gravity: 0.95,
      scalar: 1,
    })
  })
}
