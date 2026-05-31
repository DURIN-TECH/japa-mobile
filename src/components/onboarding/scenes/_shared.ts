import { Circle, G, Path, Rect } from 'react-native-svg';
import Animated from 'react-native-reanimated';

export const AnimatedG = Animated.createAnimatedComponent(G);
export const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const AnimatedRect = Animated.createAnimatedComponent(Rect);
export const AnimatedPath = Animated.createAnimatedComponent(Path);

export type SceneProps = { playing: boolean };
