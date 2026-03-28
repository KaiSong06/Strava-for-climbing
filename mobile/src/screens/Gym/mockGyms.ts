export interface RecentClimb {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string;
  grade: string;
  type: 'flash' | 'send' | 'attempt';
}

export interface Gym {
  id: string;
  name: string;
  distance: string;
  hours: string;
  tier: 'PRO LEVEL' | 'CLASSIC' | 'ELITE';
  activeCount: number;
  imageUrl: string;
  latitude: number;
  longitude: number;
  recentClimbs: RecentClimb[];
}

export const MOCK_GYMS: Gym[] = [
  {
    id: '1',
    name: 'The Vertical Lab',
    distance: '0.8 miles away',
    hours: 'Open until 11pm',
    tier: 'PRO LEVEL',
    activeCount: 142,
    imageUrl: 'https://picsum.photos/seed/gym-vertical/800/450',
    latitude: 37.7749,
    longitude: -122.4194,
    recentClimbs: [
      {
        id: 'rc1',
        userId: 'u1',
        userName: 'Alex R.',
        avatarUrl: 'https://picsum.photos/seed/climber1/100',
        grade: 'V7',
        type: 'flash',
      },
      {
        id: 'rc2',
        userId: 'u2',
        userName: 'Jamie K.',
        avatarUrl: 'https://picsum.photos/seed/climber2/100',
        grade: 'V5',
        type: 'send',
      },
      {
        id: 'rc3',
        userId: 'u3',
        userName: 'Sam W.',
        avatarUrl: 'https://picsum.photos/seed/climber3/100',
        grade: 'V4',
        type: 'send',
      },
      {
        id: 'rc4',
        userId: 'u4',
        userName: 'Chris P.',
        avatarUrl: 'https://picsum.photos/seed/climber4/100',
        grade: 'V6',
        type: 'flash',
      },
      {
        id: 'rc5',
        userId: 'u5',
        userName: 'Morgan L.',
        avatarUrl: 'https://picsum.photos/seed/climber5/100',
        grade: 'V3',
        type: 'send',
      },
    ],
  },
  {
    id: '2',
    name: 'Stone Summit',
    distance: '2.4 miles away',
    hours: 'Closes 9pm',
    tier: 'CLASSIC',
    activeCount: 58,
    imageUrl: 'https://picsum.photos/seed/gym-stone/800/450',
    latitude: 37.7789,
    longitude: -122.4094,
    recentClimbs: [
      {
        id: 'rc6',
        userId: 'u6',
        userName: 'Taylor M.',
        avatarUrl: 'https://picsum.photos/seed/climber6/100',
        grade: 'V3',
        type: 'send',
      },
      {
        id: 'rc7',
        userId: 'u7',
        userName: 'Jordan B.',
        avatarUrl: 'https://picsum.photos/seed/climber7/100',
        grade: 'V5',
        type: 'flash',
      },
    ],
  },
  {
    id: '3',
    name: 'Urban Ascent',
    distance: '5.1 miles away',
    hours: '24/7 Access',
    tier: 'ELITE',
    activeCount: 12,
    imageUrl: 'https://picsum.photos/seed/gym-urban/800/450',
    latitude: 37.7649,
    longitude: -122.4094,
    recentClimbs: [],
  },
];
