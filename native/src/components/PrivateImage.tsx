import { useEffect } from 'react';
import { Image, type ImageProps } from 'react-native';
import { usePrivateMedia } from '../media/usePrivateMedia';

/** Private media bytes use Firebase authentication, including historical token URL inputs. */
export function PrivateImage(props: ImageProps) {
  const {onError}=props;
  const input = props.source && !Array.isArray(props.source) && typeof props.source === 'object' ? props.source as { uri?: string } : null;
  const media = usePrivateMedia(input?.uri || '', 'image');
  useEffect(() => {
    if (media.error) onError?.({ nativeEvent: { error: media.error } } as never);
  }, [media.error, onError]);
  return <Image {...props} source={input?.uri ? media.uri ? { ...input, uri: media.uri } : undefined : props.source} />;
}
