'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';

export default function PastPostsViewer({ userId = null, currentUser = null }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [syncResult, setSyncResult] = useState(null);

  const supabase = getSupabase();
  
  // Check if we're viewing another user's data
  const isViewingOtherUser = userId && currentUser && userId !== currentUser.id;

  useEffect(() => {
    fetchPosts();
  }, [currentPage, userId]);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = `/api/linkedin/posts?page=${currentPage}&limit=20${userId ? `&userId=${userId}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setPosts(data.data.posts);
        setPagination(data.data.pagination);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch posts');
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncLinkedInPosts = async (count = 30) => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const response = await fetch('/api/linkedin/posts/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count }),
      });

      const data = await response.json();

      if (data.success) {
        setSyncResult(data);
        await fetchPosts(); // Refresh the posts list
      } else {
        if (data.needsAuth) {
          setError(
            <div>
              <p>{data.error}</p>
              <a 
                href={data.authUrl} 
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Click here to connect LinkedIn
              </a>
            </div>
          );
        } else {
          setError(data.error);
        }
      }
    } catch (err) {
      setError('Failed to sync posts');
      console.error('Error syncing posts:', err);
    } finally {
      setSyncing(false);
    }
  };

  const deleteAllPosts = async () => {
    if (!confirm('Are you sure you want to delete all past posts? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/linkedin/posts?deleteAll=true', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setPosts([]);
        setPagination({});
        setCurrentPage(1);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to delete posts');
      console.error('Error deleting posts:', err);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPostTypeIcon = (type) => {
    switch (type) {
      case 'video': return '🎥';
      case 'image': return '📸';
      case 'article': return '📝';
      default: return '💬';
    }
  };

  const getEngagementTotal = (metrics) => {
    if (!metrics) return 0;
    return (metrics.likes || 0) + (metrics.comments || 0) + (metrics.shares || 0);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">LinkedIn Past Posts</h2>
          
          <div className="flex flex-wrap gap-3 mb-4">
            {!isViewingOtherUser && (
              <>
                <button
                  onClick={() => syncLinkedInPosts(30)}
                  disabled={syncing}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncing ? 'Syncing...' : 'Sync Posts (30)'}
                </button>
                
                <button
                  onClick={() => syncLinkedInPosts(50)}
                  disabled={syncing}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncing ? 'Syncing...' : 'Sync Posts (50)'}
                </button>
              </>
            )}
            
            <button
              onClick={fetchPosts}
              disabled={loading}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            
            {posts.length > 0 && !isViewingOtherUser && (
              <button
                onClick={deleteAllPosts}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Delete All
              </button>
            )}
            
            {isViewingOtherUser && (
              <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm">
                Viewing posts for another user - sync and delete operations disabled
              </div>
            )}
          </div>

          {syncResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h3 className="text-green-800 font-semibold mb-2">Sync Complete!</h3>
              <p className="text-green-700">
                Successfully synced {syncResult.data.synced_count} of {syncResult.data.total_fetched} posts
              </p>
              {syncResult.data.errors_count > 0 && (
                <p className="text-yellow-600 text-sm mt-1">
                  {syncResult.data.errors_count} posts had errors during sync
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {pagination.total_count > 0 && (
            <div className="text-sm text-gray-600">
              Showing {posts.length} of {pagination.total_count} posts
            </div>
          )}
        </div>

        <div className="p-6">
          {loading && posts.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No past posts found.</p>
                           <p className="text-sm text-gray-500">
                 Click &quot;Sync Posts&quot; to import your LinkedIn posts.
               </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getPostTypeIcon(post.post_type)}</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {post.post_type} Post
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">
                        {formatDate(post.published_at)}
                      </span>
                    </div>
                    
                    {post.post_url && (
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View on LinkedIn →
                      </a>
                    )}
                  </div>

                  <div className="mb-3">
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {post.content_preview || post.content}
                    </p>
                  </div>

                  {post.media_urls && post.media_urls.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">
                        Media: {post.media_urls.length} attachment(s)
                      </p>
                    </div>
                  )}

                  {post.metrics && (
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>👍 {post.metrics.likes || 0}</span>
                      <span>💬 {post.metrics.comments || 0}</span>
                      <span>🔄 {post.metrics.shares || 0}</span>
                      {post.metrics.views && (
                        <span>👀 {post.metrics.views}</span>
                      )}
                      <span className="ml-auto font-medium">
                        Total Engagement: {getEngagementTotal(post.metrics)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-6">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!pagination.has_prev_page}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <span className="text-sm text-gray-600">
                Page {pagination.current_page} of {pagination.total_pages}
              </span>
              
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!pagination.has_next_page}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 