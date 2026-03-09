import React from "react";
import { View, Text, ActivityIndicator, StyleSheet, Image } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppBackground } from "./src/components/AppBackground";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import HomeScreen from "./src/screens/HomeScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import AICoachScreen from "./src/screens/AICoachScreen";
import FlowTimerScreen from "./src/screens/FlowTimerScreen";
import SomaticShredderScreen from "./src/screens/SomaticShredderScreen";
import GratitudeCardScreen from "./src/screens/GratitudeCardScreen";

const Tab = createBottomTabNavigator();
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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home-outline";
          if (route.name === "主頁") iconName = "home-outline";
          else if (route.name === "正向教練") iconName = "chatbubbles-outline";
          else if (route.name === "離線深潛") iconName = "timer-outline";
          else if (route.name === "抒壓") iconName = "construct-outline";
          else if (route.name === "感恩") iconName = "heart-outline";
          else if (route.name === "設定") iconName = "settings-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#d56c2f",
        tabBarInactiveTintColor: "#9ca3af"
      })}
    >
      <Tab.Screen name="主頁" component={HomeScreen} />
      <Tab.Screen name="正向教練" component={AICoachScreen} />
      <Tab.Screen name="離線深潛" component={FlowTimerScreen} />
      <Tab.Screen name="抒壓" component={SomaticShredderScreen} />
      <Tab.Screen name="感恩" component={GratitudeCardScreen} />
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

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
            <RootNavigator />
          </SafeAreaView>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fefce8" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingLogo: { width: 80, height: 80, marginBottom: 16 },
  loadingText: { marginTop: 8, fontSize: 14, color: "#78716c" }
});
