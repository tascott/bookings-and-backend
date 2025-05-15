import { SupabaseClient } from '@supabase/supabase-js';
import { Pet, PetImage, Staff, PetWithDetails } from '@booking-and-accounts-monorepo/shared-types'; // Assuming shared-types path
import { Database } from '@booking-and-accounts-monorepo/shared-types/types_db'; // Assuming types_db path
import { decode as decodeBase64 } from 'base64-arraybuffer'; // Added import

// Type for the file input, can be File (web) or an object with uri (mobile)
export type FileInput = File | { uri: string; name?: string; type?: string; base64?: string };

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
  const fileInputName = file instanceof File ? file.name : (file.name || `image-${Date.now()}`);
  const fileExt = fileInputName.split('.').pop() || 'jpg'; // Ensure fallback for extension
  const filePath = `pet_${petId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

  let uploadError, data;
  let resolvedContentType = file instanceof File ? file.type : (file.type || 'application/octet-stream');

  if (file instanceof File) {
    // Web upload
    console.log(`[uploadPetImage] Web upload initiated for ${file.name}, type: ${file.type}, size: ${file.size}`);
    ({ error: uploadError, data } = await supabase.storage
      .from('pet-images')
      .upload(filePath, file, { contentType: resolvedContentType }));
  } else if (typeof file === 'object' && file.uri && typeof file.uri === 'string') {
    // Mobile upload: Use FormData with URI
    resolvedContentType = file.type || 'image/jpeg'; // Default to image/jpeg if not specified
    const mobileFile = file as { uri: string; name?: string; type?: string; base64?: string }; // Type assertion
    const fileNameForFormData = mobileFile.name || `image-${Date.now()}.${fileExt}`;

    console.log(`[uploadPetImage] Mobile upload initiated using FormData. URI: ${mobileFile.uri}, Type: ${resolvedContentType}, Name: ${fileNameForFormData}`);

    try {
      const formData = new FormData();
      // The 'file' field name is arbitrary but common.
      // Supabase SDK expects the file data as the second argument, and FormData is a supported type.
      // The third argument to append is the filename.
      formData.append('file', {
        uri: mobileFile.uri,
        name: fileNameForFormData,
        type: resolvedContentType,
      } as any); // Type 'any' to match FormData append signature for files in RN

      ({ error: uploadError, data } = await supabase.storage
        .from('pet-images')
        .upload(filePath, formData, {
          // contentType is often inferred by Supabase when using FormData with correct file object,
          // but specifying it doesn't hurt and can be required by some storage configurations.
          // However, when uploading FormData directly, Supabase usually handles the Content-Type header for the multipart request itself.
          // The `contentType` option here in .upload() might be for overriding or if the object isn't a standard File/Blob.
          // For FormData, it's best to let Supabase SDK and the browser/fetch API handle multipart headers.
          // Let's remove explicit contentType here if SDK handles it. Or keep it if required.
          // For now, we'll rely on the type property in the object appended to FormData.
          upsert: false,
        }));

    } catch (uploadProcessError) {
        console.error('[uploadPetImage] Error during mobile FormData upload processing:', uploadProcessError);
        throw uploadProcessError;
    }
  } else {
    throw new Error('Invalid file input type. Must be a File (web) or an object with uri, name, and type (mobile).');
  }

  if (uploadError) {
    console.error('Error uploading image to storage:', uploadError);
    throw uploadError;
  }

  if (!data || !data.path) {
    throw new Error('Upload successful but no path returned from storage.');
  }

  const confirmedStoragePath = data.path; // Explicitly use the confirmed path

  // Record metadata in the pet_images table
  const { data: imageRecordData, error: dbError } = await supabase
    .from('pet_images')
    .insert({
      pet_id: petId,
      uploaded_by_staff_id: staffId,
      storage_object_path: confirmedStoragePath, // Use confirmed path
      caption: caption,
      file_name: fileInputName,
      mime_type: resolvedContentType, // Use the resolved content type for DB record
      // size_bytes: file instanceof File ? file.size : undefined, // Blob size is harder to get synchronously here for DB record
    })
    .select()
    .single();

  if (dbError) {
    console.error('Error saving image metadata to database:', dbError);
    // Attempt to delete the orphaned storage object if DB insert fails
    await supabase.storage.from('pet-images').remove([confirmedStoragePath]); // Use confirmed path
    throw dbError;
  }

  if (!imageRecordData) {
    throw new Error('Image metadata not saved correctly.');
  }

  // Now, create a signed URL for the newly uploaded image
  let signedUrl = null;
  let attempt = 1;
  const maxAttempts = 2;
  const retryDelayMs = 1000; // 1 second

  while (attempt <= maxAttempts) {
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('pet-images')
      .createSignedUrl(confirmedStoragePath, 60 * 60); // 1 hour validity

    if (signedUrlError) {
      console.error(`Error creating signed URL (attempt ${attempt}/${maxAttempts}):`, confirmedStoragePath, signedUrlError);
      if (attempt < maxAttempts && signedUrlError.message && signedUrlError.message.includes('Object not found')) {
        console.log(`Retrying signed URL creation in ${retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      } else {
        // Non-retryable error or max attempts reached
        break;
      }
    } else {
      signedUrl = signedUrlData.signedUrl;
      break; // Success
    }
    attempt++;
  }

  // Combine the database record with the signed URL
  return {
    ...imageRecordData,
    image_url: signedUrl,
  } as PetImage;
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
 * Fetches a list of all pets in the system, augmented with their client's name.
 *
 * @param supabase - The Supabase client instance.
 * @returns An array of PetWithDetails objects.
 */
