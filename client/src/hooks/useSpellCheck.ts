import { useState, useEffect, useCallback } from 'react';

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
      // Use browser's native spell checker if available
      if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
        // For now, we'll use a simple word validation approach
        // In a production environment, you might want to integrate with a spell check service
        
        const words = textToCheck.toLowerCase().split(/\s+/);
        const commonWords = new Set([
          'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
          'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
          'to', 'was', 'will', 'with', 'you', 'your', 'have', 'had', 'this',
          'they', 'we', 'been', 'their', 'said', 'each', 'which', 'do',
          'how', 'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so',
          'some', 'her', 'would', 'make', 'like', 'into', 'time', 'very',
          'when', 'can', 'could', 'get', 'first', 'way', 'may', 'new',
          'now', 'old', 'see', 'two', 'who', 'come', 'did', 'go', 'know',
          'look', 'over', 'take', 'think', 'use', 'want', 'work', 'year',
          'facebook', 'ad', 'ads', 'marketing', 'campaign', 'conversion',
          'cro', 'test', 'testing', 'optimization', 'audience', 'targeting',
          'colorblock', 'statement', 'workflow', 'project', 'client'
        ]);
        
        // Add custom words to the common words set
        customWords.forEach(word => commonWords.add(word.toLowerCase()));
        
        const potentialErrors: SpellCheckError[] = [];
        let currentPosition = 0;
        
        words.forEach((word) => {
          const cleanWord = word.replace(/[^\w]/g, '');
          if (cleanWord.length > 2 && !commonWords.has(cleanWord)) {
            // Find the position of this word in the original text
            const wordPosition = textToCheck.toLowerCase().indexOf(word, currentPosition);
            potentialErrors.push({
              word: cleanWord,
              position: wordPosition,
              suggestions: getSuggestions(cleanWord)
            });
          }
          currentPosition += word.length + 1;
        });
        
        setErrors(potentialErrors);
      }
    } catch (error) {
      console.error('Spell check error:', error);
      setErrors([]);
    } finally {
      setIsChecking(false);
    }
  }, [enabled, language, customWords]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkSpelling(text);
    }, 500); // Debounce spell checking

    return () => clearTimeout(timeoutId);
  }, [text, checkSpelling]);

  const getSuggestions = (word: string): string[] => {
    // Simple suggestion algorithm - in production, use a proper spell check service
    const suggestions = [];
    
    // Common typo corrections for marketing terms
    const corrections: Record<string, string[]> = {
      'campain': ['campaign'],
      'campagne': ['campaign'],
      'advertisment': ['advertisement'],
      'advertisng': ['advertising'],
      'convertion': ['conversion'],
      'optmization': ['optimization'],
      'optimisation': ['optimization'],
      'audiance': ['audience'],
      'targetting': ['targeting'],
      'perfomance': ['performance'],
      'anlytics': ['analytics'],
      'engagment': ['engagement'],
      'succesfull': ['successful'],
      'profesional': ['professional'],
      'guarntee': ['guarantee'],
      'guaranted': ['guaranteed']
    };
    
    if (corrections[word.toLowerCase()]) {
      suggestions.push(...corrections[word.toLowerCase()]);
    }
    
    return suggestions.slice(0, 3); // Limit to 3 suggestions
  };

  const addToPersonalDictionary = useCallback((word: string) => {
    // In a real implementation, you might save this to localStorage or user preferences
    setErrors(prev => prev.filter(error => error.word !== word));
  }, []);

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