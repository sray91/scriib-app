import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LinkedInApiTester() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [tokenPreview, setTokenPreview] = useState(null);
  
  const testApi = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/postforge/linkedin-test');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to test LinkedIn API');
      }
      
      setResults(data.results || []);
      setUserId(data.userId);
      setTokenPreview(data.tokenPreview);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">LinkedIn API Tester</h2>
        <Button onClick={testApi} disabled={isLoading}>
          {isLoading ? 'Testing...' : 'Test API Access'}
        </Button>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}
      
      {userId && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p><strong>User ID:</strong> {userId}</p>
          <p><strong>Token:</strong> {tokenPreview}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((result, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex justify-between">
                {result.name}
                <Badge variant={result.success ? "success" : "destructive"}>
                  {result.status}
                </Badge>
              </CardTitle>
              <CardDescription>{result.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {result.success ? (
                <div className="bg-gray-50 p-2 rounded text-sm font-mono overflow-x-auto">
                  {result.data}
                </div>
              ) : (
                <div className="bg-red-50 p-2 rounded text-sm text-red-700 overflow-x-auto">
                  {result.error}
                </div>
              )}
            </CardContent>
            <CardFooter className="text-xs text-gray-500">
              Endpoint: {result.url}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
} 