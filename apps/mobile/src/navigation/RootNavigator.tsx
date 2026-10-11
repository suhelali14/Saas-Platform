import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/HomeScreen";
import ExploreScreen from "../screens/ExploreScreen";
import ActivityScreen from "../screens/ActivityScreen";
import ProfileScreen from "../screens/ProfileScreen";
import PreferencesScreen from "../screens/PreferencesScreen";
import InviteFriendsScreen from "../screens/InviteFriendsScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import ResultsScreen from "../screens/ResultsScreen";
import BusinessProfileScreen from "../screens/BusinessProfileScreen";
import BookingScreen from "../screens/BookingScreen";
import BookingConfirmScreen from "../screens/BookingConfirmScreen";
import BookingsScreen from "../screens/BookingsScreen";
import AuthNavigator from "./AuthNavigator";
import SplashScreen from "../screens/auth/SplashScreen";
import type { ActivityStackParamList, ExploreStackParamList, HomeStackParamList, ProfileStackParamList, RootTabParamList, BookingsStackParamList } from "./types";
import { colors } from "../theme/tokens";
import { useAuth } from "../context/AuthContext";

const Tab = createBottomTabNavigator<RootTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();
const ActivityStack = createNativeStackNavigator<ActivityStackParamList>();
const BookingsStack = createNativeStackNavigator<BookingsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  HomeTab: "home-outline",
  ExploreTab: "grid-outline",
  BookingsTab: "calendar-outline",
  ActivityTab: "time-outline",
  ProfileTab: "person-outline",
};

// Every tab root screen (Home/Explore/Activity/Profile) renders its own
// custom header -- headerShown: false here is load-bearing, not cosmetic.
// Without it react-navigation's native header stacks on top of the
// screen's own header (this was the double-header bug). Pushed detail
// screens (Results, BusinessProfile, Preferences, InviteFriends) keep the
// native header -- they don't render their own.

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="Results" component={ResultsScreen} options={{ title: "Results" }} />
      <HomeStack.Screen name="BusinessProfile" component={BusinessProfileScreen} options={{ title: "Details" }} />
      <HomeStack.Screen name="Booking" component={BookingScreen} options={{ title: "Book Appointment" }} />
      <HomeStack.Screen name="BookingConfirm" component={BookingConfirmScreen} options={{ headerShown: false }} />
    </HomeStack.Navigator>
  );
}

function ActivityStackNavigator() {
  return (
    <ActivityStack.Navigator>
      <ActivityStack.Screen name="Activity" component={ActivityScreen} options={{ headerShown: false }} />
      <ActivityStack.Screen name="Results" component={ResultsScreen} options={{ title: "Results" }} />
      <ActivityStack.Screen
        name="BusinessProfile"
        component={BusinessProfileScreen}
        options={{ title: "Details" }}
      />
      <ActivityStack.Screen name="Booking" component={BookingScreen} options={{ title: "Book Appointment" }} />
      <ActivityStack.Screen name="BookingConfirm" component={BookingConfirmScreen} options={{ headerShown: false }} />
    </ActivityStack.Navigator>
  );
}

function ExploreStackNavigator() {
  return (
    <ExploreStack.Navigator>
      <ExploreStack.Screen name="Explore" component={ExploreScreen} options={{ headerShown: false }} />
      <ExploreStack.Screen name="Results" component={ResultsScreen} options={{ title: "Results" }} />
      <ExploreStack.Screen
        name="BusinessProfile"
        component={BusinessProfileScreen}
        options={{ title: "Details" }}
      />
      <ExploreStack.Screen name="Booking" component={BookingScreen} options={{ title: "Book Appointment" }} />
      <ExploreStack.Screen name="BookingConfirm" component={BookingConfirmScreen} options={{ headerShown: false }} />
    </ExploreStack.Navigator>
  );
}

function BookingsStackNavigator() {
  return (
    <BookingsStack.Navigator>
      <BookingsStack.Screen name="Bookings" component={BookingsScreen} options={{ headerShown: false }} />
      <BookingsStack.Screen name="Results" component={ResultsScreen} options={{ title: "Results" }} />
      <BookingsStack.Screen
        name="BusinessProfile"
        component={BusinessProfileScreen}
        options={{ title: "Details" }}
      />
      <BookingsStack.Screen name="Booking" component={BookingScreen} options={{ title: "Book Appointment" }} />
      <BookingsStack.Screen name="BookingConfirm" component={BookingConfirmScreen} options={{ headerShown: false }} />
    </BookingsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="Preferences" component={PreferencesScreen} options={{ title: "Preferences" }} />
      <ProfileStack.Screen name="InviteFriends" component={InviteFriendsScreen} options={{ title: "Invite Friends" }} />
      <ProfileStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: "Change Password" }}
      />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name as keyof RootTabParamList]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: "Home" }} />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreStackNavigator}
        options={{ tabBarLabel: "Explore" }}
      />
      <Tab.Screen
        name="BookingsTab"
        component={BookingsStackNavigator}
        options={{ tabBarLabel: "Bookings" }}
      />
      <Tab.Screen
        name="ActivityTab"
        component={ActivityStackNavigator}
        options={{ tabBarLabel: "Activity" }}
      />
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

/**
 * Gates the whole app on auth state -- see AuthContext for how `user` gets
 * resolved. SplashScreen (the JS one, matching the Figma design) covers the
 * gap between the native splash handing off and this resolving. Not logged
 * in -> Welcome/Login/Register; logged in (including guest) -> the main tabs.
 */
export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return <NavigationContainer>{user ? <MainTabs /> : <AuthNavigator />}</NavigationContainer>;
}
