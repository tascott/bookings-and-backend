'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { PetImage } from '@booking-and-accounts-monorepo/shared-types';
import {
  getPetImages,
  uploadPetImage,
  deletePetImage,
} from '@booking-and-accounts-monorepo/api-services/src/image-service';
import { createClient } from '@booking-and-accounts-monorepo/utils/supabase/client';

// Placeholder for user session logic - replace with your actual auth solution
// This hook might need to be hoisted or context provided if used across unrelated components
const useUser = () => {
  const [staffId, setStaffId] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: staffMember, error: staffError } = await supabase
          .from('staff')
          .select('id')
          .eq('user_id', session.user.id)
          .single();
        if (staffError) {
          console.error('Error fetching staff ID:', staffError);
        } else if (staffMember) {
          setStaffId(staffMember.id);
        }
      }
    };
    fetchUserData();
  }, [supabase]);

  return { staffId };
};

interface PetImageGalleryProps {
  petId: number;
  onBack?: () => void; // Optional callback for a back button
}

export default function PetImageGallery({ petId, onBack }: PetImageGalleryProps) {
  const supabase = useMemo(() => createClient(), []);
  const { staffId } = useUser();

  const [images, setImages] = useState<PetImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [caption, setCaption] = useState('');

  const fetchPetImages = useCallback(async () => {
    if (petId && supabase) {
      setIsLoading(true);
      setError(null); // Clear previous errors
      setDeleteError(null);
      try {
        const fetchedImages = await getPetImages(supabase, petId);
        setImages(fetchedImages);
      } catch (err) {
        console.error('Error fetching pet images:', err);
        setError('Failed to load images.');
      } finally {
        setIsLoading(false);
      }
    }
  }, [petId, supabase]);

  useEffect(() => {
    fetchPetImages();
  }, [fetchPetImages]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFileToUpload(event.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!fileToUpload || !staffId || !petId) {
      setUploadError('Missing file, staff information, or pet ID.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const newImage = await uploadPetImage(supabase, petId, staffId, fileToUpload, caption);
      setImages(prevImages => [newImage, ...prevImages]);
      setFileToUpload(null);
      setCaption('');
      const fileInput = document.getElementById('petMediaUpload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      setTimeout(() => {
        fetchPetImages();
      }, 3000);
    } catch (err) {
      console.error('Error uploading image:', err);
      setUploadError(`Failed to upload image: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: string, storagePath: string) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;
    setIsDeleting(imageId);
    setDeleteError(null);
    try {
      await deletePetImage(supabase, imageId, storagePath);
      setImages(prevImages => prevImages.filter(img => img.id !== imageId));
    } catch (err) {
      console.error('Error deleting image:', err);
      setDeleteError(`Failed to delete image: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) return <p>Loading images for Pet ID: {petId}...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div style={{ padding: '20px' }}>
      {onBack && (
        <button onClick={onBack} style={{ marginBottom: '20px', padding: '8px 12px' }}>
          &larr; Back to Pet Selector
        </button>
      )}
      <h2>Media Gallery for Pet ID: {petId}</h2>

      <div style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px' }}>
        <h3>Upload New Media</h3>
        {uploadError && <p style={{ color: 'red' }}>{uploadError}</p>}
        <div>
          <input id="petMediaUpload" type="file" accept="image/*,video/*" onChange={handleFileChange} disabled={uploading} style={{ marginBottom: '10px' }} />
        </div>
        <div>
          <input type="text" placeholder="Optional caption" value={caption} onChange={(e) => setCaption(e.target.value)} disabled={uploading} style={{ marginBottom: '10px', width: '300px', padding: '8px' }} />
        </div>
        <button onClick={handleUpload} disabled={uploading || !fileToUpload || !staffId}>
          {uploading ? 'Uploading...' : 'Upload Media'}
        </button>
        {!staffId && <p style={{fontSize: '0.8em', color: 'orange'}}>Waiting for staff information to enable upload...</p>}
      </div>

      <h3>Existing Media</h3>
      {deleteError && <p style={{ color: 'red', marginBottom: '10px' }}>{deleteError}</p>}
      {images.length === 0 ? (
        <p>No media found for this pet.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {images.map(mediaItem => {
            const isVideo = mediaItem.mime_type && mediaItem.mime_type.startsWith('video/');
            return (
              <div key={mediaItem.id} style={{ border: '1px solid #eee', padding: '10px', width: '200px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '15px', right: '15px', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '10px', padding: '2px 4px', borderRadius: '3px', zIndex: 1 }}>
                  {isVideo ? '[Video]' : '[Image]'}
                </div>
                {mediaItem.image_url ? (
                  isVideo ? (
                    <video controls src={mediaItem.image_url} style={{ width: '100%', height: 'auto', marginBottom: '5px' }}>
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <img src={mediaItem.image_url} alt={mediaItem.caption || `Pet media ${mediaItem.id}`} style={{ width: '100%', height: 'auto', marginBottom: '5px' }} />
                  )
                ) : (
                  <p>Media URL not available. Processing...</p>
                )}
                <p style={{ fontSize: '0.9em', margin: 0 }}>{mediaItem.caption || 'No caption'}</p>
                <p style={{ fontSize: '0.7em', color: '#555' }}>Uploaded: {new Date(mediaItem.created_at).toLocaleDateString()}</p>
                <button onClick={() => handleDeleteImage(mediaItem.id, mediaItem.storage_object_path)} disabled={isDeleting === mediaItem.id} style={{ marginTop: '5px', padding: '3px 7px', fontSize: '0.8em' }}>
                  {isDeleting === mediaItem.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}