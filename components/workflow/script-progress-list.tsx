"use client";

import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ProgressStep {
  number: number;
  label: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface ScriptProgressListProps {
  steps: ProgressStep[];
  message?: string;
}

export function ScriptProgressList({ steps, message }: ScriptProgressListProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        Generating Script...
      </h3>

      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.number}
            className="flex items-center gap-3"
          >
            {/* Icon */}
            {step.status === 'completed' && (
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            )}
            {step.status === 'in_progress' && (
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
            )}
            {step.status === 'pending' && (
              <Circle className="h-5 w-5 text-gray-300 flex-shrink-0" />
            )}

            {/* Label */}
            <span
              className={cn(
                "text-sm",
                step.status === 'completed' && "text-gray-600",
                step.status === 'in_progress' && "text-blue-600 font-medium",
                step.status === 'pending' && "text-gray-400"
              )}
            >
              Step {step.number}: {step.label}
            </span>
          </div>
        ))}
      </div>

      {message && (
        <p className="text-sm text-gray-500 italic">
          {message}
        </p>
      )}
    </div>
  );
}
