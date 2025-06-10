import { Chat, Message } from '../types/chat';
import { toast } from 'react-toastify';
import { authService } from '../services/api';
import { NavigateFunction } from 'react-router-dom';

export function createNewSession(
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  setSelectedChatId: (id: string) => void,
  navigate: NavigateFunction
) {
  const newChat: Chat = {
    id: Date.now().toString(),
    title: 'New Chat',
    messages: [],
    lastUpdated: new Date(),
  };

  setChats(prevChats => [newChat, ...prevChats]);
  setSelectedChatId(newChat.id);
  localStorage.setItem('sessionId', newChat.id);
  navigate(`/c/${newChat.id}`);
  return newChat.id;
}

export async function handleSendMessage(
  content: string,
  selectedChatId: string,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  locationPathname: string,
  createNewSessionHelper: () => string
) {
  const user = authService.getUser();
  
  if (!user?.id || !user?.mobile) {
    toast.error("Please login to chat.");
    // Trigger login modal
    window.dispatchEvent(new CustomEvent('login:required'));
    return;
  }

  if (locationPathname === '/' && !localStorage.getItem('sessionId')) {
    createNewSessionHelper();
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const newMessageId = Date.now().toString();

  const userMessage: Message = {
    id: newMessageId,
    content,
    role: 'user',
    timestamp: new Date(),
  };

  setChats((prevChats) =>
    prevChats.map((chat) =>
      chat.id === selectedChatId
        ? { ...chat, messages: [...chat.messages, userMessage], lastUpdated: new Date() }
        : chat
    )
  );

  const loadingMessageId = `${newMessageId}-loading`;
  setChats((prevChats) =>
    prevChats.map((chat) =>
      chat.id === selectedChatId
        ? {
            ...chat,
            messages: [
              ...chat.messages,
              {
                id: loadingMessageId,
                content: '',
                role: 'assistant',
                timestamp: new Date(),
                isLoading: true,
              },
            ],
            lastUpdated: new Date(),
          }
        : chat
    )
  );

  try {
    const session_id = localStorage.getItem('sessionId');

    // Check authentication before making request
    if (!authService.isAuthenticated()) {
      toast.error("Please login to continue");
      window.dispatchEvent(new CustomEvent('login:required'));
      return;
    }

    const body = {
      query: content,
      id: Number(user.id),
      name: user.name || null,
      mobile: user.mobile,
      session_id: session_id || undefined
    };

    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-User-ID': user.id?.toString() || '',
      'X-Session-ID': session_id || ''
    });

    // Use fetchWithRefresh which handles token refresh automatically
    const response = await authService.fetchWithRefresh('/api/query', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const responseText = await response.text();
    let assistantContent: any = '';

    try {
      // Try to parse as JSON
      const parsed = JSON.parse(responseText);

      if (parsed?.data?.upcoming_travels || parsed?.upcoming_travels) {
        // This is cancellation data - preserve the structure
        assistantContent = parsed.data ? parsed : { data: parsed };
      } else if (
        parsed &&
        typeof parsed === 'object' &&
        'recommendations' in parsed &&
        Array.isArray(parsed.recommendations)
      ) {
        assistantContent = parsed;
      } else if (
        parsed &&
        typeof parsed === 'object' &&
        'reply' in parsed &&
        typeof parsed.reply === 'string'
      ) {
        assistantContent = parsed.reply;
      } else {
        assistantContent = responseText;
      }
    } catch {
      assistantContent = responseText;
    }

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === selectedChatId
          ? {
              ...chat,
              messages: chat.messages.map((message) =>
                message.id === loadingMessageId
                  ? {
                      ...message,
                      id: `${Date.now()}`,
                      content: assistantContent,
                      isLoading: false,
                      role: 'assistant',
                    }
                  : message
              ),
              lastUpdated: new Date(),
            }
          : chat
      )
    );
  } catch (error: any) {
    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === selectedChatId
          ? {
              ...chat,
              messages: chat.messages.map((message) =>
                message.id === loadingMessageId
                  ? {
                      ...message,
                      content: 'Sorry, something went wrong. Please try again.',
                      isLoading: false,
                    }
                  : message
              ),
              lastUpdated: new Date(),
            }
          : chat
      )
    );
    
    if (error.message === 'Session expired') {
      toast.error('Session expired. Please login again.');
      window.dispatchEvent(new CustomEvent('login:required'));
    } else {
      toast.error(error.message || 'Failed to send message');
    }
  }
}

export function handleNewChat(
  chats: Chat[],
  selectedChatId: string,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  setSelectedChatId: (id: string) => void,
  navigate: NavigateFunction
) {
  const currentChat = chats.find(chat => chat.id === selectedChatId);

  if (currentChat && currentChat.messages.length <= 1) {
    toast.error('Please start a conversation before creating a new chat');
    return;
  }

  localStorage.removeItem('sessionId');

  const newChat: Chat = {
    id: Date.now().toString(),
    title: 'New Chat',
    messages: [],
    lastUpdated: new Date(),
  };

  setChats(prevChats => [newChat, ...prevChats]);
  setSelectedChatId(newChat.id);
  localStorage.setItem('sessionId', newChat.id);

  navigate(`/c/${newChat.id}`);
}

