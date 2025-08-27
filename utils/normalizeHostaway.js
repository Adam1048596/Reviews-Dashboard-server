// Specialist for Hostaway API data
const normalizeHostaway = (raw) => {
  let overallRating = raw.rating;
  // Calculate an average if overall rating is missing
  if (!overallRating && raw.reviewCategory?.length > 0) {
    const sum = raw.reviewCategory.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / raw.reviewCategory.length;
    overallRating = Number(average.toFixed(1)); // <-- ROUND HERE
  }

  return {
    id: raw.id,
    channel: "hostaway",
    property: raw.listingName,
    reviewer: raw.guestName,
    type: raw.type,
    status: raw.status,
    ratingOverall: overallRating || null,
    ratingsByCategory: Object.fromEntries(
      (raw.reviewCategory || []).map((c) => [c.category, c.rating])
    ),
    text: raw.publicReview,
    submittedAt: new Date(raw.submittedAt).toISOString(),

    publicDisplay: Boolean(raw.PublicDisplayStatus)
  };
};

// Export this specialist
module.exports = { normalizeHostaway };