export interface UserVoice {
  id: string;
  imageSrc: string;
  imageAltKey: string;
  roleKey: string;
  quoteKey: string;
  highlightKey: string;
}

/** Scenario-based feedback with design assets — role labels, not stock portrait names. */
export const userVoices: UserVoice[] = [
  {
    id: 'voice-newcomer',
    imageSrc: '/marketing/jobseeker-scene.jpg',
    imageAltKey: 'beta_voice_img_newcomer_alt',
    roleKey: 'beta_voice_role_newcomer',
    quoteKey: 'beta_voice_quote_newcomer',
    highlightKey: 'beta_voice_highlight_newcomer',
  },
  {
    id: 'voice-switcher',
    imageSrc: '/marketing/pricing-visual.jpg',
    imageAltKey: 'beta_voice_img_switcher_alt',
    roleKey: 'beta_voice_role_switcher',
    quoteKey: 'beta_voice_quote_switcher',
    highlightKey: 'beta_voice_highlight_switcher',
  },
  {
    id: 'voice-employer',
    imageSrc: '/marketing/employer-scene.jpg',
    imageAltKey: 'beta_voice_img_employer_alt',
    roleKey: 'beta_voice_role_employer',
    quoteKey: 'beta_voice_quote_employer',
    highlightKey: 'beta_voice_highlight_employer',
  },
];
