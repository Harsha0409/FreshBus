import { Chat, Message } from '../types/chat';
import { toast } from 'react-toastify';
import { authService } from '../services/api';

export function createNewSession(
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  setSelectedChatId: (id: string) => void,
  navigate: (path: string) => void
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
  const userStr = localStorage.getItem('user');
  let user: { id?: string; name?: string; mobile?: string } = {};
  try {
    user = userStr && userStr !== "undefined" ? JSON.parse(userStr) : {};
  } catch {
    user = {};
  }
  if (!user.id || !user.mobile) {
    toast.error("Please login to chat.");
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

  // --- Added: Send query to backend ---
  try {
    const session_id = localStorage.getItem('sessionId');
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('refresh_token='))
      ?.split('=')?.[1];

    // Validate tokens before making the request
    if (!accessToken) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        // Try to refresh the token
        const refreshed = await authService.refreshToken();
        if (!refreshed) {
          toast.error("Session expired. Please login again.");
          authService.clearAuth(); // Clear stored auth data
          return;
        }
      } else {
        toast.error("Please login to continue");
        return;
      }
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
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`, // Get fresh token
      'X-User-ID': user.id?.toString() || '',
      'X-Session-ID': session_id || ''
    });

    if (refreshToken) {
      headers.append('X-Refresh-Token', refreshToken);
    }

    const response = await fetch('/api/query', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include' // Important: include cookies in request
    });

    if (response.status === 401) {
      // Try to refresh the token
      const refreshed = await authService.refreshToken();
      if (!refreshed) {
        toast.error("Session expired. Please login again.");
        authService.clearAuth(); // Clear stored auth data
        return;
      }
      // Retry the request with new token
      return handleSendMessage(content, selectedChatId, setChats, locationPathname, createNewSessionHelper);
    }

    // Handle authentication errors
    if (response.status === 401) {
      const errorData = await response.json();
      toast.error(errorData.message || "Session expired. Please login again.");
      // Clear invalid tokens
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      return;
    }

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
    toast.error(error.message || 'Failed to send message');
  }
}

export function handleNewChat(
  chats: Chat[],
  selectedChatId: string,
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
  setSelectedChatId: (id: string) => void,
  navigate: (path: string) => void
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
  navigate: (path: string) => void,
  locationPathname: string
) {
  try {
    const userStr = localStorage.getItem('user');
    let user: { id?: string; name?: string; mobile?: string } = {};
    try {
      user = userStr && userStr !== "undefined" ? JSON.parse(userStr) : {};
    } catch {
      user = {};
    }

    if (!user.id) {
      toast.error("User not found");
      return;
    }

    const historyResponse = await authService.fetchWithRefresh(
      `/api/history?user_id=${user.id}&session_id=${conversationId}`
    );

    if (!historyResponse.ok) {
      throw new Error('Failed to fetch conversation history');
    }

    const historyData = await historyResponse.json();

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
            }
          } catch {
            // Not JSON, keep as string
          }
        }
        
        return {
          id: `${conversationId}-${index}`,
          role: msg.role as 'user' | 'assistant',
          content: content,
          timestamp: new Date(),
          isLoading: false
        };
      });

    const loadedChat: Chat = {
      id: conversationId,
      title: 'Loaded Conversation',
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
      navigate(`/c/${conversationId}`);
    }

    toast.success('Conversation loaded successfully');
  } catch (error) {
    toast.error('Failed to load conversation');
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