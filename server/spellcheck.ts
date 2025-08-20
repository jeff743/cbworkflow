import SpellChecker from 'simple-spellchecker';
import { logger } from './logger';

interface SpellCheckResult {
  word: string;
  position: number;
  suggestions: string[];
  isCorrect: boolean;
}

interface SpellCheckResponse {
  errors: SpellCheckResult[];
  isChecking: boolean;
  totalWords: number;
  correctWords: number;
}

class AdvancedSpellChecker {
  private dictionaries: Map<string, any> = new Map();
  private customWords: Set<string> = new Set();
  private marketingTerms: Set<string> = new Set([
    'facebook', 'ad', 'ads', 'marketing', 'campaign', 'campaigns', 'conversion',
    'conversions', 'cro', 'test', 'testing', 'optimization', 'audience', 'targeting',
    'colorblock', 'colorblocks', 'statement', 'statements', 'workflow', 'workflows',
    'project', 'projects', 'client', 'clients', 'copywriter', 'copywriters',
    'strategist', 'strategists', 'analytics', 'engagement', 'impressions',
    'clickthrough', 'ctr', 'cpc', 'cpm', 'roi', 'roas', 'attribution',
    'retargeting', 'lookalike', 'audiences', 'demographics', 'psychographics',
    'funnel', 'funnels', 'landing', 'page', 'pages', 'creative', 'creatives',
    'headline', 'headlines', 'cta', 'calltoaction', 'value', 'proposition',
    'usp', 'benefit', 'benefits', 'feature', 'features', 'testimonial',
    'testimonials', 'social', 'proof', 'scarcity', 'urgency', 'personalization',
    'segmentation', 'automation', 'workflow', 'drip', 'sequence', 'nurture',
    'leadgen', 'acquisition', 'retention', 'churn', 'lifetime', 'value',
    'ltv', 'acquisition', 'cost', 'cac', 'payback', 'period'
  ]);

  constructor() {
    this.initializeCustomWords();
  }

  private initializeCustomWords() {
    // Add common business and marketing terms that might not be in standard dictionaries
    const businessTerms = [
      'ecommerce', 'fintech', 'saas', 'b2b', 'b2c', 'api', 'ui', 'ux',
      'onboarding', 'upsell', 'downsell', 'crosssell', 'freemium',
      'subscription', 'recurring', 'mrr', 'arr', 'churn', 'cohort',
      'persona', 'personas', 'touchpoint', 'touchpoints', 'omnichannel',
      'multichannel', 'attribution', 'incrementality', 'lift', 'holdout',
      'control', 'variant', 'variants', 'hypothesis', 'statistical',
      'significance', 'confidence', 'interval', 'pvalue', 'bayesian'
    ];

    businessTerms.forEach(term => {
      this.customWords.add(term.toLowerCase());
      this.marketingTerms.add(term.toLowerCase());
    });
  }

  async getDictionary(language: string = 'en-US'): Promise<any> {
    if (this.dictionaries.has(language)) {
      return this.dictionaries.get(language);
    }

    return new Promise((resolve, reject) => {
      SpellChecker.getDictionary(language, (err: Error, dictionary: any) => {
        if (err) {
          logger.error(`Failed to load dictionary for ${language}`, 'spellcheck', err);
          reject(err);
          return;
        }

        this.dictionaries.set(language, dictionary);
        resolve(dictionary);
      });
    });
  }

  async checkText(text: string, language: string = 'en-US'): Promise<SpellCheckResponse> {
    try {
      const dictionary = await this.getDictionary(language);
      const words = this.extractWords(text);
      const errors: SpellCheckResult[] = [];
      let correctWords = 0;

      for (const { word, position } of words) {
        const cleanWord = word.toLowerCase();
        
        // Skip if it's a custom marketing term or in our custom dictionary
        if (this.marketingTerms.has(cleanWord) || this.customWords.has(cleanWord)) {
          correctWords++;
          continue;
        }

        // Skip numbers, single letters, and very short words
        if (this.shouldSkipWord(word)) {
          correctWords++;
          continue;
        }

        const isCorrect = dictionary.spellCheck(word);
        
        if (!isCorrect) {
          const suggestions = dictionary.getSuggestions(word, 5);
          errors.push({
            word,
            position,
            suggestions: this.enhanceSuggestions(word, suggestions),
            isCorrect: false
          });
        } else {
          correctWords++;
        }
      }

      return {
        errors,
        isChecking: false,
        totalWords: words.length,
        correctWords
      };
    } catch (error) {
      logger.error('Spell check failed', 'spellcheck', error as Error);
      return {
        errors: [],
        isChecking: false,
        totalWords: 0,
        correctWords: 0
      };
    }
  }

  private extractWords(text: string): { word: string; position: number }[] {
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
  }

  private shouldSkipWord(word: string): boolean {
    // Skip single letters, numbers, very short words
    if (word.length <= 2) return true;
    
    // Skip if it's all numbers
    if (/^\d+$/.test(word)) return true;
    
    // Skip if it's a mix of numbers and letters (like model numbers)
    if (/\d/.test(word) && /[a-zA-Z]/.test(word)) return true;
    
    // Skip if it's all caps (likely an acronym)
    if (word === word.toUpperCase() && word.length <= 5) return true;
    
    // Skip common contractions and abbreviations
    const commonAbbreviations = ['don\'t', 'won\'t', 'can\'t', 'shouldn\'t', 'wouldn\'t', 'isn\'t', 'aren\'t'];
    if (commonAbbreviations.includes(word.toLowerCase())) return true;
    
    return false;
  }

  private enhanceSuggestions(originalWord: string, baseSuggestions: string[]): string[] {
    const enhanced = [...baseSuggestions];
    
    // Add marketing-specific corrections
    const marketingCorrections: Record<string, string[]> = {
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
      'cemetary': ['cemetery'],
      'changable': ['changeable'],
      'colunm': ['column'],
      'comittee': ['committee'],
      'concious': ['conscious'],
      'definite': ['definite'],
      'embarass': ['embarrass'],
      'existance': ['existence'],
      'febuary': ['february'],
      'goverment': ['government'],
      'grammer': ['grammar'],
      'independant': ['independent'],
      'maintainance': ['maintenance'],
      'millenium': ['millennium'],
      'noticable': ['noticeable'],
      'occured': ['occurred'],
      'persistant': ['persistent'],
      'privelege': ['privilege'],
      'publically': ['publicly'],
      'reccommend': ['recommend'],
      'rythm': ['rhythm'],
      'succesful': ['successful'],
      'supercede': ['supersede'],
      'tommorrow': ['tomorrow'],
      'truely': ['truly'],
      'untill': ['until'],
      'wierd': ['weird']
    };
    
    const lowerWord = originalWord.toLowerCase();
    if (marketingCorrections[lowerWord]) {
      // Add marketing-specific suggestions to the beginning
      enhanced.unshift(...marketingCorrections[lowerWord]);
    }
    
    // Remove duplicates and limit to 5 suggestions
    return [...new Set(enhanced)].slice(0, 5);
  }

  addCustomWord(word: string): void {
    this.customWords.add(word.toLowerCase());
    logger.info(`Added custom word: ${word}`, 'spellcheck');
  }

  removeCustomWord(word: string): void {
    this.customWords.delete(word.toLowerCase());
    logger.info(`Removed custom word: ${word}`, 'spellcheck');
  }

  getCustomWords(): string[] {
    return Array.from(this.customWords);
  }
}

export const spellChecker = new AdvancedSpellChecker();