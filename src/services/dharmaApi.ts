
import { apiRequest } from '@/services/api';
import { getToken } from '@/services/authStorage';

// ========================================
// TYPES
// ========================================

export type DharmaCategory = {
  id: number;
  name: string;
  description: string | null;
};

export type DharmaQuestion = {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
  category_id: number;
  category_name: string;
  devotee_name: string;
  answer_count: number;
};
export type DharmaAnswer = {
  id: number;
  answer: string;
  answer_type: 'community' | 'official';
  created_at: string;
  devotee_name: string;
  helpful_count: number;

  // Whether the logged-in devotee liked this answer
  is_liked?: boolean;
};

export type DharmaQuestionDetails = Omit<
  DharmaQuestion,
  'answer_count'
> & {
  user_id: number;
};
export type DharmaQuestionListResponse = {
  success: boolean;
  questions: DharmaQuestion[];
  page: number;
  limit: number;
  hasMore: boolean;
};

export type DharmaQuestionDetailsResponse = {
  success: boolean;
  question: DharmaQuestionDetails;
  answers: DharmaAnswer[];
  communityAnswerSlotsUsed: number;
  maxCommunityAnswers: number;
};

// ========================================
// PUBLIC APIs
// ========================================

export async function fetchDharmaCategories() {
  return apiRequest('/dharma/categories') as Promise<{
    success: boolean;
    categories: DharmaCategory[];
  }>;
}

export async function fetchDharmaQuestions(options?: {
  categoryId?: number;
  search?: string;
  filter?: 'latest' | 'answered' | 'unanswered';
  page?: number;
}) {
  const params: string[] = [];

  if (options?.categoryId) {
    params.push(
      `category_id=${encodeURIComponent(options.categoryId)}`
    );
  }

  if (options?.search?.trim()) {
    params.push(
      `search=${encodeURIComponent(options.search.trim())}`
    );
  }

  if (options?.filter) {
    params.push(
      `filter=${encodeURIComponent(options.filter)}`
    );
  }

  if (options?.page) {
    params.push(`page=${options.page}`);
  }

  const query = params.length
    ? `?${params.join('&')}`
    : '';

  return apiRequest(
    `/dharma/questions${query}`
  ) as Promise<DharmaQuestionListResponse>;
}


export async function fetchDharmaQuestionById(
  questionId: number
) {
  const token = await getToken();

  return apiRequest(
    `/dharma/questions/${questionId}`,
    token
      ? { token }
      : {}
  ) as Promise<DharmaQuestionDetailsResponse>;
}


// ========================================
// AUTHENTICATED API HELPER
// ========================================

async function authenticatedDharmaRequest(
  endpoint: string,
  method: 'POST',
  body: Record<string, unknown>
) {
  const token = await getToken();

  if (!token) {
    throw new Error(
      'Please log in to continue.'
    );
  }

  return apiRequest(endpoint, {
    method,
    body,
    token,
  });
}

// ========================================
// SUBMIT QUESTION
// ========================================

export async function submitDharmaQuestion(data: {
  category_id: number;
  title: string;
  description?: string;
}) {
  return authenticatedDharmaRequest(
    '/dharma/questions',
    'POST',
    data
  );
}

// ========================================
// SUBMIT COMMUNITY ANSWER
// ========================================

export async function submitDharmaAnswer(
  questionId: number,
  answer: string
) {
  return authenticatedDharmaRequest(
    `/dharma/questions/${questionId}/answers`,
    'POST',
    { answer }
  );
}

// ========================================
// TOGGLE HELPFUL VOTE
// ========================================

export async function toggleDharmaHelpful(
  answerId: number
) {
  return authenticatedDharmaRequest(
    `/dharma/answers/${answerId}/helpful`,
    'POST',
    {}
  );
}

// ========================================
// REPORT QUESTION OR ANSWER
// ========================================

export async function reportDharmaContent(data: {
  question_id?: number;
  answer_id?: number;
  reason: string;
}) {
  return authenticatedDharmaRequest(
    '/dharma/reports',
    'POST',
    data
  );
}
