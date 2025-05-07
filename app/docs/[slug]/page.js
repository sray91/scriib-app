'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { formatDocsTitle } from '@/app/utils/docUtils';

export default function DocPage() {
  const params = useParams();
  const router = useRouter();
  const { slug } = params;
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    async function fetchDocumentation() {
      try {
        setIsLoading(true);
        setError(null);
        
        // Create the path from the slug
        const formattedSlug = slug.replace(/-/g, '_').toUpperCase();
        const path = `/docs/${formattedSlug}.md`;
        
        const response = await fetch(path);
        
        if (!response.ok) {
          throw new Error(`Failed to load documentation: ${response.statusText}`);
        }
        
        const text = await response.text();
        setContent(text);
        
        // Generate a title from the slug if we have one
        if (slug) {
          setTitle(formatDocsTitle(formattedSlug));
        }
      } catch (err) {
        console.error('Error loading documentation:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (slug) {
      fetchDocumentation();
    }
  }, [slug]);

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex justify-between items-center mb-6">
        <Link href="/" passHref>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        
        <h1 className="text-2xl font-bold flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          {title}
        </h1>
      </div>
      
      <Card className="p-6">
        {isLoading && (
          <div className="flex justify-center items-center min-h-[300px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        )}
        
        {error && (
          <div className="text-center p-8 text-red-500">
            <h3 className="text-xl font-bold mb-2">Error Loading Documentation</h3>
            <p>{error}</p>
            <Button 
              variant="outline" 
              className="mt-4" 
              onClick={() => router.push('/')}
            >
              Return to Home
            </Button>
          </div>
        )}
        
        {!isLoading && !error && (
          <article className="prose prose-slate max-w-none dark:prose-invert">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={tomorrow}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
        )}
      </Card>
    </div>
  );
} 