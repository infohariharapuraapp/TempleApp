
import { Request, Response } from 'express';

import {
  translateText,
  TranslationError,
  TranslationLanguage,
  SUPPORTED_LANGUAGES,
} from '../services/translationService';

function isSupportedLanguage(
  value: unknown
): value is TranslationLanguage {
  return (
    typeof value === 'string' &&
    SUPPORTED_LANGUAGES.includes(
      value as TranslationLanguage
    )
  );
}

export const translateContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      text,
      targetLanguage,
      sourceLanguage = 'en',
    } = req.body ?? {};

    if (
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > 5000
    ) {
      res.status(400).json({
        success: false,
        message:
          'Text is required and must not exceed 5000 characters.',
      });
      return;
    }

    if (
      !isSupportedLanguage(targetLanguage) ||
      !isSupportedLanguage(sourceLanguage)
    ) {
      res.status(400).json({
        success: false,
        message: 'Unsupported language.',
      });
      return;
    }

    const translatedText = await translateText(
      text,
      targetLanguage,
      sourceLanguage
    );

    res.json({
      success: true,
      data: {
        sourceLanguage,
        targetLanguage,
        originalText: text,
        translatedText,
      },
    });
  } catch (error) {
    console.error(
      'Translation controller error:',
      error
    );

    if (error instanceof TranslationError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(503).json({
      success: false,
      message: 'Translation service unavailable.',
    });
  }
};
