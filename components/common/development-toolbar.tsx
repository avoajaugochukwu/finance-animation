"use client";

import React from 'react';
import { useSessionStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IS_DEVELOPMENT, getMockDataForStep } from '@/lib/config/development';
import {
  Code,
  FileText
} from 'lucide-react';
import { WorkflowStep } from '@/lib/types';

export function DevelopmentToolbar() {
  const { skipToStep } = useSessionStore();

  if (!IS_DEVELOPMENT) return null;

  const skipButtons = [
    { step: 1 as WorkflowStep, label: 'Topics', icon: FileText },
    { step: 2 as WorkflowStep, label: 'Outline', icon: FileText },
    { step: 3 as WorkflowStep, label: 'Draft', icon: FileText },
    { step: 4 as WorkflowStep, label: 'Polish', icon: FileText },
  ];

  const handleSkip = (step: WorkflowStep) => {
    const mockData = getMockDataForStep(step);
    skipToStep(step, mockData);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900 border-t border-gray-700">
      <div className="container mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-yellow-500" />
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
              Development Mode
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 mr-2">Skip to:</span>
            {skipButtons.map(({ step, label, icon: Icon }) => (
              <Button
                key={step}
                variant="outline"
                size="sm"
                onClick={() => handleSkip(step)}
                className="text-white border-gray-600 hover:bg-gray-800"
              >
                <Icon className="h-4 w-4 mr-1" />
                {label}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="mt-2 text-xs text-gray-500">
          Mock data will be loaded for testing. Images will be generated using your FAL_API_KEY.
        </div>
      </div>
    </div>
  );
}