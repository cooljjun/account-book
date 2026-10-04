"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Bot,
  User,
  Send,
  Trash2,
  Sparkles,
  RefreshCw,
  Receipt,
  Calendar,
  CreditCard,
  MessageSquare,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ExpenseItem {
  id: number | string;
  created_at?: string;
  date: string;
  amount: number;
  description: string;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  actionType?: "ADD_EXPENSE" | "DELETE_EXPENSE" | "QUERY" | "GENERAL";
  expenseDetail?: {
    date: string;
    amount: number;
    description: string;
  };
}

export default function Home() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState<boolean>(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [showSavedCards, setShowSavedCards] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAiThinking]);

  // Initial welcome message
  useEffect(() => {
    const initialMsg: Message = {
      id: "welcome-1",
      sender: "ai",
      text: "안녕하세요! AI 가계부 챗봇입니다. 🤖\n\n자연스럽게 이야기하듯 지출 내역을 입력해 보세요. AI가 똑똑하게 분석해서 가계부에 등록해 드립니다!\n\n💡 예시 입력:\n• \"오늘 점심 12,000원 김치찌개 먹었어\"\n• \"어제 택시비 8,500원 결제함\"\n• \"이번 달 총 지출 알려줘\"",
      timestamp: new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages([initialMsg]);
  }, []);

  // Fetch saved expenses from Supabase (Newest first)
  const fetchExpenses = useCallback(async () => {
    setLoadingExpenses(true);
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase fetch error:", error);
      } else if (data) {
        setExpenses(data);
      }
    } catch (err) {
      console.error("Fetch exception:", err);
    } finally {
      setLoadingExpenses(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Total expenses sum calculation
  const totalExpenseAmount = expenses.reduce(
    (sum, item) => sum + (item.amount || 0),
    0
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Direct card deletion
  const handleDeleteExpense = async (id: number | string, desc: string) => {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) {
        showToast("지출 삭제 실패: " + error.message);
      } else {
        setExpenses((prev) => prev.filter((item) => item.id !== id));
        showToast(`'${desc}' 지출 내역을 삭제했습니다.`);
        
        // Add notification message to chat
        const deleteMsg: Message = {
          id: Date.now().toString(),
          sender: "ai",
          text: `🗑️ 카드에서 '${desc}' 지출 내역을 삭제했습니다.`,
          timestamp: new Date().toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          actionType: "DELETE_EXPENSE",
        };
        setMessages((prev) => [...prev, deleteMsg]);
      }
    } catch (err: any) {
      showToast("삭제 중 오류 발생");
    }
  };

  // Send Chat Message to Gemini API Route
  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputMessage).trim();
    if (!content || isAiThinking) return;

    const userTime = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: content,
      timestamp: userTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsAiThinking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          expenses: expenses,
        }),
      });

      const data = await res.json();
      const aiTime = new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (!res.ok || data.error) {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: data.reply || "오류가 발생했습니다. AI 답변을 가져올 수 없습니다.",
          timestamp: aiTime,
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      // Process Action based on Gemini analysis
      let actionType: Message["actionType"] = data.action;
      let expenseDetail: Message["expenseDetail"] = undefined;

      if (data.action === "ADD_EXPENSE" && data.expenseData) {
        const { date, amount, description } = data.expenseData;
        if (amount && description) {
          // Insert into Supabase
          const { data: inserted, error: insertErr } = await supabase
            .from("expenses")
            .insert([{ date, amount: Number(amount), description }])
            .select();

          if (insertErr) {
            console.error("Supabase insert error:", insertErr);
            showToast("DB 저장 중 오류: " + insertErr.message);
          } else if (inserted && inserted.length > 0) {
            setExpenses((prev) => [inserted[0], ...prev]);
            expenseDetail = { date, amount: Number(amount), description };
            showToast(`✨ ${description} (${Number(amount).toLocaleString()}원) 가계부 추가 완료!`);
          }
        }
      } else if (data.action === "DELETE_EXPENSE" && data.deleteTargetId) {
        const targetId = data.deleteTargetId;
        const { error: delErr } = await supabase
          .from("expenses")
          .delete()
          .eq("id", targetId);

        if (!delErr) {
          setExpenses((prev) => prev.filter((item) => item.id !== targetId));
          showToast(`🗑️ 지출 항목 삭제 완료`);
        }
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data.reply || "네, 확인했습니다!",
        timestamp: aiTime,
        actionType,
        expenseDetail,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("Chat error:", err);
      const fallbackMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: "네트워크 통신 중 오류가 발생했습니다. 다시 시도해 주세요.",
        timestamp: new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F2F4F7] text-zinc-900 font-sans selection:bg-amber-300">
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg border border-zinc-800 flex items-center gap-2 animate-bounce">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-4 py-3 sm:px-6 shadow-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-400/90 flex items-center justify-center shadow-xs border border-amber-500/20 text-zinc-950 font-bold">
            <Bot className="w-5 h-5 text-zinc-900" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              AI 가계부 챗봇
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Gemini 3.8
              </span>
            </h1>
            <p className="text-xs text-zinc-500 font-normal">
              대화하듯 간편하게 기록하는 스마트 가계부
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSavedCards(!showSavedCards)}
            className="flex items-center gap-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3 py-1.5 rounded-xl transition-all border border-zinc-200/60"
            title="저장된 지출 내역 토글"
          >
            <Receipt className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden sm:inline">저장 목록</span>
            <span className="bg-zinc-200 text-zinc-800 text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold">
              {expenses.length}
            </span>
            {showSavedCards ? (
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </button>
        </div>
      </header>

      {/* SAVED EXPENSES CARDS SECTION (대화 창 위) */}
      {showSavedCards && (
        <section className="bg-white/80 backdrop-blur-xs border-b border-zinc-200/80 px-4 py-3 shrink-0 transition-all duration-300">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-zinc-700 tracking-wide uppercase flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                  저장된 지출 내역
                </h2>
                <span className="text-[11px] text-zinc-400 font-normal">
                  (최신순 정렬)
                </span>
              </div>
              <div className="text-xs font-semibold text-zinc-800 font-mono flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/80 px-2.5 py-0.5 rounded-full">
                <span className="text-[10px] text-amber-600 font-sans">총 지출:</span>
                ₩{totalExpenseAmount.toLocaleString()}
              </div>
            </div>

            {loadingExpenses ? (
              <div className="flex items-center justify-center py-4 text-xs text-zinc-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                지출 내역 로딩 중...
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-4 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-xs text-zinc-400">
                아직 저장된 지출 내역이 없습니다. 하단 챗봇에 지출 내역을 입력해 보세요! 📝
              </div>
            ) : (
              <div className="flex gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-zinc-300">
                {expenses.map((item) => (
                  <div
                    key={item.id}
                    className="shrink-0 bg-white border border-zinc-200/90 hover:border-zinc-300 p-3 rounded-2xl shadow-xs w-48 sm:w-52 transition-all hover:shadow-sm flex flex-col justify-between group relative"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium mb-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          {item.date}
                        </span>
                        <button
                          onClick={() => handleDeleteExpense(item.id, item.description)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-500 text-zinc-400 transition-opacity p-0.5 rounded"
                          title="지출 내역 삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-xs font-semibold text-zinc-800 line-clamp-1">
                        {item.description}
                      </div>
                    </div>

                    <div className="mt-2 text-sm font-extrabold text-zinc-900 font-mono tracking-tight flex items-baseline justify-between border-t border-zinc-100 pt-1.5">
                      <span className="text-[10px] font-sans font-normal text-zinc-400">금액</span>
                      <span>₩{Number(item.amount).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* MAIN CHAT CONVERSATION AREA */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 space-y-4 max-w-4xl w-full mx-auto">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                isUser ? "flex-row-reverse" : "flex-row"
              } animate-fade-in`}
            >
              {/* Avatar */}
              {!isUser ? (
                <div className="w-8 h-8 rounded-full bg-amber-400 text-zinc-900 font-bold flex items-center justify-center shrink-0 shadow-xs border border-amber-500/20 text-xs">
                  <Bot className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-800 text-white font-bold flex items-center justify-center shrink-0 shadow-xs text-xs">
                  <User className="w-4 h-4" />
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-xs text-sm leading-relaxed ${
                  isUser
                    ? "bg-amber-300 text-zinc-950 rounded-tr-none font-medium border border-amber-400/60"
                    : "bg-white text-zinc-900 border border-zinc-200/90 rounded-tl-none"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{msg.text}</div>

                {/* Expense Details Badge (if ADD_EXPENSE action triggered) */}
                {msg.expenseDetail && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-200/60 text-xs bg-amber-50/80 -mx-1 px-2.5 py-1.5 rounded-lg border border-amber-200/60 flex items-center justify-between">
                    <span className="font-semibold text-zinc-700">
                      📝 {msg.expenseDetail.description}
                    </span>
                    <span className="font-mono font-bold text-amber-900">
                      ₩{msg.expenseDetail.amount.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Timestamp */}
                <div
                  className={`text-[10px] mt-1.5 text-right ${
                    isUser ? "text-amber-900/60 font-medium" : "text-zinc-400"
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {/* AI THINKING INDICATOR */}
        {isAiThinking && (
          <div className="flex items-start gap-2.5 flex-row">
            <div className="w-8 h-8 rounded-full bg-amber-400 text-zinc-900 font-bold flex items-center justify-center shrink-0 shadow-xs border border-amber-500/20 text-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-zinc-200/90 rounded-2xl rounded-tl-none px-4 py-3 shadow-xs text-xs text-zinc-500 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
              <span>AI가 메시지를 분석하고 있습니다...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* QUICK RECOMMENDATION CHIPS & CHAT INPUT BAR */}
      <footer className="bg-white border-t border-zinc-200/80 p-3 sm:p-4 shrink-0 shadow-lg">
        <div className="max-w-4xl mx-auto space-y-2.5">
          {/* Quick Suggestion Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <span className="text-[11px] text-zinc-400 font-medium shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> 추천:
            </span>
            {[
              "오늘 점심 12000원 김치찌개",
              "어제 커피 4500원 결제함",
              "총 지출 내역 알려줘",
              "이번 달 얼마 썼어?",
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={isAiThinking}
                className="shrink-0 bg-zinc-100 hover:bg-amber-100 hover:text-amber-900 text-zinc-700 px-2.5 py-1 rounded-full border border-zinc-200/80 text-[11px] transition-colors disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* INPUT FORM */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAiThinking}
              placeholder="지출 내역을 자유롭게 입력해보세요 (예: 오늘 저녁 25000원 삼겹살)..."
              className="flex-1 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-2xl px-4 py-3 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isAiThinking}
              className="bg-amber-400 hover:bg-amber-500 text-zinc-950 font-bold px-4 py-3 rounded-2xl transition-all shadow-xs active:scale-95 disabled:opacity-40 disabled:hover:bg-amber-400 shrink-0 flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">전송</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
