import PastPostsViewer from '@/components/PastPostsViewer';

export default function LinkedInPostsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              LinkedIn Past Posts
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Import and view your past LinkedIn posts using the Member Data Portability API. 
              Analyze your content performance and engagement metrics.
            </p>
          </div>
          
          <PastPostsViewer />
        </div>
      </div>
    </div>
  );
} 