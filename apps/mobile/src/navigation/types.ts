// Results and BusinessProfile are pushed from both the Home tab and the
// Activity tab (each owns its own stack, per docs/05-native-app-spec.md's
// screen map) -- shared here so both stacks agree on the same param shape.
export type SharedStackParamList = {
  Results: { intentRequestId: string };
  BusinessProfile: { businessId: string };
  Booking: {
    matchId?: string;
    offerId: string;
    businessId: string;
    offerPrice: number;
    offerDescription: string;
    businessName: string;
    hasRazorpay: boolean;
    currency: string;
  };
  BookingConfirm: {
    bookingId: string;
    status: string;
    paymentMode: string;
    scheduledAt: string;
    businessName: string;
  };
  Bookings: undefined;
};

export type HomeStackParamList = SharedStackParamList & {
  Home: undefined;
};

export type ExploreStackParamList = SharedStackParamList & {
  Explore: undefined;
};

export type ActivityStackParamList = SharedStackParamList & {
  Activity: undefined;
};

export type BookingsStackParamList = SharedStackParamList & {
  Bookings: undefined;
};

export type ProfileStackParamList = SharedStackParamList & {
  Profile: undefined;
  Preferences: undefined;
  InviteFriends: undefined;
  ChangePassword: undefined;
};

export type RootTabParamList = {
  HomeTab: undefined;
  ExploreTab: undefined;
  BookingsTab: undefined;
  ActivityTab: undefined;
  ProfileTab: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
};
