import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface SpellCheckError {
  word: string;
  position: number;
  suggestions: string[];
}

interface UseSpellCheckOptions {
  enabled?: boolean;
  language?: string;
  customWords?: string[];
}

export function useSpellCheck(text: string, options: UseSpellCheckOptions = {}) {
  const { enabled = true, language = 'en-US', customWords = [] } = options;
  const [errors, setErrors] = useState<SpellCheckError[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const checkSpelling = useCallback(async (textToCheck: string) => {
    if (!enabled || !textToCheck.trim()) {
      setErrors([]);
      return;
    }

    setIsChecking(true);
    
    try {
      // Use the advanced server-side spell checker
      const response = await apiRequest('POST', '/api/spellcheck', {
        text: textToCheck,
        language
      });
      const result = await response.json();
      
      // Convert server response format to our expected format
      setErrors(result.errors || []);
      
    } catch (error) {
      console.error('Spell check API failed:', error);
      // Fallback to no errors instead of client-side checking
      // This ensures we don't duplicate effort and keeps the UX clean
      setErrors([]);
    } finally {
      setIsChecking(false);
    }
  }, [enabled, language]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkSpelling(text);
    }, 500); // Debounce spell checking

    return () => clearTimeout(timeoutId);
  }, [text, checkSpelling]);



  const addToPersonalDictionary = useCallback(async (word: string) => {
    try {
      await apiRequest('POST', '/api/spellcheck/dictionary/add', { word });
      // Refresh spell check to remove the word from errors
      await checkSpelling(text);
    } catch (error) {
      console.error('Failed to add word to dictionary:', error);
      // Fallback to just removing locally if server call fails
      setErrors(prev => prev.filter(error => error.word !== word));
    }
  }, [checkSpelling, text]);

  const replaceWord = useCallback((oldWord: string, newWord: string, originalText: string): string => {
    return originalText.replace(new RegExp(`\\b${oldWord}\\b`, 'gi'), newWord);
  }, []);

  return {
    errors,
    isChecking,
    checkSpelling,
    addToPersonalDictionary,
    replaceWord,
    hasErrors: errors.length > 0
  };
}