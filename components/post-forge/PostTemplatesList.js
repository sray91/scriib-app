import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PostTemplatesList({ day, templates, isLoading, onCreatePost }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Post Templates</h2>
      </div>
      
      {isLoading ? (
        <p>Loading templates...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 border rounded-lg">
          <p className="text-gray-500 mb-4">No post templates for {day}</p>
          <Link href="/post-forge/builder">
            <Button variant="outline">
              Create Templates
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{template.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">{template.description}</p>
                {template.user_tasks && template.user_tasks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Content Ideas:</h4>
                    <ul className="list-disc pl-5 text-sm">
                      {template.user_tasks.map((task) => (
                        <li key={task.id}>{task.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button 
                  className="mt-4 w-full"
                  onClick={() => onCreatePost(template.id)}
                >
                  Create Post <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 