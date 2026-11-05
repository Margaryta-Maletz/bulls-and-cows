import { useState, useEffect, useRef, useCallback } from 'react';
import { CHAT } from '../labels.ts';

export interface ChatMsg {
  id: string;
  from: string;
  text: string;
  own: boolean;
}

interface Props {
  readonly messages: readonly ChatMsg[];
  readonly onSend: (text: string) => void;
}

type FormSubmit  = { preventDefault(): void };
type InputChange = { currentTarget: { value: string } };

export default function Chat({ messages, onSend }: Props) {
  const [text, setText]   = useState('');
  const bottomRef         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback((e: FormSubmit) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }, [text, onSend]);

  const handleChange = useCallback((e: InputChange) => {
    setText(e.currentTarget.value);
  }, []);

  const messageItems = messages.map(m => {
    const cls = m.own ? 'chat-msg chat-msg-own' : 'chat-msg';
    return (
      <div key={m.id} className={cls}>
        <span className="chat-from">{m.from}</span>
        <span className="chat-text">{m.text}</span>
      </div>
    );
  });

  return (
    <div className="chat">
      <div className="chat-messages">
        {messageItems}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="chat-form">
        <input
          value={text}
          onChange={handleChange}
          placeholder={CHAT.placeholder}
        />
        <button type="submit">{CHAT.sendBtn}</button>
      </form>
    </div>
  );
}
