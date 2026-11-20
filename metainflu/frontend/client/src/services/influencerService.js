// File: frontend/client/src/services/influencerService.js

import { API_BASE_URL } from '../lib/api';

// Note: nothing imports this service yet, and the Node backend has no /influencers routes.
const API_URL = `${API_BASE_URL}/influencers/`;

/**
 * Creates a new influencer profile.
 * @param {object} profileData - The influencer's profile data.
 * @param {string} token - The user's JWT token.
 * @returns {Promise<object>} - A promise that resolves with the created profile data.
 */
const createProfile = async (profileData, token) => {
  try {
    const response = await fetch(API_URL + 'profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create influencer profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Profile creation failed:', error);
    throw error;
  }
};

export default {
  createProfile,
};
