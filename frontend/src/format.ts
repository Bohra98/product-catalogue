// Fake Store prices carry no currency; we assume USD (see DECISIONS.md).
const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const formatPrice = (value: number) => price.format(value);

export const formatRating = (rate: number, count: number) =>
  `${rate.toFixed(1)} out of 5 (${count} ${count === 1 ? 'rating' : 'ratings'})`;
