import { TopLayer } from "@/components/TopLayer";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { Image, Text, TextInput, View, Alert } from "react-native";
import { authApi } from "../utils/api";
import Key from "../assets/icons/key.png";
import { Btn, styles } from "./index";

export function InputText({ text }: { text: string }) {
    const [focused, setFocused] = useState(false)
    return (
        <TextInput
            style={styles.borgray}
            placeholder={text}
            className={`rounded-lg border p-3 px-4 ${focused ? "border-[#9F9F9F]" : "border-[#9F9F9F]"} `}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
    )
}
export default function OTP() {
    const route = useRouter();
    const { email } = useLocalSearchParams<{ email: string }>();
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [step, setStep] = useState(1);
    const [error, setError] = useState(false);
    const [timeLeft, setTimeLeft] = useState(600);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const interval = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [timeLeft]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleResend = async () => {
        if (timeLeft === 0) {
            try {
                setTimeLeft(600);
                await authApi.resetPassword({ email: email as string || "" });
                Alert.alert("Success", "OTP resent successfully.");
            } catch (err: any) {
                Alert.alert("Error", err.message || "Failed to resend OTP.");
                setTimeLeft(0);
            }
        }
    };

    const handleVerifyOtpClick = () => {
        if (code.length < 4) {
            Alert.alert("Error", "Please enter the 4-digit OTP.");
            return;
        }
        setStep(2);
    };

    const submitNewPassword = async () => {
        if (!newPassword || !confirmPassword) {
            Alert.alert("Error", "Please fill in all areas.");
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match!");
            return;
        }

        try {
            setLoading(true);
            await authApi.verifyOtp({
                email: email as string || "",
                code,
                newPassword,
            });
            Alert.alert("Success", "Password reset successfully!");
            route.push("/login"); // Directly push to login after success
        } catch (err: any) {
            setError(true);
            setStep(1); // Go back to OTP entry if OTP was incorrect on the backend
            Alert.alert("Verification Failed", err.message || "Invalid OTP.");
        } finally {
            setLoading(false);
        }
    };

    const renderDigit = (index: number) => {
        const digit = code[index] || "";
        return (
            <View
                key={index}
                className={`w-14 h-14 rounded-xl border-2 items-center justify-center bg-white ${error ? "border-red-500" : digit ? "border-[#D66A1F]" : "border-gray-200"
                    }`}
            >
                <Text className="text-2xl font-bold text-[#333]" style={styles.title}>{digit}</Text>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-white">
            <TopLayer
                title={step === 1 ? "OTP Verification" : "Create New Password"}
                big
                more={step === 1 ? "Enter one time password that we have sent to your email address." : "Your new password must be securely configured."}
            />

            <View className="m-6 gap-6 ">
                {step === 1 ? (
                    <>
                        <View className="flex items-center justify-center ">
                            <Image source={Key} className="w-48 h-48" />
                        </View>

                        <View className="relative items-center">
                            {/* Hidden Actual Input */}
                            <TextInput
                                className="absolute w-full h-full opacity-0 z-10"
                                keyboardType="number-pad"
                                maxLength={4}
                                value={code}
                                onChangeText={(text) => {
                                    setCode(text);
                                    setError(false);
                                }}
                                autoFocus
                            />

                            {/* Visual Boxes */}
                            <View className="flex flex-row items-center justify-center gap-4">
                                {[0, 1, 2, 3].map(renderDigit)}
                            </View>
                        </View>

                        <View>
                            <Text style={styles.text} className="text-lg text-[#464646FF] text-center">
                                can't get code ? &nbsp;&nbsp;
                                <Text
                                    onPress={handleResend}
                                    style={[styles.text, { opacity: timeLeft === 0 ? 1 : 0.5 }]}
                                    className="underline"
                                >
                                    Resend Now
                                </Text>
                                <Text className="text-[#D66A1F] ml-2" style={styles.text}> {formatTime(timeLeft)}</Text>
                            </Text>
                        </View>

                        <View className="flex justify-center items-center mt-4">
                            <Btn title="Verify OTP" onPress={handleVerifyOtpClick} />
                        </View>
                    </>
                ) : (
                    <>
                        <View className="flex flex-col gap-4 mb-4">
                            <TextInput
                                style={styles.borgray}
                                placeholder="Enter your new password"
                                secureTextEntry
                                value={newPassword}
                                onChangeText={setNewPassword}
                                className={`rounded-lg border p-3 px-4 border-[#9F9F9F]`}
                            />
                            <TextInput
                                style={styles.borgray}
                                placeholder="Confirm new password"
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                className={`rounded-lg border p-3 px-4 border-[#9F9F9F]`}
                            />
                        </View>

                        <View className="flex justify-center items-center mt-4">
                            <Btn title={loading ? "Saving..." : "Submit Password"} disabled={loading} onPress={submitNewPassword} />
                        </View>

                        <View className="flex justify-center items-center mt-4">
                            <Text onPress={() => setStep(1)} className="text-[#9F9F9F] underline text-sm">Cancel & Return</Text>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}
