import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  StatusBar,
  Keyboard,
  Animated,
  Dimensions,
  SafeAreaView,
} from "react-native";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { theme } from "../styles/theme";
import KeyboardAwareContainer from "../components/KeyboardAwareContainer";

const { width } = Dimensions.get('window');

export default function GroupScreen({ navigation }) {
  const { user } = useAuth();
  const [groupCode, setGroupCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    fetchUserGroups();
    
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Dismiss keyboard when component unmounts
    return () => {
      Keyboard.dismiss();
    };
  }, []);

  const fetchUserGroups = async () => {
    try {
      const groupsQuery = query(
        collection(db, "groups"),
        where("members", "array-contains", user.uid)
      );
      const snapshot = await getDocs(groupsQuery);
      const groups = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUserGroups(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Error", "Please enter a group name");
      return;
    }

    setLoading(true);
    try {
      const groupCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const groupRef = await addDoc(collection(db, "groups"), {
        name: groupName.trim(),
        code: groupCode,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: new Date(),
        memberCount: 1,
      });

      setGroupName("");
      
      // Wait for user groups to be fetched before navigating
      await fetchUserGroups();
      
      // Navigate directly to Main with the newly created group selected
      navigation.replace("Main", { selectedGroup: groupRef.id });
    } catch (error) {
      console.error("Error in createGroup:", error);
      Alert.alert("Error", error.message);
    }
    setLoading(false);
  };

  const joinGroup = async () => {
    if (!groupCode.trim()) {
      Alert.alert("Error", "Please enter a group code");
      return;
    }

    setLoading(true);
    try {
      const groupsQuery = query(
        collection(db, "groups"),
        where("code", "==", groupCode.toUpperCase())
      );
      const snapshot = await getDocs(groupsQuery);

      if (snapshot.empty) {
        Alert.alert("Error", "Group not found");
        setLoading(false);
        return;
      }

      const groupDoc = snapshot.docs[0];
      const groupData = groupDoc.data();

      if (groupData.members.includes(user.uid)) {
        Alert.alert("Info", "You are already in this group");
        setLoading(false);
        return;
      }

      if (groupData.members.length >= 20) {
        Alert.alert("Error", "Group is full (max 20 members)");
        setLoading(false);
        return;
      }

      await updateDoc(doc(db, "groups", groupDoc.id), {
        members: arrayUnion(user.uid),
        memberCount: groupData.members.length + 1,
      });

      setGroupCode("");
      
      // Wait for user groups to be fetched before navigating
      await fetchUserGroups();
      
      // Navigate directly to Main with the newly joined group selected
      navigation.replace("Main", { selectedGroup: groupDoc.id });
    } catch (error) {
      console.error("Error in joinGroup:", error);
      Alert.alert("Error", error.message);
    }
    setLoading(false);
  };

  const renderGroupCard = ({ item, index }) => {
    const scaleAnim = new Animated.Value(1);
    
    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View
        style={[
          styles.groupCard,
          {
            transform: [{ scale: scaleAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.groupCardTouchable}
          onPress={() => navigation.navigate("Main")}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <View style={styles.groupAvatar}>
            <Text style={styles.groupAvatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.groupDetails}>
              {item.memberCount} members • {item.code}
            </Text>
          </View>
          <View style={styles.chevronContainer}>
            <Text style={styles.chevron}>›</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };



  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Groups</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Scrollable Content */}
        <FlatList
          data={[{ key: 'content' }]}
          renderItem={() => (
            <>
              {/* Create Group Section */}
              <View style={styles.createSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Create New Group</Text>
                  <Text style={styles.sectionSubtitle}>Start a new group and invite friends</Text>
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Group Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter group name..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={groupName}
                    onChangeText={setGroupName}
                    maxLength={30}
                    editable={!loading}
                    selectTextOnFocus={false}
                    clearButtonMode="while-editing"
                    returnKeyType="done"
                    keyboardType="default"
                    autoCorrect={false}
                    autoComplete="off"
                    autoCapitalize="words"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    onBlur={() => setTimeout(() => Keyboard.dismiss(), 100)}
                  />
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.createButton,
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={createGroup}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionButtonText}>
                    {loading ? "Creating..." : "Create Group"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Join Group Section */}
              <View style={styles.joinSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Join Existing Group</Text>
                  <Text style={styles.sectionSubtitle}>Enter a group code to join</Text>
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Group Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit code..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={groupCode}
                    onChangeText={setGroupCode}
                    autoCapitalize="characters"
                    maxLength={6}
                    editable={!loading}
                    selectTextOnFocus={false}
                    clearButtonMode="while-editing"
                    returnKeyType="done"
                    keyboardType="default"
                    autoCorrect={false}
                    autoComplete="off"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    onBlur={() => setTimeout(() => Keyboard.dismiss(), 100)}
                  />
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.joinButton,
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={joinGroup}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionButtonText}>
                    {loading ? "Joining..." : "Join Group"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Your Groups */}
              <View style={styles.groupsSection}>
                <View style={styles.groupsHeader}>
                  <Text style={styles.groupsTitle}>Your Groups</Text>
                  <Text style={styles.groupsCount}>({userGroups.length})</Text>
                </View>
                
                {userGroups.length === 0 ? (
                  <Animated.View 
                    style={[styles.emptyState, { opacity: fadeAnim }]}
                  >
                    <View style={styles.emptyIcon}>
                      <Text style={styles.emptyIconText}>👥</Text>
                    </View>
                    <Text style={styles.emptyText}>No groups yet</Text>
                    <Text style={styles.emptySubtext}>
                      Create or join a group to start sharing fits with friends
                    </Text>
                  </Animated.View>
                ) : (
                  userGroups.map((group, index) => (
                    <View key={group.id}>
                      {renderGroupCard({ item: group, index })}
                      {index < userGroups.length - 1 && <View style={styles.separator} />}
                    </View>
                  ))
                )}
              </View>
            </>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backText: {
    fontSize: 24,
    color: theme.colors.text,
    fontWeight: "300",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingBottom: 120, // Extra padding to ensure content is not cut off by navigation
  },
  createSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  joinSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: "600",
    marginHorizontal: theme.spacing.lg,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 56,
  },
  actionButton: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: "center",
    minHeight: 56,
    justifyContent: "center",
    ...theme.shadows.md,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
  },
  joinButton: {
    backgroundColor: theme.colors.secondary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  groupsSection: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  groupsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  groupsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  groupsCount: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.sm,
  },
  groupsList: {
    paddingBottom: 100,
  },
  separator: {
    height: theme.spacing.sm,
  },
  groupCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    ...theme.shadows.sm,
  },
  groupCardTouchable: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.lg,
    ...theme.shadows.glow,
  },
  groupAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 4,
  },
  groupDetails: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: "500",
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: "center",
    alignItems: "center",
  },
  chevron: {
    fontSize: 18,
    color: theme.colors.textMuted,
    fontWeight: "300",
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyIconText: {
    fontSize: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: theme.spacing.lg,
  },
});
