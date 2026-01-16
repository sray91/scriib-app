/**
 * Voice Profile Store
 *
 * Handles database operations for unified voice profiles.
 * Single source of truth for user voice characteristics.
 */

/**
 * Get the current voice profile for a user
 * @param {object} supabase - Supabase client
 * @param {string} userId - User UUID
 * @returns {object|null} Voice profile or null if not found
 */
export async function getVoiceProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('user_voice_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching voice profile:', error);
    throw error;
  }

  return data || null;
}

/**
 * Create or update a user's voice profile
 * @param {object} supabase - Supabase client
 * @param {string} userId - User UUID
 * @param {object} profileData - Voice profile data
 * @returns {object} Updated voice profile
 */
export async function upsertVoiceProfile(supabase, userId, profileData) {
  const { data, error } = await supabase
    .from('user_voice_profiles')
    .upsert({
      user_id: userId,
      ...profileData,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting voice profile:', error);
    throw error;
  }

  return data;
}

/**
 * Check if voice profile needs updating based on new content
 * @param {object} profile - Current voice profile
 * @param {object} newSources - New source counts
 * @returns {boolean} True if profile should be updated
 */
export function shouldUpdateProfile(profile, newSources) {
  if (!profile) return true;

  const currentSources = profile.analysis_sources || {};

  // Update if we have significantly more posts (5+ new posts)
  if (newSources.pastPostsCount > (currentSources.past_posts_count || 0) + 5) {
    return true;
  }

  // Update if we have new training documents
  if (newSources.trainingDocsCount > (currentSources.training_docs_count || 0)) {
    return true;
  }

  // Update if context guide has changed significantly
  if (newSources.contextGuideWords !== currentSources.context_guide_words) {
    return true;
  }

  // Update if profile is more than 7 days old
  const profileAge = Date.now() - new Date(profile.updated_at).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (profileAge > sevenDays) {
    return true;
  }

  return false;
}

/**
 * Get voice profile with validation for ghostwriter access
 * @param {object} supabase - Supabase client
 * @param {string} requestingUserId - User making the request
 * @param {string} targetUserId - User whose profile to fetch
 * @returns {object|null} Voice profile if access is valid
 */
export async function getVoiceProfileWithAccess(supabase, requestingUserId, targetUserId) {
  // If requesting own profile, just fetch it
  if (requestingUserId === targetUserId) {
    return getVoiceProfile(supabase, targetUserId);
  }

  // Check ghostwriter access
  const { data: accessLink, error: accessError } = await supabase
    .from('ghostwriter_approver_link')
    .select('id')
    .eq('ghostwriter_id', requestingUserId)
    .eq('approver_id', targetUserId)
    .eq('active', true)
    .single();

  if (accessError || !accessLink) {
    console.error('Ghostwriter access denied or not found');
    return null;
  }

  return getVoiceProfile(supabase, targetUserId);
}

/**
 * Update performance insights based on post performance
 * @param {object} supabase - Supabase client
 * @param {string} userId - User UUID
 * @param {object} insights - Performance insights to merge
 */
export async function updatePerformanceInsights(supabase, userId, insights) {
  const currentProfile = await getVoiceProfile(supabase, userId);

  if (!currentProfile) {
    console.warn('No voice profile found to update insights');
    return null;
  }

  const mergedInsights = {
    ...(currentProfile.performance_insights || {}),
    ...insights,
    last_updated: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('user_voice_profiles')
    .update({ performance_insights: mergedInsights })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating performance insights:', error);
    throw error;
  }

  return data;
}

/**
 * Create default voice profile structure
 * @returns {object} Default voice profile
 */
export function createDefaultProfile() {
  return {
    writing_style: {
      formality: 0.5,
      directness: 0.5,
      sentence_length_avg: 15,
      sentence_length_variance: 'medium',
      paragraph_style: 'medium'
    },
    tone: {
      primary: 'professional',
      secondary: 'approachable',
      emotional_range: []
    },
    vocabulary: {
      level: 'professional',
      industry_terms: [],
      signature_phrases: [],
      words_to_avoid: []
    },
    formatting: {
      uses_emojis: false,
      uses_hashtags: false,
      uses_line_breaks: true,
      preferred_hooks: [],
      cta_style: 'soft'
    },
    content_preferences: {
      expertise_areas: [],
      storytelling_style: 'personal anecdote',
      typical_post_length: 800
    },
    analysis_sources: {
      past_posts_count: 0,
      training_docs_count: 0,
      context_guide_words: 0,
      last_post_analyzed_at: null
    }
  };
}
