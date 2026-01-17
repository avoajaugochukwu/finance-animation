"use client";

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Sparkles, Download } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils/cn';
import { createProgressSnapshot } from '@/lib/utils/export';

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    selectedTopic,
    outline,
    script,
    scenes,
    characters,
    storyboardScenes,
    currentStep,
    completedSteps,
  } = useSessionStore();

  const [isDownloading, setIsDownloading] = useState(false);
  const hasAnyProgress = selectedTopic !== null;

  const handleDownloadProgress = async () => {
    if (!hasAnyProgress) {
      toast.error('No progress to download');
      return;
    }

    setIsDownloading(true);
    try {
      await createProgressSnapshot({
        topic: selectedTopic,
        outline,
        script,
        scenes,
        characters,
        storyboardScenes,
        currentStep,
        completedSteps,
      });
      toast.success('Progress snapshot downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download progress');
    } finally {
      setIsDownloading(false);
    }
  };

  const navItems = [
    { path: '/scripting', label: 'Scripting' },
    { path: '/rewrite', label: 'Rewrite' },
    { path: '/scenes', label: 'Scenes' },
    { path: '/export', label: 'Export' },
  ];

  return (
    <>
      <Toaster position="top-right" />
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => router.push('/scripting')}
              >
                <Sparkles className="h-6 w-6 text-black" />
                <h1 className="text-xl font-bold text-gray-900">
                  Relatable Explainer Studio
                </h1>
                <span className="text-sm text-gray-500">v1.0</span>
              </div>

              {/* Navigation Links */}
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Button
                    key={item.path}
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(item.path)}
                    className={cn(
                      "text-sm",
                      pathname === item.path
                        ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    {item.label}
                  </Button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-600 hidden lg:block">
                AI-Powered Relatable Explainers for YouTube
              </p>

              {hasAnyProgress && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadProgress}
                  disabled={isDownloading}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {isDownloading ? 'Downloading...' : 'Save Progress'}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
