export const me = {
  name: 'Kit Marlowe',
  handle: 'kit',
  initials: 'KM',
  joined: 'Joined Nov 2026',
  stats: [
    { value: '12', label: 'Cases solved' },
    { value: '7', label: 'Squads' },
    { value: '#1', label: 'Best placement' },
    { value: '$83.33', label: 'Bounty earned' },
  ],
  packs: [
    { id: 's01', season: 'Season 01', title: 'The Aurora Seed', creator: 'Nova', episodes: '4', owned: 2 },
    { id: 'glass', season: 'Season 01', title: 'Glass Harbor', creator: 'Rook', episodes: '3', owned: 3 },
  ],
  squads: [
    { id: 'q14', squad: 'Squad 14', members: ['Kit', 'Lou', 'Ana'], drop: 'The Aurora Seed', placement: '#2', earned: '$33.33', when: 'Today' },
    { id: 'q9', squad: 'Squad 9', members: ['Kit', 'Mae'], drop: 'Glass Harbor', placement: '#1', earned: '$50.00', when: 'Nov 8' },
    { id: 'q3', squad: 'Squad 3', members: ['Kit', 'Theo', 'Ivy'], drop: 'Night Ferry', placement: '#6', earned: null, when: 'Nov 1' },
  ],
};