export const getAllPetsWithClientNames = async (
  supabase: SupabaseClient<Database>
): Promise<PetWithDetails[]> => {
  const { data: petsWithClientInfo, error: petsError } = await supabase
    .from('pets')
    .select(`
      *,
      clients (
        id,
        user_id,
        profiles (
          first_name,
          last_name
        )
      )
    `);

  if (petsError) {
    console.error('Error fetching all pets with client names:', petsError);
    throw petsError;
  }

  if (!petsWithClientInfo) {
    return [];
  }

  return petsWithClientInfo.map(pet => {
    const clientProfile = pet.clients?.profiles;
    const clientName = clientProfile ? `${clientProfile.first_name || ''} ${clientProfile.last_name || ''}`.trim() : 'Unknown Client';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clients, ...petData } = pet; // Exclude the nested clients relation

    return {
      ...petData,
      client_id: pet.client_id, // client_id is directly on petData
      client_name: clientName,
    } as PetWithDetails;
  });
};

/**
 * Fetches a list of pets (with client names) that are part of bookings assigned
 * to a given staff member for the current day.
 *
 * @param supabase - The Supabase client instance.
 * @param staffUserId - The auth.uid() of the staff member.
 * @returns An array of PetWithDetails objects.
 */
export const getTodaysPetsForStaff = async (
  supabase: SupabaseClient<Database>,
  staffUserId: string
): Promise<PetWithDetails[]> => {
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

  const today = new Date();
  const startDate = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const endDate = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  // Step 1: Fetch today's bookings for the staff member
  const { data: todaysBookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id') // We only need booking IDs to find associated pets
    .eq('assigned_staff_id', staffUserId) // Corrected: Use staffUserId (string UUID)
    .gte('start_time', startDate)
    .lte('start_time', endDate);

  if (bookingsError) {
    console.error("Error fetching today's bookings for staff:", staffUserId, bookingsError); // Log staffUserId for clarity
    return [];
  }

  if (!todaysBookings || todaysBookings.length === 0) {
    return []; // No bookings for today for this staff
  }

  const bookingIds = todaysBookings.map(b => b.id);

  // Step 2: Fetch pet_ids from booking_pets for these bookings
  const { data: bookingPetsLinks, error: bpError } = await supabase
    .from('booking_pets')
    .select('pet_id')
    .in('booking_id', bookingIds);

  if (bpError) {
    console.error('Error fetching booking_pets links:', bpError);
    return [];
  }

  if (!bookingPetsLinks || bookingPetsLinks.length === 0) {
    return []; // No pets linked to today's bookings
  }

  const uniquePetIds = [...new Set(bookingPetsLinks.map(bp => bp.pet_id))];

  if (uniquePetIds.length === 0) {
    return [];
  }

  // Step 3: Fetch details for these unique pets, including client names
  const { data: pets, error: petsError } = await supabase
    .from('pets')
    .select(`
      *,
      clients (
        id,
        profiles (
          first_name,
          last_name
        )
      )
    `)
    .in('id', uniquePetIds);

  if (petsError) {
    console.error('Error fetching pet details for today:', petsError);
    throw petsError;
  }

  if (!pets) {
    return [];
  }

  return pets.map(petFromDb => {
    // The structure from Supabase with nested selects needs careful handling
    // Ensure 'clients' is correctly accessed (it might be an object or null)
    const clientProfile = petFromDb.clients?.profiles;
    const clientName = clientProfile ? `${clientProfile.first_name || ''} ${clientProfile.last_name || ''}`.trim() : 'Unknown Client';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clients, ...petData } = petFromDb; // Exclude the nested clients object from the final pet data

    return {
      ...petData,
      client_id: petFromDb.client_id, // ensure client_id is correctly passed from petFromDb
      client_name: clientName,
    } as PetWithDetails; // Cast, assuming petData matches the rest of Pet type
  });
};