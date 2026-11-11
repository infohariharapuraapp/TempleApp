
import React from 'react';
import {
  Text,
  TextProps,
} from 'react-native';

import { useAutoTranslate } from '@/localization/useAutoTranslate';

type Props = TextProps & {
  children: string;
};

export default function AutoTranslatedText({
  children,
  ...props
}: Props) {
  const translatedText = useAutoTranslate(children);

  return (
    <Text {...props}>
      {translatedText}
    </Text>
  );
}
