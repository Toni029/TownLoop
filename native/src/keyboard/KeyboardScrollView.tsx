import { revealOffset } from './geometry';
import { createContext, forwardRef, useCallback, useContext, useEffect, useRef } from 'react';
import { Keyboard, Platform, ScrollView as NativeScrollView, TextInput as NativeTextInput, type ScrollViewProps, type TextInputProps } from 'react-native';

const Focus = createContext<(input: NativeTextInput) => void>(() => {});
export type ScrollView = NativeScrollView;
export type TextInput = NativeTextInput;

/** Scroll only enough to reveal the focused field inside the actual visible viewport. */
export const ScrollView = forwardRef<NativeScrollView, ScrollViewProps>(function KeyboardScrollView(props, forwardedRef) {
  const scroll = useRef<NativeScrollView | null>(null);
  const focused = useRef<NativeTextInput | null>(null);
  const offset = useRef(0);
  const keyboardTop = useRef(Infinity);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reveal = useCallback(() => {
    const input = focused.current;
    if (Platform.OS === 'web' || props.horizontal || !input?.isFocused() || !scroll.current) return;
    scroll.current.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
      input.measureInWindow((_ix, y, _iw, h) => {
        const next = revealOffset(offset.current, top, height, keyboardTop.current, y, h);
        if (next !== offset.current) scroll.current?.scrollTo({ y: next, animated: true });
      });
    });
  }, [props.horizontal]);
  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(reveal, 80);
  }, [reveal]);
  useEffect(() => {
    if (props.horizontal) return;
    const show = Keyboard.addListener('keyboardDidShow', e => { keyboardTop.current = e.endCoordinates.screenY; schedule(); });
    const change = Keyboard.addListener('keyboardDidChangeFrame', e => { keyboardTop.current = e.endCoordinates.screenY; schedule(); });
    const hide = Keyboard.addListener('keyboardDidHide', () => { keyboardTop.current = Infinity; });
    return () => { show.remove(); change.remove(); hide.remove(); clearTimeout(timer.current); };
  }, [schedule, props.horizontal]);
  const register = useCallback((input: NativeTextInput) => { focused.current = input; schedule(); }, [schedule]);
  const parent = useContext(Focus);
  return <Focus.Provider value={props.horizontal ? parent : register}>
    <NativeScrollView {...props} ref={node => {
      scroll.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }} keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'} keyboardDismissMode={props.keyboardDismissMode ?? 'none'}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} scrollEventThrottle={16}
      onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; props.onScroll?.(event); }}
      onLayout={event => { props.onLayout?.(event); schedule(); }} />
  </Focus.Provider>;
});

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function KeyboardTextInput(props, forwardedRef) {
  const input = useRef<NativeTextInput | null>(null);
  const focus = useContext(Focus);
  return <NativeTextInput {...props} ref={node => {
    input.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }} onFocus={event => { props.onFocus?.(event); if (input.current) focus(input.current); }}
    onContentSizeChange={event => { props.onContentSizeChange?.(event); if (input.current?.isFocused()) focus(input.current); }} />;
});
