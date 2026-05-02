import React from "react";
import { View, Text, ActivityIndicator, StyleSheet, Image } from "react-native";
import {
  NavigationContainer,
  DefaultTheme as NavDefaultTheme,
  DarkTheme as NavDarkTheme
} from "@react-navigation/native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppBackground } from "./src/components/AppBackground";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import HomeScreen from "./src/screens/HomeScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import AICoachScreen from "./src/screens/AICoachScreen";
import FlowTimerScreen from "./src/screens/FlowTimerScreen";
import SomaticShredderScreen from "./src/screens/SomaticShredderScreen";
import GratitudeCardScreen from "./src/screens/GratitudeCardScreen";
import type { RootTabParamList } from "./src/navigation/types";

const Tab = createBottomTabNavigator<RootTabParamList>();
const AuthStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  const { colors, isDark } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home-outline";
          if (route.name === "主頁") iconName = "home-outline";
          else if (route.name === "正向教練") iconName = "chatbubbles-outline";
          else if (route.name === "離線深潛") iconName = "timer-outline";
          else if (route.name === "紓壓") iconName = "construct-outline";
          else if (route.name === "感恩") iconName = "heart-outline";
          else if (route.name === "設定") iconName = "settings-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: isDark ? "#64748b" : "#9ca3af",
        tabBarLabelStyle: {
          fontSize: 11
        }
      })}
    >
      <Tab.Screen name="主頁" component={HomeScreen} />
      <Tab.Screen name="正向教練" component={AICoachScreen} />
      <Tab.Screen name="離線深潛" component={FlowTimerScreen} />
      <Tab.Screen
        name="紓壓"
        component={SomaticShredderScreen}
        options={{ tabBarLabel: "紓壓碎紙" }}
      />
      <Tab.Screen
        name="感恩"
        component={GratitudeCardScreen}
        options={{ tabBarLabel: "火炬傳暖" }}
      />
      <Tab.Screen name="設定" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading, pendingOtp } = useAuth();

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.loading}>
          <Image
            source={require("./assets/img/AppLogo.png")}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color="#d56c2f" />
          <Text style={styles.loadingText}>載入中…</Text>
        </View>
      </AppBackground>
    );
  }

  return user && !pendingOtp ? <MainTabs /> : <AuthNavigator />;
}

function AppNavigation() {
  const { isDark, colors } = useTheme();
  const navTheme = React.useMemo(
    () => ({
      ...(isDark ? NavDarkTheme : NavDefaultTheme),
      colors: {
        ...(isDark ? NavDarkTheme : NavDefaultTheme).colors,
        primary: colors.accent,
        background: colors.safeAreaBg,
        card: colors.tabBarBg,
        text: colors.text,
        border: colors.tabBarBorder,
        notification: colors.accent
      }
    }),
    [isDark, colors]
  );

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.safeAreaBg }]} edges={["top", "left", "right"]}>
        <RootNavigator />
      </SafeAreaView>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigation />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingLogo: { width: 80, height: 80, marginBottom: 16 },
  loadingText: { marginTop: 8, fontSize: 14, color: "#78716c" }
});
