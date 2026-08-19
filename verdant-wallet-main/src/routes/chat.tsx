import { createFileRoute } from "@tanstack/react-router";
import { Bot, MessageCircle, Send, User } from "lucide-react";
import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui-kit/Card";
import { Button } from "@/components/ui-kit/Button";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Live chat — Velvato support" },
      {
        name: "description",
        content: "Chat with the Velvato support assistant.",
      },
    ],
  }),
  component: ChatPage,
});

type ChatMessage = {
  id: number;
  from: "bot" | "user";
  text: string;
};

const quickQuestions = ["How do I recharge?", "How do I withdraw?", "Where is my UTR?"];

function getBotReply(message: string) {
  const text = message.toLowerCase();
  if (text.includes("recharge") || text.includes("payment")) {
    return "To recharge, open Recharge, choose an amount, then complete the UPI payment. Enter your UTR after paying so the team can review it.";
  }
  if (text.includes("withdraw")) {
    return "Open Withdraw from the home shortcuts, enter the amount and your withdrawal password, then submit the request for review.";
  }
  if (text.includes("utr") || text.includes("reference")) {
    return "Your UTR is the reference number shown in your UPI app after payment. You can enter it on the Payment screen before submitting.";
  }
  if (text.includes("telegram") || text.includes("agent")) {
    return "For direct help, open Support agent on the support page to contact @andry0725 on Telegram.";
  }
  return "I can help with recharge, payment, UTR, withdrawals, or Telegram support. Choose a quick question below or type your question.";
}

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      from: "bot",
      text: "Hi! I’m Velvato support. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = (value = input) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const id = Date.now();
    setMessages((current) => [
      ...current,
      { id, from: "user", text: trimmed },
      { id: id + 1, from: "bot", text: getBotReply(trimmed) },
    ]);
    setInput("");
  };

  return (
    <MobileShell className="pb-5">
      <Header title="Live Chat" />
      <div className="flex min-h-[calc(100dvh-140px)] flex-col gap-3 p-3">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Bot className="size-6" />
          </span>
          <div>
            <p className="font-extrabold text-foreground">Velvato Support</p>
            <p className="text-xs text-primary-dark">Online now · Instant answers</p>
          </div>
        </Card>

        <div className="flex-1 space-y-3 overflow-y-auto pb-1">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${message.from === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.from === "bot" && (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <MessageCircle className="size-4" />
                </span>
              )}
              <div
                className={
                  message.from === "user"
                    ? "max-w-[82%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground"
                    : "max-w-[82%] rounded-2xl rounded-bl-md bg-card px-4 py-3 text-sm text-foreground shadow-card"
                }
              >
                {message.text}
              </div>
              {message.from === "user" && (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <User className="size-4" />
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {quickQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => sendMessage(question)}
              className="shrink-0 rounded-full border border-primary/25 bg-primary-soft px-3 py-2 text-xs font-bold text-primary-dark"
            >
              {question}
            </button>
          ))}
        </div>

        <Card className="flex items-center gap-2 p-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") sendMessage();
            }}
            placeholder="Type your question..."
            aria-label="Type your question"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="button"
            size="md"
            className="size-10 !p-0"
            aria-label="Send message"
            onClick={() => sendMessage()}
          >
            <Send className="size-4" />
          </Button>
        </Card>
      </div>
    </MobileShell>
  );
}