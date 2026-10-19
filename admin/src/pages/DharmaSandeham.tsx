
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

// ========================================
// TYPES
// ========================================

type Status = 'pending' | 'approved' | 'rejected' | 'hidden';
type ModerationStatus = Exclude<Status, 'pending'>;
type StatusFilter = Status | 'all';
type Section = 'questions' | 'answers' | 'official' | 'reports';

type DharmaQuestion = {
  id: number;
  title: string;
  description: string | null;
  category_id: number;
  category_name: string | null;
  devotee_name: string | null;
  status: Status;
  created_at: string;
};

type DharmaAnswer = {
  id: number;
  question_id: number;
  user_id: number;
  answer: string;
  answer_type: 'community' | 'official';
  status: Status;
  created_at: string;
  updated_at: string;
  devotee_name: string | null;
  question_title: string;
};

type ReportStatus =
  | 'pending'
  | 'reviewed'
  | 'dismissed';

type ReportFilter =
  | ReportStatus
  | 'all';

type DharmaReport = {
  id: number;
  reported_by: number;
  question_id: number | null;
  answer_id: number | null;
  reason: string;
  status: ReportStatus;
  created_at: string;
  reported_by_name: string | null;
  question_title: string | null;
  answer_text: string | null;
  content_type: 'question' | 'answer';
};

type ReportsResponse = {
  success: boolean;
  reports: DharmaReport[];
  message?: string;
};

type ReportAction =
  | 'reviewed'
  | 'dismissed'
  | 'hide_content';
type QuestionsResponse = {
  success: boolean;
  questions: DharmaQuestion[];
  message?: string;
};

type AnswersResponse = {
  success: boolean;
  answers: DharmaAnswer[];
  message?: string;
};

type ActionResponse = {
  success: boolean;
  message?: string;
};

// ========================================
// HELPERS
// ========================================

