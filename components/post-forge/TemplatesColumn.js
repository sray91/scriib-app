import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Simple collapsible implementation without external dependency
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Settings,
  ArrowRight,
  Calendar,
  FileText,
  Sparkles
} from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function TemplatesColumn({
  selectedUser,
  onUseTemplate,
  onManageTemplates,
  currentUser
}) {
  const [templates, setTemplates] = useState([]);
  const [templatesByDay, setTemplatesByDay] = useState({});
  const [expandedDays, setExpandedDays] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = getSupabase();

  useEffect(() => {
    if (selectedUser) {
      fetchTemplatesForUser();
    }
  }, [selectedUser]);

  const fetchTemplatesForUser = async () => {
    try {
      setIsLoading(true);
      
      // Fetch templates for the selected user
      const { data: templates, error } = await supabase
        .from('user_time_blocks')
        .select(`
          id,
          title,
          description,
          day,
          user_id,
          created_at,
          user_tasks (
            id,
            text
          )
        `)
        .eq('user_id', selectedUser.id)
        .order('created_at');

      if (error) throw error;

      setTemplates(templates || []);
      
      // Group templates by day
      const grouped = {};
      DAYS_OF_WEEK.forEach(day => {
        grouped[day] = templates?.filter(template => template.day === day) || [];
      });
      
      setTemplatesByDay(grouped);
      
      // Auto-expand days with templates
      const autoExpanded = {};
      DAYS_OF_WEEK.forEach(day => {
        autoExpanded[day] = grouped[day].length > 0;
      });
      setExpandedDays(autoExpanded);
      
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
      setTemplatesByDay({});
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDay = (day) => {
    setExpandedDays(prev => ({
      ...prev,
      [day]: !prev[day]
    }));
  };

  const handleUseTemplate = (template) => {
    if (onUseTemplate) {
      onUseTemplate(template.id, template.day);
    }
  };

  const handleManageTemplates = () => {
    if (onManageTemplates) {
      onManageTemplates();
    } else {
      router.push('/post-forge/builder');
    }
  };

  const getTotalTemplates = () => {
    return templates.length;
  };

  const getTemplateCountForDay = (day) => {
    return templatesByDay[day]?.length || 0;
  };

  if (isLoading) {
    return (
      <div className="w-80 bg-gray-50 border-r p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-50 border-r flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText size={20} />
            Templates for {selectedUser?.name || 'User'}
          </h2>
          <Badge variant="secondary" className="text-xs">
            {getTotalTemplates()}
          </Badge>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={handleManageTemplates}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Settings size={14} className="mr-1" />
            Manage
          </Button>
          <Button
            onClick={() => handleUseTemplate(null)}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus size={14} className="mr-1" />
            New
          </Button>
        </div>
      </div>

      {/* Templates by Day */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {DAYS_OF_WEEK.map((day) => {
          const dayTemplates = templatesByDay[day] || [];
          const isExpanded = expandedDays[day];
          const templateCount = getTemplateCountForDay(day);

          return (
            <div key={day} className="border rounded-lg bg-white">
              <Button
                variant="ghost"
                className="w-full justify-between p-3 h-auto hover:bg-gray-100 rounded-b-none"
                onClick={() => toggleDay(day)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                  <span className="font-medium">{day}</span>
                </div>
                <Badge 
                  variant={templateCount > 0 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {templateCount}
                </Badge>
              </Button>
              
              {isExpanded && (
                <div className="space-y-2 p-3 pt-0 border-t">
                {dayTemplates.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    <FileText size={16} className="mx-auto mb-2 opacity-50" />
                    <p>No templates for {day}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => handleUseTemplate(null, day)}
                    >
                      <Plus size={12} className="mr-1" />
                      Create Template
                    </Button>
                  </div>
                ) : (
                  dayTemplates.map((template) => (
                    <Card 
                      key={template.id} 
                      className="border-l-4 border-l-blue-400 hover:shadow-sm transition-shadow"
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          {template.title || 'Untitled Template'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {template.description && (
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                        
                        {template.user_tasks && template.user_tasks.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-700">
                              Content Ideas:
                            </p>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {template.user_tasks.slice(0, 2).map((task) => (
                                <li key={task.id} className="flex items-start gap-1">
                                  <span className="text-blue-500 mt-0.5">•</span>
                                  <span className="line-clamp-1">{task.text}</span>
                                </li>
                              ))}
                              {template.user_tasks.length > 2 && (
                                <li className="text-gray-400 text-xs">
                                  +{template.user_tasks.length - 2} more ideas
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                        
                        <Button
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleUseTemplate(template)}
                        >
                          <Sparkles size={12} className="mr-1" />
                          Use Template
                          <ArrowRight size={12} className="ml-1" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-white">
        <div className="text-xs text-gray-500 text-center">
          <p className="mb-2">
            Total: {getTotalTemplates()} templates across {DAYS_OF_WEEK.length} days
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManageTemplates}
            className="text-xs"
          >
            <Settings size={12} className="mr-1" />
            Manage All Templates
          </Button>
        </div>
      </div>
    </div>
  );
} 