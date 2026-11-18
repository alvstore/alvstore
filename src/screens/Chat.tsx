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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Send, Plus, Search, Phone, Check, CheckCheck, Clock, UserPlus, Users, Paperclip, Image as ImageIcon, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string; type: string; title: string | null; participant_ids: string[];
  last_message: string | null; last_message_at: string | null; created_at: string;
  channel: string | null; whatsapp_phone: string | null;
}

interface Message {
  id: string; conversation_id: string; sender_id: string; content: string;
  read_at: string | null; created_at: string; channel: string | null;
  delivery_status: string | null; whatsapp_message_id: string | null;
  file_url?: string | null; file_name?: string | null; file_type?: string | null;
  delivered_at?: string | null;
}

interface ProfileMap {
  [userId: string]: { full_name: string | null; avatar_url: string | null };
}

interface ContactEntry {
  user_id: string; full_name: string | null; role?: string; phone?: string | null;
  has_login: boolean; employee_type?: string;
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
  const [allContacts, setAllContacts] = useState<ContactEntry[]>([]);
  const [waContacts, setWaContacts] = useState<{ name: string; phone: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [channelFilter, setChannelFilter] = useState<"all" | "internal" | "whatsapp">("all");
  const [waPhone, setWaPhone] = useState("");
  const [waName, setWaName] = useState("");
  const [newChatType, setNewChatType] = useState<"internal" | "whatsapp">("internal");
  const [sendingWa, setSendingWa] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; preview?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("chat_conversations").select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (!error && data) setConversations(data as Conversation[]);
  }, [user]);

  const fetchMessages = useCallback(async (convoId: string) => {
    const { data, error } = await supabase
      .from("chat_messages").select("*")
      .eq("conversation_id", convoId).order("created_at", { ascending: true });
    if (!error && data) setMessages(data as Message[]);
  }, []);

  const fetchProfiles = useCallback(async (userIds: string[]) => {
    const missing = userIds.filter(id => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", missing);
    if (data) {
      const map: ProfileMap = { ...profiles };
      data.forEach(p => { map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
      setProfiles(map);
    }
  }, [profiles]);

  const fetchAllContacts = useCallback(async () => {
    const [{ data: profilesData }, { data: rolesData }, { data: employeesData }, { data: customersData }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("employees").select("id, name, user_id, role, phone, employee_type").eq("status", "active"),
      supabase.from("customers").select("id, name, phone").not("phone", "is", null).limit(50),
    ]);

    const rolesMap: Record<string, string> = {};
    rolesData?.forEach(r => { rolesMap[r.user_id] = r.role; });

    const contactMap = new Map<string, ContactEntry>();
    profilesData?.filter(p => p.user_id !== user?.id).forEach(p => {
      contactMap.set(p.user_id, {
        user_id: p.user_id, full_name: p.full_name || "User",
        role: rolesMap[p.user_id] || "staff", has_login: true,
      });
    });

    employeesData?.forEach(emp => {
      if (emp.user_id && emp.user_id !== user?.id && !contactMap.has(emp.user_id)) {
        contactMap.set(emp.user_id, {
          user_id: emp.user_id, full_name: emp.name, role: emp.role || "staff",
          phone: emp.phone, has_login: true, employee_type: emp.employee_type || "internal",
        });
      }
    });

    setAllContacts(Array.from(contactMap.values()));

    const waSuggestions: { name: string; phone: string }[] = [];
    employeesData?.forEach(emp => { if (emp.phone) waSuggestions.push({ name: emp.name, phone: emp.phone }); });
    customersData?.forEach(c => { if (c.phone) waSuggestions.push({ name: c.name, phone: c.phone }); });
    setWaContacts(waSuggestions);
  }, [user]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    const allIds = new Set<string>();
    conversations.forEach(c => c.participant_ids.forEach(id => allIds.add(id)));
    messages.forEach(m => { if (m.sender_id) allIds.add(m.sender_id); });
    if (allIds.size > 0) fetchProfiles(Array.from(allIds));
  }, [conversations, messages]);

  // Mark messages as read when viewing a conversation
  const markMessagesRead = useCallback(async (convoId: string) => {
    if (!user) return;
    await supabase.from("chat_messages")
      .update({ read_at: new Date().toISOString() } as any)
      .eq("conversation_id", convoId)
      .neq("sender_id", user.id)
      .is("read_at", null);
  }, [user]);

  const selectConvo = (id: string) => {
    setSelectedConvo(id);
    setMobileShowChat(true);
    fetchMessages(id);
    markMessagesRead(id);
  };

  // Poll for new messages (replaces Supabase realtime subscription)
  useEffect(() => {
    if (!selectedConvo) return;
    const interval = setInterval(() => {
      fetchMessages(selectedConvo);
      fetchConversations();
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedConvo, fetchConversations, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // File upload handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File size must be under 10MB"); return; }
    const isImage = file.type.startsWith("image/");
    const preview = isImage ? URL.createObjectURL(file) : undefined;
    setPendingFile({ file, preview });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadAndSend = async (file: File) => {
    if (!selectedConvo || !user) return null;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `chat/${selectedConvo}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("chat-files").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
      return { url: urlData.publicUrl, name: file.name, type: file.type };
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    if ((!messageText.trim() && !pendingFile) || !selectedConvo || !user) return;
    const content = messageText.trim() || (pendingFile ? `📎 ${pendingFile.file.name}` : "");
    setMessageText("");

    let fileData: { url: string; name: string; type: string } | null = null;
    if (pendingFile) {
      fileData = await uploadAndSend(pendingFile.file);
      setPendingFile(null);
    }

    const convo = conversations.find(c => c.id === selectedConvo);
    const isWhatsApp = convo?.channel === "whatsapp";

    if (isWhatsApp && convo?.whatsapp_phone) {
      setSendingWa(true);
      try {
        const { data, error } = await supabase.functions.invoke("send-whatsapp", {
          body: { to: convo.whatsapp_phone, message: content, conversation_id: selectedConvo, sender_id: user.id },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Send failed");
      } catch (err: any) {
        toast.error(err.message || "WhatsApp send failed");
        setMessageText(content);
      } finally { setSendingWa(false); }
      await supabase.from("chat_conversations").update({ last_message: content, last_message_at: new Date().toISOString() }).eq("id", selectedConvo);
    } else {
      const insertPayload: any = {
        conversation_id: selectedConvo, sender_id: user.id, content, channel: "internal",
      };
      if (fileData) {
        insertPayload.file_url = fileData.url;
        insertPayload.file_name = fileData.name;
        insertPayload.file_type = fileData.type;
      }
      const { error } = await supabase.from("chat_messages").insert(insertPayload);
      if (error) { toast.error("Failed to send"); return; }
      await supabase.from("chat_conversations").update({ last_message: content, last_message_at: new Date().toISOString() }).eq("id", selectedConvo);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const createConversation = async () => {
    if (!user) return;
    if (newChatType === "whatsapp") {
      if (!waPhone.trim()) { toast.error("Enter phone number"); return; }
      const { data, error } = await supabase.from("chat_conversations").insert({
        type: "whatsapp", channel: "whatsapp", participant_ids: [user.id],
        created_by: user.id, title: waName || waPhone,
        whatsapp_phone: waPhone.replace(/\D/g, ""),
      }).select().single();
      if (error) { toast.error(error.message); return; }
      setNewSheetOpen(false); setWaPhone(""); setWaName("");
      fetchConversations();
      if (data) selectConvo(data.id);
      return;
    }
    if (!selectedUserId) return;
    const existing = conversations.find(c =>
      c.channel !== "whatsapp" && c.participant_ids.length === 2 &&
      c.participant_ids.includes(user.id) && c.participant_ids.includes(selectedUserId)
    );
    if (existing) { selectConvo(existing.id); setNewSheetOpen(false); setSelectedUserId(""); return; }
    const { data, error } = await supabase.from("chat_conversations").insert({
      type: "internal", channel: "internal", participant_ids: [user.id, selectedUserId], created_by: user.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setNewSheetOpen(false); setSelectedUserId("");
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

  const DeliveryIcon = ({ msg }: { msg: Message }) => {
    const isMe = msg.sender_id === user?.id;
    if (!isMe) return null;
    if (msg.read_at) return <CheckCheck className="h-3 w-3 text-info" />;
    if (msg.delivered_at) return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    return <Check className="h-3 w-3 text-muted-foreground" />;
  };

  const filteredConvos = conversations.filter(c => {
    if (channelFilter !== "all" && (c.channel || "internal") !== channelFilter) return false;
    if (!searchText) return true;
    return getConvoName(c).toLowerCase().includes(searchText.toLowerCase());
  });

  const selectedConversation = conversations.find(c => c.id === selectedConvo);

  const isImageFile = (type?: string | null) => type?.startsWith("image/");

  const FilePreview = ({ msg }: { msg: Message }) => {
    if (!msg.file_url) return null;
    if (isImageFile(msg.file_type)) {
      return (
        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
          <img src={msg.file_url} alt={msg.file_name || "Image"} className="max-w-[220px] rounded-lg border border-border/50" />
        </a>
      );
    }
    return (
      <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-xs">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate max-w-[160px]">{msg.file_name || "File"}</span>
      </a>
    );
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="text-muted-foreground text-sm">Team & customer messaging</p>
        </div>
        <Button onClick={() => { fetchAllContacts(); setNewChatType("internal"); setNewSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />New Chat
        </Button>
      </div>

      <Card className="flex-1 flex overflow-hidden border-border/50">
        {/* Left Panel */}
        <div className={cn(
          "w-full md:w-80 border-r border-border/50 flex flex-col bg-card",
          mobileShowChat ? "hidden md:flex" : "flex"
        )}>
          <div className="p-3 border-b border-border/50 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search conversations..." className="pl-9 h-9" value={searchText} onChange={e => setSearchText(e.target.value)} />
            </div>
            <Tabs value={channelFilter} onValueChange={v => setChannelFilter(v as any)}>
              <TabsList className="w-full h-8">
                <TabsTrigger value="all" className="text-xs flex-1">All</TabsTrigger>
                <TabsTrigger value="internal" className="text-xs flex-1"><MessageCircle className="h-3 w-3 mr-1" />Internal</TabsTrigger>
                <TabsTrigger value="whatsapp" className="text-xs flex-1"><Phone className="h-3 w-3 mr-1" />WhatsApp</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredConvos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No conversations yet</p>
                <p className="text-xs mt-1">Click "New Chat" to start messaging</p>
              </div>
            ) : filteredConvos.map(c => (
              <button
                key={c.id} onClick={() => selectConvo(c.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/30",
                  selectedConvo === c.id && "bg-primary/5 border-l-2 border-l-primary"
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className={cn("text-xs font-semibold",
                    c.channel === "whatsapp" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                  )}>
                    {c.channel === "whatsapp" ? <Phone className="h-4 w-4" /> : getInitials(getConvoName(c))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{getConvoName(c)}</p>
                      {c.channel === "whatsapp" && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 text-success border-success/30">WA</Badge>
                      )}
                    </div>
                    {c.last_message_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {format(new Date(c.last_message_at), "HH:mm")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message || "No messages yet"}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className={cn("flex-1 flex flex-col bg-background/50", !mobileShowChat ? "hidden md:flex" : "flex")}>
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
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMobileShowChat(false)}>←</Button>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className={cn("text-xs font-semibold",
                    selectedConversation?.channel === "whatsapp" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                  )}>
                    {selectedConversation?.channel === "whatsapp"
                      ? <Phone className="h-4 w-4" />
                      : getInitials(selectedConversation ? getConvoName(selectedConversation) : "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{selectedConversation ? getConvoName(selectedConversation) : "Chat"}</p>
                    {selectedConversation?.channel === "whatsapp" && (
                      <Badge variant="outline" className="text-[10px] text-success border-success/30">WhatsApp</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedConversation?.channel === "whatsapp" ? selectedConversation.whatsapp_phone : "Internal"}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
                {messages.map(msg => {
                  const isMe = msg.sender_id === user?.id;
                  const senderName = msg.sender_id ? (profiles[msg.sender_id]?.full_name || "User") : "System";
                  const isWaMsg = msg.channel === "whatsapp";
                  return (
                    <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                      <div className={cn("flex gap-2 max-w-[75%]", isMe && "flex-row-reverse")}>
                        {!isMe && (
                          <Avatar className="h-7 w-7 mt-1 shrink-0">
                            <AvatarFallback className={cn("text-[10px]", isWaMsg ? "bg-success/10 text-success" : "bg-muted")}>
                              {isWaMsg ? <Phone className="h-3 w-3" /> : getInitials(senderName)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          {!isMe && <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">{senderName}</p>}
                          <div className={cn("rounded-2xl px-3.5 py-2 text-sm",
                            isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"
                          )}>
                            {msg.content && !msg.content.startsWith("📎") && msg.content}
                            {msg.content?.startsWith("📎") && !msg.file_url && msg.content}
                            <FilePreview msg={msg} />
                          </div>
                          <div className={cn("flex items-center gap-1 mt-0.5", isMe ? "justify-end mr-1" : "ml-1")}>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(msg.created_at), "HH:mm")}</span>
                            <DeliveryIcon msg={msg} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Pending file preview */}
              {pendingFile && (
                <div className="px-4 py-2 border-t border-border/50 bg-muted/30 flex items-center gap-3">
                  {pendingFile.preview ? (
                    <img src={pendingFile.preview} alt="Preview" className="h-12 w-12 rounded-lg object-cover border border-border" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{pendingFile.file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(pendingFile.file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPendingFile(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Input Bar */}
              <div className="p-3 border-t border-border/50 bg-card">
                <div className="flex gap-2 items-center">
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xlsx,.csv,.txt" onChange={handleFileSelect} />
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder={selectedConversation?.channel === "whatsapp" ? "Type a WhatsApp message..." : "Type a message..."}
                    value={messageText} onChange={e => setMessageText(e.target.value)}
                    onKeyDown={handleKeyPress} className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={(!messageText.trim() && !pendingFile) || sendingWa || uploading}>
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
            <SheetDescription>Start an internal or WhatsApp chat</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <Tabs value={newChatType} onValueChange={v => setNewChatType(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="internal" className="flex-1"><MessageCircle className="h-3.5 w-3.5 mr-1.5" />Internal</TabsTrigger>
                <TabsTrigger value="whatsapp" className="flex-1"><Phone className="h-3.5 w-3.5 mr-1.5" />WhatsApp</TabsTrigger>
              </TabsList>
            </Tabs>

            {newChatType === "internal" ? (
              <>
                {allContacts.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/30" />
                    <div>
                      <p className="text-sm font-medium text-foreground">No contacts available</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add employees with login accounts in<br />
                        <span className="font-medium">Settings → Employees</span> to enable internal chat
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                      <SelectContent>
                        {allContacts.map(p => (
                          <SelectItem key={p.user_id} value={p.user_id}>
                            <div className="flex items-center gap-2">
                              <span>{p.full_name || "User"}</span>
                              <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize">{p.role || "staff"}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={createConversation} disabled={!selectedUserId}>
                      <MessageCircle className="h-4 w-4 mr-2" />Start Chat
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
                {waContacts.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Quick Select Contact</label>
                    <Select onValueChange={(v) => {
                      const contact = waContacts.find(c => c.phone === v);
                      if (contact) { setWaPhone(contact.phone); setWaName(contact.name); }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select from contacts" /></SelectTrigger>
                      <SelectContent>
                        {waContacts.map((c, i) => (
                          <SelectItem key={`${c.phone}-${i}`} value={c.phone}>
                            <div className="flex items-center gap-2">
                              <span>{c.name}</span>
                              <span className="text-xs text-muted-foreground">{c.phone}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Contact Name</label>
                  <Input placeholder="Customer name" value={waName} onChange={e => setWaName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">WhatsApp Phone *</label>
                  <Input placeholder="+91 98765 43210" value={waPhone} onChange={e => setWaPhone(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Include country code (e.g. 919876543210)</p>
                </div>
                <Button className="w-full" onClick={createConversation} disabled={!waPhone.trim()}>
                  <Phone className="h-4 w-4 mr-2" />Start WhatsApp Chat
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
