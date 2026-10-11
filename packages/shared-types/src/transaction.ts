export type TransactionStatus = "PENDING" | "COMPLETED" | "REFUNDED" | "DISPUTED";

export interface Transaction {
  id: string;
  userId: string;
  businessId: string;
  offerId?: string | null;
  amount: number;
  commissionAmount: number;
  currency: string;
  status: TransactionStatus;
  paymentReference?: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  transactionId: string;
  rating: number;
  text?: string | null;
  createdAt: string;
}

export type RewardLedgerType = "REFERRAL" | "REDEMPTION";

export interface RewardLedgerEntry {
  id: string;
  userId: string;
  type: RewardLedgerType;
  amount: number;
  relatedTransactionId?: string | null;
  createdAt: string;
}
