import { TopLayer } from "@/components/TopLayer";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View, Alert } from "react-native";
import { authApi } from "../utils/api";
import { Btn, styles } from "./index";

export function InputText({ text, keyboardType, value, onChangeText }: { text: string, keyboardType?: any, value?: string, onChangeText?: (t: string) => void }) {
    const [focused, setFocused] = useState(false)
    return (
        <TextInput
            style={styles.borgray}
            placeholder={text}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            className={`rounded-lg border p-3 px-4 ${focused ? "border-[#D66A1F]" : "border-[#9F9F9F]"} `}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
    )
}
export default function Reset() {
    const route = useRouter();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const handleContinue = async () => {
        if (!email) return;
        try {
            setLoading(true);
            await authApi.resetPassword({ email });
            route.push(`/otp?email=${encodeURIComponent(email)}`);
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to send reset code.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <TopLayer title="Reset Password" big />
            <View className="m-6 gap-4">
                <Text style={styles.subtitle} className="text-[#464646FF] text-center text-lg">Enter your valid email address so as to reset your password</Text>
                <View className="flex flex-col gap-6 py-4">
                    <InputText
                        text="Email address"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />
                </View>
                <View className="flex justify-center items-center my-3">
                    <Btn title={loading ? "Sending..." : "Continue"} disabled={loading} onPress={handleContinue} />
                </View>
            </View>
        </View>
    )
}