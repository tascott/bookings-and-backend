import { SupabaseClient } from '@supabase/supabase-js';
import { Pet, PetImage, Staff } from '@booking-and-accounts-monorepo/shared-types'; // Assuming shared-types path
import { Database } from '@booking-and-accounts-monorepo/shared-types/types_db'; // Assuming types_db path

// Type for the file input, can be File (web) or an object with uri (mobile)
export type FileInput = File | { uri: string; name?: string; type?: string };

/**
 * Uploads an image for a pet to Supabase Storage and records its metadata.
 *
 * @param supabase - The Supabase client instance.
 * @param petId - The ID of the pet the image belongs to.
 * @param staffId - The ID of the staff member uploading the image (staff.id).
 * @param file - The image file (File object for web, { uri, name?, type? } for mobile).
 * @param caption - Optional caption for the image.
 * @returns The metadata of the uploaded image.
 */
export const uploadPetImage = async (
  supabase: SupabaseClient<Database>,
  petId: number,
  staffId: number,
  file: FileInput,
  caption?: string
): Promise<PetImage> => {
  if (!file) {
    throw new Error('No file provided for upload.');
  }

  // Generate a unique path for the image in storage
  const fileName = file instanceof File ? file.name : (file.name || `image-${Date.now()}`);
  const fileExt = fileName.split('.').pop();
  const filePath = `pet_${petId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

  let uploadError, data;

  if (file instanceof File) {
    // Web upload
    ({ error: uploadError, data } = await supabase.storage
      .from('pet-images') // Ensure this matches your bucket name
      .upload(filePath, file));
  } else if (file.uri) {
    // Mobile upload - requires a different approach.
    // Supabase client JS library doesn't directly support uploading from a local file URI like `file://...` for mobile.
    // This typically involves fetching the blob data from the URI first.
    // For Expo, you can use FileSystem.readAsStringAsync or similar, then convert to Blob/ArrayBuffer.
    // This part will need careful implementation for mobile.
    // Placeholder for mobile upload logic:
    console.warn('Mobile image upload needs specific implementation to convert URI to a file/blob for Supabase storage.');
    // As a temporary measure, this will fail until implemented.
    // Example using fetch to get blob (might need polyfills for fetch on older RN versions if not using Expo's fetch)
    const response = await fetch(file.uri);
    const blob = await response.blob();
    ({ error: uploadError, data } = await supabase.storage
      .from('pet-images')
      .upload(filePath, blob, { contentType: file.type || 'image/jpeg' })); // Adjust contentType as needed
  } else {
    throw new Error('Invalid file input type.');
  }

  if (uploadError) {
    console.error('Error uploading image to storage:', uploadError);
    throw uploadError;
  }

  if (!data || !data.path) {
    throw new Error('Upload successful but no path returned from storage.');
  }

  // Record metadata in the pet_images table
  const { data: imageRecord, error: dbError } = await supabase
    .from('pet_images')
    .insert({
      pet_id: petId,
      uploaded_by_staff_id: staffId,
      storage_object_path: data.path,
      caption: caption,
      file_name: fileName,
      mime_type: file instanceof File ? file.type : (file.type || 'application/octet-stream'),
      // size_bytes: file instanceof File ? file.size : undefined, // Blob size is harder to get synchronously here
    })
    .select()
    .single();

  if (dbError) {
    console.error('Error saving image metadata to database:', dbError);
    // Attempt to delete the orphaned storage object if DB insert fails
    await supabase.storage.from('pet-images').remove([data.path]);
    throw dbError;
  }

  if (!imageRecord) {
    throw new Error('Image metadata not saved correctly.');
  }

  // The imageRecord from Supabase might not exactly match PetImage type (e.g. no image_url)
  // We cast it, assuming the structure is compatible based on our table and RLS.
  return imageRecord as PetImage;
};

/**
 * Fetches all images for a specific pet.
 * Includes logic to get public URLs if your bucket/policies allow, or signed URLs.
 *
 * @param supabase - The Supabase client instance.
 * @param petId - The ID of the pet.
 * @returns An array of PetImage objects.
 */
