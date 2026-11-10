import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleProp, View, type ViewInstance, type ViewStyle } from 'react-native';
import { useTutorial } from '@/contexts/tutorial';

export function TutorialTarget({
  id,
  children,
  style,
}: {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<ViewInstance>(null);
  const { register, step } = useTutorial();

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) register(id, { x, y, width, height });
    });
  }, [id, register]);

  useEffect(() => {
    const timeouts = [0, 80, 250, 500].map((ms) => setTimeout(measure, ms));
    const frame = requestAnimationFrame(measure);
    const idle =
      typeof requestIdleCallback === 'function' ? requestIdleCallback(() => measure()) : null;
    return () => {
      timeouts.forEach(clearTimeout);
      cancelAnimationFrame(frame);
      if (idle != null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idle);
      register(id, null);
    };
  }, [id, measure, register, step]);

  return (
    <View ref={ref} collapsable={false} style={style} onLayout={measure}>
      {children}
    </View>
  );
}
