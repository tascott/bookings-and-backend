import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Button, ActivityIndicator, Alert, Platform
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PetMediaStackParamList } from '../../navigation/PetMediaStackNavigator';
import { PetImage } from '@booking-and-accounts-monorepo/shared-types';
import {
  getPetImages,
  uploadPetImage,
  deletePetImage,
} from '@booking-and-accounts-monorepo/api-services/src/image-service';
import { createClient } from '@booking-and-accounts-monorepo/utils/supabase/client';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';

// Define props for this screen
type Props = NativeStackScreenProps<PetMediaStackParamList, 'PetImageGallery'>;

// Placeholder for user auth - REPLACE with your actual mobile auth logic
// This needs to provide the staff.id (number) for uploads.
const useStaffData = () => {
  const [staffId, setStaffId] = useState<number | null>(null); // This should be staff.id (number)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchStaffData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: staffMember, error: staffError } = await supabase
          .from('staff')
          .select('id')
          .eq('user_id', session.user.id)
          .single();
        if (staffError) {
          console.error('Error fetching staff ID:', staffError);
          Alert.alert("Error", "Could not fetch staff details.");
        } else if (staffMember) {
          setStaffId(staffMember.id);
        } else {
          Alert.alert("Error", "No staff record found for your user.");
        }
      } else {
        Alert.alert("Auth Error", "You are not logged in.");
      }
      setIsLoadingAuth(false);
    };
    fetchStaffData();
  }, [supabase]);

  return { staffId, isLoadingAuth };
};

export default function PetImageGalleryScreen({ route }: Props) {
  const { petId, petName } = route.params;
  const supabase = useMemo(() => createClient(), []);
  const { staffId, isLoadingAuth: isLoadingStaffData } = useStaffData();

  const [images, setImages] = useState<PetImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isDeleting, setIsDeleting] = useState<string | null>(null); // image.id of deleting image
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    setIsLoadingImages(true);
    setError(null);
    try {
      const fetchedImages = await getPetImages(supabase, petId);
      setImages(fetchedImages);
    } catch (err) {
      console.error('Error fetching pet images:', err);
      setError('Failed to load images.');
      Alert.alert("Error", "Could not load pet images.");
    } finally {
      setIsLoadingImages(false);
    }
  }, [supabase, petId]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Image Picker Logic
  const pickImage = async () => {
    // Request permissions first
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Denied", "Permission to access camera roll is required!");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      handleImageUpload(asset);
    }
  };

  const handleImageUpload = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!staffId) {
      Alert.alert("Error", "Staff ID not available. Cannot upload.");
      return;
    }
    setIsUploading(true);
    setUploadError(null);

    let fileType = asset.mimeType;
    if (!fileType) {
        if (asset.uri.endsWith('.mov') || asset.uri.endsWith('.mp4')) {
            fileType = asset.uri.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
        } else {
            fileType = 'image/jpeg';
        }
    }

    const generatedName = asset.fileName || `pet_media_${petId}_${Date.now()}.${asset.uri.split('.').pop() || 'unknown'}`;

    try {
      const fileInput = {
        uri: asset.uri,
        name: generatedName,
        type: fileType,
      };

      const newImage = await uploadPetImage(supabase, petId, staffId, fileInput, undefined);
      console.log('[PetImageGalleryScreen] New image data received:', JSON.stringify(newImage, null, 2));
      setImages(prevImages => {
        const updatedImages = [newImage, ...prevImages];
        console.log('[PetImageGalleryScreen] Images state updated:', JSON.stringify(updatedImages, null, 2));
        return updatedImages;
      });
      Alert.alert("Success", "Image uploaded!");
      setTimeout(fetchImages, 1000);

    } catch (err) {
      console.error('Error uploading image:', err);
      setUploadError(`Failed to upload: ${err instanceof Error ? err.message : String(err)}`);
      Alert.alert("Upload Failed", err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (image: PetImage) => {
    if (!image.id || !image.storage_object_path) return;
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this image?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", onPress: async () => {
            setIsDeleting(image.id);
            setDeleteError(null);
            try {
              await deletePetImage(supabase, image.id, image.storage_object_path);
              setImages(prevImages => prevImages.filter(img => img.id !== image.id));
              Alert.alert("Success", "Image deleted.");
            } catch (err) {
              console.error('Error deleting image:', err);
              setDeleteError(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
              Alert.alert("Delete Failed", err instanceof Error ? err.message : "An unknown error occurred.");
            } finally {
              setIsDeleting(null);
            }
          }, style: "destructive"
        }
      ]
    );
  };

  const renderImageItem = ({ item }: { item: PetImage }) => {
    const isVideo = item.mime_type && item.mime_type.startsWith('video/');

    return (
      <View style={styles.imageItemContainer}>
        <Text style={styles.mediaTypeLabel}>{isVideo ? '[Video]' : '[Image]'}</Text>
        {isVideo ? (
          item.image_url ? (
            <Video
              source={{ uri: item.image_url }}
              style={styles.media}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
            />
          ) : (
            <View style={[styles.media, styles.mediaPlaceholder]}>
              <Text>No URL / Processing Video...</Text>
            </View>
          )
        ) : (
          item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.media} resizeMode="cover" />
          ) : (
            <View style={[styles.media, styles.mediaPlaceholder]}>
              <Text>No URL / Processing Image...</Text>
            </View>
          )
        )}
        {item.caption && <Text style={styles.captionText}>{item.caption}</Text>}
        <Text style={styles.dateText}>Uploaded: {new Date(item.created_at).toLocaleDateString()}</Text>
        <TouchableOpacity
          style={[styles.deleteButton, isDeleting === item.id && styles.deleteButtonDisabled]}
          onPress={() => handleDelete(item)}
          disabled={isDeleting === item.id}
        >
          <Text style={styles.deleteButtonText}>{isDeleting === item.id ? "Deleting..." : "Delete"}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoadingStaffData || isLoadingImages) {
    return (
      <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" /><Text>Loading data...</Text></View>
    );
  }

  if (error) {
    return <View style={[styles.container, styles.centered]}><Text style={styles.errorText}>{error}</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gallery for {petName || `Pet ID: ${petId}`}</Text>

      <Button title="Upload New Image" onPress={pickImage} disabled={isUploading || !staffId} />
      {isUploading && <View style={styles.uploadIndicatorContainer}><ActivityIndicator /><Text style={{marginLeft: 10}}>Uploading...</Text></View>}
      {uploadError && <Text style={styles.errorText}>{uploadError}</Text>}
      {deleteError && <Text style={styles.errorText}>{deleteError}</Text>}

      {images.length === 0 ? (
        <Text style={styles.emptyListText}>No images found for this pet.</Text>
      ) : (
        <FlatList
          data={images}
          renderItem={renderImageItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContentContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f4f4f4',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginVertical: 10,
  },
  emptyListText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 30,
    fontSize: 16,
  },
  uploadIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  imageItemContainer: {
    flex: 1/2,
    margin: 5,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    position: 'relative',
  },
  media: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    marginBottom: 8,
  },
  mediaPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 10,
    color: '#888',
    marginBottom: 8,
  },
  mediaTypeLabel: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: 'white',
    fontSize: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    zIndex: 1,
  },
  deleteButton: {
    backgroundColor: '#ff4d4d',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  deleteButtonDisabled: {
    backgroundColor: '#ff9999',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});