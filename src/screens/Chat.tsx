"use client";

import { Avatar, Box, Button, ButtonBase, Card, IconButton, MenuItem, Tab, TextField, Typography } from "@mui/material";
import { AnimatedPage, PageHeader, SearchToolbar, SideDrawer, StatusChip, TabBar, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageCircle, Send, Plus, Search, Phone, Check, CheckCheck, Clock, UserPlus, Users, Paperclip, Image as ImageIcon, FileText, X } from "lucide-react";
import { format } from "date-fns";
interface Conversation {
    id: string;
    type: string;
    title: string | null;
    participant_ids: string[];
    last_message: string | null;
    last_message_at: string | null;
    created_at: string;
    channel: string | null;
    whatsapp_phone: string | null;
}
interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    read_at: string | null;
    created_at: string;
    channel: string | null;
    delivery_status: string | null;
    whatsapp_message_id: string | null;
    file_url?: string | null;
    file_name?: string | null;
    file_type?: string | null;
    delivered_at?: string | null;
}
interface ProfileMap {
    [userId: string]: {
        full_name: string | null;
        avatar_url: string | null;
    };
}
interface ContactEntry {
    user_id: string;
    full_name: string | null;
    role?: string;
    phone?: string | null;
    has_login: boolean;
    employee_type?: string;
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
    const [waContacts, setWaContacts] = useState<{
        name: string;
        phone: string;
    }[]>([]);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [mobileShowChat, setMobileShowChat] = useState(false);
    const [channelFilter, setChannelFilter] = useState<"all" | "internal" | "whatsapp">("all");
    const [waPhone, setWaPhone] = useState("");
    const [waName, setWaName] = useState("");
    const [newChatType, setNewChatType] = useState<"internal" | "whatsapp">("internal");
    const [sendingWa, setSendingWa] = useState(false);
    const [promotingLead, setPromotingLead] = useState(false);
    const [promotedMap, setPromotedMap] = useState<Record<string, boolean>>({});
    const [uploading, setUploading] = useState(false);
    const [pendingFile, setPendingFile] = useState<{
        file: File;
        preview?: string;
    } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fetchConversations = useCallback(async () => {
        if (!user)
            return;
        const { data, error } = await supabase
            .from("chat_conversations").select("*")
            .order("last_message_at", { ascending: false, nullsFirst: false });
        if (!error && data)
            setConversations(data as Conversation[]);
    }, [user]);
    const fetchMessages = useCallback(async (convoId: string) => {
        const { data, error } = await supabase
            .from("chat_messages").select("*")
            .eq("conversation_id", convoId).order("created_at", { ascending: true });
        if (!error && data)
            setMessages(data as Message[]);
    }, []);
    const fetchProfiles = useCallback(async (userIds: string[]) => {
        const missing = userIds.filter(id => !profiles[id]);
        if (missing.length === 0)
            return;
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
        const waSuggestions: {
            name: string;
            phone: string;
        }[] = [];
        employeesData?.forEach(emp => { if (emp.phone)
            waSuggestions.push({ name: emp.name, phone: emp.phone }); });
        customersData?.forEach(c => { if (c.phone)
            waSuggestions.push({ name: c.name, phone: c.phone }); });
        setWaContacts(waSuggestions);
    }, [user]);
    useEffect(() => { fetchConversations(); }, [fetchConversations]);
    useEffect(() => {
        const allIds = new Set<string>();
        conversations.forEach(c => c.participant_ids.forEach(id => allIds.add(id)));
        messages.forEach(m => { if (m.sender_id)
            allIds.add(m.sender_id); });
        if (allIds.size > 0)
            fetchProfiles(Array.from(allIds));
    }, [conversations, messages]);
    // Mark messages as read when viewing a conversation
    const markMessagesRead = useCallback(async (convoId: string) => {
        if (!user)
            return;
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
    // Poll conversations & active thread (and auto-select ?conversation= from notifications)
    useEffect(() => {
        const paramConvo = new URLSearchParams(window.location.search).get("conversation");
        if (paramConvo && !selectedConvo) {
            setSelectedConvo(paramConvo);
            setMobileShowChat(true);
            fetchMessages(paramConvo);
        }
    }, [fetchMessages, selectedConvo]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (selectedConvo) fetchMessages(selectedConvo);
            fetchConversations();
        }, selectedConvo ? 4000 : 8000);
        return () => clearInterval(interval);
    }, [selectedConvo, fetchConversations, fetchMessages]);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    // File upload handler
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File size must be under 10MB");
            return;
        }
        const isImage = file.type.startsWith("image/");
        const preview = isImage ? URL.createObjectURL(file) : undefined;
        setPendingFile({ file, preview });
        if (fileInputRef.current)
            fileInputRef.current.value = "";
    };
    const uploadAndSend = async (file: File) => {
        if (!selectedConvo || !user)
            return null;
        setUploading(true);
        try {
            const ext = file.name.split(".").pop();
            const path = `chat/${selectedConvo}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage.from("chat-files").upload(path, file);
            if (uploadError)
                throw uploadError;
            const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
            return { url: urlData.publicUrl, name: file.name, type: file.type };
        }
        catch (err: any) {
            toast.error("Upload failed: " + err.message);
            return null;
        }
        finally {
            setUploading(false);
        }
    };
    const sendMessage = async () => {
        if ((!messageText.trim() && !pendingFile) || !selectedConvo || !user)
            return;
        const content = messageText.trim() || (pendingFile ? `📎 ${pendingFile.file.name}` : "");
        setMessageText("");
        let fileData: {
            url: string;
            name: string;
            type: string;
        } | null = null;
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
                    body: {
                        to: convo.whatsapp_phone,
                        message: content,
                        conversation_id: selectedConvo,
                        sender_id: user.id,
                        customer_name: convo.title,
                        ...(fileData ? { file_url: fileData.url, file_name: fileData.name, file_type: fileData.type } : {}),
                    },
                });
                if (error)
                    throw error;
                if (!data?.success)
                    throw new Error(data?.error || "Send failed");
                await fetchMessages(selectedConvo);
                await fetchConversations();
            }
            catch (err: any) {
                toast.error(err.message || "WhatsApp send failed");
                setMessageText(content);
            }
            finally {
                setSendingWa(false);
            }
        }
        else {
            const insertPayload: any = {
                conversation_id: selectedConvo, sender_id: user.id, content, channel: "internal",
            };
            if (fileData) {
                insertPayload.file_url = fileData.url;
                insertPayload.file_name = fileData.name;
                insertPayload.file_type = fileData.type;
            }
            const { error } = await supabase.from("chat_messages").insert(insertPayload);
            if (error) {
                toast.error("Failed to send");
                return;
            }
            await supabase.from("chat_conversations").update({ last_message: content, last_message_at: new Date().toISOString() }).eq("id", selectedConvo);
        }
    };
    const promoteToLead = async () => {
        if (!selectedConversation) return;
        setPromotingLead(true);
        try {
            const { data, error } = await supabase.functions.invoke("whatsapp-promote-lead", {
                body: { conversation_id: selectedConversation.id },
            });
            if (error || !data?.success) {
                throw new Error(data?.error || error?.message || "Failed to add lead");
            }
            setPromotedMap((prev) => ({ ...prev, [selectedConversation.id]: true }));
            if (data.created) {
                toast.success(`Added ${data.lead?.name || "contact"} to Leads`);
            } else {
                toast.info(`Already in Leads (${data.lead?.name || "linked"})`);
            }
        } catch (err: any) {
            toast.error(err?.message || "Failed to add contact to Leads");
        } finally {
            setPromotingLead(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };
    const createConversation = async () => {
        if (!user)
            return;
        if (newChatType === "whatsapp") {
            if (!waPhone.trim()) {
                toast.error("Enter phone number");
                return;
            }
            const { data, error } = await supabase.from("chat_conversations").insert({
                type: "whatsapp", channel: "whatsapp", participant_ids: [user.id],
                created_by: user.id, title: waName || waPhone,
                whatsapp_phone: waPhone.replace(/\D/g, ""),
            }).select().single();
            if (error) {
                toast.error(error.message);
                return;
            }
            setNewSheetOpen(false);
            setWaPhone("");
            setWaName("");
            fetchConversations();
            if (data)
                selectConvo(data.id);
            return;
        }
        if (!selectedUserId)
            return;
        const existing = conversations.find(c => c.channel !== "whatsapp" && c.participant_ids.length === 2 &&
            c.participant_ids.includes(user.id) && c.participant_ids.includes(selectedUserId));
        if (existing) {
            selectConvo(existing.id);
            setNewSheetOpen(false);
            setSelectedUserId("");
            return;
        }
        const { data, error } = await supabase.from("chat_conversations").insert({
            type: "internal", channel: "internal", participant_ids: [user.id, selectedUserId], created_by: user.id,
        }).select().single();
        if (error) {
            toast.error(error.message);
            return;
        }
        setNewSheetOpen(false);
        setSelectedUserId("");
        fetchConversations();
        if (data)
            selectConvo(data.id);
    };
    const getConvoName = (c: Conversation) => {
        if (c.title)
            return c.title;
        const otherId = c.participant_ids.find(id => id !== user?.id);
        if (otherId && profiles[otherId])
            return profiles[otherId].full_name || "User";
        return "Conversation";
    };
    const getInitials = (name: string) => name.slice(0, 2).toUpperCase();
    const DeliveryIcon = ({ msg }: {
        msg: Message;
    }) => {
        const isMe = msg.sender_id === user?.id;
        if (!isMe)
            return null;
        if (msg.read_at)
            return <Box component={CheckCheck} sx={{ height: "0.75rem", width: "0.75rem", color: "hsl(var(--info))" }}/>;
        if (msg.delivered_at)
            return <Box component={CheckCheck} sx={{ height: "0.75rem", width: "0.75rem", color: "hsl(var(--muted-foreground))" }}/>;
        return <Box component={Check} sx={{ height: "0.75rem", width: "0.75rem", color: "hsl(var(--muted-foreground))" }}/>;
    };
    const filteredConvos = conversations.filter(c => {
        if (channelFilter !== "all" && (c.channel || "internal") !== channelFilter)
            return false;
        if (!searchText)
            return true;
        return getConvoName(c).toLowerCase().includes(searchText.toLowerCase());
    });
    const selectedConversation = conversations.find(c => c.id === selectedConvo);
    const isImageFile = (type?: string | null) => type?.startsWith("image/");
    const FilePreview = ({ msg }: {
        msg: Message;
    }) => {
        if (!msg.file_url)
            return null;
        if (isImageFile(msg.file_type)) {
            return (<Box href={msg.file_url} target="_blank" rel="noopener noreferrer" component="a" sx={mergeSx({ color: "inherit", textDecoration: "none" }, { display: "block", marginTop: "0.25rem" })}>
          <Box src={msg.file_url} alt={msg.file_name || "Image"} component="img" sx={{ maxWidth: "220px", borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}/>
        </Box>);
        }
        return (<Box href={msg.file_url} target="_blank" rel="noopener noreferrer" component="a" sx={mergeSx({ color: "inherit", textDecoration: "none" }, { display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", "&:hover": { backgroundColor: "hsl(var(--muted))" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", fontSize: "0.75rem", lineHeight: "1rem" })}>
        <Box component={FileText} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--muted-foreground))", flexShrink: "0" }}/>
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>{msg.file_name || "File"}</Box>
      </Box>);
    };
    return <AnimatedPage><Box sx={{ height: "calc(100vh - 5rem)", display: "flex", flexDirection: "column" }}>
      <PageHeader title={"Chat"} subtitle={"Team & customer messaging"} actions={<><Button onClick={() => { fetchAllContacts(); setNewChatType("internal"); setNewSheetOpen(true); }} variant="contained">
          <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>New Chat
        </Button></>}/>

      <Card sx={{ flex: "1 1 0%", display: "flex", overflow: "hidden", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
        {/* Left Panel */}
        <Box sx={mergeSx({ width: "100%", "@media (min-width: 768px)": { width: "20rem" }, borderRightWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", display: "flex", flexDirection: "column", backgroundColor: "hsl(var(--card))" }, mobileShowChat ? { display: "none", "@media (min-width: 768px)": { display: "flex" } } : { display: "flex" })}>
          <Box sx={{ padding: "0.75rem", borderBottomWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
            <SearchToolbar onSearch={query => setSearchText(query)} value={searchText} placeholder="Search conversations..."/>
            <TabView value={channelFilter} onChange={v => setChannelFilter(v as any)}>
              <TabBar sx={{ width: "100%", height: "2rem" }}>
                <Tab value="all" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>All</Box>} sx={{ fontSize: "0.75rem", lineHeight: "1rem", flex: "1 1 0%" }}/>
                <Tab value="internal" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={MessageCircle} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Internal</Box>} sx={{ fontSize: "0.75rem", lineHeight: "1rem", flex: "1 1 0%" }}/>
                <Tab value="whatsapp" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Phone} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>WhatsApp</Box>} sx={{ fontSize: "0.75rem", lineHeight: "1rem", flex: "1 1 0%" }}/>
              </TabBar>
            </TabView>
          </Box>

          <Box sx={{ flex: "1 1 0%", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent", "&::-webkit-scrollbar": { width: "5px", height: "5px" }, "&::-webkit-scrollbar-track": { background: "transparent" }, "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "99px" } }}>
            {filteredConvos.length === 0 ? (<Box sx={{ textAlign: "center", paddingTop: "3rem", paddingBottom: "3rem", color: "hsl(var(--muted-foreground))", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                <Box component={MessageCircle} sx={{ height: "2.5rem", width: "2.5rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.75rem", opacity: "0.3" }}/>
                <Typography component="p" variant="body1">No conversations yet</Typography>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", marginTop: "0.25rem" }}>Click "New Chat" to start messaging</Typography>
              </Box>) : filteredConvos.map(c => (<ButtonBase key={c.id} onClick={() => selectConvo(c.id)} type="button" sx={mergeSx({ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem", textAlign: "left", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", borderBottomWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 30%, transparent)" }, selectedConvo === c.id && { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)", borderLeftWidth: "2px", borderLeftColor: "hsl(var(--primary))" })}>
                <Avatar sx={mergeSx({ height: "2.5rem", width: "2.5rem", flexShrink: "0" }, mergeSx({ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600" }, c.channel === "whatsapp" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } : { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" }))}>
                    {c.channel === "whatsapp" ? <Box component={Phone} sx={{ height: "1rem", width: "1rem" }}/> : getInitials(getConvoName(c))}
                  </Avatar>
                <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getConvoName(c)}</Typography>
                      {c.channel === "whatsapp" && (<StatusChip label={"WA"} variant="outlined" sx={{ fontSize: "9px", paddingLeft: "0.25rem", paddingRight: "0.25rem", paddingTop: "0px", paddingBottom: "0px", color: "hsl(var(--success))", borderColor: "color-mix(in srgb, hsl(var(--success)) 30%, transparent)" }}/>)}
                    </Box>
                    {c.last_message_at && (<Box component="span" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", flexShrink: "0", marginLeft: "0.5rem" }}>
                        {format(new Date(c.last_message_at), "HH:mm")}
                      </Box>)}
                  </Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "0.125rem" }}>{c.last_message || "No messages yet"}</Typography>
                </Box>
              </ButtonBase>))}
          </Box>
        </Box>

        {/* Right Panel */}
        <Box sx={mergeSx({ flex: "1 1 0%", display: "flex", flexDirection: "column", backgroundColor: "color-mix(in srgb, hsl(var(--background)) 50%, transparent)" }, !mobileShowChat ? { display: "none", "@media (min-width: 768px)": { display: "flex" } } : { display: "flex" })}>
          {!selectedConvo ? (<Box sx={{ flex: "1 1 0%", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--muted-foreground))" }}>
              <Box sx={{ textAlign: "center" }}>
                <Box component={MessageCircle} sx={{ height: "4rem", width: "4rem", marginLeft: "auto", marginRight: "auto", marginBottom: "1rem", opacity: "0.2" }}/>
                <Typography component="p" variant="body1" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "500" }}>Select a conversation</Typography>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", marginTop: "0.25rem" }}>Choose a chat to start messaging</Typography>
              </Box>
            </Box>) : (<>
              {/* Chat Header */}
              <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.625rem", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem", borderBottomWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", backgroundColor: "hsl(var(--card))" }}>
                <Button onClick={() => setMobileShowChat(false)} variant="text" size="small" sx={{ minWidth: "32px", px: "0.375rem", "@media (min-width: 768px)": { display: "none" } }}>←</Button>
                <Avatar sx={mergeSx({ height: "2.25rem", width: "2.25rem" }, mergeSx({ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600" }, selectedConversation?.channel === "whatsapp" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } : { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" }))}>
                    {selectedConversation?.channel === "whatsapp"
                ? <Box component={Phone} sx={{ height: "1rem", width: "1rem" }}/> : getInitials(selectedConversation ? getConvoName(selectedConversation) : "?")}
                  </Avatar>
                <Box sx={{ flex: "1 1 0%", minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedConversation ? getConvoName(selectedConversation) : "Chat"}</Typography>
                    {selectedConversation?.channel === "whatsapp" && (<StatusChip label={"WhatsApp"} variant="outlined" sx={{ fontSize: "10px", color: "hsl(var(--success))", borderColor: "color-mix(in srgb, hsl(var(--success)) 30%, transparent)" }}/>)}
                  </Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
                    {selectedConversation?.channel === "whatsapp" ? selectedConversation.whatsapp_phone : "Internal"}
                  </Typography>
                </Box>
                {selectedConversation?.channel === "whatsapp" && (
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={promotingLead}
                    onClick={() => void promoteToLead()}
                    startIcon={<UserPlus size={14} />}
                    sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    {promotingLead
                      ? "Adding..."
                      : promotedMap[selectedConversation.id]
                        ? "In Leads"
                        : "Add to Leads"}
                  </Button>
                )}
              </Box>

              {/* Messages */}
              <Box sx={{ flex: "1 1 0%", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent", "&::-webkit-scrollbar": { width: "5px", height: "5px" }, "&::-webkit-scrollbar-track": { background: "transparent" }, "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "99px" }, padding: "1rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                {messages.map(msg => {
                const isMe = msg.sender_id === user?.id;
                const isWaMsg = msg.channel === "whatsapp";
                const senderName = msg.sender_id
                  ? (profiles[msg.sender_id]?.full_name || "User")
                  : isWaMsg && selectedConversation
                    ? getConvoName(selectedConversation)
                    : "System";
                return (<Box key={msg.id} sx={mergeSx({ display: "flex" }, isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" })}>
                      <Box sx={mergeSx({ display: "flex", gap: "0.5rem", maxWidth: "75%" }, isMe && { flexDirection: "row-reverse" })}>
                        {!isMe && (<Avatar sx={mergeSx({ height: "1.75rem", width: "1.75rem", marginTop: "0.25rem", flexShrink: "0" }, mergeSx({ fontSize: "10px" }, isWaMsg ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } : { backgroundColor: "hsl(var(--muted))" }))}>
                              {isWaMsg ? <Box component={Phone} sx={{ height: "0.75rem", width: "0.75rem" }}/> : getInitials(senderName)}
                            </Avatar>)}
                        <Box>
                          {!isMe && <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginBottom: "0.125rem", marginLeft: "0.25rem" }}>{senderName}</Typography>}
                          <Box sx={mergeSx({ borderRadius: "1rem", paddingLeft: "0.875rem", paddingRight: "0.875rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontSize: "0.875rem", lineHeight: "1.25rem" }, isMe ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderBottomRightRadius: "calc(var(--radius) - 2px)" } : { backgroundColor: "hsl(var(--muted))", borderBottomLeftRadius: "calc(var(--radius) - 2px)" })}>
                            {msg.content && !msg.content.startsWith("📎") && msg.content}
                            {msg.content?.startsWith("📎") && !msg.file_url && msg.content}
                            <FilePreview msg={msg}/>
                          </Box>
                          <Box sx={mergeSx({ display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.125rem" }, isMe ? { justifyContent: "flex-end", marginRight: "0.25rem" } : { marginLeft: "0.25rem" })}>
                            <Box component="span" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>{format(new Date(msg.created_at), "HH:mm")}</Box>
                            <Box msg={msg} component={DeliveryIcon}/>
                          </Box>
                        </Box>
                      </Box>
                    </Box>);
            })}
                <Box ref={messagesEndRef}/>
              </Box>

              {/* Pending file preview */}
              {pendingFile && (<Box sx={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", borderTopWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {pendingFile.preview ? (<Box src={pendingFile.preview} alt="Preview" component="img" sx={{ height: "3rem", width: "3rem", borderRadius: "var(--radius)", objectFit: "cover", borderWidth: "1px", borderColor: "hsl(var(--border))" }}/>) : (<Box sx={{ height: "3rem", width: "3rem", borderRadius: "var(--radius)", backgroundColor: "hsl(var(--muted))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Box component={FileText} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--muted-foreground))" }}/>
                    </Box>)}
                  <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendingFile.file.name}</Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>{(pendingFile.file.size / 1024).toFixed(1)} KB</Typography>
                  </Box>
                  <IconButton onClick={() => setPendingFile(null)} aria-label={"X"} sx={{ height: "1.75rem", width: "1.75rem" }}>
                    <Box component={X} sx={{ height: "0.875rem", width: "0.875rem" }}/>
                  </IconButton>
                </Box>)}

              {/* Input Bar */}
              <Box sx={{ padding: "0.75rem", borderTopWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", backgroundColor: "hsl(var(--card))" }}>
                <Box sx={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <Box ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx,.csv,.txt" onChange={handleFileSelect} component="input" sx={{ display: "none" }}/>
                  <IconButton onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label={"Paperclip"} sx={{ height: "2.25rem", width: "2.25rem", flexShrink: "0", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" } }}>
                    <Box component={Paperclip} sx={{ height: "1rem", width: "1rem" }}/>
                  </IconButton>
                  <TextField placeholder={selectedConversation?.channel === "whatsapp" ? "Type a WhatsApp message..." : "Type a message..."} value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={handleKeyPress} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": selectedConversation?.channel === "whatsapp" ? "Type a WhatsApp message..." : "Type a message..." } }} sx={{ flex: "1 1 0%" }}/>
                  <Button onClick={sendMessage} disabled={(!messageText.trim() && !pendingFile) || sendingWa || uploading} variant="contained">
                    <Box component={Send} sx={{ height: "1rem", width: "1rem" }}/>
                  </Button>
                </Box>
              </Box>
            </>)}
        </Box>
      </Card>

      {/* New Conversation Sheet */}
      <SideDrawer open={newSheetOpen} onClose={() => setNewSheetOpen(false)} title={"New Conversation"} description={"Start an internal or WhatsApp chat"} width={460}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <TabView value={newChatType} onChange={v => setNewChatType(v as any)}>
              <TabBar sx={{ width: "100%" }}>
                <Tab value="internal" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={MessageCircle} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Internal</Box>} sx={{ flex: "1 1 0%" }}/>
                <Tab value="whatsapp" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Phone} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>WhatsApp</Box>} sx={{ flex: "1 1 0%" }}/>
              </TabBar>
            </TabView>

            {newChatType === "internal" ? (<>
                {allContacts.length === 0 ? (<Box sx={{ textAlign: "center", paddingTop: "2rem", paddingBottom: "2rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                    <Box component={Users} sx={{ height: "3rem", width: "3rem", marginLeft: "auto", marginRight: "auto", color: "color-mix(in srgb, hsl(var(--muted-foreground)) 30%, transparent)" }}/>
                    <Box>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "hsl(var(--foreground))" }}>No contacts available</Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>
                        Add employees with login accounts in<Box component="br"/>
                        <Box component="span" sx={{ fontWeight: "500" }}>Settings → Employees</Box> to enable internal chat
                      </Typography>
                    </Box>
                  </Box>) : (<>
                    <TextField value={selectedUserId} select size="small" fullWidth onChange={event => setSelectedUserId(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select team member"}</MenuItem>
                        {allContacts.map(p => (<MenuItem key={p.user_id} value={p.user_id}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <Box component="span">{p.full_name || "User"}</Box>
                              <StatusChip label={p.role || "staff"} variant="outlined" sx={{ fontSize: "10px", paddingLeft: "0.25rem", paddingRight: "0.25rem", paddingTop: "0px", paddingBottom: "0px", textTransform: "capitalize" }}/>
                            </Box>
                          </MenuItem>))}
                      </TextField>
                    <Button onClick={createConversation} disabled={!selectedUserId} variant="contained" sx={{ width: "100%" }}>
                      <Box component={MessageCircle} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Start Chat
                    </Button>
                  </>)}
              </>) : (<>
                {waContacts.length > 0 && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                    <TextField label={"Quick Select Contact"} select size="small" fullWidth value="" onChange={event => ((v) => {
                const contact = waContacts.find(c => c.phone === v);
                if (contact) {
                    setWaPhone(contact.phone);
                    setWaName(contact.name);
                }
            })(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select from contacts"}</MenuItem>
                        {waContacts.map((c, i) => (<MenuItem key={`${c.phone}-${i}`} value={c.phone}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <Box component="span">{c.name}</Box>
                              <Box component="span" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{c.phone}</Box>
                            </Box>
                          </MenuItem>))}
                      </TextField>
                  </Box>)}
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField placeholder="Customer name" value={waName} onChange={e => setWaName(e.target.value)} label={"Contact Name"} size="small" fullWidth/>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField placeholder="+91 98765 43210" value={waPhone} onChange={e => setWaPhone(e.target.value)} label={"WhatsApp Phone *"} size="small" fullWidth/>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Include country code (e.g. 919876543210)</Typography>
                </Box>
                <Button onClick={createConversation} disabled={!waPhone.trim()} variant="contained" sx={{ width: "100%" }}>
                  <Box component={Phone} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Start WhatsApp Chat
                </Button>
              </>)}
          </Box>
        </SideDrawer>
    </Box></AnimatedPage>;
}
