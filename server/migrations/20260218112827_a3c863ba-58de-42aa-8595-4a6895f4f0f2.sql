
-- Chat conversations table
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'internal',
  title text,
  participant_ids uuid[] NOT NULL DEFAULT '{}',
  last_message text,
  last_message_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_conversations
CREATE POLICY "Participants can view conversations"
  ON public.chat_conversations FOR SELECT TO authenticated
  USING (auth.uid() = ANY(participant_ids));

CREATE POLICY "Authenticated can create conversations"
  ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = ANY(participant_ids));

CREATE POLICY "Participants can update conversations"
  ON public.chat_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = ANY(participant_ids));

-- RLS policies for chat_messages
CREATE POLICY "Participants can view messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = chat_messages.conversation_id
    AND auth.uid() = ANY(participant_ids)
  ));

CREATE POLICY "Participants can send messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE id = chat_messages.conversation_id
      AND auth.uid() = ANY(participant_ids)
    )
  );

-- Enable realtime on chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
