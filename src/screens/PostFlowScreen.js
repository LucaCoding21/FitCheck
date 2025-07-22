import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import CustomPhotoPicker from '../components/CustomPhotoPicker';

const PostFlowScreen = ({ navigation }) => {
  const [showPhotoPicker, setShowPhotoPicker] = useState(true);

  const handleImageSelected = (imageUri) => {
    setShowPhotoPicker(false);
    // Navigate to PostFitScreen with the selected image
    navigation.replace('PostFit', { selectedImage: imageUri });
  };

  const handleClose = () => {
    setShowPhotoPicker(false);
    // Navigate back immediately
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <CustomPhotoPicker
        visible={showPhotoPicker}
        onClose={handleClose}
        onImageSelected={handleImageSelected}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default PostFlowScreen; 