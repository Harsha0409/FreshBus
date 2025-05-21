

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types/chat';
import { useTheme } from '../context/ThemeContext';
import BusResults from './BusResults';
import { Sparkles } from 'lucide-react';


interface ChatMessageProps {
  message: Message;
  onBook: (busId: number) => void;
}


export function ChatMessage({ message, onBook }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const { theme } = useTheme();
  const isLoading = message.isLoading || false;
  const [minTimePassed, setMinTimePassed] = useState(false);

  const showLoader = (isLoading && !isUser) || (!minTimePassed && !isUser);
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isLoading && !isUser) {
      setMinTimePassed(false);
      timer = setTimeout(() => {
        setMinTimePassed(true);
      }, 5000);
    } else {
      setMinTimePassed(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading, isUser]);

  // Single state for content - either bus data or text
  const [content, setContent] = useState<{
    type: 'bus' | 'text';
    data: any;
  }>({ type: 'text', data: '' });
  console.log("ChatMessage initial content:", content);
  // One-time content processor that runs on mount or when message changes
  useEffect(() => {
    if (isLoading || isUser) return;

    console.log("ChatMessage processing content:", typeof message.content);

    // Function to detect if content is bus data
    const isBusData = (data: any): boolean => {
      try {
        // Case 1: Already an array of objects with tripID property
        if (Array.isArray(data) &&
          data.length > 0 &&
          typeof data[0] === 'object' &&
          'tripID' in data[0]) {
          console.log("✅ DETECTED BUS DATA:", data.length, "buses");
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    };

    // Try to extract bus data from string
    const extractBusData = (text: string): any[] | null => {
  try {
    // Try to parse the entire string
    const parsed = JSON.parse(text);
    // If parsed is { recommendations: [...] }
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray(parsed.recommendations) &&
      parsed.recommendations.length > 0 &&
      typeof parsed.recommendations[0] === 'object' &&
      'tripID' in parsed.recommendations[0]
    ) {
      return parsed.recommendations;
    }
    // If parsed is an array of bus objects
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof parsed[0] === 'object' &&
      'tripID' in parsed[0]
    ) {
      return parsed;
    }
  } catch (e) {
    // If parsing fails, try to extract a JSON array from the string
    const match = text.match(/\[\s*\{(?:.|\n)*?\}\s*\]/g);
    if (match) {
      for (const potentialJson of match) {
        try {
          const parsed = JSON.parse(potentialJson);
          if (
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            typeof parsed[0] === 'object' &&
            'tripID' in parsed[0]
          ) {
            return parsed;
          }
        } catch {
          // Continue to next match
        }
      }
    }
  }
  return null;
};
    // Main content processing
    const processContent = () => {
      // Check message.content type and process accordingly
      if (typeof message.content === 'object') {
        // Direct object - check if it's bus data
        if (isBusData(message.content)) {
          setContent({ type: 'bus', data: message.content });
          return;
        }
      } else if (typeof message.content === 'string') {
        // String content - try to extract bus data
        const busData = extractBusData(message.content);
        if (busData) {
          setContent({ type: 'bus', data: busData });
          return;
        }
      }

      // If we get here, it's not bus data
      setContent({
        type: 'text',
        data: typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content, null, 2)
      });
    };

    // Process content immediately
    processContent();
  }, [message.content, isLoading, isUser]);

  // Loading state
  if (isLoading && !isUser) {
    return (
      <div className="flex justify-start items-start">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full  flex items-center justify-center">
            {showLoader ? (
  <div className="flex items-center justify-center w-8 h-8" role="status" aria-label="Loading">
    {/* Inline animation for sparkle */}
    <style>
      {`
        @keyframes sparkle-pulse {
          0%, 100% {
            filter: brightness(0.8);
            transform: scale(0.9);
          }
          50% {
            filter: brightness(1.5);
            transform: scale(1.2);
          }
        }
        .sparkle-pulse {
          animation: sparkle-pulse 1.2s ease-in-out infinite;
        }
      `}
    </style>
    <Sparkles
      className="text-[#fbe822] sparkle-pulse"
      size={24}
      fill="#fbe822"
    />
  </div>
) : null}
          </div>
        </div>
        {/* <div className="flex-shrink-0">
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
            <img
              src="/assets/aiimg.png"
              alt="AI Icon"
              className="w-4 h-4 object-contain"
              style={{ transform: 'scale(1.5)' }}
            />
          </div>
        </div> */}
        {!showLoader && (
          <div className="flex-1 ml-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              <span className="text-[#1765f3] dark:text-[#fbe822]">Ṧ</span>.AI
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start py-1 mb-4 gap-1`}>
      {/* AI Icon for Assistant Messages
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500 flex items-center justify-center">
            <img
              src="/assets/aiimg.png"
              alt="AI Icon"
              className="w-3 h-3 sm:w-4 sm:h-4 object-contain"
              style={{ transform: 'scale(1.5)' }}
            />
          </div>
        </div>
      )} */}

      {/* Message Content */}
      <div className={`flex-1 ${!isUser ? 'ml-2' : 'mr-2'} ${isUser ? 'text-right' : 'text-left'}`}>
        <div className="flex items-center gap-1 justify-between">
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {!isUser && (
              <>
                <span className="text-[#1765f3] dark:text-[#fbe822]">Ṧ</span>.AI
              </>
            )}
          </span>
        </div>

        {/* Content Rendering - Bus Results or Text */}
        {message.content.includes('"tripID"') || message.content.includes('[{') || message.content.includes('{"tripID"') ? (
          <div className="mt-2 w-full">
            <BusResults searchQuery={content.data} onBook={onBook} />
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none mt-1 text-xs sm:text-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* User Icon for User Messages */}
      {isUser && (
        <div className="flex-shrink-0">
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-7 h-7">
              <circle
                cx="256"
                cy="256"
                r="256"
                fill={theme === 'dark' ? '#FBE822' : '#1765F3'}
              />
              <circle
                cx="256"
                cy="192"
                r="80"
                fill={theme === 'dark' ? '#1765F3' : '#FBE822'}
              />
              <path
                d="M256 288 C 160 288, 80 352, 80 432 L 432 432 C 432 352, 352 288, 256 288 Z"
                fill={theme === 'dark' ? '#1765F3' : '#FBE822'}
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}