const fs = require("fs");
const path = require("path");
const express = require("express");
const axios = require("axios");
const router = express.Router();

// Import the normalization utility to transform Hostaway data into a consistent application-specific schema.
const { normalizeHostaway } = require("../utils/normalizeHostaway");

// Import mock data to be used as a fallback when the live API is unavailable, fails, or returns empty.
const mockReviews = require("../reviews.json");

// --- Hostaway API Configuration ---
// IMPORTANT: In a production environment, these values should be stored in environment variables (.env) for security.
const ACCOUNT_ID = "61148";
// NOTE FOR REVIEWERS/DEVS:
// The provided Hostaway endpoint returns a 405 Method Not Allowed error.
// As per the assignment requirements, we are to handle this scenario by falling back to mock data.
const HOSTAWAY_API_URL = `https://api.hostaway.com/v1/reviews?accountId=${ACCOUNT_ID}`;
const API_KEY = "f94377ebbbb479490bb3ec364649168dc443dda2e4830facaf5de2e74ccc9152"; // Hardcoded for demo purposes only.

/**
 * GET /api/reviews/hostaway
 * @description Fetches all reviews from the Hostaway API (or falls back to mock data),
 *              normalizes them into a standard format, and returns them.
 *              This is intended for an internal dashboard.
 * @returns {Object} JSON response containing status, data source, count, and an array of normalized reviews.
 */
router.get("/hostaway", async (req, res) => {
  let source; // Tracks the data source for transparency in the response
  let reviewsData = []; // Will hold the raw review data from either API or mock

  try {
    console.log(`Attempting to fetch live reviews from Hostaway API...`);

    // Attempt to call the live Hostaway API with a timeout to prevent hanging.
    const response = await axios.get(HOSTAWAY_API_URL, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      timeout: 10000, // 10-second timeout
    });

    // Validate the structure of the API response.
    if (response.data && response.data.status === "success" && Array.isArray(response.data.result)) {
      // Check if the API returned actual data or just an empty array.
      if (response.data.result.length > 0) {
        reviewsData = response.data.result;
        source = "Hostaway API";
        console.log(`Successfully fetched ${reviewsData.length} reviews from ${source}.`);
      } else {
        // Handle empty response from live API gracefully.
        console.warn("Live API returned an empty array. Falling back to mock data.");
        source = "mock (empty live response)";
        reviewsData = mockReviews.result;
      }
    } else {
      // Handle unexpected API response structure (e.g., different status, missing result array).
      const errorMessage = `Invalid API response structure. Received status: ${response.status}`;
      console.error(errorMessage, "Full response:", response.data);

      // Create a detailed error to be caught by the catch block, triggering the fallback.
      const validationError = new Error(errorMessage);
      validationError.type = "API_VALIDATION_ERROR";
      validationError.response = response;
      throw validationError;
    }
  } catch (error) {
    // Catch any errors: network failures, timeouts, validation errors, etc.
    source = "mock (API error)";
    console.error(`Hostaway API request failed: ${error.message}. Falling back to mock data.`);
    reviewsData = mockReviews.result; // Use mock data as a reliable fallback
  }

  // Process the retrieved data (whether from API or mock) through our normalization function.
  // This ensures a consistent data structure for the frontend, regardless of the source.
  const normalizedReviews = reviewsData.map(normalizeHostaway);
  console.log(`Sending ${normalizedReviews.length} normalized reviews (source: ${source}).`);

  // Send a standardized success response with metadata and the processed data.
  res.json({
    status: "success",
    source, // Informs the client where the data came from (useful for debugging)
    count: normalizedReviews.length,
    reviews: normalizedReviews,
  });
});

/**
 * GET /api/reviews/public
 * @description Fetches reviews and filters them to only return those marked for public display.
 *              This is intended for a public-facing website or widget.
 * @returns {Object} JSON response containing status, data source, count, and an array of public, normalized reviews.
 */
router.get("/public", async (req, res) => {
  let source;
  let reviewsData = [];

  // The data fetching logic is identical to the /hostaway endpoint.
  try {
    console.log(`Attempting to fetch live reviews from Hostaway API...`);

    const response = await axios.get(HOSTAWAY_API_URL, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      timeout: 10000,
    });

    if (response.data && response.data.status === "success" && Array.isArray(response.data.result)) {
      if (response.data.result.length > 0) {
        reviewsData = response.data.result;
        source = "Hostaway API";
      } else {
        source = "mock (empty live response)";
        reviewsData = mockReviews.result;
      }
    } else {
      const errorMessage = `Invalid API response structure. Received status: ${response.status}`;
      console.error(errorMessage, "Full response:", response.data);
      const validationError = new Error(errorMessage);
      validationError.type = "API_VALIDATION_ERROR";
      validationError.response = response;
      throw validationError;
    }
  } catch (error) {
    source = "mock (API error)";
    reviewsData = mockReviews.result;
  }

  // The key difference from the /hostaway endpoint:
  // 1. Normalize all reviews.
  const normalizedReviews = reviewsData.map(normalizeHostaway);
  // 2. Filter the normalized list to only include reviews where `publicDisplay` is true.
  const publicReviews = normalizedReviews.filter((r) => r.publicDisplay);

  console.log(`Sending ${publicReviews.length} public reviews (source: ${source}).`);

  res.json({
    status: "success",
    source,
    count: publicReviews.length,
    reviews: publicReviews,
  });
});

// -------------------- PATCH ROUTE FOR MANAGING REVIEW VISIBILITY --------------------
/**
 * PATCH /api/reviews/hostaway/:id/public
 * @description Toggles the public visibility of a specific review. Changes are persisted to the local reviews.json file.
 *              This provides a simple way to moderate reviews without a full database.
 * @param {string} id - The ID of the review to update, provided as a URL parameter.
 * @param {boolean} publicDisplay - The new visibility status, provided in the request body.
 * @returns {Object} JSON response indicating success/failure and the updated review object.
 */
const mockFilePath = path.join(__dirname, "..", "reviews.json"); // Construct absolute path to the mock data file.

router.patch("/hostaway/:id/public", (req, res) => {
  const { id } = req.params; // Extract the review ID from the URL
  const { publicDisplay } = req.body; // Extract the new visibility flag from the request body

  // Find the review in the in-memory mock data array.
  // Uses loose equality (==) to match string and number IDs, but consider strict (===) with type conversion for production.
  const review = mockReviews.result.find((r) => r.id == id);
  if (!review) {
    // If no review is found with the given ID, return a 404 error.
    return res.status(404).json({ success: false, message: "Review not found" });
  }

  // Update the review's visibility status in the in-memory object.
  // Note: This assumes the original mock data uses the key 'PublicDisplayStatus'.
  review.PublicDisplayStatus = publicDisplay;

  try {
    // Persist the entire updated mock data object back to the reviews.json file.
    // `null, 2` arguments format the JSON with 2-space indentation for readability.
    fs.writeFileSync(mockFilePath, JSON.stringify(mockReviews, null, 2), "utf8");
  } catch (err) {
    // Handle file system errors (e.g., permission issues, missing file).
    console.error("Error writing to reviews.json:", err);
    return res.status(500).json({ success: false, message: "Failed to persist changes" });
  }

  // Return a success response with the updated review object.
  res.json({
    success: true,
    message: `Review ${id} visibility updated`,
    review, // Sending back the updated review confirms the change to the client.
  });
});

// Export the router so it can be mounted by the main Express application.
module.exports = router;