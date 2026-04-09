import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MAX_PHOTOS, type HoldColour } from '../constants';
import type { RecordPhoto } from './useRecordForm';

export interface UseRecordCameraArgs {
  photosLength: number;
  addPhotos: (photos: RecordPhoto[]) => void;
}

export interface UseRecordCameraResult {
  capturePhoto: () => Promise<void>;
  uploadFromLibrary: () => Promise<void>;
}

/**
 * Camera and library image picker handlers for the Record screen.
 *
 * Preserves the original behaviour:
 *  - Camera permission prompt with explicit alert on denial
 *  - MediaTypeOptions images only, quality 0.8
 *  - Multi-selection on library pick limited to remaining slots
 */
export function useRecordCamera({
  photosLength,
  addPhotos,
}: UseRecordCameraArgs): UseRecordCameraResult {
  const capturePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission required', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      addPhotos([{ uri: result.assets[0].uri }]);
    }
  }, [addPhotos]);

  const uploadFromLibrary = useCallback(async () => {
    const remaining = MAX_PHOTOS - photosLength;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!result.canceled) {
      addPhotos(result.assets.map((a) => ({ uri: a.uri })));
    }
  }, [photosLength, addPhotos]);

  return { capturePhoto, uploadFromLibrary };
}

// Re-export for consumers that also want the colour type from the constants module.
export type { HoldColour };
