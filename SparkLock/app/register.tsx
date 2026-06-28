import { TopLayer } from "@/components/TopLayer";
import { useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import { useRef, useState } from "react";
import { Text, TextInput, TouchableOpacity, View, Alert, Platform } from "react-native";
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

export default function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const route = useRouter();

    const [loading, setLoading] = useState(false);

    const emailRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);
    const confirmRef = useRef<TextInput>(null);

    const handleSignUp = async () => {
        if (!name || !email || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }
        if (password !== confirm) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }

        const nameParts = name.trim().split(" ");
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        try {
            setLoading(true);
            await authApi.signup({
                email,
                password,
                firstName,
                lastName
            });
            userStore.setUser({ fullName: name, email: email });
            route.push("/complete");
        } catch (error: any) {
            Alert.alert("Sign Up Failed", error.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white">
            <TopLayer title="Sign Up" big more="Create an account to start monitoring your building safety." />
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
                        text="Full name"
                        value={name}
                        onChangeText={setName}
                        returnKeyType="next"
                        onSubmitEditing={() => emailRef.current?.focus()}
                    />
                    <InputText
                        text="Email address"
                        inputRef={emailRef}
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
                        returnKeyType="next"
                        onSubmitEditing={() => confirmRef.current?.focus()}
                    />
                    <InputText
                        text="Confirm password"
                        inputRef={confirmRef}
                        secureTextEntry
                        value={confirm}
                        onChangeText={setConfirm}
                        returnKeyType="done"
                        onSubmitEditing={handleSignUp}
                    />
                </View>
                <View className="flex justify-center items-center my-4">
                    <Btn title={loading ? "Loading..." : "Sign Up"} disabled={loading} onPress={handleSignUp} />
                </View>

                <Text style={styles.text} className="text-lg text-center pb-20" onPress={() => route.push("/login")}  >Already have an account ? &nbsp;&nbsp;<Text style={styles.subtitle} className="text-[#D66A1F] underline">Login</Text> </Text>
            </KeyboardAwareScrollView>
        </View>
    )
}
