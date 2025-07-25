/**
 * Formats a rating number to display without unnecessary decimal places
 * @param {number} rating - The rating value to format
 * @returns {string} - Formatted rating string
 * 
 * Examples:
 * formatRating(4.0) -> "4"
 * formatRating(4.2) -> "4.2"
 * formatRating(0.0) -> "0"
 * formatRating(1.0) -> "1"
 */
export const formatRating = (rating) => {
  if (rating === null || rating === undefined || isNaN(rating)) {
    return "0";
  }
  
  // Convert to number and round to 1 decimal place
  const roundedRating = Math.round(rating * 10) / 10;
  
  // If it's a whole number, return without decimal
  if (roundedRating % 1 === 0) {
    return Math.floor(roundedRating).toString();
  }
  
  // Otherwise return with one decimal place
  return roundedRating.toFixed(1);
}; 