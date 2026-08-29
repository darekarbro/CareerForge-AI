import React, { useState } from 'react';
import { Eye, EyeOff, Send, CheckCircle, HelpCircle, Loader2, Sparkles } from 'lucide-react';
import FeedbackPanel from '../FeedbackPanel/FeedbackPanel';

export default function QuestionCard({
  question,
  index,
  total,
  onSubmitAnswer,
  isSubmitting,
}) {
  const [userAnswer, setUserAnswer] = useState(question.userAnswer || '');
  const [showSuggested, setShowSuggested] = useState(false);

  const isEvaluated = Boolean(question.feedback?.overallScore !== undefined);

  const difficultyColors = {
    Easy: 'bg-green-100 text-green-800 border-green-800',
    Medium: 'bg-amber-100 text-amber-800 border-amber-800',
    Hard: 'bg-red-100 text-red-800 border-red-800',
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userAnswer.trim() || isSubmitting) return;
    onSubmitAnswer(question._id, userAnswer);
  };

  return (
    <div className="brutal-card p-6 space-y-5">
      {/* Header Tags */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-2 border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-[#1a1a1a] text-[#ffcc00] border-2 border-[#1a1a1a] font-headline font-black text-xs uppercase">
            Q{index + 1} of {total}
          </span>
          <span className="px-2 py-0.5 bg-[#0055ff] text-white border-2 border-[#1a1a1a] font-headline font-bold text-xs uppercase">
            {question.category.replace('_', ' ')}
          </span>
          <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 border border-[#1a1a1a]">
            {question.topic}
          </span>
        </div>

        <span
          className={`px-2 py-0.5 border-2 font-black text-xs uppercase ${
            difficultyColors[question.difficulty] || 'bg-gray-100 text-black border-black'
          }`}
        >
          {question.difficulty}
        </span>
      </div>

      {/* Question Text */}
      <h3 className="font-headline font-black text-lg sm:text-xl text-[#1a1a1a] leading-snug">
        {question.questionText}
      </h3>

      {/* Suggested Model Answer Toggle Accordion */}
      <div className="border-2 border-[#1a1a1a] bg-[#f5f0e8] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSuggested(!showSuggested)}
          className="w-full p-3 bg-white hover:bg-[#faf7f2] flex items-center justify-between font-headline font-bold text-xs uppercase tracking-wide border-b-2 border-[#1a1a1a] transition-colors"
        >
          <div className="flex items-center gap-2 text-[#0055ff]">
            <Sparkles className="w-4 h-4 text-[#ffcc00]" />
            <span>AI-Suggested Model Answer & Key Rubric Points</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {showSuggested ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showSuggested ? 'Hide' : 'Reveal'}</span>
          </div>
        </button>

        {showSuggested && (
          <div className="p-4 space-y-3 text-xs bg-[#faf7f2]">
            <div className="leading-relaxed font-normal text-gray-800 whitespace-pre-line border-l-4 border-[#0055ff] pl-3 py-1 bg-white border border-[#1a1a1a]">
              {question.suggestedAnswer}
            </div>
            {question.keyPoints?.length > 0 && (
              <div>
                <span className="font-headline font-black text-[10px] uppercase text-gray-600 block mb-1">
                  Key Concepts Expected by Evaluator:
                </span>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {question.keyPoints.map((pt, idx) => (
                    <li key={idx} className="font-medium">{pt}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Candidate Answer Box */}
      {!isEvaluated ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block font-headline font-bold text-xs uppercase text-[#1a1a1a]">
            Your Response (Technical explanation or STAR breakdown)
          </label>
          <textarea
            rows={5}
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Structure your answer clearly. For behavioral questions, highlight Situation, Task, Action, and measurable Results..."
            className="brutal-input w-full text-xs leading-relaxed"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!userAnswer.trim() || isSubmitting}
              className="brutal-btn-primary px-6 py-2.5 text-xs flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#ffcc00]" />
                  <span>Scoring via Evaluator Agent...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit for Dimension Evaluation</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="p-3 border-2 border-[#1a1a1a] bg-white text-xs">
            <span className="font-headline font-bold text-[10px] uppercase text-gray-500 block mb-1">
              Your Submitted Answer:
            </span>
            <p className="text-gray-800 whitespace-pre-line font-medium leading-relaxed">
              {question.userAnswer}
            </p>
          </div>

          {/* 4-Dimension Scorecard */}
          <FeedbackPanel feedback={question.feedback} />
        </div>
      )}
    </div>
  );
}
