import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const { message, expenses = [] } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "메시지가 유효하지 않습니다." },
        { status: 400 }
      );
    }

    const today = new Date();
    const formattedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const systemPrompt = `당신은 사용자의 지출을 관리해주는 똑똑하고 친절한 AI 가계부 챗봇입니다.
오늘 날짜: ${formattedToday}

현재 저장된 지출 목록 (${expenses.length}건):
${JSON.stringify(expenses.slice(0, 50), null, 2)}

사용자의 입력: "${message}"

사용자의 입력 Intent를 분석하여 아래 JSON 구조로만 응답하세요. 다른 설명이나 마크다운 코드블록(\`\`\`json)은 절대 붙이지 마세요.

JSON 응답 형식:
{
  "action": "ADD_EXPENSE" | "DELETE_EXPENSE" | "QUERY" | "GENERAL",
  "expenseData": {
    "amount": 12000,
    "description": "점심 김치찌개",
    "date": "${formattedToday}"
  },
  "deleteTargetId": 12,
  "deleteDescription": "삭제 대상 지출 설명",
  "reply": "사용자에게 전달할 친근하고 정중한 한국어 답변 메세지 (관련 이모지 포함)"
}

규칙:
1. 지출 등록 (action: "ADD_EXPENSE"):
   - 사용자가 지출/소비한 금액과 내용(음식, 수단, 구매품 등)을 말했을 때 적용합니다.
   - 금액은 숫자만 포함합니다 (예: "1만2천원" -> 12000, "4500원" -> 4500, "삼만원" -> 30000).
   - 날짜(date)는 "어제"면 하루 전 날짜, "오늘"이나 특별한 지정이 없으면 ${formattedToday}로 작성합니다.
   - expenseData 필드를 작성하세요.

2. 지출 삭제 (action: "DELETE_EXPENSE"):
   - 사용자가 특정 지출 내역을 삭제해달라고 요청할 때 적용합니다.
   - 현재 저장된 지출 목록에서 삭제하려는 항목과 일치하는 id를 찾아 deleteTargetId에 넣으세요.
   - 만약 목록에서 대상을 찾을 수 없으면 reply에 어떤 지출을 삭제할지 되물어보세요.

3. 지출 조회/분석 (action: "QUERY"):
   - 사용자가 "지출 내역 알려줘", "총 얼마 썼어?", "가장 많이 쓴 카테고리" 등을 물어볼 때 적용합니다.
   - 저장된 지출 목록 데이터를 기반으로 친절하게 집계하거나 답변해주세요.

4. 일반 대화 (action: "GENERAL"):
   - 가계부와 관련 없는 인사, 감사 등의 대화일 때 적용합니다.
`;

    // Try models with fallback logic (gemini-3.5-flash-lite -> gemini-3.8-flash)
    const modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
    let responseText = "";
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
          },
        });
        const result = await model.generateContent(systemPrompt);
        responseText = result.response.text().trim();
        if (responseText) break;
      } catch (err: any) {
        console.warn(`Model ${modelName} failed, trying next fallback:`, err.message);
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error("모든 AI 모델 트라이얼 실패");
    }

    // Clean markdown code blocks if any
    const cleanedJson = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");

    const parsedData = JSON.parse(cleanedJson);

    return NextResponse.json(parsedData);
  } catch (err: any) {
    console.error("Gemini API error:", err);
    return NextResponse.json(
      {
        action: "GENERAL",
        reply: "죄송해요, AI 응답 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        error: err.message,
      },
      { status: 500 }
    );
  }
}
