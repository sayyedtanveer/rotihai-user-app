import {useReducedMotion} from '../hooks/useReducedMotion';
import React, { useEffect, useRef } from 'react';
import { 
  Animated, 
  StyleSheet, 
  View, 
  Image, 
  useWindowDimensions 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

/**
 * Premium RotiHai Full-Screen Splash Screen
 * Uses the high-quality brand asset to cover the entire screen area.
 */
export function StartupSplash() {
  const reducedMotion=useReducedMotion();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if(reducedMotion===null)return;
    if(reducedMotion){fadeAnim.setValue(1);return;}
    const animation=Animated.timing(fadeAnim,{toValue:1,duration:700,useNativeDriver:true});animation.start();return()=>animation.stop();
  }, [fadeAnim,reducedMotion]);

  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      
      <Animated.View style={[
        StyleSheet.absoluteFill, 
        { opacity: fadeAnim }
      ]}>
        <Image 
          source={require('../../../../assets/brand/RotiHai Warm Golden Splash Screen.png')} 
          style={{ width, height }}
          resizeMode="cover"
          accessibilityLabel="RotiHai Splash Screen"
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff3e2', // Brand pale golden background
  },
});
