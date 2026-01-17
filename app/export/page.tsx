"use client";

import React from 'react';
import { ExportPanel } from '@/components/workflow/export-panel';
import { Card } from '@/components/ui/card';

export default function ExportPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Export Your Work
            </h1>
            <p className="text-sm text-gray-600">
              Download your generated content
            </p>
          </div>

          {/* Export Panel Component */}
          <Card className="p-6">
            <ExportPanel />
          </Card>

          {/* Footer */}
          <footer className="text-center text-sm text-gray-500 py-4">
            <p>
              Session-only application • No data is saved • Export your work before leaving
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
