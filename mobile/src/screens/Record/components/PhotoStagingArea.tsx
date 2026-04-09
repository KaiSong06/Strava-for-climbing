import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { MAX_PHOTOS } from '../constants';
import type { RecordPhoto } from '../hooks/useRecordForm';

interface PhotoStagingAreaProps {
  photos: RecordPhoto[];
  onCapturePhoto: () => void;
  onUploadFromLibrary: () => void;
  onRemovePhoto: (index: number) => void;
}

export function PhotoStagingArea({
  photos,
  onCapturePhoto,
  onUploadFromLibrary,
  onRemovePhoto,
}: PhotoStagingAreaProps) {
  if (photos.length === 0) {
    return (
      <>
        <AccessiblePressable
          style={styles.actionCard}
          onPress={onCapturePhoto}
          accessibilityLabel="Capture photo with camera"
          accessibilityRole="button"
        >
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(168,200,255,0.1)' }]}>
            <MaterialCommunityIcons name="camera" size={28} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Capture Photo</Text>
          <Text style={styles.cardSubtitle}>Open camera to take a photo</Text>
        </AccessiblePressable>

        <AccessiblePressable
          style={styles.actionCard}
          onPress={onUploadFromLibrary}
          accessibilityLabel="Upload photos from your device library"
          accessibilityRole="button"
        >
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(178,199,240,0.1)' }]}>
            <MaterialCommunityIcons name="cloud-upload" size={28} color={colors.secondary} />
          </View>
          <Text style={styles.cardTitle}>Upload from Library</Text>
          <Text style={styles.cardSubtitle}>Choose from your device gallery</Text>
        </AccessiblePressable>
      </>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photoStrip}
      >
        {photos.map((photo, index) => (
          <View key={photo.uri} style={styles.photoThumb}>
            <Image source={{ uri: photo.uri }} style={styles.photoThumbImage} resizeMode="cover" />
            <AccessiblePressable
              style={styles.photoRemoveButton}
              onPress={() => onRemovePhoto(index)}
              accessibilityLabel={`Remove photo ${index + 1}`}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="close" size={14} color={colors.onSurface} />
            </AccessiblePressable>
          </View>
        ))}
        {photos.length < MAX_PHOTOS && (
          <AccessiblePressable
            style={styles.addPhotoButton}
            onPress={onUploadFromLibrary}
            accessibilityLabel="Add another photo"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="plus" size={24} color={colors.onSurfaceVariant} />
          </AccessiblePressable>
        )}
      </ScrollView>
      <Text style={styles.photoCounter}>
        {photos.length}/{MAX_PHOTOS} photos
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(66,71,82,0.10)',
    gap: spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  photoStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(14,14,14,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant,
  },
  photoCounter: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
});