const formatDate = (value: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';

const statusOptions: StatusFilter[] = [
  'pending',
  'approved',
  'rejected',
  'hidden',
  'all',
];

const buttonStyle = (
  background: string,
  color = '#FFFFFF'
) => ({
  background,
  color,
  border: 'none',
  padding: '8px 12px',
  borderRadius: 8,
  cursor: 'pointer' as const,
  fontWeight: 600,
});

// ========================================
// COMPONENT
// ========================================

export default function DharmaSandeham() {
    // ========================================
// REPORT MANAGEMENT STATE
// ========================================

const [reports, setReports] =
  useState<DharmaReport[]>([]);

const [reportFilter, setReportFilter] =
  useState<ReportFilter>('pending');

const [reportsLoading, setReportsLoading] =
  useState(false);

const [reportsError, setReportsError] =
  useState('');

const [moderatingReportId, setModeratingReportId] =
  useState<number | null>(null);
    const [officialQuestions, setOfficialQuestions] =
  useState<DharmaQuestion[]>([]);

const [selectedQuestionId, setSelectedQuestionId] =
  useState('');

const [officialAnswerText, setOfficialAnswerText] =
  useState('');
  const [existingOfficialAnswers, setExistingOfficialAnswers] =
  useState<Record<number, DharmaAnswer>>({});

const [officialQuestionsLoading, setOfficialQuestionsLoading] =
  useState(false);

const [publishingOfficial, setPublishingOfficial] =
  useState(false);

const [officialError, setOfficialError] =
  useState('');

const [officialSuccess, setOfficialSuccess] =
  useState('');

  const [section, setSection] = useState<Section>('questions');

  const [questions, setQuestions] = useState<DharmaQuestion[]>([]);
  const [questionFilter, setQuestionFilter] =
    useState<StatusFilter>('pending');
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState('');

  const [answers, setAnswers] = useState<DharmaAnswer[]>([]);
  const [answerFilter, setAnswerFilter] =
    useState<StatusFilter>('pending');
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersError, setAnswersError] = useState('');

  const [moderatingQuestionId, setModeratingQuestionId] =
    useState<number | null>(null);
  const [moderatingAnswerId, setModeratingAnswerId] =
    useState<number | null>(null);

  // ========================================
  // LOAD QUESTIONS
  // ========================================

  const loadQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    setQuestionsError('');

    try {
      const query =
        questionFilter === 'all'
          ? ''
          : `?status=${encodeURIComponent(questionFilter)}`;

      const result = await apiRequest<QuestionsResponse>(
        `/admin/dharma/questions${query}`
      );

      if (!result.success || !Array.isArray(result.questions)) {
        throw new Error(result.message || 'Unable to fetch questions.');
      }

      setQuestions(result.questions);
    } catch (error) {
      setQuestions([]);
      setQuestionsError(errorMessage(error));
    } finally {
      setQuestionsLoading(false);
    }
  }, [questionFilter]);

  // ========================================
  // LOAD COMMUNITY ANSWERS
  // ========================================

  const loadAnswers = useCallback(async () => {
    setAnswersLoading(true);
    setAnswersError('');

    try {
      const query =
        answerFilter === 'all'
          ? ''
          : `?status=${encodeURIComponent(answerFilter)}`;

      const result = await apiRequest<AnswersResponse>(
        `/admin/dharma/answers${query}`
      );

      if (!result.success || !Array.isArray(result.answers)) {
        throw new Error(result.message || 'Unable to fetch answers.');
      }

      setAnswers(
        result.answers.filter(
          (answer) => answer.answer_type === 'community'
        )
      );
    } catch (error) {
      setAnswers([]);
      setAnswersError(errorMessage(error));
    } finally {
      setAnswersLoading(false);
    }
  }, [answerFilter]);

  // ========================================
  // LOAD ACTIVE TAB
  // ========================================

  useEffect(() => {
    if (section === 'questions') {
      void loadQuestions();
    }

    if (section === 'answers') {
      void loadAnswers();
    }
  }, [section, loadQuestions, loadAnswers]);

  // ========================================
  
  // ========================================
  // LOAD DHARMA REPORTS
  // ========================================

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError('');

    try {
      const query =
        reportFilter === 'all'
          ? ''
          : `?status=${encodeURIComponent(reportFilter)}`;

      const response = await apiRequest<ReportsResponse>(
        `/admin/dharma/reports${query}`
      );

      if (!response.success || !Array.isArray(response.reports)) {
        throw new Error(
          response.message || 'Unable to load reports.'
        );
      }

      setReports(response.reports);
    } catch (error) {
      setReports([]);
      setReportsError(errorMessage(error));
    } finally {
      setReportsLoading(false);
    }
  }, [reportFilter]);

  // ========================================
  // LOAD REPORTS WHEN TAB IS ACTIVE
  // ========================================

  useEffect(() => {
    if (section === 'reports') {
      void loadReports();
    }
  }, [section, loadReports]);

  // ========================================
  // REVIEW OR HIDE REPORTED CONTENT
  // ========================================

  const moderateReport = async (
    report: DharmaReport,
    action: ReportAction
  ) => {
    if (moderatingReportId !== null) return;

    const actionLabel =
      action === 'hide_content'
        ? 'hide the reported content'
        : action === 'reviewed'
          ? 'mark this report as reviewed'
          : 'dismiss this report';

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel}?\n\n` +
      `Report #${report.id}\n` +
      `Reason: ${report.reason}`
    );

    if (!confirmed) return;

    setModeratingReportId(report.id);

    try {
      const response = await apiRequest<ActionResponse>(
        `/admin/dharma/reports/${report.id}/review`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action }),
        }
      );

      if (!response.success) {
        throw new Error(
          response.message || 'Unable to update report.'
        );
      }

      await loadReports();

      window.alert(
        response.message || 'Report updated successfully.'
      );
    } catch (error) {
      window.alert(errorMessage(error));
    } finally {
      setModeratingReportId(null);
    }
  };

  // MODERATE QUESTION
  // ========================================

  const moderateQuestion = async (
    question: DharmaQuestion,
    status: ModerationStatus
  ) => {
    if (moderatingQuestionId !== null) return;

    const confirmed = window.confirm(
      `Change question #${question.id} to ${status}?\n\n${question.title}`
    );

    if (!confirmed) return;

    setModeratingQuestionId(question.id);

    try {
      const result = await apiRequest<ActionResponse>(
        `/admin/dharma/questions/${question.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      );

      if (!result.success) {
        throw new Error(result.message || 'Moderation failed.');
      }

      await loadQuestions();
      window.alert(result.message || 'Question updated successfully.');
    } catch (error) {
      window.alert(errorMessage(error));
    } finally {
      setModeratingQuestionId(null);
    }
  };
// ========================================
// LOAD APPROVED QUESTIONS
// ========================================

const loadOfficialQuestions = useCallback(async () => {
  setOfficialQuestionsLoading(true);
  setOfficialError('');

  try {
    const response = await apiRequest<QuestionsResponse>(
      '/admin/dharma/questions?status=approved'
    );

    if (!response.success || !Array.isArray(response.questions)) {
      throw new Error(
        response.message || 'Failed to load approved questions.'
      );
    }

    setOfficialQuestions(response.questions);
    const answerResponse = await apiRequest<AnswersResponse>(
  '/admin/dharma/answers?status=approved'
);

if (!answerResponse.success || !Array.isArray(answerResponse.answers)) {
  throw new Error(
    answerResponse.message || 'Failed to load official answers.'
  );
}

const officialMap: Record<number, DharmaAnswer> = {};

answerResponse.answers
  .filter((item) => item.answer_type === 'official')
  .forEach((item) => {
    if (
      !officialMap[item.question_id] ||
      item.id < officialMap[item.question_id].id
    ) {
      officialMap[item.question_id] = item;
    }
  });

setExistingOfficialAnswers(officialMap);
  } catch (error) {
    setOfficialQuestions([]);
    setOfficialError(errorMessage(error));
  } finally {
    setOfficialQuestionsLoading(false);
  }
}, []);
// ========================================
// PUBLISH OFFICIAL ANSWER
// ========================================

const publishOfficialAnswer = async () => {
  const questionId = Number(selectedQuestionId);
  const answer = officialAnswerText.trim();

  if (
    !Number.isSafeInteger(questionId) ||
    questionId <= 0
  ) {
    setOfficialError('Please select a question.');
    return;
  }

  if (answer.length < 10 || answer.length > 2000) {
    setOfficialError(
      'Official answer must contain 10 to 2000 characters.'
    );
    return;
  }

  const confirmed = window.confirm(
    'Publish this as an official verified temple answer?'
  );

  if (!confirmed) return;

  setPublishingOfficial(true);
  setOfficialError('');
  setOfficialSuccess('');

  try {
    const response = await apiRequest<ActionResponse>(
      `/admin/dharma/questions/${questionId}/official-answer`,
      {
        method: 'POST',
        body: JSON.stringify({ answer }),
      }
    );

    if (!response.success) {
      throw new Error(
        response.message || 'Failed to publish official answer.'
      );
    }

 const wasUpdating = Boolean(
  existingOfficialAnswers[questionId]
);

// Reload saved answers from the backend
await loadOfficialQuestions();

// Keep the selected question and answer visible
setOfficialSuccess(
  wasUpdating
    ? 'Official temple answer updated successfully.'
    : 'Official temple answer published successfully.'
);
  } catch (error) {
    setOfficialError(errorMessage(error));
  } finally {
    setPublishingOfficial(false);
  }
};

useEffect(() => {
  if (section === 'official') {
    void loadOfficialQuestions();
  }
}, [section, loadOfficialQuestions]);
  // ========================================
  // MODERATE COMMUNITY ANSWER
  // ========================================

  const moderateAnswer = async (
    answer: DharmaAnswer,
    status: ModerationStatus
  ) => {
    if (moderatingAnswerId !== null) return;
    if (answer.answer_type !== 'community') return;

    const confirmed = window.confirm(
      `Change answer #${answer.id} to ${status}?\n\n${answer.answer}`
    );

    if (!confirmed) return;

    setModeratingAnswerId(answer.id);

    try {
      const result = await apiRequest<ActionResponse>(
        `/admin/dharma/answers/${answer.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      );

      if (!result.success) {
        throw new Error(result.message || 'Moderation failed.');
      }

      await loadAnswers();
      window.alert(result.message || 'Answer updated successfully.');
    } catch (error) {
      window.alert(errorMessage(error));
    } finally {
      setModeratingAnswerId(null);
    }
  };

  // ========================================
  // PAGE UI - CONTINUE WITH PART 2
  // ========================================

  return (
    <main className="content">
      <div className="page-head">
        <div>
          <h2>Dharma Sandeham</h2>
          <p>
            Manage devotee questions, community answers,
            official temple guidance, and reports.
          </p>
        </div>

        {(section === 'questions' || section === 'answers') && (
          <button
            type="button"
            disabled={
              section === 'questions'
                ? questionsLoading
                : answersLoading
            }
            onClick={() =>
              section === 'questions'
                ? void loadQuestions()
                : void loadAnswers()
            }
          >
            Refresh
          </button>
        )}
      </div>

      {/* NAVIGATION */}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 22,
        }}
      >
        {(
          [
            ['questions', 'Questions'],
            ['answers', 'Community Answers'],
            ['official', 'Official Answers'],
            ['reports', 'Reports'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            style={{
              padding: '11px 16px',
              borderRadius: 10,
              border: `1px solid ${
                section === id ? '#C69A3A' : '#E8DCCB'
              }`,
              background:
                section === id ? '#F7EBD7' : '#FFFFFF',
              color:
                section === id ? '#6B1720' : '#8E8175',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ========================================
          QUESTIONS TAB
      ======================================== */}

      {section === 'questions' && (
        <div className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <h3>Devotee Questions</h3>
              <p>Review and moderate submitted questions.</p>
            </div>

            <select
              value={questionFilter}
              onChange={(event) =>
                setQuestionFilter(
                  event.target.value as StatusFilter
                )
              }
              style={{ padding: 10, borderRadius: 8 }}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Questions' : status}
                </option>
              ))}
            </select>
          </div>

          {questionsError && (
            <div className="error">
              {questionsError}
              <button
                type="button"
                onClick={() => void loadQuestions()}
                style={{ marginLeft: 10 }}
              >
                Retry
              </button>
            </div>
          )}

          {questionsLoading ? (
            <p>Loading questions...</p>
          ) : questionsError ? null : questions.length === 0 ? (
            <p>No questions found.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Question</th>
                    <th>Category</th>
                    <th>Devotee</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {questions.map((question) => (
                    <tr key={question.id}>
                      <td>#{question.id}</td>

                      <td>
                        <strong>{question.title}</strong>
                        {question.description && (
                          <p
                            style={{
                              maxWidth: 320,
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'anywhere',
                              marginTop: 6,
                            }}
                          >
                            {question.description}
                          </p>
                        )}
                      </td>

                      <td>
                        {question.category_name || 'General'}
                      </td>

                      <td>
                        {question.devotee_name || 'Devotee'}
                      </td>

                      <td>{formatDate(question.created_at)}</td>

                      <td>
                        <span className="badge">
                          {question.status}
                        </span>
                      </td>

                      <td>
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            minWidth: 210,
                          }}
                        >
                          {question.status !== 'approved' && (
                            <button
                              type="button"
                              disabled={
                                moderatingQuestionId !== null
                              }
                              style={buttonStyle('#347C52')}
                              onClick={() =>
                                void moderateQuestion(
                                  question,
                                  'approved'
                                )
                              }
                            >
                              {moderatingQuestionId === question.id
                                ? 'Processing...'
                                : 'Approve'}
                            </button>
                          )}

                          {question.status !== 'rejected' && (
                            <button
                              type="button"
                              disabled={
                                moderatingQuestionId !== null
                              }
                              style={buttonStyle('#A83C3C')}
                              onClick={() =>
                                void moderateQuestion(
                                  question,
                                  'rejected'
                                )
                              }
                            >
                              Reject
                            </button>
                          )}

                          {question.status !== 'hidden' && (
                            <button
                              type="button"
                              disabled={
                                moderatingQuestionId !== null
                              }
                              style={buttonStyle(
                                '#EDE4D8',
                                '#30241F'
                              )}
                              onClick={() =>
                                void moderateQuestion(
                                  question,
                                  'hidden'
                                )
                              }
                            >
                              Hide
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTINUE WITH PART 3 */}

      {/* ========================================
          COMMUNITY ANSWERS TAB
      ======================================== */}

      {section === 'answers' && (
        <div className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <h3>Community Answer Moderation</h3>
              <p>
                Review answers submitted by devotees.
              </p>
            </div>

            <select
              value={answerFilter}
              onChange={(event) =>
                setAnswerFilter(
                  event.target.value as StatusFilter
                )
              }
              style={{ padding: 10, borderRadius: 8 }}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Answers' : status}
                </option>
              ))}
            </select>
          </div>

          {answersError && (
            <div className="error">
              {answersError}
              <button
                type="button"
                onClick={() => void loadAnswers()}
                style={{ marginLeft: 10 }}
              >
                Retry
              </button>
            </div>
          )}

          {answersLoading ? (
            <p>Loading community answers...</p>
          ) : answersError ? null : answers.length === 0 ? (
            <p>No community answers found.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Question</th>
                    <th>Answer</th>
                    <th>Devotee</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {answers.map((answer) => (
                    <tr key={answer.id}>
                      <td>#{answer.id}</td>

                      <td>
                        <strong>
                          {answer.question_title}
                        </strong>
                        <p
                          style={{
                            fontSize: 12,
                            marginTop: 5,
                          }}
                        >
                          Question #{answer.question_id}
                        </p>
                      </td>

                      <td>
                        <p
                          style={{
                            maxWidth: 360,
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            lineHeight: 1.6,
                          }}
                        >
                          {answer.answer}
                        </p>
                      </td>

                      <td>
                        {answer.devotee_name || 'Devotee'}
                      </td>

                      <td>
                        {formatDate(answer.created_at)}
                      </td>

                      <td>
                        <span className="badge">
                          {answer.status}
                        </span>
                      </td>

                      <td>
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            minWidth: 210,
                          }}
                        >
                          {answer.status !== 'approved' && (
                            <button
                              type="button"
                              disabled={
                                moderatingAnswerId !== null
                              }
                              style={buttonStyle('#347C52')}
                              onClick={() =>
                                void moderateAnswer(
                                  answer,
                                  'approved'
                                )
                              }
                            >
                              {moderatingAnswerId === answer.id
                                ? 'Processing...'
                                : 'Approve'}
                            </button>
                          )}

                          {answer.status !== 'rejected' && (
                            <button
                              type="button"
                              disabled={
                                moderatingAnswerId !== null
                              }
                              style={buttonStyle('#A83C3C')}
                              onClick={() =>
                                void moderateAnswer(
                                  answer,
                                  'rejected'
                                )
                              }
                            >
                              Reject
                            </button>
                          )}

                          {answer.status !== 'hidden' && (
                            <button
                              type="button"
                              disabled={
                                moderatingAnswerId !== null
                              }
                              style={buttonStyle(
                                '#EDE4D8',
                                '#30241F'
                              )}
                              onClick={() =>
                                void moderateAnswer(
                                  answer,
                                  'hidden'
                                )
                              }
                            >
                              Hide
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================
          OFFICIAL ANSWERS TAB
      ======================================== */}

   
{/* ========================================
    OFFICIAL TEMPLE ANSWERS
======================================== */}

{section === 'official' && (
  <div className="panel">
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 22,
      }}
    >
      <div>
        <h3 style={{ margin: 0 }}>
          Publish Official Temple Answer
        </h3>

        <p style={{ marginTop: 6 }}>
          Provide verified temple guidance for
          approved devotee questions.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void loadOfficialQuestions()}
        disabled={officialQuestionsLoading}
      >
        {officialQuestionsLoading
          ? 'Loading...'
          : 'Refresh Questions'}
      </button>
    </div>

    {/* ERROR MESSAGE */}

    {officialError && (
      <div
        className="error"
        style={{ marginBottom: 16 }}
      >
        {officialError}
      </div>
    )}

    {/* SUCCESS MESSAGE */}

    {officialSuccess && (
      <div
        style={{
          background: '#E8F5EC',
          color: '#24643C',
          padding: 14,
          borderRadius: 9,
          marginBottom: 16,
        }}
      >
        {officialSuccess}
      </div>
    )}

    {/* SELECT QUESTION */}

    <div style={{ marginBottom: 22 }}>
      <label
        htmlFor="official-question"
        style={{
          display: 'block',
          fontWeight: 700,
          marginBottom: 9,
        }}
      >
        Select Approved Question
      </label>

      <select
        id="official-question"
        value={selectedQuestionId}
       onChange={(event) => {
  const questionId = event.target.value;

  setSelectedQuestionId(questionId);

  const existing = existingOfficialAnswers[Number(questionId)];

  setOfficialAnswerText(existing?.answer ?? '');
  setOfficialError('');
  setOfficialSuccess('');
}}

        disabled={officialQuestionsLoading}
        style={{
          width: '100%',
          padding: 13,
          border: '1px solid #E8DCCB',
          borderRadius: 10,
          background: '#FFFFFF',
        }}
      >
        <option value="">
          {officialQuestionsLoading
            ? 'Loading approved questions...'
            : 'Choose a devotee question'}
        </option>

        {officialQuestions.map((question) => (
          <option
            key={question.id}
            value={question.id}
          >
            #{question.id} — {question.title}
          </option>
        ))}
      </select>

      {!officialQuestionsLoading &&
        officialQuestions.length === 0 && (
          <p
            style={{
              color: '#8E8175',
              marginTop: 8,
              fontSize: 13,
            }}
          >
            No approved questions available.
          </p>
        )}
    </div>

    {/* SELECTED QUESTION DETAILS */}

    {selectedQuestionId && (
      <div
        style={{
          background: '#FFF9ED',
          border: '1px solid #E8DCCB',
          padding: 18,
          borderRadius: 12,
          marginBottom: 22,
        }}
      >
        {officialQuestions
          .filter(
            (question) =>
              String(question.id) === selectedQuestionId
          )
          .map((question) => (
            <div key={question.id}>
              <strong
                style={{
                  color: '#6B1720',
                  fontSize: 15,
                }}
              >
                {question.title}
              </strong>

              {question.description && (
                <p
                  style={{
                    marginTop: 9,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                  }}
                >
                  {question.description}
                </p>
              )}

              <p
                style={{
                  fontSize: 12,
                  marginTop: 12,
                  color: '#8E8175',
                }}
              >
                Category: {question.category_name || 'General'}
                {' | '}
                Devotee: {question.devotee_name || 'Devotee'}
              </p>
            </div>
          ))}
      </div>
    )}

    {/* OFFICIAL ANSWER EDITOR */}

    <div style={{ marginBottom: 22 }}>
      <label
        htmlFor="official-answer"
        style={{
          display: 'block',
          fontWeight: 700,
          marginBottom: 9,
        }}
      >
        Official Temple Answer
      </label>

      <textarea
        id="official-answer"
        value={officialAnswerText}
        onChange={(event) => {
          setOfficialAnswerText(event.target.value);
          setOfficialError('');
          setOfficialSuccess('');
        }}
        placeholder="Write the verified explanation or guidance provided by the temple administration..."
        maxLength={2000}
        rows={9}
        style={{
          width: '100%',
          padding: 15,
          border: '1px solid #E8DCCB',
          borderRadius: 10,
          background: '#FFFFFF',
          fontSize: 14,
          lineHeight: 1.7,
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />

      <p
        style={{
          textAlign: 'right',
          color: '#8E8175',
          fontSize: 12,
          marginTop: 7,
        }}
      >
        {officialAnswerText.trim().length} / 2000 characters
      </p>
    </div>

    {/* PUBLISH BUTTON */}

    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <button
        type="button"
        disabled={
          publishingOfficial ||
          !selectedQuestionId ||
          officialAnswerText.trim().length < 10
        }
        onClick={() => void publishOfficialAnswer()}
        style={{
          padding: '13px 22px',
          borderRadius: 10,
          border: 'none',
          background: '#6B1720',
          color: '#FFFFFF',
          fontWeight: 700,
          cursor: publishingOfficial
            ? 'wait'
            : 'pointer',
        }}
      >
        {publishingOfficial
  ? 'Saving...'
  : existingOfficialAnswers[Number(selectedQuestionId)]
    ? 'Update Official Answer'
    : 'Publish Official Answer'}
      </button>
    </div>
  </div>
)}


      {/* ========================================
          REPORTS TAB
      ======================================== */}

     
      {/* ========================================
          REPORT MANAGEMENT
      ======================================== */}

      {section === 'reports' && (
        <div className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 14,
              marginBottom: 20,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                Reported Questions & Answers
              </h3>
              <p style={{ marginTop: 6 }}>
                Review content reported by devotees and take
                appropriate moderation action.
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <select
                value={reportFilter}
                onChange={(event) =>
                  setReportFilter(
                    event.target.value as ReportFilter
                  )
                }
                style={{
                  padding: '10px 14px',
                  borderRadius: 9,
                }}
              >
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="dismissed">Dismissed</option>
                <option value="all">All Reports</option>
              </select>

              <button
                type="button"
                onClick={() => void loadReports()}
                disabled={reportsLoading}
              >
                {reportsLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* ERROR */}

          {reportsError && (
            <div className="error">
              {reportsError}

              <button
                type="button"
                onClick={() => void loadReports()}
                style={{ marginLeft: 12 }}
              >
                Retry
              </button>
            </div>
          )}

          {/* REPORTS TABLE */}

          {reportsLoading ? (
            <p>Loading Dharma reports...</p>
          ) : reportsError ? null : reports.length === 0 ? (
            <div
              style={{
                padding: 35,
                textAlign: 'center',
                color: '#8E8175',
              }}
            >
              No {reportFilter === 'all' ? '' : reportFilter}{' '}
              reports found.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Content Type</th>
                    <th>Reported Content</th>
                    <th>Reason</th>
                    <th>Reported By</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td>#{report.id}</td>

                      <td>
                        <span className="badge">
                          {report.content_type === 'question'
                            ? 'Question'
                            : 'Answer'}
                        </span>
                      </td>

                      <td>
                        {report.question_title && (
                          <strong>
                            {report.question_title}
                          </strong>
                        )}

                        {report.answer_text && (
                          <p
                            style={{
                              marginTop: 8,
                              maxWidth: 320,
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'anywhere',
                              lineHeight: 1.5,
                            }}
                          >
                            {report.answer_text}
                          </p>
                        )}

                        <p
                          style={{
                            fontSize: 12,
                            marginTop: 7,
                            color: '#8E8175',
                          }}
                        >
                          {report.content_type === 'question'
                            ? `Question #${report.question_id}`
                            : `Answer #${report.answer_id}`}
                        </p>
                      </td>

                      <td>
                        <p
                          style={{
                            maxWidth: 280,
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {report.reason}
                        </p>
                      </td>

                      <td>
                        {report.reported_by_name || 'Devotee'}
                      </td>

                      <td>
                        {formatDate(report.created_at)}
                      </td>

                      <td>
                        <span className="badge">
                          {report.status}
                        </span>
                      </td>

                      <td>
                        {report.status === 'pending' ? (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 8,
                              minWidth: 240,
                            }}
                          >
                            <button
                              type="button"
                              disabled={
                                moderatingReportId !== null
                              }
                              style={buttonStyle('#347C52')}
                              onClick={() =>
                                void moderateReport(
                                  report,
                                  'reviewed'
                                )
                              }
                            >
                              {moderatingReportId === report.id
                                ? 'Processing...'
                                : 'Reviewed'}
                            </button>

                            <button
                              type="button"
                              disabled={
                                moderatingReportId !== null
                              }
                              style={buttonStyle('#8E8175')}
                              onClick={() =>
                                void moderateReport(
                                  report,
                                  'dismissed'
                                )
                              }
                            >
                              Dismiss
                            </button>

                            <button
                              type="button"
                              disabled={
                                moderatingReportId !== null
                              }
                              style={buttonStyle('#A83C3C')}
                              onClick={() =>
                                void moderateReport(
                                  report,
                                  'hide_content'
                                )
                              }
                            >
                              Hide Content
                            </button>
                          </div>
                        ) : (
                          <span
                            style={{
                              color: '#8E8175',
                              fontSize: 12,
                            }}
                          >
                            Resolved
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </main>
  );
}