export const getPetImages = async (
  supabase: SupabaseClient<Database>,
  petId: number
): Promise<PetImage[]> => {
  const { data, error } = await supabase
    .from('pet_images')
    .select('*')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pet images:', error);
    throw error;
  }
  if (!data) {
    return [];
  }

  // Enhance with image URLs (using signed URLs for private buckets)
  const enhancedImages = await Promise.all(data.map(async (image) => {
    // Ensure image and image.storage_object_path are not null or undefined
    if (!image || typeof image.storage_object_path !== 'string') {
      console.error('Invalid image data or missing storage_object_path:', image);
      return {
        // Spread existing image properties, then ensure all PetImage fields are present with fallbacks
        ...(image || {}),
        id: image?.id || 'unknown-id',
        pet_id: image?.pet_id || -1,
        uploaded_by_staff_id: image?.uploaded_by_staff_id || -1,
        storage_object_path: image?.storage_object_path || 'invalid-path',
        created_at: image?.created_at || new Date().toISOString(),
        image_url: null,
      } as PetImage;
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('pet-images')
      .createSignedUrl(image.storage_object_path, 60 * 60); // Signed URL valid for 1 hour

    if (signedUrlError) {
      console.error('Error creating signed URL for image:', image.storage_object_path, signedUrlError);
      return {
        ...image,
        image_url: null,
      } as PetImage;
    }

    return {
      ...image,
      image_url: signedUrlData.signedUrl,
    } as PetImage;
  }));
  return enhancedImages;
};

/**
 * Deletes an image for a pet from Supabase Storage and its metadata record.
 *
 * @param supabase - The Supabase client instance.
 * @param imageId - The ID of the image record in pet_images table.
 * @param storagePath - The storage_object_path of the image.
 */
export const deletePetImage = async (
  supabase: SupabaseClient<Database>,
  imageId: string, // This is pet_images.id (uuid)
  storagePath: string
): Promise<void> => {
  // First, delete the file from storage
  const { error: storageError } = await supabase.storage
    .from('pet-images')
    .remove([storagePath]);

  if (storageError) {
    // Log error but attempt to delete DB record anyway, or handle more gracefully
    console.error('Error deleting image from storage:', storageError);
    // Depending on policy, you might not want to throw here if DB deletion is more critical
  }

  // Then, delete the metadata record from the database
  const { error: dbError } = await supabase
    .from('pet_images')
    .delete()
    .eq('id', imageId);

  if (dbError) {
    console.error('Error deleting image metadata from database:', dbError);
    throw dbError;
  }
};


/**
 * Fetches a list of pets that a given staff member is associated with.
 * This is a placeholder and needs a proper definition based on your business logic
 * (e.g., pets from bookings assigned to the staff, or pets of clients managed by the staff).
 *
 * @param supabase - The Supabase client instance.
 * @param staffUserId - The auth.uid() of the staff member.
 * @returns An array of Pet objects.
 */
export const getStaffPets = async (
  supabase: SupabaseClient<Database>,
  staffUserId: string
): Promise<Pet[]> => {
  // Placeholder: This needs to be implemented based on how staff are linked to pets.
  // Example: Fetch pets from clients who have this staff as default_staff_id
  // Or pets from all bookings this staff member has been assigned to.
  console.warn(
    `getStaffPets is a placeholder and needs to be implemented with correct logic
     to determine which pets a staff member (user_id: ${staffUserId}) can manage images for.`
  );

  // Example (very simplified, likely needs more complex join/logic):
  // Get staff.id from staff.user_id
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', staffUserId)
    .single();

  if (staffError || !staffData) {
    console.error('Could not find staff record for user:', staffUserId, staffError);
    return [];
  }
  const staffId = staffData.id;

  // Find clients associated with this staff (e.g. default_staff_id)
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('default_staff_id', staffId); // This is just one way to link staff to clients

  if (clientError) {
    console.error('Error fetching clients for staff:', clientError);
    return [];
  }
  if (!clients || clients.length === 0) {
    return [];
  }

  const clientIds = clients.map(c => c.id);

  // Fetch pets for those clients
  const { data: pets, error: petsError } = await supabase
    .from('pets')
    .select('*') // Select all pet details
    .in('client_id', clientIds);

  if (petsError) {
    console.error('Error fetching pets for clients:', petsError);
    throw petsError;
  }

  return pets || [];
};