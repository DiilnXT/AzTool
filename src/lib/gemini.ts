import { Question, QuestionAuditError } from '@/types/exam';

export const DEFAULT_MODEL_ID = 'gemini-1.5-flash';

export const POPULAR_GEMINI_MODELS = [
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Cực Kỳ Ổn Định - Khuyên Dùng)', tag: 'Mặc Định' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Tốc Độ Cao - Thế Hệ Mới)', tag: 'Nhanh' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Mới' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Suy Luận Cao Cấp)', tag: 'Pro' },
];

export function getAvailableKeys(apiKeysStr?: string): string[] {
  if (!apiKeysStr) return [];
  return apiKeysStr
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 10);
}

/**
 * Robust Gemini API caller with Multi-key rotation, Resilient Model Fallback Chain, and Auto-retry
 */
export async function callGeminiApi(
  prompt: string,
  apiKeysStr: string,
  modelId?: string,
  systemInstruction?: string,
  jsonMode: boolean = false
): Promise<string> {
  const keys = getAvailableKeys(apiKeysStr);
  if (keys.length === 0) {
    throw new Error(
      'Chưa cấu hình API Key Gemini. Vui lòng vào Cài đặt (⚙️) và nhập API key (có thể nhập nhiều key cách nhau bằng dấu phẩy).'
    );
  }

  // Model fallback chain: user's requested model -> gemini-2.0-flash -> gemini-1.5-flash -> gemini-2.5-flash
  const requestedModel = (modelId && modelId.trim()) ? modelId.trim() : DEFAULT_MODEL_ID;
  const modelsToTry: string[] = [requestedModel];
  const stableFallbacks = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
  for (const fb of stableFallbacks) {
    if (!modelsToTry.includes(fb)) modelsToTry.push(fb);
  }

  // Shuffle keys
  const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

  let lastError: any = null;

  for (const activeModel of modelsToTry) {
    let modelHadUnavailableError = false;

    for (const key of shuffledKeys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${key}`;

        const body: any = {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          },
        };

        if (systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }

        if (jsonMode) {
          body.generationConfig.responseMimeType = 'application/json';
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();

          // 503 (Model High Demand / Service Unavailable) or 404 (Not Found) or 500 -> Model issue, skip to NEXT MODEL in fallback chain!
          if (res.status === 503 || res.status === 404 || res.status === 500 || res.status === 502 || res.status === 504 || (res.status === 400 && errText.includes('not found'))) {
            console.warn(`Model ${activeModel} gặp mã lỗi ${res.status} (${res.statusText}). Tự động chuyển sang model dự phòng tiếp theo...`);
            lastError = new Error(`Model [${activeModel}] quá tải (${res.status}). Đã tự động kích hoạt model dự phòng.`);
            modelHadUnavailableError = true;
            break; // Break inner key loop to try next model!
          }

          // 429 (Rate limit quota on this specific key) -> Try next key of this model
          if (res.status === 429) {
            lastError = new Error(`Key hết quota (${res.status}), đang thử key tiếp theo...`);
            continue;
          }

          // 400 (Bad request with json mode) -> Retry without json mode
          if (res.status === 400 && jsonMode) {
            return await callGeminiApi(prompt, apiKeysStr, activeModel, systemInstruction, false);
          }

          // Other error: break key loop to try next model
          lastError = new Error(`[${activeModel}] ${errText}`);
          break;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('Không nhận được nội dung từ Gemini');
        }

        return text;
      } catch (err: any) {
        lastError = err;
        if (modelHadUnavailableError) break;
        continue;
      }
    }
  }

  throw lastError || new Error('Không thể kết nối đến Gemini. Vui lòng kiểm tra lại API Key trong phần Cài đặt.');
}

/**
 * Scan all questions in an exam for errors (Deterministic pre-checks + Deep Gemini AI Audit)
 */
export async function auditExamWithAI(
  questions: Question[],
  apiKeysStr: string,
  modelId?: string
): Promise<QuestionAuditError[]> {
  // 1. Deterministic structural & missing-answer checks
  const localErrors: QuestionAuditError[] = [];

  for (const q of questions) {
    // Check 1: Missing correct answer
    if (!q.correctAnswer) {
      localErrors.push({
        questionNumber: q.id,
        severity: 'critical',
        title: 'Chưa có đáp án đúng',
        description: `Câu ${q.id} hiện chưa được đánh dấu đáp án đúng (A, B, C hoặc D) trong đề gốc cũng như bảng đáp án.`,
        suggestion: 'Nhấp chọn trực tiếp đáp án đúng A/B/C/D hoặc bấm "AI Sửa (3 Bản)" để AI tự giải và chọn đáp án đúng.',
      });
    }

    // Check 2: Empty options
    const emptyOpts = (['A', 'B', 'C', 'D'] as const).filter(
      opt => !q.options[opt] || q.options[opt].trim().length === 0
    );
    if (emptyOpts.length > 0) {
      localErrors.push({
        questionNumber: q.id,
        severity: 'critical',
        title: `Thiếu nội dung phương án ${emptyOpts.join(', ')}`,
        description: `Câu ${q.id} bị bỏ trống phương án ${emptyOpts.join(', ')}.`,
        suggestion: 'Bổ sung đầy đủ 4 phương án A, B, C, D hoặc dùng "AI Sửa (3 Bản)" để AI tự biên soạn.',
      });
    }

    // Check 3: Duplicate options within the same question
    const normOpts = (['A', 'B', 'C', 'D'] as const).map(opt => ({
      opt,
      val: (q.options[opt] || '').trim().toLowerCase(),
    }));
    const dupPairs: string[] = [];
    for (let i = 0; i < normOpts.length; i++) {
      for (let j = i + 1; j < normOpts.length; j++) {
        if (normOpts[i].val && normOpts[i].val === normOpts[j].val) {
          dupPairs.push(`${normOpts[i].opt} & ${normOpts[j].opt}`);
        }
      }
    }
    if (dupPairs.length > 0) {
      localErrors.push({
        questionNumber: q.id,
        severity: 'critical',
        title: `Trùng lặp phương án (${dupPairs.join(', ')})`,
        description: `Câu ${q.id} có các phương án hoàn toàn giống nhau (${dupPairs.join(', ')}).`,
        suggestion: 'Thay đổi phương án gây nhiễu hoặc bấm "AI Sửa (3 Bản)".',
      });
    }
  }

  // 2. Deep AI Knowledge & Pedagogical Audit
  const simplifiedQuestions = questions.map(q => ({
    so_cau: q.id,
    noi_dung: q.text,
    phuong_an: q.options,
    dap_an_hien_tai: q.correctAnswer || 'CHƯA_CHỌN',
  }));

  const systemInstruction = `Bạn là Hội đồng Thẩm định Đề thi Trắc nghiệm Đại học cấp cao.
Nhiệm vụ của bạn là rà soát KỸ LƯỠNG từng câu hỏi về mặt kiến thức chuyên môn, logic đề bài và đáp án:

1. Lỗi nghiêm trọng (severity: "critical"):
   - **Câu hỏi sai đề / sai kiến thức khoa học**: Đề bài chứa dữ kiện vô lý, sai kiến thức chuyên ngành, mâu thuẫn hoặc thiếu dữ kiện khiến không thể giải được.
   - **Không có đáp án đúng**: Cả 4 phương án A, B, C, D đều SAI so với câu hỏi, hoặc câu hỏi chưa có đáp án đúng.
   - **Chọn sai đáp án đúng**: Đáp án đang chọn (dap_an_hien_tai) là SAI về mặt kiến thức, trong khi một phương án khác mới là đáp án đúng (hãy chỉ rõ đáp án đúng phải là câu nào).
   - **Có từ 2 đáp án đúng trở lên**: Có nhiều hơn 1 phương án đúng hoặc các phương án trùng lặp ý nghĩa.

2. Cảnh báo (severity: "warning"):
   - Câu hỏi bị trùng lặp nội dung với câu khác trong đề.
   - Câu hỏi tối nghĩa, gây hiểu lầm cho sinh viên hoặc phương án nhiễu quá lộ liễu.

3. Lỗi chính tả / diễn đạt (severity: "typo"):
   - Sai chính tả tiếng Việt, sai danh pháp khoa học/thuật ngữ chuyên ngành, lỗi đánh máy.

Trả về mảng JSON thuần túy (không kèm markdown ngoài):
[
  {
    "questionNumber": 1,
    "severity": "critical" | "warning" | "typo",
    "title": "Tóm tắt lỗi ngắn gọn (VD: Sai đáp án / Không có đáp án đúng / Câu hỏi sai đề)",
    "description": "Giải thích chi tiết, rõ ràng vì sao câu hỏi bị sai đề hoặc vì sao đáp án hiện tại sai",
    "suggestion": "Gợi ý cụ thể cách sửa đề hoặc chỉ rõ đáp án đúng phải là phương án nào"
  }
]
Nếu toàn bộ câu hỏi đều chuẩn xác 100%, trả về mảng rỗng [].`;

  const prompt = `Hãy thẩm định chi tiết danh sách câu hỏi trắc nghiệm sau đây (chú ý phát hiện câu hỏi sai đề, câu không có đáp án đúng, và câu chọn sai đáp án):\n${JSON.stringify(
    simplifiedQuestions,
    null,
    2
  )}`;

  try {
    const responseText = await callGeminiApi(
      prompt,
      apiKeysStr,
      modelId,
      systemInstruction,
      true
    );

    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiErrors: QuestionAuditError[] = JSON.parse(cleaned);

    if (!Array.isArray(aiErrors)) {
      return localErrors;
    }

    // Merge localErrors and aiErrors cleanly by questionNumber
    const mergedMap = new Map<number, QuestionAuditError>();

    for (const err of localErrors) {
      mergedMap.set(err.questionNumber, err);
    }

    for (const aiErr of aiErrors) {
      const existing = mergedMap.get(aiErr.questionNumber);
      if (existing) {
        mergedMap.set(aiErr.questionNumber, {
          questionNumber: aiErr.questionNumber,
          severity: existing.severity === 'critical' || aiErr.severity === 'critical' ? 'critical' : aiErr.severity,
          title: `${existing.title} • ${aiErr.title}`,
          description: `${existing.description} Ngoài ra AI phát hiện: ${aiErr.description}`,
          suggestion: aiErr.suggestion || existing.suggestion,
        });
      } else {
        mergedMap.set(aiErr.questionNumber, aiErr);
      }
    }

    return Array.from(mergedMap.values()).sort((a, b) => a.questionNumber - b.questionNumber);
  } catch (err) {
    console.warn('Lỗi parse hoặc gọi AI audit:', err);
    if (localErrors.length > 0) return localErrors;
    throw err;
  }
}

/**
 * Deeply analyze a specific question
 */
export async function analyzeQuestionDeeply(
  question: Question,
  errorDetail: string,
  apiKeysStr: string,
  modelId?: string
): Promise<string> {
  const prompt = `Phân tích chuyên sâu câu hỏi trắc nghiệm sau đang gặp lỗi:
Câu ${question.id}: ${question.text}
A. ${question.options.A}
B. ${question.options.B}
C. ${question.options.C}
D. ${question.options.D}
Đáp án hiện tại: ${question.correctAnswer}

Lỗi được ghi nhận: ${errorDetail}

Hãy phân tích rõ:
1. Vì sao phương án hiện tại lại gây mâu thuẫn hoặc sai sót khoa học?
2. Phân tích tính đúng sai của từng phương án A, B, C, D.
3. Đề xuất cách sửa đổi chuẩn xác nhất về kiến thức và sư phạm.`;

  return await callGeminiApi(prompt, apiKeysStr, modelId);
}

/**
 * Generate 3 fix variants for a flawed question
 */
export async function generateQuestionFixVariants(
  question: Question,
  errorDetail: string,
  apiKeysStr: string,
  modelId?: string
): Promise<Array<{
  text: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}>> {
  const systemInstruction = `Bạn là chuyên gia soạn thảo đề thi trắc nghiệm.
Nhiệm vụ: Tạo ra đúng 3 PHIÊN BẢN KHÁC NHAU để sửa lỗi cho câu hỏi trắc nghiệm được cung cấp.
Mỗi phiên bản phải:
- Có nội dung câu hỏi rõ ràng, chính xác.
- Đầy đủ 4 phương án A, B, C, D không trùng lặp.
- Chỉ DUY NHẤT 1 đáp án đúng (ghi rõ correctAnswer là 'A', 'B', 'C' hoặc 'D').
- Có lời giải thích ngắn gọn lý do sửa.

Trả về mảng JSON thuần túy gồm đúng 3 object:
[
  {
    "text": "Nội dung câu hỏi đã sửa",
    "options": {
      "A": "...",
      "B": "...",
      "C": "...",
      "D": "..."
    },
    "correctAnswer": "A",
    "explanation": "Đã sửa..."
  }
]`;

  const prompt = `Câu hỏi gốc:
Câu ${question.id}: ${question.text}
A. ${question.options.A}
B. ${question.options.B}
C. ${question.options.C}
D. ${question.options.D}
Đáp án hiện tại: ${question.correctAnswer}
Lỗi cần sửa: ${errorDetail}`;

  const responseText = await callGeminiApi(
    prompt,
    apiKeysStr,
    modelId,
    systemInstruction,
    true
  );

  try {
    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 3);
    }
    throw new Error('Dữ liệu trả về không đúng định dạng');
  } catch (err) {
    console.warn('Lỗi parse variants:', err, responseText);
    throw new Error('Không thể tự động sinh phiên bản sửa lỗi. Vui lòng thử lại.');
  }
}

/**
 * Multimodal Vision caller for Scanned PDF OCR & Table Extraction
 */
export async function callGeminiVisionApi(
  prompt: string,
  base64Image: string,
  mimeType: string = 'image/jpeg',
  apiKeysStr?: string,
  modelId?: string
): Promise<string> {
  const keys = getAvailableKeys(apiKeysStr);
  if (keys.length === 0) {
    throw new Error('Chưa có API Key Gemini cho OCR Vision');
  }

  const cleanBase64 = base64Image.includes(',')
    ? base64Image.split(',')[1]
    : base64Image;

  const requestedModel = modelId && modelId.trim() ? modelId.trim() : 'gemini-2.0-flash';
  const modelsToTry = [requestedModel, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
  const uniqueModels = Array.from(new Set(modelsToTry));
  const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);

  let lastError: any = null;
  for (const activeModel of uniqueModels) {
    for (const key of shuffledKeys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${key}`;
        const body = {
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          if (res.status === 429) continue;
          break;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Không thể gọi Gemini Vision OCR');
}
