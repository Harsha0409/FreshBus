import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { Message } from '../types/chat';
import { useTheme } from '../context/ThemeContext';
import BusResults from './BusResults';
import { Sparkles } from 'lucide-react';
import CancellationCard from './cancellationCard';

interface ChatMessageProps {
  message: Message;
  onBook: (busId: number) => void;
  selectedChatId?: string;
  setChats?: React.Dispatch<React.SetStateAction<any[]>>;
}

export function ChatMessage({ message, onBook, selectedChatId, setChats }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const { theme } = useTheme();
  const isLoading = message.isLoading || false;
  const [minTimePassed, setMinTimePassed] = useState(false);

  // Always try to parse stringified JSON if possible
  let parsedContent: any = message.content;
  let isMalformedRecommendationString = false;

  // Try to parse if it's a string and looks like JSON
  if (typeof message.content === 'string') {
    try {
      parsedContent = JSON.parse(message.content);
    } catch {
      parsedContent = message.content;
      if (
        message.content.includes('recommendations: [object Object]') ||
        message.content.includes('[object Object]')
      ) {
        isMalformedRecommendationString = true;
      }
    }
  }

  useEffect(() => {
    console.log('[ChatMessage] typeof content:', typeof message.content, message.content);
    console.log('[ChatMessage] typeof parsedContent:', typeof parsedContent, parsedContent);
  }, [message.content, parsedContent]);

  const showLoader = (isLoading && !isUser) || (!minTimePassed && !isUser);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isLoading && !isUser) {
      setMinTimePassed(false);
      timer = setTimeout(() => {
        setMinTimePassed(true);
      }, 2000);
    } else {
      setMinTimePassed(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading, isUser]);

  // --- CANCELLATION SUCCESS MESSAGE RENDERING ---
  if (
    !isUser &&
    typeof parsedContent === 'object' &&
    parsedContent !== null &&
    parsedContent.status === true &&
    typeof parsedContent.message === 'string'
  ) {
    return (
      <div className="flex justify-start items-start py-1 mb-4 gap-1">
        <div className="flex-1 ml-2 text-left">
          <div className="flex items-center gap-1 justify-between">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              <span className="text-[#1765f3] dark:text-[#fbe822]">Ṧ</span>.AI
            </span>
          </div>
          <div className="prose dark:prose-invert max-w-none mt-1 text-xs sm:text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkBreaks]}
              components={{
                a: (props) => (
                  <a {...props} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                    {props.children}
                  </a>
                ),
              }}
            >
              {parsedContent.message}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // --- CANCELLATION CARD RENDERING ---
  if (
    !isUser &&
    typeof parsedContent === 'object' &&
    parsedContent !== null &&
    (parsedContent.success === true || parsedContent.data?.upcoming_travels)
  ) {
    // Get the upcoming travels
    const upcomingTravels = parsedContent.success === true ? 
      parsedContent.data.upcoming_travels : 
      parsedContent;

    // Check if this is a "Where is my bus?" query
    const isWhereIsMyBusQuery = typeof message.content === 'string' && 
      message.content.toLowerCase().includes('where is my bus');

    let cancellationData;
    
    if (isWhereIsMyBusQuery) {
      // Helper function to convert month name to number
      function getMonthNumber(monthName: string): number {
        const months: { [key: string]: number } = {
          'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
          'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
        };
        return months[monthName];
      }

      // Sort journeys by date and time to get the latest one
      const sortedJourneys = [...upcomingTravels].sort((a, b) => {
        // Parse the date and time strings
        const parseDateTime = (dateTimeStr: string) => {
          const [datePart, timePart] = dateTimeStr.split(' at ');
          const [month, day, year] = datePart.split(' ')[0].split(',')[0].split(' ');
          const [time, period] = timePart.split(' ');
          let [hours, minutes] = time.split(':').map(Number);
          
          // Convert to 24-hour format
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          
          return new Date(parseInt(year), getMonthNumber(month), parseInt(day), hours, minutes);
        };

        const dateA = parseDateTime(a.date);
        const dateB = parseDateTime(b.date);
        return dateB.getTime() - dateA.getTime();
      });

      // Take only the latest journey
      const latestJourney = sortedJourneys[0];
      cancellationData = {
        success: true,
        data: {
          upcoming_travels: [latestJourney],
          count: 1,
          fetch_timestamp: new Date().toISOString()
        }
      };
    } else {
      // For cancellation view, show all journeys
      cancellationData = parsedContent.success === true ? 
        parsedContent : 
        { 
          success: true, 
          data: { 
            upcoming_travels: upcomingTravels,
            count: upcomingTravels.length,
            fetch_timestamp: new Date().toISOString()
          } 
        };
    }

    return (
      <div className="flex justify-start items-start py-1 mb-4 gap-1">
        <div className="flex-1 ml-2 text-left">
          <div className="flex items-center gap-1 justify-between">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              <span className="text-[#1765f3] dark:text-[#fbe822]">Ṧ</span>.AI
            </span>
          </div>
          <div className="mt-2 w-full">
            <CancellationCard 
              data={cancellationData} 
              selectedChatId={selectedChatId}
              setChats={setChats}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- IMMEDIATE BUS CARD RENDERING ---
  if (
    !isUser &&
    typeof parsedContent === 'object' &&
    parsedContent !== null &&
    Array.isArray(parsedContent.recommendations)
  ) {
    return (
      <div className="flex justify-start items-start py-1 mb-4 gap-1">
        <div className="flex-1 ml-2 text-left">
          <div className="flex items-center gap-1 justify-between">
            <span className="font-medium text-gray-900 dark:text-gray-100"> 
              <span className="text-[#1765f3] dark:text-[#fbe822]">Ṧ</span>.AI
            </span>
          </div>
          <div className="mt-2 w-full">
            <BusResults searchQuery={parsedContent} onBook={onBook} />
          </div>
        </div>
      </div>
    );
  }

  // --- RAW TICKET DATA FILTERING (prevent JSON display) ---
  if (
    !isUser &&
    typeof parsedContent === 'object' &&
    parsedContent !== null &&
    parsedContent.ticketData &&
    parsedContent.ticketData.invoiceNumber &&
    !parsedContent.summary
  ) {
    // This is raw ticket data without summary - don't render it
    return null;
  }

  // --- TICKET DETAILS RENDERING ---
  if (
    !isUser &&
    typeof parsedContent === 'object' &&
    parsedContent !== null &&
    typeof parsedContent.summary === 'string' &&
    parsedContent.ticketData &&
    parsedContent.ticketData.invoiceNumber
  ) {
    return (
      <div className="flex justify-start items-start py-1 mb-4 gap-1">
        <div className="flex-1 ml-2 text-left">
          <div className="flex items-center gap-1 justify-between">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              <span className="text-[#1765f3] dark:text-[#fbe822]">Ṧ</span>.AI
            </span>
          </div>
          <div className="prose dark:prose-invert max-w-none mt-1 text-xs sm:text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkBreaks]}
              components={{
                a: (props) => (
                  <a {...props} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                    {props.children}
                  </a>
                ),
              }}
            >
              {parsedContent.summary}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // --- TICKET SUMMARY RENDERING (without ticket details) ---
  if (
    !isUser &&
    typeof parsedContent === 'object' &&
    parsedContent !== null &&
    typeof parsedContent.summary === 'string' &&
    !parsedContent.ticketData
  ) {
    return (
      <div className="flex justify-start items-start py-1 mb-4 gap-1">
        <div className="flex-1 ml-2 text-left">
          <div className="flex items-center gap-1 justify-between">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              <span className="text-[#1765f3] dark:text-[#fbe822]">Ṧ</span>.AI
            </span>
          </div>
          <div className="prose dark:prose-invert max-w-none mt-1 text-xs sm:text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkBreaks]}
              components={{
                a: (props) => (
                  <a {...props} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                    {props.children}
                  </a>
                ),
              }}
            >
              {parsedContent.summary}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // Defensive: If assistant message is a string and does NOT look like JSON, but is not empty, render as markdown/text
  if (
    !isUser &&
    typeof parsedContent === 'string' &&
    parsedContent.trim() !== '' &&
    !parsedContent.trim().startsWith('{')
  ) {
    console.log('[ChatMessage] Rendering defensive text:', parsedContent); 
    return (
      <div className="flex justify-start items-start py-1 mb-4 gap-1">
        <div className="flex-1 ml-2 text-left">
          <div className="flex items-center gap-1 justify-between">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              <span className="text-[#1765f3] dark:text-[#fbe822]">Ṧ</span>.AI
            </span>
          </div>
          <div className="prose dark:prose-invert max-w-none mt-1 text-xs sm:text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkBreaks]}
              components={{
                a: (props) => (
                  <a {...props} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                    {props.children}
                  </a>
                ),
              }}
            >
              {parsedContent}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // Loader for assistant
  if (isLoading && !isUser) {
    return (
      <div className="flex justify-start items-start">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center">
            {showLoader ? (
              <div className="flex items-center justify-center w-8 h-8" role="status" aria-label="Loading">
                <style>
                  {`
                    @keyframes sparkle-pulse {
                      0%, 100% { filter: brightness(0.8); transform: scale(0.9); }
                      50% { filter: brightness(1.5); transform: scale(1.2); }
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

  // User message: always render as markdown/text
  if (isUser) {
    return (
      <div className="flex justify-end items-start py-1 mb-4 gap-1">
        <div className="flex-1 mr-2 text-right">
          <div className="prose dark:prose-invert max-w-none mt-1 text-xs sm:text-sm">
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>
              {typeof message.content === 'string'
                ? message.content
                : JSON.stringify(message.content, null, 2)}
            </ReactMarkdown>
          </div>
        </div>
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
      </div>
    );
  }

  // Fallback: Malformed recommendations string
  if (isMalformedRecommendationString) {
    return (
      <div className="flex justify-start items-start py-1 mb-4 gap-1">
        <div className="flex-1 ml-2 text-left">
          <div className="flex items-center gap-1 justify-between">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              <span className="text-[#1765f3] dark:text-[#fbe822]">Ṧ</span>.AI
            </span>
          </div>
          <div className="mt-2 w-full text-yellow-700 dark:text-yellow-300">
            <div className="p-2 border border-yellow-400 rounded bg-yellow-50 dark:bg-yellow-900/30">
              Sorry, bus recommendations could not be displayed due to a data formatting issue.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback: Render as markdown/text (but filter out raw ticket data)
  if (
    !isUser &&
    typeof parsedContent === 'object' &&
    parsedContent !== null &&
    (parsedContent.ticketData || parsedContent.passengerData || parsedContent.billItems)
  ) {
    // This looks like raw ticket data - don't render it as JSON
    console.log('[ChatMessage] Filtering out raw ticket data:', parsedContent);
    return null;
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start py-1 mb-4 gap-1`}>
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
        <div className="prose dark:prose-invert max-w-none mt-1 text-xs sm:text-sm">
          <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            components={{
              a: (props) => (
                <a {...props} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                  {props.children}
                </a>
              ),
            }}
          >
            {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
          </ReactMarkdown>
        </div>
      </div>
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