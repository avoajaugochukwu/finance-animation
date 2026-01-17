"use client";

import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ErrorDisplayProps {
  errors: string[];
  onDismiss?: (index: number) => void;
  className?: string;
}

export function ErrorDisplay({ errors, onDismiss, className }: ErrorDisplayProps) {
  if (errors.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {errors.map((error, index) => (
        <div
          key={index}
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          {onDismiss && (
            <button
              onClick={() => onDismiss(index)}
              className="text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}