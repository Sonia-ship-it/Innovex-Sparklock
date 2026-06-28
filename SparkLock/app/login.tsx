import { TopLayer } from "@/components/TopLayer";
import { useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import { useRef, useState } from "react";
import { Image, Text, TextInput, TouchableOpacity, View, Alert, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { authApi } from "../utils/api";
import { userStore } from "../utils/userStore";
import { Btn, styles } from "./index";

function InputText({ text, secureTextEntry, value, onChangeText, keyboardType, inputRef, returnKeyType, onSubmitEditing }:
    { text: string, secureTextEntry?: boolean, value?: string, onChangeText?: (t: string) => void, keyboardType?: any, inputRef?: any, returnKeyType?: any, onSubmitEditing?: () => void }) {
    const [focused, setFocused] = useState(false);
    const [visible, setVisible] = useState(false);

    return (
        <View className="relative">
            <TextInput
                ref={inputRef}
                style={styles.borgray}
                placeholder={text}
                secureTextEntry={secureTextEntry && !visible}
                value={value}
                onChangeText={onChangeText}
                keyboardType={keyboardType}
                returnKeyType={returnKeyType}
                onSubmitEditing={onSubmitEditing}
                blurOnSubmit={returnKeyType !== "next"}
                className={`rounded-lg border p-[14px] px-5 ${focused ? "border-[#D66A1F]" : "border-[#9F9F9F]"}`}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            />
            {secureTextEntry && (
                <TouchableOpacity
                    onPress={() => setVisible(!visible)}
                    className="absolute right-4 top-3"
                >
                    {visible ? <EyeOff size={24} color="#D66A1F" /> : <Eye size={24} color="#9F9F9F" />}
                </TouchableOpacity>
            )}
        </View>
    )
}

export default function Login() {
    const route = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const passwordRef = useRef<TextInput>(null);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        try {
            setLoading(true);
            const res = await authApi.login({ email, password });

            // Assume res.user contains the user details, and res.token contains JWT
            // Update userStore with retrieved info 
            if (res && res.user) {
                userStore.setUser({
                    fullName: res.user.firstName + (res.user.lastName ? ' ' + res.user.lastName : ''),
                    email: res.user.email,
                    token: res.token,
                    profileImage: res.user.profileImage,
                    location: res.user.location,
                    emergencyContact: res.user.emergencyContact
                });
            }
            route.replace("/(tabs)");
        } catch (error: any) {
            Alert.alert("Login Failed", error.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <TopLayer title="Login" big more="Enter your account credentials to access your Sparklock dashboard." />
            <KeyboardAwareScrollView
                className="flex-1"
                contentContainerStyle={{ paddingHorizontal: 24 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                enableOnAndroid={true}
                extraHeight={50}
                extraScrollHeight={20}
            >
                <View className="flex flex-col gap-5 pt-4">
                    <InputText
                        text="Email address"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                    <InputText
                        text="Password"
                        inputRef={passwordRef}
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                        returnKeyType="done"
                        onSubmitEditing={handleLogin}
                    />
                </View>
                <Text style={styles.text} className="text-right py-4" onPress={() => route.push("/reset-password")}>Forgot password ?</Text>
                <View className="flex justify-center items-center my-2">
                    <Btn title={loading ? "Loading..." : "Login"} disabled={loading} onPress={handleLogin} />
                </View>

                <Text style={styles.text} className="text-lg text-center mt-3 pb-10" onPress={() => route.push("/register")}>Don't have an account ? &nbsp;&nbsp;<Text style={styles.subtitle} className="text-[#D66A1F] underline">Sign Up</Text> </Text>
            </KeyboardAwareScrollView>
        </View>
    )
}
