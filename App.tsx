import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
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
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "chatbubbles-outline";
          if (route.name === "正向教練") iconName = "chatbubbles-outline";
          else if (route.name === "心流計時") iconName = "timer-outline";
          else if (route.name === "抒壓") iconName = "construct-outline";
          else if (route.name === "感恩") iconName = "heart-outline";
          else if (route.name === "設定") iconName = "settings-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#9ca3af"
      })}
    >
      <Tab.Screen name="正向教練" component={AICoachScreen} />
      <Tab.Screen name="心流計時" component={FlowTimerScreen} />
      <Tab.Screen name="抒壓" component={SomaticShredderScreen} />
      <Tab.Screen name="感恩" component={GratitudeCardScreen} />
      <Tab.Screen name="設定" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>載入中…</Text>
      </View>
    );
  }

  return user ? <MainTabs /> : <AuthNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f9fafb" },
  loadingText: { marginTop: 8, fontSize: 14, color: "#6b7280" }
});
