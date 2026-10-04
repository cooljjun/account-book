"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Sparkles,
  Calendar,
  CreditCard,
  FileText,
  Plus,
  Trash2,
  PieChart,
  Search,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";

interface ExpenseItem {
  id: number | string;
  created_at?: string;
  date: string;
  amount: number;
  description: string;
}

const CATEGORIES = [
  { name: "식비", icon: "🍱" },
  { name: "교통비", icon: "🚗" },
  { name: "쇼핑", icon: "🛍️" },
  { name: "문화/여가", icon: "🎬" },
  { name: "주거/통신", icon: "🏠" },
  { name: "의료/건강", icon: "💊" },
  { name: "기타", icon: "🏷️" },
];

function getCategoryFromDescription(desc: string): string {
  if (!desc) return "기타";
  const text = desc.toLowerCase();
  if (/식사|점심|저녁|아침|밥|버거|치킨|피자|카페|커피|스타벅스|음료|밀키트|식당|고기|라멘|샌드위치|디저트/.test(text)) {
    return "식비";
  }
  if (/택시|버스|지하철|주유|주차|기차|ktx|따릉이|교통|주차장|카카오t/.test(text)) {
    return "교통비";
  }
  if (/쿠팡|네이버|쇼핑|옷|신발|의류|마트|다이소|올리브영|지그재그|무신사|선물/.test(text)) {
    return "쇼핑";
  }
  if (/영화|공연|게임|전시|서점|책|넷플릭스|뮤지컬|스팀|노래방|티켓|유튜브/.test(text)) {
    return "문화/여가";
  }
  if (/월세|관리비|전기세|수도세|통신비|폰요금|인터넷|요금|공과금/.test(text)) {
    return "주거/통신";
  }
  if (/병원|약국|영양제|헬스|운동|필라테스|치과|의원|약/.test(text)) {
    return "의료/건강";
  }
  return "기타";
}

