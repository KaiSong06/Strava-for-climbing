import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import type { DiscoveryTile } from '../searchTypes';

interface DiscoveryGridProps {
  tiles: DiscoveryTile[];
  onTilePress?: (tile: DiscoveryTile) => void;
}

function tileAccessibilityLabel(tile: DiscoveryTile): string {
  switch (tile.type) {
    case 'featured_climb':
      return `Featured climb: ${tile.problemName ?? 'unnamed'}, grade ${tile.grade ?? 'unknown'}`;
    case 'gym_spotlight':
      return `Gym spotlight: ${tile.gymName ?? 'unknown gym'}`;
    case 'tall_video':
      return `Featured video clip`;
    case 'featured_athlete':
      return `Featured athlete: ${tile.athlete?.username ?? 'unknown'}`;
    case 'standard':
    default:
      return 'Discover climb';
  }
}

const GAP = spacing.sm; // 8px gap between tiles
const SIDE_PADDING = spacing.lg; // matches content padding in ScrollView (16px each side)
const SCREEN_W = Dimensions.get('window').width;
const GRID_W = SCREEN_W - SIDE_PADDING * 2;
const COL = (GRID_W - GAP * 2) / 3; // width of 1 column
const COL2 = COL * 2 + GAP; // width of 2 columns

/**
 * Bento grid matching the mockup layout:
 *
 * Row group A (height = COL2):
 *   [featured_climb col0-1 × row0-1] | [gym_spotlight col2 × row0]
 *                                    | [standard      col2 × row1]
 *
 * Row group B (height = COL2):
 *   [standard col0 × row2] [standard col1 × row2] | [tall_video col2 × row2-3]
 *   [standard col0 × row3]  ←── empty space       |
 *
 * Row group C (height = COL):
 *   [featured_athlete col0-1 × row4] | [standard col2 × row4]
 *
 * Row group D (height = COL):
 *   [standard] [standard] [standard]
 */
