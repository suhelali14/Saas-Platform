/** Width and height of each screen in public/shots, so a page never jumps as they load. */
export const shotSize = {
  'assistant-card': [1440, 738],
  'audit': [1600, 1160],
  'billing': [1600, 1406],
  'd-assistant': [792, 558],
  'd-growth': [1151, 500],
  'd-listening': [908, 1036],
  'd-queue': [928, 890],
  'growth-autoreply': [1600, 784],
  'growth-customers': [1600, 1006],
  'growth-home': [1600, 1324],
  'growth-optin': [1600, 370],
  'growth-proof': [1600, 864],
  'growth-reports': [1600, 1150],
  'growth-statement': [1412, 1522],
  'listening': [1469, 1036],
  'livequeue': [1600, 1760],
  'patient': [1600, 1238],
  'pharmacy': [1520, 940],
  'queue': [1600, 860],
  'rx': [1472, 780],
  'site-mr': [1600, 950],
  'site': [1600, 900],
  'visit-draft': [1483, 1260],
  'website-builder': [1600, 1040],
} as const;

export type ShotName = keyof typeof shotSize;
