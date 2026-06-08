/** User quotes and top tools with portrait photos. */
export interface SuccessStory {
  id: string;
  imageSrc: string;
  name: string;
  roleKey: string;
  quoteKey: string;
  toolKeys: [string, string, string];
}

export const successStories: SuccessStory[] = [
  {
    id: 'ana',
    imageSrc:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
    name: 'Ana Silva',
    roleKey: 'audience_story_ana_role',
    quoteKey: 'audience_story_ana_quote',
    toolKeys: ['audience_story_ana_tool_1', 'audience_story_ana_tool_2', 'audience_story_ana_tool_3'],
  },
  {
    id: 'ben',
    imageSrc:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop',
    name: 'Ben Carter',
    roleKey: 'audience_story_ben_role',
    quoteKey: 'audience_story_ben_quote',
    toolKeys: ['audience_story_ben_tool_1', 'audience_story_ben_tool_2', 'audience_story_ben_tool_3'],
  },
  {
    id: 'chloe',
    imageSrc:
      'https://images.unsplash.com/photo-1521119989659-a83eee488004?q=80&w=400&auto=format&fit=crop',
    name: 'Chloe Davis',
    roleKey: 'audience_story_chloe_role',
    quoteKey: 'audience_story_chloe_quote',
    toolKeys: ['audience_story_chloe_tool_1', 'audience_story_chloe_tool_2', 'audience_story_chloe_tool_3'],
  },
  {
    id: 'david',
    imageSrc:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
    name: 'David Chen',
    roleKey: 'audience_story_david_role',
    quoteKey: 'audience_story_david_quote',
    toolKeys: ['audience_story_david_tool_1', 'audience_story_david_tool_2', 'audience_story_david_tool_3'],
  },
];
