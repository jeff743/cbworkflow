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
      // Create a simple but more comprehensive spell checker
      const words = extractWords(textToCheck);
      const knownWords = new Set([
        // Common English words
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
        'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
        'to', 'was', 'will', 'with', 'you', 'your', 'have', 'had', 'this',
        'they', 'we', 'been', 'their', 'said', 'each', 'which', 'do', 'does',
        'how', 'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so', 'but',
        'some', 'her', 'would', 'make', 'like', 'into', 'time', 'very', 'his',
        'when', 'can', 'could', 'get', 'first', 'way', 'may', 'new', 'our',
        'now', 'old', 'see', 'two', 'who', 'come', 'did', 'go', 'know', 'more',
        'look', 'over', 'take', 'think', 'use', 'want', 'work', 'year', 'about',
        'all', 'also', 'after', 'back', 'because', 'before', 'being', 'between',
        'both', 'came', 'come', 'could', 'during', 'each', 'even', 'every',
        'find', 'give', 'good', 'great', 'here', 'home', 'just', 'last',
        'life', 'long', 'made', 'most', 'much', 'need', 'never', 'only',
        'other', 'own', 'part', 'place', 'right', 'same', 'school', 'should',
        'small', 'state', 'still', 'such', 'than', 'them', 'there', 'through',
        'too', 'under', 'used', 'using', 'water', 'well', 'were', 'what',
        'where', 'while', 'world', 'would', 'write', 'years',
        // Marketing and business terms
        'facebook', 'ad', 'ads', 'marketing', 'campaign', 'campaigns', 'conversion',
        'conversions', 'cro', 'test', 'testing', 'optimization', 'audience', 'targeting',
        'colorblock', 'colorblocks', 'statement', 'statements', 'workflow', 'workflows',
        'project', 'projects', 'client', 'clients', 'business', 'sale', 'sales',
        'buy', 'purchase', 'product', 'products', 'service', 'services', 'brand',
        'company', 'customer', 'customers', 'user', 'users', 'website', 'online',
        'digital', 'content', 'social', 'media', 'email', 'newsletter', 'blog',
        'seo', 'ppc', 'roi', 'analytics', 'metrics', 'data', 'insights', 'strategy',
        'growth', 'revenue', 'profit', 'discount', 'offer', 'deal', 'free', 'save',
        'today', 'now', 'click', 'learn', 'discover', 'explore', 'join', 'sign'
      ]);
      
      // Add custom words to the known words set
      customWords.forEach(word => knownWords.add(word.toLowerCase()));
      
      const potentialErrors: SpellCheckError[] = [];
      
      for (const { word, position } of words) {
        const cleanWord = word.toLowerCase();
        
        // Skip very short words, numbers, or words with numbers
        if (cleanWord.length <= 2 || /\d/.test(cleanWord) || cleanWord === cleanWord.toUpperCase()) {
          continue;
        }
        
        // Check if word is known
        if (!knownWords.has(cleanWord)) {
          potentialErrors.push({
            word: word,
            position: position,
            suggestions: getSuggestions(cleanWord)
          });
        }
      }
      
      setErrors(potentialErrors);
      
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

  const extractWords = (text: string): { word: string; position: number }[] => {
    const words: { word: string; position: number }[] = [];
    const wordRegex = /\b[a-zA-Z]+(?:'[a-zA-Z]+)?\b/g;
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
      words.push({
        word: match[0],
        position: match.index
      });
    }

    return words;
  };

  const getSuggestions = (word: string): string[] => {
    // Common typo corrections for marketing and general terms
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
      'guaranted': ['guaranteed'],
      'recieve': ['receive'],
      'acheive': ['achieve'],
      'seperate': ['separate'],
      'definately': ['definitely'],
      'occassionally': ['occasionally'],
      'neccessary': ['necessary'],
      'accomodate': ['accommodate'],
      'begining': ['beginning'],
      'beleive': ['believe'],
      'calender': ['calendar'],
      'changable': ['changeable'],
      'colunm': ['column'],
      'comittee': ['committee'],
      'concious': ['conscious'],
      'embarass': ['embarrass'],
      'existance': ['existence'],
      'febuary': ['february'],
      'goverment': ['government'],
      'grammer': ['grammar'],
      'independant': ['independent'],
      'maintainance': ['maintenance'],
      'noticable': ['noticeable'],
      'occured': ['occurred'],
      'persistant': ['persistent'],
      'privelege': ['privilege'],
      'publically': ['publicly'],
      'reccommend': ['recommend'],
      'succesful': ['successful'],
      'tommorrow': ['tomorrow'],
      'truely': ['truly'],
      'untill': ['until'],
      'wierd': ['weird'],
      // Common test words
      'testng': ['testing'],
      'spellng': ['spelling'],
      'mispelled': ['misspelled'],
      'missng': ['missing'],
      'errror': ['error']
    };
    
    return corrections[word.toLowerCase()] || [];
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