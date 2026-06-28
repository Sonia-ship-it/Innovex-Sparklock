import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ArrowLeft, Camera, Check, User } from "lucide-react-native";
import { useRef, useState } from "react";
import { Image, Platform, Text, TextInput, TouchableOpacity, View, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authApi } from "../utils/api";
import { useTheme } from "../utils/themeContext";
import { userStore } from "../utils/userStore";
import { styles } from "./index";

function InputField({ label, value, onChangeText, keyboardType, inputRef, returnKeyType, onSubmitEditing }:
    { label: string, value: string, onChangeText: (t: string) => void, keyboardType?: any, inputRef?: any, returnKeyType?: any, onSubmitEditing?: () => void }) {
    const [focused, setFocused] = useState(false);
    const { isDarkMode } = useTheme();

    return (
        <View style={{ marginBottom: 24 }}>
            <Text
                style={[
                    styles.subtitle,
                    { fontSize: 14, marginBottom: 8, marginLeft: 4, color: focused ? "#D66A1F" : (isDarkMode ? "#6b7280" : "#888") }
                ]}
            >
                {label}
            </Text>
            <View
                style={{
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: focused ? "#D66A1F" : (isDarkMode ? "#333" : "#f3f4f6"),
                    backgroundColor: focused ? "#FFFFFF" : (isDarkMode ? "#222" : "#F9F9F9"),
                    shadowColor: "transparent",
                    shadowOpacity: 0,
                    shadowRadius: 0,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 0
                }}
            >
                <TextInput
                    ref={inputRef}
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType={keyboardType}
                    returnKeyType={returnKeyType}
                    onSubmitEditing={onSubmitEditing}
                    style={[
                        styles.text,
                        { padding: 16, paddingHorizontal: 20, fontSize: 16, color: isDarkMode ? "#FFFFFF" : "#000000" }
                    ]}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholderTextColor={isDarkMode ? "#555" : "#CCC"}
                />
            </View>
        </View>
    );
}

export default function EditProfile() {
    const route = useRouter();
    const insets = useSafeAreaInsets();
    const user = userStore.getUser();
    const { isDarkMode } = useTheme();

    const [name, setName] = useState(user.fullName || "");
    const [email, setEmail] = useState(user.email || "");
    const [contact, setContact] = useState(user.emergencyContact || "");
    const [imageUri, setImageUri] = useState<string | null>(user.profileImage || null);
    const [loading, setLoading] = useState(false);

    const emailRef = useRef<TextInput>(null);
    const contactRef = useRef<TextInput>(null);


    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Required", "Permission to access camera roll is required!");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
            });

            console.log('ImagePicker Result:', result);

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setImageUri(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert("Error", "Failed to pick an image.");
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const token = user.token || "";
            let finalImageUri = imageUri;

            // Convert picked image to base64 to send to the server
            if (imageUri && imageUri.startsWith('file://')) {
                const base64 = await FileSystem.readAsStringAsync(imageUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                const match = /\.(\w+)$/.exec(imageUri.split('/').pop() || '');
                const ext = match ? match[1].toLowerCase() : 'jpeg';
                finalImageUri = `data:image/${ext};base64,${base64}`;
            }

            // Update to Java SQL server specifically
            await authApi.updateProfile({
                fullName: name,
                email: email,
                emergencyContact: contact,
                location: user.location,
                profileImage: finalImageUri,
                token: token
            });

            // If success, update offline native layer properly triggering real-time UI
            userStore.setUser({
                fullName: name,
                email: email,
                emergencyContact: contact,
                profileImage: finalImageUri
            });

            Alert.alert("Success", "Profile updated successfully!");
            route.back();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to sync profile update. Server offline?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className={`flex-1 ${isDarkMode ? "bg-black" : "bg-white"}`} style={{ paddingTop: insets.top }}>
            {/* Top Header Match Dashboard */}
            <View className={`px-6 flex-row justify-between items-center pb-2 z-10 ${isDarkMode ? "bg-black" : "bg-white"}`}>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => route.back()} className={`w-10 h-10 rounded-full items-center justify-center ${isDarkMode ? "bg-[#1A1A1A]" : "bg-gray-50"}`}>
                        <ArrowLeft size={20} color={isDarkMode ? "#AAA" : "#333"} />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-[#D66A1F] text-2xl" style={styles.title}>SPARKLOCK</Text>
                        <Text className={`${isDarkMode ? "text-gray-500" : "text-[#666]"} text-sm`} style={styles.text}>{user.location}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => route.back()} className={`w-10 h-10 rounded-full border border-[#D66A1F] ${isDarkMode ? "bg-[#333]" : "bg-[#FAEBE4]"} items-center justify-center overflow-hidden`}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} className="w-full h-full rounded-full" />
                    ) : (
                        <User size={20} color="#D66A1F" />
                    )}
                </TouchableOpacity>
            </View>
            <View className={`h-[1px] w-full ${isDarkMode ? "bg-[#333]" : "bg-gray-100"}`} />

            <KeyboardAwareScrollView
                className="flex-1"
                contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                enableOnAndroid={true}
                extraHeight={Platform.OS === "ios" ? 100 : 120}
                extraScrollHeight={50}
            >
                <Text className={`text-3xl mb-8 ${isDarkMode ? "text-white" : "text-black"}`} style={styles.title}>Edit Profile</Text>

                <View className="items-center mb-8">
                    <TouchableOpacity onPress={pickImage} className="relative">
                        <View className={`w-32 h-32 rounded-full items-center justify-center overflow-hidden border-2 shadow-sm ${isDarkMode ? "bg-[#1A1A1A] border-[#333]" : "bg-gray-50 border-gray-100"}`}>
                            {imageUri ? (
                                <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <User size={70} color="#D66A1F" strokeWidth={1} />
                            )}
                        </View>
                        <View className="absolute bottom-0 right-0 w-9 h-9 bg-[#D66A1F] rounded-full border-2 border-white items-center justify-center shadow-md">
                            <Camera size={16} color="white" />
                        </View>
                    </TouchableOpacity>
                </View>

                <View className={`rounded-[32px] p-6 border shadow-sm mb-6 ${isDarkMode ? "bg-[#1A1A1A] border-[#333]" : "bg-[#fdfaf8] border-[#FAEBE4]"}`}>
                    <InputField
                        key="input-name"
                        label="Full Display Name"
                        value={name}
                        onChangeText={setName}
                    />
                    <InputField
                        key="input-email"
                        label="Email Address"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                    />
                    <InputField
                        key="input-contact"
                        label="Emergency Responder Number"
                        value={contact}
                        onChangeText={setContact}
                        keyboardType="phone-pad"
                    />
                </View>
            </KeyboardAwareScrollView>

            <View className={`px-6 pb-12 pt-4 border-t flex-row items-center justify-between ${isDarkMode ? "bg-black border-[#333]" : "bg-white border-gray-50"}`}>
                <TouchableOpacity
                    onPress={() => route.back()}
                    className={`px-8 py-4 rounded-2xl border ${isDarkMode ? "border-[#444]" : "border-gray-200"}`}
                >
                    <Text className={`${isDarkMode ? "text-gray-400" : "text-[#666]"} text-lg font-medium`} style={styles.subtitle}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleSave}
                    disabled={loading}
                    className="bg-[#D66A1F] rounded-2xl p-4 px-10 flex-row items-center justify-center gap-3 shadow-md"
                    style={{ elevation: 4, opacity: loading ? 0.7 : 1 }}
                >
                    <Check size={20} color="white" />
                    <Text className="text-white text-lg font-bold" style={styles.subtitle}>{loading ? "Saving..." : "Save"}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