export default function Home() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // UI state
  const [aiSuggestedCat, setAiSuggestedCat] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("전체");

  // Fetch expenses from Supabase
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase fetch error:", error);
        setDbError(error.message);
      } else if (data) {
        setExpenses(data);
      }
    } catch (err: any) {
      console.error("Fetch exception:", err);
      setDbError(err?.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // AI Category Recommendation
  useEffect(() => {
    if (!description.trim()) {
      setAiSuggestedCat(null);
      return;
    }
    const cat = getCategoryFromDescription(description);
    setAiSuggestedCat(cat);
  }, [description]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Save to Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const numericAmount = parseInt(amount.replace(/[^0-9]/g, ""), 10);

    if (!date) {
      alert("날짜를 입력해주세요.");
      return;
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert("올바른 금액을 입력해주세요.");
      return;
    }
    if (!description.trim()) {
      alert("내용을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("expenses").insert([
        {
          date,
          amount: numericAmount,
          description: description.trim(),
        },
      ]);

      if (error) {
        console.error("Supabase insert error:", error);
        alert(`저장 실패: ${error.message}`);
      } else {
        // Clear inputs
        setAmount("");
        setDescription("");
        setDate(new Date().toISOString().split("T")[0]);

        showToast("지출 내역이 저장되었습니다.");
        fetchExpenses();
      }
    } catch (err: any) {
      console.error("Insert exception:", err);
      alert(`저장 중 오류 발생: ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete from Supabase
  const handleDelete = async (id: number | string) => {
    if (!confirm("이 내역을 삭제하시겠습니까?")) return;

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);

      if (error) {
        console.error("Supabase delete error:", error);
        alert(`삭제 실패: ${error.message}`);
      } else {
        setExpenses((prev) => prev.filter((item) => item.id !== id));
        showToast("내역이 삭제되었습니다.");
      }
    } catch (err: any) {
      console.error("Delete exception:", err);
      alert(`삭제 중 오류 발생: ${err?.message || err}`);
    }
  };

  // Calculations
  const totalExpense = useMemo(() => {
    return expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [expenses]);

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((item) => {
      const cat = getCategoryFromDescription(item.description);
      map[cat] = (map[cat] || 0) + item.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const aiInsight = useMemo(() => {
    if (expenses.length === 0) {
      return "지출 내역을 입력하시면 소비 패턴 분석 리포트가 표시됩니다.";
    }

    if (categoryTotals.length > 0) {
      const topCat = categoryTotals[0];
      const percentage = Math.round((topCat[1] / (totalExpense || 1)) * 100);

      if (topCat[0] === "식비" && percentage > 40) {
        return `현재 가장 큰 지출 항목은 '${topCat[0]}'(${percentage}%)입니다. 식비를 점검해보세요.`;
      }
      if (topCat[0] === "교통비" && percentage > 30) {
        return `지출 중 '${topCat[0]}'(${percentage}%) 비중이 높습니다. 대중교통 카드를 활용해보세요.`;
      }
      if (topCat[0] === "쇼핑" && percentage > 35) {
        return `'${topCat[0]}' 지출이 전체의 ${percentage}%를 차지하고 있습니다.`;
      }
      return `현재 지출 1위는 '${topCat[0]}'(${topCat[1].toLocaleString()}원, ${percentage}%)입니다.`;
    }
    return "꾸준한 소비 기록으로 가계부를 관리해보세요.";
  }, [categoryTotals, totalExpense, expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const cat = getCategoryFromDescription(item.description);
      const matchSearch =
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.date.includes(searchQuery);
      const matchCat = filterCategory === "전체" || cat === filterCategory;
      return matchSearch && matchCat;
    });
  }, [expenses, searchQuery, filterCategory]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans antialiased selection:bg-zinc-900 selection:text-white pb-24 sm:pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-lg border border-zinc-800 flex items-center gap-2.5 text-sm font-medium animate-fade-in">
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-3xl mx-auto w-full px-5 sm:px-8 pt-10 sm:pt-16">
        {/* NOTION / APPLE STYLE HEADER */}
        <header className="mb-12">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase mb-2">
            <span>Supabase Sync</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
            나의 스마트 가계부
          </h1>
          <p className="text-zinc-500 text-sm mt-1.5 font-normal">
            지출 내역을 심플하게 기록하고 스마트하게 관리하세요.
          </p>
        </header>

        {/* METRICS SUMMARY - Minimal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/60 shadow-xs">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">
              총 지출
            </div>
            <div className="text-2xl font-extrabold text-zinc-900 font-mono tracking-tight">
              ₩{totalExpense.toLocaleString()}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">합계 금액</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200/60 shadow-xs">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">
              등록 내역
            </div>
            <div className="text-2xl font-extrabold text-zinc-900 font-mono tracking-tight">
              {expenses.length} <span className="text-sm font-normal text-zinc-400">건</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">전체 건수</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-zinc-200/60 shadow-xs">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">
              건당 평균
            </div>
            <div className="text-2xl font-extrabold text-zinc-900 font-mono tracking-tight">
              ₩{expenses.length > 0 ? Math.round(totalExpense / expenses.length).toLocaleString() : 0}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">평균 소비</div>
          </div>
        </div>

        {/* NOTION STYLE CALLOUT / AI REPORT */}
        <div className="mb-10 p-4 bg-[#F4F4F5]/70 border border-zinc-200/50 rounded-2xl flex items-start gap-3 text-sm text-zinc-700">
          <Sparkles className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-zinc-900 mr-2">AI 인사이트:</span>
            <span>{aiInsight}</span>
          </div>
        </div>

        {/* INPUT FORM - Subtle Background Contrast & Flat Button */}
        <section className="bg-white border border-zinc-200/70 rounded-2xl p-6 sm:p-8 shadow-xs mb-12">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">지출 내역 입력</h2>
            <p className="text-xs text-zinc-500 mt-0.5">날짜, 금액, 내용을 입력 후 저장하세요.</p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  날짜
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#F4F4F5] hover:bg-[#EAEAEA] focus:bg-white border border-transparent focus:border-zinc-300 text-zinc-900 text-sm font-medium rounded-xl px-4 py-3.5 transition-all outline-none"
                  required
                />
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  금액 (원)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setAmount(val ? Number(val).toLocaleString() : "");
                    }}
                    className="w-full bg-[#F4F4F5] hover:bg-[#EAEAEA] focus:bg-white border border-transparent focus:border-zinc-300 text-zinc-900 text-sm font-mono font-semibold rounded-xl px-4 py-3.5 transition-all outline-none placeholder:font-normal placeholder:text-zinc-400"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400">
                    원
                  </span>
                </div>
              </div>
            </div>

            {/* Description Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  내용
                </label>
                {aiSuggestedCat && (
                  <span className="text-xs text-zinc-600 bg-zinc-100 px-2.5 py-0.5 rounded-md font-medium">
                    추천: {aiSuggestedCat}
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="예: 점심 식사, 스타벅스, 택시비"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#F4F4F5] hover:bg-[#EAEAEA] focus:bg-white border border-transparent focus:border-zinc-300 text-zinc-900 text-sm font-medium rounded-xl px-4 py-3.5 transition-all outline-none placeholder:text-zinc-400"
                required
              />
            </div>

            {/* Flat Solid Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-medium py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.99]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
                    <span>저장 중...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>저장하기</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* CATEGORY BREAKDOWN & EXPENSES LIST */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Category Ratios (Side column) */}
          <div className="lg:col-span-1 bg-white border border-zinc-200/70 rounded-2xl p-6 shadow-xs h-fit">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-zinc-500" />
              카테고리 비율
            </h3>

            {categoryTotals.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">내역이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {categoryTotals.map(([catName, sum]) => {
                  const percent = Math.round((sum / (totalExpense || 1)) * 100);
                  const catObj = CATEGORIES.find((c) => c.name === catName);
                  return (
                    <div key={catName} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-700 font-medium">
                          {catObj?.icon || "🏷️"} {catName}
                        </span>
                        <span className="text-zinc-500 font-mono">
                          {percent}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-zinc-800 h-full rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Transactions Main Column */}
          <div className="lg:col-span-2 bg-white border border-zinc-200/70 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-zinc-100">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">지출 목록</h3>
                <p className="text-xs text-zinc-400">총 {filteredExpenses.length}건</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchExpenses}
                  className="p-2 bg-[#F4F4F5] hover:bg-zinc-200 text-zinc-600 rounded-xl transition-colors"
                  title="새로고침"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#F4F4F5] focus:bg-white border border-transparent focus:border-zinc-300 text-xs text-zinc-900 rounded-xl pl-8 pr-3 py-2 outline-none w-28 sm:w-36 transition-all"
                  />
                </div>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-[#F4F4F5] focus:bg-white border border-transparent focus:border-zinc-300 text-xs text-zinc-700 rounded-xl px-2.5 py-2 outline-none transition-all"
                >
                  <option value="전체">전체</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error handling */}
            {dbError && (
              <div className="mb-4 p-3.5 bg-red-50 text-red-700 rounded-xl flex items-center gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>Supabase 연결 오류: {dbError}</span>
              </div>
            )}

            {/* Loading / Empty / List */}
            {loading ? (
              <div className="text-center py-12 text-zinc-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                불러오는 중...
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-200 rounded-xl">
                <p className="text-zinc-400 text-xs">지출 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {filteredExpenses.map((item) => {
                  const inferredCat = getCategoryFromDescription(item.description);
                  const catObj = CATEGORIES.find((c) => c.name === inferredCat);

                  return (
                    <div
                      key={item.id}
                      className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#F4F4F5] flex items-center justify-center text-sm shrink-0">
                          {catObj?.icon || "🏷️"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-900 text-sm truncate">
                              {item.description}
                            </span>
                            <span className="text-[11px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md font-normal">
                              {inferredCat}
                            </span>
                          </div>
                          <span className="text-xs text-zinc-400 font-mono block mt-0.5">
                            {item.date}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-bold text-base text-zinc-900 tracking-tight">
                          -₩{item.amount.toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-zinc-300 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MINIMAL FOOTER */}
        <footer className="mt-16 text-center text-xs text-zinc-400 border-t border-zinc-200/60 pt-6">
          <p>© 2026 나의 스마트 가계부</p>
        </footer>
      </div>
    </div>
  );
}
