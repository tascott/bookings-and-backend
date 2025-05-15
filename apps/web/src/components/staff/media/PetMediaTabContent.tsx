'use client';

import React, { useState } from 'react';
import PetMediaSelector from './PetMediaSelector';
import PetImageGallery from './PetImageGallery'; // We will create/refactor this next

export default function PetMediaTabContent() {
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);

  const handlePetSelect = (petId: number) => {
    setSelectedPetId(petId);
  };

  const handleBackToSelector = () => {
    setSelectedPetId(null);
  };

  if (selectedPetId) {
    return <PetImageGallery petId={selectedPetId} onBack={handleBackToSelector} />;
  }

  return <PetMediaSelector onPetSelect={handlePetSelect} />;
}