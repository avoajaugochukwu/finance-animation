"use client";

import React, { useState, useRef } from 'react';
import { useSessionStore } from '@/lib/store';
import { Character } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { 
  RefreshCw, 
  CheckCircle, 
  User, 
  Edit2, 
  ArrowRight,
  Save,
  X
} from 'lucide-react';

export function CharacterApproval() {
  const {
    characters,
    updateCharacter,
    setAssetApproval,
  } = useSessionStore();

  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [editedDescription, setEditedDescription] = useState('');
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const generatedCharactersRef = useRef<Set<string>>(new Set());

  const generateCharacterImage = async (characterId: string) => {
    const character = characters.find(c => c.id === characterId);
    if (!character) return;

    generatedCharactersRef.current.add(characterId);
    setGeneratingImages(prev => new Set(prev).add(characterId));

    try {
      const response = await fetch('/api/generate/character-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          character,
          referenceImagePath: '/cartoon_character_sheet.jpg'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate character image');
      }

      const { image_url, prompt_used } = await response.json();
      
      updateCharacter(characterId, {
        reference_image_url: image_url,
        reference_prompt: prompt_used,
      });
    } catch (error) {
      console.error('Character image generation error:', error);
    } finally {
      setGeneratingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(characterId);
        return newSet;
      });
    }
  };

  const startEditing = (character: Character) => {
    setEditingCharacter(character.id);
    setEditedDescription(character.description);
  };

  const saveEdit = (characterId: string) => {
    updateCharacter(characterId, { description: editedDescription });
    setEditingCharacter(null);
    // Regenerate image with new description
    generateCharacterImage(characterId);
  };

  const cancelEdit = () => {
    setEditingCharacter(null);
    setEditedDescription('');
  };

  const approveCharacter = (characterId: string) => {
    updateCharacter(characterId, { is_approved: true });

    // Check if all characters are approved
    const allApproved = characters.every(c =>
      c.id === characterId ? true : c.is_approved
    );

    if (allApproved) {
      setAssetApproval({
        characters_approved: true,
        all_approved: true,
        phase: 'generating'
      });
    }
  };

  const unapproveCharacter = (characterId: string) => {
    updateCharacter(characterId, { is_approved: false });
    setAssetApproval({ characters_approved: false, all_approved: false });
  };

  const proceedToGenerating = () => {
    setAssetApproval({
      characters_approved: true,
      all_approved: true,
      phase: 'generating'
    });
  };

  // Generate initial images for characters without them
  React.useEffect(() => {
    characters.forEach(character => {
      if (!character.reference_image_url && 
          !generatingImages.has(character.id) && 
          !generatedCharactersRef.current.has(character.id)) {
        generateCharacterImage(character.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allCharactersApproved = characters.every(c => c.is_approved);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold">Character Consistency Check</h3>
        <p className="text-gray-600">
          Review and approve the appearance of each character to ensure consistency
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <Badge variant={allCharactersApproved ? "default" : "outline"}>
            {characters.filter(c => c.is_approved).length} / {characters.length} Approved
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {characters.map((character) => (
          <Card 
            key={character.id}
            className={character.is_approved ? 'border-green-500' : ''}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {character.name}
                </div>
                {character.is_approved && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Character Image */}
              <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                {generatingImages.has(character.id) ? (
                  <div className="flex items-center justify-center h-full">
                    <LoadingSpinner size="lg" text="Generating..." />
                  </div>
                ) : character.reference_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={character.reference_image_url}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <User className="h-16 w-16" />
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description:</label>
                {editingCharacter === character.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveEdit(character.id)}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      {character.description}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing(character)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit Description
                    </Button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {character.is_approved ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unapproveCharacter(character.id)}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Revoke Approval
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateCharacterImage(character.id)}
                      disabled={generatingImages.has(character.id)}
                      className="flex-1"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Regenerate
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateCharacterImage(character.id)}
                      disabled={generatingImages.has(character.id)}
                      className="flex-1"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approveCharacter(character.id)}
                      disabled={!character.reference_image_url}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={proceedToGenerating}
          disabled={!allCharactersApproved}
        >
          Continue to Scene Generation
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}