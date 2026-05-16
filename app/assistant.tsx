import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, useRef, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Palette, Radius, Spacing, Shadow } from "../constants/theme";
import { processAIChat } from "../lib/ai";

type Message = {
  id: string;
  text: string;
  sender: "user" | "ai";
};

export default function AssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Bonjour ! Je suis votre assistant MediFind. Que puis-je chercher pour vous aujourd'hui ?",
      sender: "ai",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Scroll to bottom when messages update
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), text: input.trim(), sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    let tempMessageId = (Date.now() + 1).toString();
    
    // Add temporary AI thinking message
    setMessages((prev) => [
      ...prev,
      { id: tempMessageId, text: "💬 ...", sender: "ai" }
    ]);

    await processAIChat(userMessage.text, (text) => {
      setMessages((prev) => 
        prev.map(msg => msg.id === tempMessageId ? { ...msg, text } : msg)
      );
    });

    setIsTyping(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header Modal */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerEmoji}>✨</Text>
          <Text style={styles.headerTitle}>Assistant IA</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Palette.textPrimary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.sender === "user" ? styles.messageUser : styles.messageAi,
              ]}
            >
              <Text style={[
                styles.messageText,
                msg.sender === "user" ? styles.messageTextUser : styles.messageTextAi
              ]}>
                {msg.text}
              </Text>
            </View>
          ))}
          {isTyping && (
             <View style={[styles.messageBubble, styles.messageAi, styles.typingBubble]}>
               <ActivityIndicator size="small" color={Palette.primary} />
             </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Rechercher une pharmacie, un médicament..."
            placeholderTextColor={Palette.textMuted}
            multiline
            maxLength={500}
          />
          <Pressable 
            onPress={handleSend} 
            disabled={isTyping || !input.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              (!input.trim() || isTyping) && styles.sendBtnDisabled,
              pressed && { opacity: 0.8 }
            ]}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerEmoji: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Palette.textPrimary,
  },
  closeBtn: {
    padding: 4,
    backgroundColor: Palette.background,
    borderRadius: Radius.full,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    ...Shadow.sm,
  },
  messageUser: {
    alignSelf: "flex-end",
    backgroundColor: Palette.primary,
    borderBottomRightRadius: 4,
  },
  messageAi: {
    alignSelf: "flex-start",
    backgroundColor: Palette.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextUser: {
    color: "#fff",
  },
  messageTextAi: {
    color: Palette.textPrimary,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: Spacing.md,
    backgroundColor: Palette.surface,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 45,
    color: Palette.textPrimary,
  },
  sendBtn: {
    backgroundColor: Palette.primary,
    width: 45,
    height: 45,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: Palette.border,
  },
});
