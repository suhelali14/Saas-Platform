export interface User {
  id: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  rewardCredits: number;
  createdAt: string;
}