export async function loadConversation(
  conversationId: string,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  setSelectedChatId: (id: string) => void,
  navigate: NavigateFunction,
  locationPathname: string
) {
  try {
    const user = authService.getUser();

    if (!user?.id) {
      toast.error("User not found");
      return;
    }

    console.log(`[loadConversation] Loading conversation: ${conversationId}`);

    // Skip authentication test for chat history loading
    const historyResponse = await fetch(
      `/api/history?user_id=${user.id}&session_id=${conversationId}`,
      {
        credentials: 'include',
        headers: {
          'X-User-ID': user.id.toString(),
          'X-Session-ID': conversationId
        }
      }
    );

    if (!historyResponse.ok) {
      if (historyResponse.status === 404) {
        console.log(`[loadConversation] Conversation ${conversationId} not found, creating empty chat`);
        
        // Create empty chat for new conversation
        const newChat: Chat = {
          id: conversationId,
          title: 'New Conversation',
          messages: [],
          lastUpdated: new Date()
        };

        setChats(prevChats => {
          const exists = prevChats.some(c => c.id === conversationId);
          if (!exists) {
            return [newChat, ...prevChats];
          }
          return prevChats;
        });

        setSelectedChatId(conversationId);
        localStorage.setItem('sessionId', conversationId);
        
        if (locationPathname !== `/c/${conversationId}`) {
          navigate(`/c/${conversationId}`, { replace: true });
        }
        
        return;
      }
      throw new Error(`Failed to fetch conversation history: ${historyResponse.status}`);
    }

    const historyData = await historyResponse.json();
    console.log('[loadConversation] Raw history data:', historyData);

    // Handle empty history
    if (!historyData.history || historyData.history.length === 0) {
      console.log(`[loadConversation] Empty history for conversation: ${conversationId}`);
      
      const emptyChat: Chat = {
        id: conversationId,
        title: 'Empty Conversation',
        messages: [],
        lastUpdated: new Date()
      };

      setChats(prevChats => {
        const exists = prevChats.some(c => c.id === conversationId);
        if (!exists) {
          return [emptyChat, ...prevChats];
        }
        return prevChats.map(c =>
          c.id === conversationId ? emptyChat : c
        );
      });

      setSelectedChatId(conversationId);
      localStorage.setItem('sessionId', conversationId);

      if (locationPathname !== `/c/${conversationId}`) {
        navigate(`/c/${conversationId}`, { replace: true });
      }
      
      return;
    }

    const formattedMessages: Message[] = historyData.history
      .filter((msg: any) => msg.role !== 'meta')
      .map((msg: any, index: number) => {
        let content = msg.content;
        
        // Try to parse JSON content if it's a string
        if (typeof content === 'string') {
          try {
            const parsed = JSON.parse(content);
            if (parsed.data?.upcoming_travels || parsed.upcoming_travels) {
              content = parsed; // Use the parsed object directly
            } else if (parsed.summary || parsed.ticketData || parsed.recommendations) {
              // Handle ticket confirmations, bus recommendations, and other structured data
              console.log('[loadConversation] Found structured data:', parsed);
              content = parsed;
            }
          } catch {
            // Not JSON, keep as string
          }
        }
        
        return {
          id: `${conversationId}-${index}`,
          role: msg.role as 'user' | 'assistant',
          content: content,
          timestamp: new Date(msg.timestamp || Date.now()),
          isLoading: false
        };
      });

    const loadedChat: Chat = {
      id: conversationId,
      title: formattedMessages.length > 0 ? 'Loaded Conversation' : 'Empty Conversation',
      messages: formattedMessages,
      lastUpdated: new Date()
    };

    setChats(prevChats => {
      const exists = prevChats.some(c => c.id === conversationId);
      if (exists) {
        return prevChats.map(c =>
          c.id === conversationId ? loadedChat : c
        );
      } else {
        return [loadedChat, ...prevChats];
      }
    });

    setSelectedChatId(conversationId);
    localStorage.setItem('sessionId', conversationId);

    if (locationPathname !== `/c/${conversationId}`) {
      navigate(`/c/${conversationId}`, { replace: true });
    }

    console.log(`[loadConversation] Successfully loaded conversation: ${conversationId} with ${formattedMessages.length} messages`);
  } catch (error) {
    console.error('[loadConversation] Error:', error);
    if (error instanceof Error && error.message === 'Session expired') {
      toast.error('Session expired. Please login again.');
      window.dispatchEvent(new CustomEvent('login:required'));
    } else {
      toast.error('Failed to load conversation');
    }
  }
}

export function addAIMessageToChat(
  content: string,
  selectedChatId: string,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
) {
  const newMessageId = Date.now().toString();

  const aiMessage: Message = {
    id: newMessageId,
    content,
    role: 'assistant',
    timestamp: new Date(),
  };

  setChats((prevChats) =>
    prevChats.map((chat) =>
      chat.id === selectedChatId
        ? { ...chat, messages: [...chat.messages, aiMessage], lastUpdated: new Date() }
        : chat
    )
  );
}