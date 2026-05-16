import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <Pressable
      {...(props as any)}
      hitSlop={15}
      onPress={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPress?.(ev);
      }}
    />
  );
}
