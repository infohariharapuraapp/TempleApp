
import { Request, Response } from 'express';
import { withTranslationDeadline } from '../services/translationDeadline';

import {
  translateText,
  translateTextOrOriginal,
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

// Existing admin translation endpoint.
// Keep its response structure unchanged.
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
    console.error('Translation controller error:', error);

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

// Public batch translation for UI text.
// Uses the existing PostgreSQL translation cache.
export const translatePublicBatch = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      texts,
      targetLanguage,
      sourceLanguage = 'en',
    } = req.body ?? {};

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

    if (
      !Array.isArray(texts) ||
      texts.length === 0 ||
      texts.length > 10 ||
      !texts.every(
        (text) =>
          typeof text === 'string' &&
          text.length <= 500
      )
    ) {
      res.status(400).json({
        success: false,
        message:
          'Provide 1 to 10 text strings, maximum 500 characters each.',
      });
      return;
    }

    const totalCharacters = texts.reduce(
      (sum: number, text: string) =>
        sum + Array.from(text).length,
      0
    );

    if (totalCharacters > 1500) {
      res.status(400).json({
        success: false,
        message:
          'Maximum 1500 characters per request.',
      });
      return;
    }

    const uniqueTexts = [
      ...new Set(texts as string[]),
    ];

    const translatedMap = new Map<string, string>();

    // Sequential requests avoid overwhelming
    // the free translation provider.
    await withTranslationDeadline(
      (async () => {
        const deadline = Date.now() + 3500;
        for (const text of uniqueTexts) {
          if (Date.now() >= deadline) break;
          const translated = await translateTextOrOriginal(
            text,
            targetLanguage,
            sourceLanguage
          );
          translatedMap.set(text, translated);
        }
      })(),
      undefined
    );

    const translations = texts.map(
      (text: string) =>
        translatedMap.get(text) ?? text
    );

    res.json({
      success: true,
      data: {
        sourceLanguage,
        targetLanguage,
        translations,
      },
    });
  } catch (error) {
    console.error('Public batch translation error:', error);

    res.status(503).json({
      success: false,
      message: 'Translation service unavailable.',
    });
  }
};
