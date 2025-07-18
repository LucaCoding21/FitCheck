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

export default function GroupScreen({ navigation }) {
  const { user } = useAuth();
  const [groupCode, setGroupCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserGroups();
    
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

      await addDoc(collection(db, "groups"), {
        name: groupName.trim(),
        code: groupCode,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: new Date(),
        memberCount: 1,
      });

      Alert.alert("Success", `Group created! Share code: ${groupCode}`);
      setGroupName("");
      fetchUserGroups();
    } catch (error) {
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

  const renderGroupCard = ({ item }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => navigation.navigate("Main")}
      activeOpacity={0.7}
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
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAwareContainer>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Groups</Text>
      </View>

      {/* Create Group Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Create Group</Text>
        <TextInput
          style={styles.input}
          placeholder="Group name"
          placeholderTextColor={theme.colors.textMuted}
          value={groupName}
          onChangeText={setGroupName}
          maxLength={30}
          editable={true}
          selectTextOnFocus={false}
          clearButtonMode="while-editing"
          returnKeyType="done"
          keyboardType="default"
          autoCorrect={false}
          autoComplete="off"
          autoCapitalize="words"
          blurOnSubmit={true}
          onSubmitEditing={() => {
            Keyboard.dismiss();
          }}
          onBlur={() => {
            // Ensure keyboard is dismissed when input loses focus
            setTimeout(() => Keyboard.dismiss(), 100);
          }}
        />
        <TouchableOpacity
          style={[styles.button, styles.createButton]}
          onPress={createGroup}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Creating..." : "Create Group"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Join Group Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Join Group</Text>
        <TextInput
          style={styles.input}
          placeholder="Group code"
          placeholderTextColor={theme.colors.textMuted}
          value={groupCode}
          onChangeText={setGroupCode}
          autoCapitalize="characters"
          maxLength={6}
          editable={true}
          selectTextOnFocus={false}
          clearButtonMode="while-editing"
          returnKeyType="done"
          keyboardType="default"
          autoCorrect={false}
          autoComplete="off"
          blurOnSubmit={true}
          onSubmitEditing={() => {
            Keyboard.dismiss();
          }}
          onBlur={() => {
            // Ensure keyboard is dismissed when input loses focus
            setTimeout(() => Keyboard.dismiss(), 100);
          }}
        />
        <TouchableOpacity
          style={[styles.button, styles.joinButton]}
          onPress={joinGroup}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Joining..." : "Join Group"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Your Groups */}
      <View style={styles.groupsSection}>
        <Text style={styles.groupsTitle}>Your Groups</Text>
        {userGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No groups yet</Text>
            <Text style={styles.emptySubtext}>
              Create or join a group to get started
            </Text>
          </View>
        ) : (
          <FlatList
            data={userGroups}
            keyExtractor={(item) => item.id}
            renderItem={renderGroupCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.groupsList}
          />
        )}
      </View>
    </KeyboardAwareContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  backText: {
    fontSize: 18,
    color: theme.colors.text,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: theme.colors.text,
  },

  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 12,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 50,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  createButton: {
    backgroundColor: theme.colors.primary,
  },
  joinButton: {
    backgroundColor: theme.colors.secondary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
  },
  groupsSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  groupsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 16,
  },
  groupsList: {
    paddingBottom: 100,
  },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  groupAvatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 4,
  },
  groupDetails: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  chevron: {
    fontSize: 20,
    color: theme.colors.textMuted,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
});
