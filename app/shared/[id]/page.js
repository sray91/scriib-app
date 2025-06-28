'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TwitterEmbed } from '@/components/viral-posts/TwitterEmbed';
import Image from 'next/image';
import Link from 'next/link';

export default function SharedPosts({ params }) {
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchSharedCollection() {
      try {
        const { data, error } = await supabase
          .from('shared_collections')
          .select('*')
          .eq('share_id', params.id)
          .single();

        if (error) throw error;
        if (data) {
          setCollection(data);
        }
      } catch (err) {
        setError('Collection not found or no longer available');
      } finally {
        setLoading(false);
      }
    }

    fetchSharedCollection();
  }, [params.id, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-500">Oops!</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <Link href="/" className="flex items-center gap-2 px-4 py-6">
          <div className="flex h-12 w-12 items-center justify-center">
            <Image src="/scriib-logo.png" width={100} height={100} alt="" />
          </div>
          <div className="font-bebas-neue text-2xl tracking-wide text-black">SCRIIB</div>
        </Link>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-[#FF4400]">
            {collection.tag} Collection
          </h1>
          <p className="text-muted-foreground mt-2">
            Shared on {new Date(collection.created_at).toLocaleDateString()}
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {collection.posts.map((post) => (
            <Card key={post.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {post.description && (
                  <p className="text-sm text-muted-foreground">
                    {post.description}
                  </p>
                )}
                <TwitterEmbed tweetId={post.tweet_id} />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="border-t mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Shared via Scriib
          </p>
        </div>
      </footer>
    </div>
  );
}