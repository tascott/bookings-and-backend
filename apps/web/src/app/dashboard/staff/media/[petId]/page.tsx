'use client';

import React, { use } from 'react';
import PetImageGallery from '@/components/staff/media/PetImageGallery'; // Import the new reusable component

// This page component now primarily serves as a route handler for direct URL access
export default function PetImageGalleryPage({ params: paramsPromise }: { params: Promise<{ petId: string }> }) {
  const params = use(paramsPromise);
  const petIdString = params.petId;

  // Basic validation or error handling for petIdString can be added here if needed
  const petId = parseInt(petIdString, 10);

  if (isNaN(petId)) {
    return <p>Invalid Pet ID.</p>; // Or a more sophisticated error component
  }

  return <PetImageGallery petId={petId} />; // Render the reusable component, no onBack prop
}