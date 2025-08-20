import { useState } from 'react';
import { AlertCircle, Check, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useSpellCheck } from '@/hooks/useSpellCheck';

interface SpellCheckIndicatorProps {
  text: string;
  onTextChange?: (newText: string) => void;
  className?: string;
  customWords?: string[];
}

export function SpellCheckIndicator({ 
  text, 
  onTextChange, 
  className = '',
  customWords = []
}: SpellCheckIndicatorProps) {
  const { errors, isChecking, addToPersonalDictionary, replaceWord, hasErrors } = useSpellCheck(text, {
    customWords
  });
  const [isOpen, setIsOpen] = useState(false);

  if (isChecking) {
    return (
      <div className={`inline-flex items-center gap-1 text-blue-600 ${className}`}>
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
        <span className="text-xs">Checking...</span>
      </div>
    );
  }

  if (!hasErrors) {
    return (
      <div className={`inline-flex items-center gap-1 text-green-600 ${className}`}>
        <Check size={14} />
        <span className="text-xs">No spelling errors</span>
      </div>
    );
  }

  const handleSuggestionClick = (oldWord: string, newWord: string) => {
    if (onTextChange) {
      const updatedText = replaceWord(oldWord, newWord, text);
      onTextChange(updatedText);
    }
    setIsOpen(false);
  };

  const handleAddToDictionary = (word: string) => {
    addToPersonalDictionary(word);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 h-auto p-1 ${className}`}
        >
          <AlertCircle size={14} />
          <span className="text-xs">{errors.length} spelling issue{errors.length !== 1 ? 's' : ''}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <AlertCircle size={16} className="text-amber-600" />
            <h4 className="font-medium text-sm">Spelling Suggestions</h4>
          </div>
          
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {errors.map((error, index) => (
              <div key={`${error.word}-${index}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {error.word}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddToDictionary(error.word)}
                    className="h-6 px-2 text-xs"
                  >
                    <BookOpen size={12} className="mr-1" />
                    Add to Dictionary
                  </Button>
                </div>
                
                {error.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {error.suggestions.map((suggestion, suggestionIndex) => (
                      <Button
                        key={suggestionIndex}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestionClick(error.word, suggestion)}
                        className="h-6 px-2 text-xs hover:bg-green-50 hover:border-green-300"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="pt-2 border-t text-xs text-gray-500">
            Click a suggestion to replace the word, or add to dictionary to ignore.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}