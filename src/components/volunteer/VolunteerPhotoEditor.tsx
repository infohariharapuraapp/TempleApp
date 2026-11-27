import React, {

  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
} from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
type Props = {
  asset: ImagePickerAsset;
  onCancel: () => void;
  onConfirm: (asset: ImagePickerAsset) => void;
};
type Position = {
  x: number;
  y: number;
  zoom: number;
};
const MAX_ZOOM = 4;
const AnimatedTextInput =
  Animated.createAnimatedComponent(TextInput);
function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  'worklet';
  return Math.max(
    minimum,
    Math.min(maximum, value)
  );
}
export default function VolunteerPhotoEditor({
  asset,
  onCancel,
  onConfirm,
}: Props) {
  const { width: screenWidth, height: screenHeight } =
    useWindowDimensions();
  const frameWidth = Math.max(
    100,
    Math.min(
      screenWidth - 32,
      (screenHeight - 310) * 0.75,
      350
    )
  );
  const frameHeight = frameWidth * 4 / 3;
  const [photo, setPhoto] =
    useState<ImagePickerAsset>(asset);
  const [dimensions, setDimensions] = useState({
    width: asset.width,
    height: asset.height,
  });
  const position = useSharedValue<Position>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const panStart = useSharedValue({ x: 0, y: 0 });
  const pinchStart = useSharedValue(1);
  const gestureLocked = useSharedValue(false);
  const workingRef = useRef(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [cropApplied, setCropApplied] = useState(false);
  useEffect(() => {
    let active = true;
    if (photo.width > 0 && photo.height > 0) {
      setDimensions({
        width: photo.width,
        height: photo.height,
      });
    } else {
      Image.getSize(
        photo.uri,
        (width, height) => {
          if (active) {
            setDimensions({ width, height });
          }
        },
        () => {
          if (active) {
            setError('Cannot read photo dimensions.');
          }
        }
      );
    }
    return () => {
      active = false;
    };
  }, [photo.uri, photo.width, photo.height]);
  const { width, height } = dimensions;
  const valid =
    width > 0 &&
    height > 0 &&
    Number.isFinite(width) &&
    Number.isFinite(height);
  const baseScale = valid
    ? Math.max(
        frameWidth / width,
        frameHeight / height
      )
    : 1;
  const updatePosition = (next: Position) => {
    'worklet';
    if (gestureLocked.value || !valid) return;
    const zoom = clamp(next.zoom, 1, MAX_ZOOM);
    const maxX = Math.max(
      0,
      (width * baseScale * zoom - frameWidth) / 2
    );
    const maxY = Math.max(
      0,
      (height * baseScale * zoom - frameHeight) / 2
    );
    position.value = {
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
      zoom,
    };
  };
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      'worklet';
      panStart.value = {
        x: position.value.x,
        y: position.value.y,
      };
    })
    .onUpdate(event => {
      'worklet';
      updatePosition({
        x: panStart.value.x + event.translationX,
        y: panStart.value.y + event.translationY,
        zoom: position.value.zoom,
      });
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      pinchStart.value = position.value.zoom;
    })
    .onUpdate(event => {
      'worklet';
      updatePosition({
        ...position.value,
        zoom: pinchStart.value * event.scale,
      });
    });
  const gesture = Gesture.Simultaneous(pan, pinch);
  const animatedPhotoStyle = useAnimatedStyle(() => {
    const current = position.value;
    const displayWidth =
      width * baseScale * current.zoom;
    const displayHeight =
      height * baseScale * current.zoom;
    return {
      position: 'absolute' as const,
      width: displayWidth,
      height: displayHeight,
      left:
        (frameWidth - displayWidth) / 2 + current.x,
      top:
        (frameHeight - displayHeight) / 2 + current.y,
    };
  });
  const zoomLabelProps = useAnimatedProps(() => {
    const label =
      `${Math.round(position.value.zoom * 100)}%`;
    return {
      text: label,
      defaultValue: label,
    };
  });
  function zoomBy(amount: number) {
    if (workingRef.current || !valid) return;
    const current = position.value;
    updatePosition({
      ...current,
      zoom: current.zoom + amount,
    });
  }
  function resetPosition() {
    position.value = { x: 0, y: 0, zoom: 1 };
  }

  async function cropPhoto(confirm = false) {
    if (workingRef.current || !valid) return;
    workingRef.current = true;
    gestureLocked.value = true;
    setWorking(true);
    setError('');
    try {
      const current = position.value;
      const scale = baseScale * current.zoom;
      const cropWidth = Math.min(
        width,
        frameWidth / scale
      );
      const cropHeight = Math.min(
        height,
        frameHeight / scale
      );
      const originX = clamp(
        (width - cropWidth) / 2 -
          current.x / scale,
        0,
        width - cropWidth
      );
      const originY = clamp(
        (height - cropHeight) / 2 -
          current.y / scale,
        0,
        height - cropHeight
      );
      const x = Math.floor(originX);
      const y = Math.floor(originY);
      const w = Math.max(
        1,
        Math.min(
          width - x,
          Math.floor(cropWidth)
        )
      );
      const h = Math.max(
        1,
        Math.min(
          height - y,
          Math.floor(cropHeight)
        )
      );
      const result =
        await ImageManipulator.manipulateAsync(
          photo.uri,
          [
            {
              crop: {
                originX: x,
                originY: y,
                width: w,
                height: h,
              },
            },
          ],
          {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
      if (!result.uri || !result.width || !result.height) {
        throw new Error('Invalid cropped photo.');
      }
      const croppedAsset: ImagePickerAsset = {
        ...photo,
        uri: result.uri,
        width: result.width,
        height: result.height,
        mimeType: 'image/jpeg',
        fileName: 'volunteer-photo.jpg',
        fileSize: undefined,
      };
      if (confirm) {
        onConfirm(croppedAsset);
        return;
      }
      setPhoto(croppedAsset);
      setDimensions({
        width: result.width,
        height: result.height,
      });
      resetPosition();
      setCropApplied(true);
    } catch {
      setError(
        'Cropping failed. Adjust the photo and retry.'
      );
    } finally {
      workingRef.current = false;
      gestureLocked.value = false;
      setWorking(false);
    }
  }
  function acceptPhoto() {
    if (workingRef.current || !valid) return;
    const current = position.value;
    if (
      cropApplied &&
      current.zoom === 1 &&
      current.x === 0 &&
      current.y === 0
    ) {
      workingRef.current = true;
    gestureLocked.value = true;
      onConfirm(photo);
      return;
    }
    void cropPhoto(true);
  }

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!workingRef.current) {
          onCancel();
        }
      }}
    >
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <SafeAreaView
            style={styles.root}
            edges={["top", "bottom", "left", "right"]}
          >
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            disabled={working}
            hitSlop={8}
            onPress={() => {
              if (!workingRef.current) onCancel();
            }}
            style={styles.action}
          >
            <Text style={styles.back}>
              {'\u2190'}
            </Text>
          </Pressable>
          <View style={styles.right}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Crop photo"
              disabled={working || !valid}
              hitSlop={8}
              onPress={() => void cropPhoto()}
              style={styles.action}
            >
              <Text style={styles.crop}>
                CROP
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Accept photo"
              disabled={working || !valid}
              hitSlop={8}
              onPress={acceptPhoto}
              style={styles.action}
            >
              <Text style={styles.ok}>
                {'\u2713'} OK
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.body}>
          <GestureDetector gesture={gesture}>
            <View
              style={[
                styles.frame,
                {
                  width: frameWidth,
                  height: frameHeight,
                },
              ]}
            >
              {valid && (
                <Animated.Image
                  source={{ uri: photo.uri }}
                  resizeMode="stretch"
                  style={animatedPhotoStyle}
                />
              )}
              <View
                pointerEvents="none"
                style={styles.grid}
              >
                <View style={styles.column} />
                <View style={styles.column} />
                <View style={styles.columnLast} />
              </View>
              <View
                pointerEvents="none"
                style={styles.rows}
              >
                <View style={styles.line} />
                <View style={styles.line} />
              </View>
            </View>
          </GestureDetector>
          <View style={styles.zoomRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
              disabled={working || !valid}
              onPress={() => zoomBy(-0.25)}
              style={styles.zoomButton}
            >
              <Text style={styles.zoomButtonText}>−</Text>
            </Pressable>
            <AnimatedTextInput
              animatedProps={zoomLabelProps}
              defaultValue="100%"
              editable={false}
              pointerEvents="none"
              underlineColorAndroid="transparent"
              style={styles.zoomText}
              accessibilityLabel="Photo zoom percentage"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
              disabled={working || !valid}
              onPress={() => zoomBy(0.25)}
              style={styles.zoomButton}
            >
              <Text style={styles.zoomButtonText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.help}>
            Drag to position • Pinch to zoom
          </Text>
          <Text style={styles.help}>
            CROP previews the result. ✓ OK accepts it.
          </Text>
          {cropApplied && (
            <Text style={styles.success}>
              Crop applied. Review the photo and tap OK.
            </Text>
          )}
          {!!error && (
            <Text style={styles.error}>
              {error}
            </Text>
          )}
          {working && (
            <ActivityIndicator
              size="large"
              color="#721D2A"
            />
          )}
        </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  toolbar: {
    height: 64,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  action: {
    minHeight: 48,
    minWidth: 48,
    alignItems: "center",
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  back: {
    fontSize: 28,
    color: '#222222',
  },
  crop: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
  },
  ok: {
    fontSize: 18,
    fontWeight: '800',
    color: '#188038',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  frame: {
    overflow: 'hidden',
    backgroundColor: '#151515',
    borderRadius: 4,
  },
  grid: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  column: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  columnLast: {
    flex: 1,
  },
  rows: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-evenly',
  },
  line: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  zoomButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F6EDEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: {
    fontSize: 28,
    color: '#721D2A',
    fontWeight: '700',
  },
  zoomText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#721D2A',
    minWidth: 70,
    padding: 0,
    textAlign: 'center',
  },
  help: {
    fontSize: 12,
    textAlign: 'center',
    color: '#555555',
  },
  success: {
    fontSize: 13,
    textAlign: 'center',
    color: '#188038',
    fontWeight: '700',
  },
  error: {
    fontSize: 13,
    textAlign: 'center',
    color: '#B3261E',
  },
});