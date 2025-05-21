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
    const session_id = localStorage.getItem('sessionId') || undefined;
    const body = {
      query: content,
      id: Number(user.id),
      name: user.name || null,
      mobile: user.mobile,
      ...(session_id && { session_id }),
    };

    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

      const responseText = await response.text();
    let assistantContent = '';

    try {
      // Try to parse as JSON
      const parsed = JSON.parse(responseText);

      if (typeof parsed === 'string') {
        assistantContent = parsed;
      } else if (
        parsed &&
        typeof parsed === 'object' &&
        'reply' in parsed &&
        typeof parsed.reply === 'string'
      ) {
        assistantContent = parsed.reply;
      } else if (parsed && typeof parsed === 'object') {
        assistantContent = Object.entries(parsed)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      } else {
        assistantContent = '';
      }
    } catch {
      // Not JSON, treat as plain text
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
    );  } catch (error: any) {
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
      .map((msg: any, index: number) => ({
        id: `${conversationId}-${index}`,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(),
        isLoading: false
      }));

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