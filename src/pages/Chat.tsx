import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Send, Plus, Search, Users, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  type: string;
  title: string | null;
  participant_ids: string[];
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface ProfileMap {
  [userId: string]: { full_name: string | null; avatar_url: string | null };
}

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [newSheetOpen, setNewSheetOpen] = useState(false);
  const [allProfiles, setAllProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (!error && data) setConversations(data);
  }, [user]);

  const fetchMessages = useCallback(async (convoId: string) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });
    if (!error && data) setMessages(data);
  }, []);

  const fetchProfiles = useCallback(async (userIds: string[]) => {
    const missing = userIds.filter(id => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", missing);
    if (data) {
      const map: ProfileMap = { ...profiles };
      data.forEach(p => { map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
      setProfiles(map);
    }
  }, [profiles]);

  const fetchAllProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name");
    if (data) setAllProfiles(data.filter(p => p.user_id !== user?.id));
  }, [user]);

  // Initial load
  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Fetch profiles for all participants
  useEffect(() => {
    const allIds = new Set<string>();
    conversations.forEach(c => c.participant_ids.forEach(id => allIds.add(id)));
    messages.forEach(m => allIds.add(m.sender_id));
    if (allIds.size > 0) fetchProfiles(Array.from(allIds));
  }, [conversations, messages]);

  // Select conversation
  const selectConvo = (id: string) => {
    setSelectedConvo(id);
    setMobileShowChat(true);
    fetchMessages(id);
  };

  // Realtime subscription
  useEffect(() => {
    if (!selectedConvo) return;
    const channel = supabase
      .channel(`chat-${selectedConvo}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${selectedConvo}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => [...prev, newMsg]);
        // Update conversation list
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConvo, fetchConversations]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConvo || !user) return;
    const content = messageText.trim();
    setMessageText("");

    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: selectedConvo,
      sender_id: user.id,
      content,
    });
    if (error) { toast.error("Failed to send"); return; }

    // Update conversation last_message
    await supabase.from("chat_conversations").update({
      last_message: content,
      last_message_at: new Date().toISOString(),
    }).eq("id", selectedConvo);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const createConversation = async () => {
    if (!selectedUserId || !user) return;
    // Check if conversation already exists
    const existing = conversations.find(c =>
      c.participant_ids.length === 2 &&
      c.participant_ids.includes(user.id) &&
      c.participant_ids.includes(selectedUserId)
    );
    if (existing) {
      selectConvo(existing.id);
      setNewSheetOpen(false);
      setSelectedUserId("");
      return;
    }

    const { data, error } = await supabase.from("chat_conversations").insert({
      type: "internal",
      participant_ids: [user.id, selectedUserId],
      created_by: user.id,
    }).select().single();

    if (error) { toast.error(error.message); return; }
    setNewSheetOpen(false);
    setSelectedUserId("");
    fetchConversations();
    if (data) selectConvo(data.id);
  };

  const getConvoName = (c: Conversation) => {
    if (c.title) return c.title;
    const otherId = c.participant_ids.find(id => id !== user?.id);
    if (otherId && profiles[otherId]) return profiles[otherId].full_name || "User";
    return "Conversation";
  };

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  const filteredConvos = conversations.filter(c => {
    if (!searchText) return true;
    const name = getConvoName(c).toLowerCase();
    return name.includes(searchText.toLowerCase());
  });

  const selectedConversation = conversations.find(c => c.id === selectedConvo);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="text-muted-foreground text-sm">Team & customer messaging</p>
        </div>
        <Button onClick={() => { fetchAllProfiles(); setNewSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />New Chat
        </Button>
      </div>

      <Card className="flex-1 flex overflow-hidden border-border/50">
        {/* Left Panel - Conversation List */}
        <div className={cn(
          "w-full md:w-80 border-r border-border/50 flex flex-col bg-card",
          mobileShowChat ? "hidden md:flex" : "flex"
        )}>
          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-9 h-9"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredConvos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No conversations yet</p>
              </div>
            ) : filteredConvos.map(c => (
              <button
                key={c.id}
                onClick={() => selectConvo(c.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/30",
                  selectedConvo === c.id && "bg-primary/5 border-l-2 border-l-primary"
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {getInitials(getConvoName(c))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{getConvoName(c)}</p>
                    {c.last_message_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {format(new Date(c.last_message_at), "HH:mm")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.last_message || "No messages yet"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel - Messages */}
        <div className={cn(
          "flex-1 flex flex-col bg-background/50",
          !mobileShowChat ? "hidden md:flex" : "flex"
        )}>
          {!selectedConvo ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose a chat to start messaging</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setMobileShowChat(false)}
                >
                  ←
                </Button>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {selectedConversation ? getInitials(getConvoName(selectedConversation)) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">
                    {selectedConversation ? getConvoName(selectedConversation) : "Chat"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedConversation?.type === "internal" ? "Internal" : "Customer"}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
                {messages.map(msg => {
                  const isMe = msg.sender_id === user?.id;
                  const senderName = profiles[msg.sender_id]?.full_name || "User";
                  return (
                    <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                      <div className={cn("flex gap-2 max-w-[75%]", isMe && "flex-row-reverse")}>
                        {!isMe && (
                          <Avatar className="h-7 w-7 mt-1 shrink-0">
                            <AvatarFallback className="text-[10px] bg-muted">{getInitials(senderName)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          {!isMe && (
                            <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">{senderName}</p>
                          )}
                          <div className={cn(
                            "rounded-2xl px-3.5 py-2 text-sm",
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md"
                          )}>
                            {msg.content}
                          </div>
                          <p className={cn(
                            "text-[10px] text-muted-foreground mt-0.5",
                            isMe ? "text-right mr-1" : "ml-1"
                          )}>
                            {format(new Date(msg.created_at), "HH:mm")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              <div className="p-3 border-t border-border/50 bg-card">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={!messageText.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* New Conversation Sheet */}
      <Sheet open={newSheetOpen} onOpenChange={setNewSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>New Conversation</SheetTitle>
            <SheetDescription>Start a chat with a team member</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {allProfiles.map(p => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name || "User"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={createConversation} disabled={!selectedUserId}>
              <MessageCircle className="h-4 w-4 mr-2" />Start Chat
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