export function DiscoveryGrid({ tiles, onTilePress }: DiscoveryGridProps) {
  const featured = tiles.find((t) => t.type === 'featured_climb');
  const gymSpot = tiles.find((t) => t.type === 'gym_spotlight');
  const tallVideo = tiles.find((t) => t.type === 'tall_video');
  const athlete = tiles.find((t) => t.type === 'featured_athlete');
  const standards = tiles.filter((t) => t.type === 'standard');

  return (
    <View style={styles.grid}>
      {/* ── Row group A ─────────────────────────────────────────────── */}
      <View style={[styles.row, { height: COL2 }]}>
        {/* Featured 2×2 */}
        {featured && (
          <AccessiblePressable
            style={[styles.tile, { width: COL2, height: COL2 }]}
            onPress={() => onTilePress?.(featured)}
            accessibilityLabel={tileAccessibilityLabel(featured)}
            accessibilityRole="button"
          >
            <Image source={{ uri: featured.imageUrl! }} style={styles.fill} />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.82)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.featuredInfo}>
              <View style={styles.gradeBadge}>
                <Text style={styles.gradeText}>{featured.grade} CRUX</Text>
              </View>
              <Text style={styles.featuredName}>{featured.problemName}</Text>
            </View>
            {featured.isVideo && (
              <View style={styles.playTopRight}>
                <MaterialCommunityIcons
                  name="play-circle-outline"
                  size={28}
                  color="rgba(255,255,255,0.5)"
                />
              </View>
            )}
          </AccessiblePressable>
        )}

        {/* Right column: gym spotlight (top) + standard (bottom) */}
        <View style={[styles.col, { width: COL, height: COL2, marginLeft: GAP }]}>
          {gymSpot && (
            <AccessiblePressable
              style={[styles.tile, { width: COL, height: COL, overflow: 'hidden' }]}
              onPress={() => onTilePress?.(gymSpot)}
              accessibilityLabel={tileAccessibilityLabel(gymSpot)}
              accessibilityRole="button"
            >
              <View style={styles.gymSpotInner}>
                <MaterialCommunityIcons name="dumbbell" size={20} color={colors.primary} />
                <Text style={styles.gymLabel}>GYM{'\n'}SPOTLIGHT</Text>
                <Text style={styles.gymName}>{gymSpot.gymName}</Text>
              </View>
            </AccessiblePressable>
          )}
          {standards[0] && (
            <AccessiblePressable
              style={[styles.tile, { width: COL, height: COL, marginTop: GAP }]}
              onPress={() => onTilePress?.(standards[0]!)}
              accessibilityLabel={tileAccessibilityLabel(standards[0])}
              accessibilityRole="button"
            >
              <Image source={{ uri: standards[0].imageUrl! }} style={styles.fill} />
            </AccessiblePressable>
          )}
        </View>
      </View>

      {/* ── Row group B ─────────────────────────────────────────────── */}
      <View style={[styles.row, { height: COL2, marginTop: GAP }]}>
        {/* Left 2 cols: 2×2 of standard tiles (with gap in bottom-right) */}
        <View style={[styles.col, { width: COL2, height: COL2 }]}>
          {/* Top row: 2 standards */}
          <View style={styles.row}>
            {standards[1] && (
              <AccessiblePressable
                style={[styles.tile, { width: COL, height: COL }]}
                onPress={() => onTilePress?.(standards[1]!)}
                accessibilityLabel={tileAccessibilityLabel(standards[1])}
                accessibilityRole="button"
              >
                <Image source={{ uri: standards[1].imageUrl! }} style={styles.fill} />
              </AccessiblePressable>
            )}
            {standards[2] && (
              <AccessiblePressable
                style={[styles.tile, { width: COL, height: COL, marginLeft: GAP }]}
                onPress={() => onTilePress?.(standards[2]!)}
                accessibilityLabel={tileAccessibilityLabel(standards[2])}
                accessibilityRole="button"
              >
                <Image source={{ uri: standards[2].imageUrl! }} style={styles.fill} />
              </AccessiblePressable>
            )}
          </View>
          {/* Bottom row: 1 standard (left), gap (right) */}
          <View style={[styles.row, { marginTop: GAP }]}>
            {standards[3] && (
              <AccessiblePressable
                style={[styles.tile, { width: COL, height: COL }]}
                onPress={() => onTilePress?.(standards[3]!)}
                accessibilityLabel={tileAccessibilityLabel(standards[3])}
                accessibilityRole="button"
              >
                <Image source={{ uri: standards[3].imageUrl! }} style={styles.fill} />
              </AccessiblePressable>
            )}
          </View>
        </View>

        {/* Right col: tall video (spans full group height) */}
        {tallVideo && (
          <AccessiblePressable
            style={[styles.tile, { width: COL, height: COL2, marginLeft: GAP }]}
            onPress={() => onTilePress?.(tallVideo)}
            accessibilityLabel={tileAccessibilityLabel(tallVideo)}
            accessibilityRole="button"
          >
            <Image source={{ uri: tallVideo.imageUrl! }} style={styles.fill} />
            <View style={styles.videoOverlay} />
            <View style={styles.playCenter}>
              <MaterialCommunityIcons name="play" size={36} color="#fff" />
            </View>
          </AccessiblePressable>
        )}
      </View>

      {/* ── Row group C: featured athlete + standard ─────────────────── */}
      <View style={[styles.row, { marginTop: GAP }]}>
        {athlete && (
          <AccessiblePressable
            style={[styles.tile, styles.athleteCard, { width: COL2, height: COL }]}
            onPress={() => onTilePress?.(athlete)}
            accessibilityLabel={tileAccessibilityLabel(athlete)}
            accessibilityRole="button"
          >
            <Image source={{ uri: athlete.athlete!.avatarUrl }} style={styles.athleteAvatar} />
            <View style={styles.athleteInfo}>
              <Text style={styles.athleteUsername}>{athlete.athlete!.username}</Text>
              <Text style={styles.athleteAchievement}>{athlete.athlete!.achievement}</Text>
            </View>
            <View style={styles.followBtn}>
              <Text style={styles.followBtnText}>Follow</Text>
            </View>
          </AccessiblePressable>
        )}
        {standards[4] && (
          <AccessiblePressable
            style={[styles.tile, { width: COL, height: COL, marginLeft: GAP }]}
            onPress={() => onTilePress?.(standards[4]!)}
            accessibilityLabel={tileAccessibilityLabel(standards[4])}
            accessibilityRole="button"
          >
            <Image source={{ uri: standards[4].imageUrl! }} style={styles.fill} />
          </AccessiblePressable>
        )}
      </View>

      {/* ── Row group D: 3 standard tiles ───────────────────────────── */}
      <View style={[styles.row, { marginTop: GAP }]}>
        {standards.slice(5, 8).map((tile, i) => (
          <AccessiblePressable
            key={tile.id}
            style={[styles.tile, { width: COL, height: COL, marginLeft: i > 0 ? GAP : 0 }]}
            onPress={() => onTilePress?.(tile)}
            accessibilityLabel={tileAccessibilityLabel(tile)}
            accessibilityRole="button"
          >
            <Image source={{ uri: tile.imageUrl! }} style={styles.fill} />
          </AccessiblePressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {},
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  col: {
    flexDirection: 'column',
  },
  tile: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
  },
  fill: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // ── Featured climb ────────────────────────────────────────────────
  featuredInfo: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
  },
  gradeBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  gradeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: colors.onPrimary,
    letterSpacing: 0.5,
  },
  featuredName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#fff',
    letterSpacing: -0.3,
  },
  playTopRight: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  },

  // ── Gym spotlight ─────────────────────────────────────────────────
  gymSpotInner: {
    flex: 1,
    backgroundColor: 'rgba(168,200,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  gymLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 14,
    marginTop: spacing.sm,
  },
  gymName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.onSurface,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 15,
  },

  // ── Tall video ────────────────────────────────────────────────────
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  playCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.lg,
  },

  // ── Featured athlete ──────────────────────────────────────────────
  athleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  athleteAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(168,200,255,0.25)',
  },
  athleteInfo: {
    flex: 1,
  },
  athleteUsername: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: colors.onSurface,
  },
  athleteAchievement: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  followBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  followBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: colors.onPrimary,
  },
});
