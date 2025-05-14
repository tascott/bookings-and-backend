'use client';

import React, { useEffect, useState, useMemo, use } from 'react';
import { PetImage } from '@booking-and-accounts-monorepo/shared-types';
import { getPetImages, uploadPetImage, deletePetImage } from '@booking-and-accounts-monorepo/api-services/src/image-service';
import { createClient } from '@booking-and-accounts-monorepo/utils/supabase/client';

// Placeholder for user session logic - replace with your actual auth solution
const useUser = () => {
  const [staffId, setStaffId] = useState<number | null>(null); // Assuming staff ID is a number based on schema
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        // Fetch staff_id based on user_id
        // This is a placeholder - you'll need to implement this based on your staff table structure
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

  return { userId, staffId }; // Return both userId and staffId
};

export default function PetImageGalleryPage({ params: paramsPromise }: { params: Promise<{ petId: string }> }) {
  const params = use(paramsPromise); // use() will unwrap the Promise
  const { petId } = params; // Destructure petId from the resolved params
  const supabase = useMemo(() => createClient(), []);
  const { staffId } = useUser(); // staffId is needed for uploading

  const [images, setImages] = useState<PetImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // To track which image is being deleted
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [caption, setCaption] = useState('');

  // Function to fetch pet images
  const fetchPetImages = async () => {
    if (petId && supabase) {
      setIsLoading(true);
      try {
        const fetchedImages = await getPetImages(supabase, parseInt(petId, 10));
        setImages(fetchedImages);
      } catch (err) {
        console.error('Error fetching pet images:', err);
        setError('Failed to load images.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchPetImages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId, supabase]); // supabase is stable, petId is the main trigger

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFileToUpload(event.target.files[0]);
      setUploadError(null); // Clear previous upload error
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
      const newImage = await uploadPetImage(supabase, parseInt(petId, 10), staffId, fileToUpload, caption);
      setImages(prevImages => [newImage, ...prevImages]); // Add new image to the top, potentially without URL initially
      setFileToUpload(null);
      setCaption('');
      const fileInput = document.getElementById('petImageUpload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Schedule a delayed re-fetch to get the signed URL if it wasn't available immediately
      setTimeout(() => {
        fetchPetImages();
      }, 3000); // 3-second delay

    } catch (err) {
      console.error('Error uploading image:', err);
      setUploadError(`Failed to upload image: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: string, storagePath: string) => {
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }
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

  if (isLoading) return <p>Loading images...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Image Gallery for Pet ID: {petId}</h1>

      {/* Image Upload Section */}
      <div style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px' }}>
        <h2>Upload New Image</h2>
        {uploadError && <p style={{ color: 'red' }}>{uploadError}</p>}
        <div>
          <input
            id="petImageUpload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ marginBottom: '10px' }}
          />
        </div>
        <div>
          <input
            type="text"
            placeholder="Optional caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={uploading}
            style={{ marginBottom: '10px', width: '300px', padding: '8px' }}
          />
        </div>
        <button onClick={handleUpload} disabled={uploading || !fileToUpload || !staffId}>
          {uploading ? 'Uploading...' : 'Upload Image'}
        </button>
         {!staffId && <p style={{fontSize: '0.8em', color: 'orange'}}>Waiting for staff information to enable upload...</p>}
      </div>

      {/* Image Display Section */}
      <h2>Existing Images</h2>
      {deleteError && <p style={{ color: 'red', marginBottom: '10px' }}>{deleteError}</p>}
      {images.length === 0 ? (
        <p>No images found for this pet.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {images.map(image => (
            <div key={image.id} style={{ border: '1px solid #eee', padding: '10px', width: '200px' }}>
              {image.image_url ? (
                <img
                  src={image.image_url}
                  alt={image.caption || `Pet image ${image.id}`}
                  style={{ width: '100%', height: 'auto', marginBottom: '5px' }}
                />
              ) : (
                <p>Image URL not available.</p>
              )}
              <p style={{ fontSize: '0.9em', margin: 0 }}>{image.caption || 'No caption'}</p>
              <p style={{ fontSize: '0.7em', color: '#555' }}>Uploaded: {new Date(image.created_at).toLocaleDateString()}</p>
              <button
                onClick={() => handleDeleteImage(image.id, image.storage_object_path)}
                disabled={isDeleting === image.id}
                style={{ marginTop: '5px', padding: '3px 7px', fontSize: '0.8em' }}
              >
                {isDeleting === image.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}