

import React, { useState } from 'react';
import { generateAgilePracticeTest } from '../../services/aiClient';
import type { AgilePracticeTestResult } from '../../types';
import LoadingSpinner from '../LoadingSpinner';

const AGILE_ROLES = [
    'Scrum Master', 'Product Owner', 'Developer / Engineer', 'Agile Coach', 'Cyber Security Analyst', 'Project / Program Manager', 'Business Analyst'
];
const AGILE_CERTIFICATIONS = [
    'PSM I (Professional Scrum Master)', 'CSM (Certified Scrum Master)', 'Disciplined Agile Scrum Master (DASM)',
    'PSPO I (Professional Scrum Product Owner)', 'CSPO (Certified Scrum Product Owner)', 'PSD (Professional Scrum Developer)',
    'CSD (Certified Scrum Developer)', 'SAFe 6 Agilist (SA)', 'PMI-ACP (Agile Certified Practitioner)', 'IIBA-AAC (Agile Analysis Certification)',
    'Certified DevSecOps Professional (CDP)', 'PMP (Project Management Professional)'
];

interface AgileCoachProps {
  onClose: () => void;
  t: (key: string) => string;
}

const AgileCoach: React.FC<AgileCoachProps> = ({ onClose, t }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgilePracticeTestResult | null>(null);
  const [selectedAgileRole, setSelectedAgileRole] = useState<string>(AGILE_ROLES[0]);
  const [selectedCertification, setSelectedCertification] = useState<string>(AGILE_CERTIFICATIONS[0]);
  const [testStage, setTestStage] = useState<'setup' | 'in_progress' | 'results'>('setup');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);

  const runTool = async (role: string, certification: string) => {
    setLoading(true);
    setError(null);
    try {
      const apiResult = await generateAgilePracticeTest(role, certification);
      setResult(apiResult);
      if (apiResult?.practiceQuestions) {
        setUserAnswers(new Array(apiResult.practiceQuestions.length).fill(null));
        setCurrentQuestionIndex(0);
        setTestStage('in_progress');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setTestStage('setup');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = () => runTool(selectedAgileRole, selectedCertification);
  const handleAnswerSelect = (optionIndex: number) => setUserAnswers(prev => prev.map((ans, i) => i === currentQuestionIndex ? optionIndex : ans));
  const handleNextQuestion = () => {
    if (result && currentQuestionIndex < result.practiceQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };
  const handleSubmitTest = () => setTestStage('results');
  const handleRetakeTest = () => runTool(selectedAgileRole, selectedCertification);

  const renderSetup = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('tool_agile_coach_setup_desc')}</p>
      <div>
        <label htmlFor="agile-role" className="block text-sm font-medium text-gray-700">{t('tool_agile_coach_role_label')}</label>
        <select id="agile-role" value={selectedAgileRole} onChange={e => setSelectedAgileRole(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
          {AGILE_ROLES.map(role => <option key={role}>{role}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="agile-cert" className="block text-sm font-medium text-gray-700">{t('tool_agile_coach_cert_label')}</label>
        <select id="agile-cert" value={selectedCertification} onChange={e => setSelectedCertification(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
          {AGILE_CERTIFICATIONS.map(cert => <option key={cert}>{cert}</option>)}
        </select>
      </div>
      <button onClick={handleStartTest} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
        {loading ? t('tool_agile_coach_generating_button') : t('tool_agile_coach_start_button')}
      </button>
    </div>
  );

  const renderTestInProgress = () => {
    if (!result) return null;
    const currentQuestion = result.practiceQuestions[currentQuestionIndex];
    return (
      <div className="animate-fade-in">
        <h4 className="font-bold text-lg text-gray-800">{result.examTitle}</h4>
        <p className="text-sm text-gray-500 mb-4">{t('tool_agile_coach_question_of').replace('{current}', String(currentQuestionIndex + 1)).replace('{total}', String(result.practiceQuestions.length))}</p>
        <div className="p-4 border rounded-lg bg-gray-50 mb-4">
          <p className="font-semibold text-gray-900">{currentQuestion.questionText}</p>
        </div>
        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => (
            <button key={index} onClick={() => handleAnswerSelect(index)} className={`w-full text-left p-3 border rounded-lg transition-colors flex items-start ${userAnswers[currentQuestionIndex] === index ? 'bg-blue-100 border-blue-400' : 'bg-white border-gray-300 hover:bg-gray-100'}`}>
              <span className={`mr-3 flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full text-sm font-bold ${userAnswers[currentQuestionIndex] === index ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{String.fromCharCode(65 + index)}</span>
              <span>{option}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-between items-center">
          <span className="text-sm text-gray-600">{t('tool_agile_coach_answered').replace('{answered}', String(userAnswers.filter(a => a !== null).length)).replace('{total}', String(result.practiceQuestions.length))}</span>
          {currentQuestionIndex < result.practiceQuestions.length - 1 ? (
            <button onClick={handleNextQuestion} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('tool_agile_coach_next_button')}</button>
          ) : (
            <button onClick={handleSubmitTest} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">{t('tool_agile_coach_submit_button')}</button>
          )}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!result) return null;
    const correctAnswers = userAnswers.filter((answer, index) => answer === result.practiceQuestions[index].correctAnswerIndex).length;
    const score = (correctAnswers / result.practiceQuestions.length) * 100;
    return (
      <div className="animate-fade-in space-y-6">
        <div>
          <h4 className="text-xl font-bold text-gray-900">{t('tool_agile_coach_results_title')}</h4>
          <p className="text-2xl font-semibold" style={{ color: score >= 70 ? '#16a34a' : '#dc2626' }}>{t('tool_agile_coach_score').replace('{score}', score.toFixed(0)).replace('{correct}', String(correctAnswers)).replace('{total}', String(result.practiceQuestions.length))}</p>
        </div>
        <div className="space-y-4">
          <h5 className="font-bold text-lg">{t('tool_agile_coach_review_answers')}</h5>
          {result.practiceQuestions.map((q, index) => {
            const userAnswer = userAnswers[index];
            const isCorrect = userAnswer === q.correctAnswerIndex;
            return (
              <div key={index} className={`p-4 rounded-lg border ${isCorrect ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                <p className="font-semibold text-gray-800 mb-2">{index + 1}. {q.questionText}</p>
                <p className="text-sm"><span className="font-bold">{t('tool_agile_coach_your_answer')}:</span> {userAnswer !== null ? q.options[userAnswer] : t('tool_agile_coach_not_answered')}</p>
                {!isCorrect && <p className="text-sm"><span className="font-bold">{t('tool_agile_coach_correct_answer')}:</span> {q.options[q.correctAnswerIndex]}</p>}
                <p className="mt-2 text-sm text-gray-700 p-2 bg-gray-100 rounded-md"><span className="font-semibold">{t('tool_agile_coach_explanation')}:</span> {q.explanation}</p>
              </div>
            );
          })}
        </div>
        <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h5 className="font-bold text-lg text-blue-900">{t('tool_agile_coach_exam_tips')}</h5>
          <ul className="list-disc list-inside space-y-2 text-blue-800">
            {result.examTips.map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </div>
        <div className="flex gap-4">
          <button onClick={onClose} className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">{t('tool_agile_coach_close_button')}</button>
          <button onClick={handleRetakeTest} className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('tool_agile_coach_retake_button')}</button>
        </div>
      </div>
    );
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;

  switch (testStage) {
    case 'in_progress': return renderTestInProgress();
    case 'results': return renderResults();
    case 'setup':
    default: return renderSetup();
  }
};

export default AgileCoach;