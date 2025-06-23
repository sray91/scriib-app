// Database operations for CoCreate API

// Fetch user's past posts from the database
export async function fetchUserPastPosts(supabase, userId) {
  try {
    const { data: posts, error } = await supabase
      .from('past_posts')
      .select(`
        id,
        content,
        published_at,
        metrics,
        post_type,
        post_url
      `)
      .eq('user_id', userId)
      .eq('platform', 'linkedin')
      .order('published_at', { ascending: false })
      .limit(20); // Analyze up to 20 recent posts for voice

    if (error) {
      console.error('Error fetching past posts:', error);
      return [];
    }

    return posts || [];
  } catch (error) {
    console.error('Error in fetchUserPastPosts:', error);
    return [];
  }
}

// Fetch user's training documents from the database
export async function fetchUserTrainingDocuments(supabase, userId) {
  try {
    const { data: documents, error } = await supabase
      .from('training_documents')
      .select(`
        id,
        file_name,
        file_type,
        extracted_text,
        word_count,
        processing_status,
        created_at
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('processing_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10); // Analyze up to 10 most recent documents

    if (error) {
      console.error('Error fetching training documents:', error);
      return [];
    }

    // Filter out documents without extracted text
    const validDocuments = (documents || []).filter(doc => 
      doc.extracted_text && 
      doc.extracted_text.length > 50 && // Minimum 50 characters
      !doc.extracted_text.includes('[PDF content - text extraction not available]') &&
      !doc.extracted_text.includes('[Word document content - text extraction not available]') &&
      !doc.extracted_text.includes('[Content extraction failed')
    );

    console.log(`📄 Found ${documents?.length || 0} training documents, ${validDocuments.length} valid for analysis`);
    if (validDocuments.length > 0) {
      console.log('Valid documents:', validDocuments.map(d => ({
        name: d.file_name,
        type: d.file_type,
        status: d.processing_status,
        words: d.word_count
      })));
    }

    return validDocuments;
  } catch (error) {
    console.error('Error in fetchUserTrainingDocuments:', error);
    return [];
  }
}

// Fetch trending posts for inspiration
export async function fetchTrendingPosts(supabase) {
  try {
    const { data: posts, error } = await supabase
      .from('trending_posts')
      .select(`
        id,
        content,
        likes,
        comments,
        shares,
        views,
        author_name,
        author_title,
        post_type,
        industry_tags,
        engagement_rate,
        post_url
      `)
      .eq('is_active', true)
      .order('engagement_rate', { ascending: false })
      .limit(10); // Top 10 trending posts

    if (error) {
      console.error('Error fetching trending posts:', error);
      return [];
    }

    return posts || [];
  } catch (error) {
    console.error('Error in fetchTrendingPosts:', error);
    return [];
  }
} 