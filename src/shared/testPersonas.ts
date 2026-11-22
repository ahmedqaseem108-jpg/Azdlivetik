import type { TikTokUser } from './types';

// Client-only testing personas using locally generated studio portraits
export const TEST_AVATARS = {
  creator: '/src/assets/images/avatar_creator_studio_1795328027150.jpg',
  gold: '/src/assets/images/avatar_supporter_gold_1795328026456.jpg',
  neon: '/src/assets/images/avatar_supporter_neon_1795328026080.jpg',
};

export const TEST_SUPPORTERS_POOL: TikTokUser[] = [
  {
    userId: 'test_u_1',
    uniqueId: 'sultan_vip',
    nickname: 'السلطان VIP',
    avatar: TEST_AVATARS.gold,
  },
  {
    userId: 'test_u_2',
    uniqueId: 'nova_creator',
    nickname: 'Nova Stream',
    avatar: TEST_AVATARS.neon,
  },
  {
    userId: 'test_u_3',
    uniqueId: 'khaled_king',
    nickname: 'خالد الملكي',
    avatar: TEST_AVATARS.creator,
  },
  {
    userId: 'test_u_4',
    uniqueId: 'reem_galaxy',
    nickname: 'ريم المجرة',
    avatar: TEST_AVATARS.gold,
  },
  {
    userId: 'test_u_5',
    uniqueId: 'zayd_pro',
    nickname: 'Zayd Pro',
    avatar: TEST_AVATARS.neon,
  },
  {
    userId: 'test_u_6',
    uniqueId: 'omar_legend',
    nickname: 'عمر الأسطورة',
    avatar: TEST_AVATARS.creator,
  },
];

export function pickRandomTestUser(index?: number): TikTokUser {
  if (typeof index === 'number') {
    return TEST_SUPPORTERS_POOL[index % TEST_SUPPORTERS_POOL.length];
  }
  return TEST_SUPPORTERS_POOL[Math.floor(Math.random() * TEST_SUPPORTERS_POOL.length)];
}
