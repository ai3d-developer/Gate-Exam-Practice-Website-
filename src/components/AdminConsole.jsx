import React, { useState, useEffect } from 'react';
import { ref, set, push, onValue } from 'firebase/database';
import { db } from '../firebase';
import studentsData from './students.json';

const TOPICS = [
  'Engineering Mathematics',
  'Electric circuits',
  'Electromagnetic Fields',
  'Signals and Systems',
  'Electrical Machines',
  'Power Systems',
  'Control Systems',
  'Electrical and Electronic Measurements',
  'Analog and Digital Electronics',
  'Power Electronics',
  'General Aptitude'
];

const LEVELS = [
  { value: 'L1', label: 'L1 – Remember' },
  { value: 'L2', label: 'L2 – Understand' },
  { value: 'L3', label: 'L3 – Apply' },
  { value: 'L4', label: 'L4 – Analyze' },
  { value: 'L5', label: 'L5 – Evaluate' },
  { value: 'L6', label: 'L6 – Create' }
];

const getDefaultNegativeMarks = (type, marks) => {
  const m = parseInt(marks) || 1;
  if (type === 'MCQ') {
    return m === 2 ? 0.66 : 0.33;
  }
  return 0;
};

export default function AdminConsole({ questionsList, onLogout, authUser, onClearAllQuestions }) {
  const [activeTab, setActiveTab] = useState('config');

  // Tab 1: Exam Config
  const [examConfig, setExamConfig] = useState({
    selectedTopic: 'Full Syllabus',
    numQuestions: 20,
    timeLimit: 30
  });
  const [configSaved, setConfigSaved] = useState(false);

  // Tab 2: Upload Question
  const [uploadForm, setUploadForm] = useState({
    section: 'Signals and Systems',
    level: 'L1',
    type: 'MCQ',
    marks: 1,
    correct_answer: 'A',
    question_text: '',
    show_question_text: false,
    options_a: 'A',
    options_b: 'B',
    options_c: 'C',
    options_d: 'D',
    is_opt_image_a: false,
    is_opt_image_b: false,
    is_opt_image_c: false,
    is_opt_image_d: false,
    image: null,
    negative_marks: 0.33
  });
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Tab 3: Student Logs
  const [studentLogs, setStudentLogs] = useState([]);
  const [logsFilter, setLogsFilter] = useState('all');
  const [selectedLogDate, setSelectedLogDate] = useState(() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const adjusted = new Date(local.getTime() - (offset * 60 * 1000));
    return adjusted.toISOString().split('T')[0];
  });
  const [uploadQuestionNumber, setUploadQuestionNumber] = useState(1);
  const [previewIndex, setPreviewIndex] = useState(-1);

  const customQuestions = questionsList.filter(q => q.id && q.id.startsWith('custom_'));

  const loadQuestionForPreview = (idx) => {
    if (idx >= 0 && idx < customQuestions.length) {
      const q = customQuestions[idx];
      const optA = q.custom_options?.[0] || 'A';
      const optB = q.custom_options?.[1] || 'B';
      const optC = q.custom_options?.[2] || 'C';
      const optD = q.custom_options?.[3] || 'D';
      setUploadForm({
        section: q.section,
        level: q.level || 'L1',
        type: q.type,
        marks: q.marks,
        correct_answer: q.correct_answer,
        question_text: q.question_text || '',
        show_question_text: !!(q.question_text && q.question_text.trim()),
        options_a: optA,
        options_b: optB,
        options_c: optC,
        options_d: optD,
        is_opt_image_a: optA.startsWith('data:image') || optA.startsWith('http'),
        is_opt_image_b: optB.startsWith('data:image') || optB.startsWith('http'),
        is_opt_image_c: optC.startsWith('data:image') || optC.startsWith('http'),
        is_opt_image_d: optD.startsWith('data:image') || optD.startsWith('http'),
        image: q.question_image,
        negative_marks: q.negative_marks
      });
      setUploadQuestionNumber(q.original_num);
      setPreviewIndex(idx);
    } else {
      setUploadForm({
        section: examConfig.selectedTopic === 'Full Syllabus' ? TOPICS[0] : examConfig.selectedTopic,
        level: 'L1',
        type: 'MCQ',
        marks: 1,
        correct_answer: 'A',
        question_text: '',
        show_question_text: false,
        options_a: 'A',
        options_b: 'B',
        options_c: 'C',
        options_d: 'D',
        is_opt_image_a: false,
        is_opt_image_b: false,
        is_opt_image_c: false,
        is_opt_image_d: false,
        image: null,
        negative_marks: 0.33
      });
      setUploadQuestionNumber(customQuestions.length + 1);
      setPreviewIndex(-1);
    }
  };

  useEffect(() => {
    // Sync Exam Config from Firebase DB on mount
    const configRef = ref(db, 'exam_config');
    const unsubscribe = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setExamConfig(data);
      } else {
        const saved = localStorage.getItem('gate_cbt_admin_exam_config');
        if (saved) setExamConfig(JSON.parse(saved));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      const logsRef = ref(db, 'student_logs');
      const unsubscribe = onValue(logsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const allLogs = [];
          const recurse = (node) => {
            if (!node || typeof node !== 'object') return;
            if (node.studentName) {
              allLogs.push(node);
              return;
            }
            Object.values(node).forEach(child => recurse(child));
          };
          recurse(data);

          const logsList = allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
          setStudentLogs(logsList);
        } else {
          const raw = localStorage.getItem('gate_cbt_student_logs');
          const defaultLogs = [
            { id: 'mock1', studentName: 'Rahul Sharma', avatarSeed: 'Rahul', date: '2026-07-16T14:32:00Z', topic: 'Control Systems', score: 8.33, totalQuestions: 10, correctCount: 7, incorrectCount: 3, unattemptedCount: 0, accuracy: 70, timeSpent: 420 },
            { id: 'mock2', studentName: 'Aditi Verma', avatarSeed: 'Aditi', date: '2026-07-16T18:15:00Z', topic: 'Electric circuits', score: 13.67, totalQuestions: 15, correctCount: 11, incorrectCount: 4, unattemptedCount: 0, accuracy: 73, timeSpent: 680 }
          ];
          setStudentLogs(raw ? JSON.parse(raw) : defaultLogs);
        }
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  const handleSaveConfig = (e) => {
    e.preventDefault();
    const updatedConfig = { ...examConfig };
    // 1. Save locally first (fallback)
    localStorage.setItem('gate_cbt_admin_exam_config', JSON.stringify(updatedConfig));
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);

    // 2. Sync to Firebase
    set(ref(db, 'exam_config'), updatedConfig)
      .catch(err => {
        console.warn('Firebase config sync failed, saved locally instead:', err);
      });
  };

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    const newMarks = uploadForm.marks;
    setUploadForm(prev => ({
      ...prev,
      type: newType,
      correct_answer: newType === 'NAT' ? '' : 'A',
      negative_marks: getDefaultNegativeMarks(newType, newMarks)
    }));
  };

  const handleMarksChange = (e) => {
    const newMarks = e.target.value;
    const newType = uploadForm.type;
    setUploadForm(prev => ({
      ...prev,
      marks: newMarks,
      negative_marks: getDefaultNegativeMarks(newType, newMarks)
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image too large. Please use an image under 5MB.');
      return;
    }
    setUploadError('');
    const reader = new FileReader();
    reader.onloadend = () => setUploadForm(prev => ({ ...prev, image: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleOptionImageChange = (opt, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(`Option (${opt.toUpperCase()}) image too large. Max size is 5MB.`);
      return;
    }
    setUploadError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadForm(prev => ({
        ...prev,
        [`options_${opt}`]: reader.result,
        [`is_opt_image_${opt}`]: true
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleUploadQuestion = (e) => {
    e.preventDefault();
    if (!uploadForm.image && (!uploadForm.question_text || !uploadForm.question_text.trim())) {
      setUploadError('Please upload a question image OR enter manual question text.');
      return;
    }

    const isEditing = previewIndex !== -1;
    const confirmProceed = window.confirm(
      isEditing 
        ? `Update and save changes to Question #${uploadQuestionNumber}?`
        : "Save and Next for Upload Next Question?"
    );
    if (!confirmProceed) return;

    const newId = isEditing ? customQuestions[previewIndex].id : `custom_${Date.now()}`;
    const newQ = {
      id: newId,
      year: new Date().getFullYear().toString(),
      original_num: uploadQuestionNumber,
      page_num: 1,
      section: uploadForm.section, // Use the selected subject/topic from the form
      level: uploadForm.level || 'L1',
      marks: parseInt(uploadForm.marks),
      type: uploadForm.type,
      options: uploadForm.type !== 'NAT' ? ['A', 'B', 'C', 'D'] : [],
      question_text: uploadForm.question_text ? uploadForm.question_text.trim() : '',
      correct_answer: uploadForm.correct_answer,
      question_image: uploadForm.image,
      custom_options: uploadForm.type !== 'NAT'
        ? [uploadForm.options_a, uploadForm.options_b, uploadForm.options_c, uploadForm.options_d]
        : [],
      negative_marks: parseFloat(uploadForm.negative_marks) || 0
    };

    // 1. Save locally first (fallback storage)
    try {
      const savedQ = localStorage.getItem('gate_cbt_custom_questions');
      let allQ = savedQ ? JSON.parse(savedQ) : [];
      if (isEditing) {
        allQ = allQ.map(q => q.id === newId ? newQ : q);
      } else {
        allQ.push(newQ);
      }
      localStorage.setItem('gate_cbt_custom_questions', JSON.stringify(allQ));

      const savedA = localStorage.getItem('gate_cbt_custom_answers') || '{}';
      const allA = JSON.parse(savedA);
      allA[newId] = uploadForm.correct_answer;
      localStorage.setItem('gate_cbt_custom_answers', JSON.stringify(allA));
    } catch (localErr) {
      console.error('Error saving question locally:', localErr);
    }

    // Helper to reset fields & increment question counter
    const completeUploadState = () => {
      if (isEditing) {
        alert("Question updated successfully!");
        loadQuestionForPreview(-1);
      } else {
        setUploadQuestionNumber(prev => prev + 1);
        setUploadForm(prev => ({
          ...prev,
          correct_answer: prev.type === 'NAT' ? '' : 'A',
          question_text: '',
          show_question_text: false,
          options_a: 'A',
          options_b: 'B',
          options_c: 'C',
          options_d: 'D',
          is_opt_image_a: false,
          is_opt_image_b: false,
          is_opt_image_c: false,
          is_opt_image_d: false,
          image: null,
          negative_marks: getDefaultNegativeMarks(prev.type, prev.marks)
        }));
        const fi = document.getElementById('q-image-input');
        if (fi) fi.value = '';
      }
    };

    // 2. Try to sync with Firebase Realtime DB
    Promise.all([
      set(ref(db, `custom_questions/${newId}`), newQ),
      set(ref(db, `custom_answers/${newId}`), uploadForm.correct_answer)
    ])
      .then(() => {
        setUploadSuccess(true);
        setUploadError('');
        setTimeout(() => setUploadSuccess(false), 4000);
        completeUploadState();
      })
      .catch(err => {
        console.warn('Firebase sync failed, saved locally instead:', err);
        setUploadSuccess(true);
        setUploadError('Saved locally! Note: Could not sync to Firebase Database (Permission Denied).');
        setTimeout(() => setUploadSuccess(false), 8000);
        completeUploadState();
      });
  };

  const handleDeleteQuestion = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this custom question?");
    if (!confirmDelete) return;

    try {
      // 1. Delete from Firebase
      await set(ref(db, `custom_questions/${id}`), null);
      await set(ref(db, `custom_answers/${id}`), null);

      // 2. Delete from LocalStorage
      const savedQ = localStorage.getItem('gate_cbt_custom_questions');
      if (savedQ) {
        const allQ = JSON.parse(savedQ).filter(q => q.id !== id);
        localStorage.setItem('gate_cbt_custom_questions', JSON.stringify(allQ));
      }

      const savedA = localStorage.getItem('gate_cbt_custom_answers');
      if (savedA) {
        const allA = JSON.parse(savedA);
        delete allA[id];
        localStorage.setItem('gate_cbt_custom_answers', JSON.stringify(allA));
      }

      alert("Question deleted successfully!");
    } catch (err) {
      console.error("Failed to delete question:", err);
      alert("Failed to delete question from Firebase.");
    }
  };

  const TAB_BTN = (key, label) => (
    <button
      onClick={() => setActiveTab(key)}
      style={{
        flex: 1,
        padding: '0.9rem 1rem',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: activeTab === key ? '#3b82f6' : '#e2e8f0',
        background: activeTab === key
          ? 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(99,102,241,0.07) 100%)'
          : 'white',
        color: activeTab === key ? '#2563eb' : '#475569',
        fontWeight: 700,
        cursor: 'pointer',
        fontSize: '0.95rem',
        boxShadow: activeTab === key ? '0 4px 12px rgba(59,130,246,0.1)' : 'none',
        transition: 'all 0.2s'
      }}
    >
      {label}
    </button>
  );

  const inputStyle = {
    width: '100%',
    padding: '0.7rem 0.9rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    backgroundColor: '#ffffff',
    color: '#0f172a'
  };

  const labelStyle = {
    display: 'block',
    fontWeight: 600,
    fontSize: '0.8rem',
    color: '#475569',
    marginBottom: '0.4rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em'
  };

  const allTopics = ['Full Syllabus', ...TOPICS];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '0' }}>
      {/* Top Nav Bar */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img 
            src="https://ckcet.edu.in/images/uploads/logo-177701468569eb179dc5a85.webp" 
            alt="CKCET Logo" 
            style={{ width: '36px', height: '36px', objectFit: 'contain' }} 
          />
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: '1rem', fontFamily: 'Outfit, sans-serif' }}>GATE EE — Admin Console</div>
            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
              {authUser?.email}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={onClearAllQuestions}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              color: '#f87171',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
          >
            🗑️ Clear All Questions
          </button>
          <button
            onClick={onLogout}
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              color: '#fca5a5',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
          {TAB_BTN('config', '⚙️ Configure Exam')}
          {TAB_BTN('upload', '📤 Upload Question')}
          {TAB_BTN('questions', '📁 View Uploaded Qns')}
          {TAB_BTN('logs', '📊 Student Logs')}
        </div>

        {/* ===== TAB 1: Configure Exam ===== */}
        {activeTab === 'config' && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>Set Student Exam Template</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2rem' }}>
              Configure the question count and time limit. Students will see this as their assigned daily practice exam.
            </p>

            {configSaved && (
              <div style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '0.875rem', marginBottom: '1.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                ✓ Configuration saved! Students will see the updated assignment.
              </div>
            )}

             <form onSubmit={handleSaveConfig}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div>
                  <label style={labelStyle}>Selected Subject / Topic</label>
                  <select value={examConfig.selectedTopic} onChange={e => setExamConfig(p => ({ ...p, selectedTopic: e.target.value }))} style={inputStyle}>
                    {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Question Count</label>
                  <select value={examConfig.numQuestions} onChange={e => setExamConfig(p => ({ ...p, numQuestions: parseInt(e.target.value) }))} style={inputStyle}>
                    {[5, 10, 15, 20, 30, 40, 65].map(n => <option key={n} value={n}>{n} Questions</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Time Limit</label>
                  <select value={examConfig.timeLimit} onChange={e => setExamConfig(p => ({ ...p, timeLimit: parseInt(e.target.value) }))} style={inputStyle}>
                    {[5, 10, 15, 20, 30, 45, 60, 90, 180].map(m => <option key={m} value={m}>{m} Minutes</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.875rem 2rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
                Save Configuration
              </button>
            </form>
          </div>
        )}

        {/* ===== TAB 2: Upload Question ===== */}
        {activeTab === 'upload' && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                  {previewIndex === -1 ? `Post Custom Question (Question #${uploadQuestionNumber})` : `Review Custom Question (Question #${uploadQuestionNumber})`}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
                  Active Config Subject: <strong style={{ color: '#3b82f6' }}>{examConfig.selectedTopic}</strong>
                </p>
              </div>

              {/* Navigation Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={customQuestions.length === 0 || previewIndex === 0}
                  onClick={() => loadQuestionForPreview(previewIndex === -1 ? customQuestions.length - 1 : previewIndex - 1)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: '#e2e8f0',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#334155',
                    fontWeight: '600',
                    fontSize: '0.8rem',
                    cursor: (customQuestions.length === 0 || previewIndex === 0) ? 'not-allowed' : 'pointer',
                    opacity: (customQuestions.length === 0 || previewIndex === 0) ? 0.5 : 1
                  }}
                >
                  ⬅ Previous
                </button>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569', padding: '0 0.25rem' }}>
                  {previewIndex === -1 ? 'New Question' : `${previewIndex + 1} / ${customQuestions.length}`}
                </span>
                <button
                  type="button"
                  disabled={previewIndex === -1}
                  onClick={() => loadQuestionForPreview(previewIndex === customQuestions.length - 1 ? -1 : previewIndex + 1)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: '#e2e8f0',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#334155',
                    fontWeight: '600',
                    fontSize: '0.8rem',
                    cursor: previewIndex === -1 ? 'not-allowed' : 'pointer',
                    opacity: previewIndex === -1 ? 0.5 : 1
                  }}
                >
                  Next ➡
                </button>
                {previewIndex !== -1 && (
                  <button
                    type="button"
                    onClick={() => loadQuestionForPreview(-1)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    ➕ New Question
                  </button>
                )}
              </div>
            </div>

            {uploadSuccess && (
              <div style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '0.875rem', marginBottom: '1.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                ✓ Question #{uploadQuestionNumber - 1} uploaded successfully! Ready for Question #{uploadQuestionNumber}.
              </div>
            )}
            {uploadError && (
              <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.875rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                ⚠️ {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadQuestion}>
              {/* Row 1: Bloom's Level, Type, Marks, Negative Marks */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={labelStyle}>Bloom's Level</label>
                  <select value={uploadForm.level} onChange={e => setUploadForm(p => ({ ...p, level: e.target.value }))} style={inputStyle}>
                    {LEVELS.map(lvl => <option key={lvl.value} value={lvl.value}>{lvl.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Question Type</label>
                  <select value={uploadForm.type} onChange={handleTypeChange} style={inputStyle}>
                    <option value="MCQ">MCQ — Single Correct</option>
                    <option value="MSQ">MSQ — Multiple Correct</option>
                    <option value="NAT">NAT — Numerical Answer</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Marks</label>
                  <select value={uploadForm.marks} onChange={handleMarksChange} style={inputStyle}>
                    <option value="1">1 Mark</option>
                    <option value="2">2 Marks</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Negative Marks</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={uploadForm.negative_marks}
                    onChange={e => setUploadForm(p => ({ ...p, negative_marks: parseFloat(e.target.value) || 0 }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Manual Question Text Toggle & Input */}
              <div style={{ marginBottom: '1.25rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: uploadForm.show_question_text ? '0.75rem' : 0 }}>
                  <input
                    type="checkbox"
                    id="enable-text-cb"
                    checked={uploadForm.show_question_text}
                    onChange={e => setUploadForm(p => ({ ...p, show_question_text: e.target.checked }))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="enable-text-cb" style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', cursor: 'pointer' }}>
                    ✍️ Add Manual Question Text (Optional)
                  </label>
                </div>

                {uploadForm.show_question_text && (
                  <div>
                    <label style={labelStyle}>Question Text</label>
                    <textarea
                      rows={3}
                      value={uploadForm.question_text}
                      onChange={e => setUploadForm(p => ({ ...p, question_text: e.target.value }))}
                      placeholder="Type your question statement here..."
                      style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>
                )}
              </div>

              {/* Question Image Upload */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>
                    Question Image {!uploadForm.question_text.trim() && <span style={{ color: '#ef4444' }}>*</span>}
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '0.4rem' }}>
                      (Optional if question text is provided)
                    </span>
                  </label>
                  {uploadForm.image && (
                    <button
                      type="button"
                      onClick={() => setUploadForm(p => ({ ...p, image: null }))}
                      style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ✕ Remove Image
                    </button>
                  )}
                </div>
                <div style={{
                  border: `2px dashed ${uploadForm.image ? '#10b981' : '#cbd5e1'}`,
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: uploadForm.image ? '#f0fdf4' : '#ffffff',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s'
                }}>
                  <input
                    id="q-image-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    required={!previewIndex !== -1 && !uploadForm.question_text.trim()}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                  />
                  {uploadForm.image ? (
                    <div>
                      <img src={uploadForm.image} alt="preview" style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '8px', marginBottom: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                      <div style={{ color: '#065f46', fontWeight: 600, fontSize: '0.875rem' }}>✓ Image loaded — click to change</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>🖼️</div>
                      <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Click to upload question image</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>PNG, JPG, WEBP — max 5MB</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Options (only for MCQ/MSQ) */}
              {uploadForm.type !== 'NAT' ? (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={labelStyle}>Answer Options (Text or Image)</label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    {['a', 'b', 'c', 'd'].map(opt => (
                      <div key={opt} style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <label style={{ ...labelStyle, marginBottom: 0, fontWeight: 700 }}>Option ({opt.toUpperCase()})</label>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <input
                              type="checkbox"
                              checked={uploadForm[`is_opt_image_${opt}`]}
                              onChange={e => {
                                const isChecked = e.target.checked;
                                setUploadForm(p => ({
                                  ...p,
                                  [`is_opt_image_${opt}`]: isChecked,
                                  [`options_${opt}`]: isChecked
                                    ? (p[`options_${opt}`]?.startsWith('data:image') ? p[`options_${opt}`] : '')
                                    : (p[`options_${opt}`]?.startsWith('data:image') ? opt.toUpperCase() : p[`options_${opt}`])
                                }));
                              }}
                            />
                            📷 Image Option
                          </label>
                        </div>

                        {uploadForm[`is_opt_image_${opt}`] ? (
                          <div style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '0.6rem', textAlign: 'center', background: 'white', position: 'relative' }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleOptionImageChange(opt, e)}
                              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                            />
                            {uploadForm[`options_${opt}`] && uploadForm[`options_${opt}`].startsWith('data:image') ? (
                              <div>
                                <img src={uploadForm[`options_${opt}`]} alt={`Opt ${opt}`} style={{ maxHeight: '80px', maxWidth: '100%', borderRadius: '4px' }} />
                                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginTop: '0.2rem' }}>✓ Image loaded</div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '0.5rem' }}>
                                📂 Click to upload image for Option ({opt.toUpperCase()})
                              </div>
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={uploadForm[`options_${opt}`]}
                            onChange={e => setUploadForm(p => ({ ...p, [`options_${opt}`]: e.target.value }))}
                            placeholder={`Enter option ${opt.toUpperCase()}`}
                            required={uploadForm.type !== 'NAT'}
                            style={inputStyle}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: '1.5rem', maxWidth: '250px' }}>
                    <label style={labelStyle}>Correct Answer</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setUploadForm(p => {
                            if (uploadForm.type === 'MSQ') {
                              const parts = p.correct_answer ? p.correct_answer.split(';').filter(Boolean) : [];
                              if (parts.includes(opt)) return { ...p, correct_answer: parts.filter(x => x !== opt).join(';') };
                              return { ...p, correct_answer: [...parts, opt].join(';') };
                            }
                            return { ...p, correct_answer: opt };
                          })}
                          style={{
                            width: '44px', height: '44px',
                            borderRadius: '8px',
                            border: '2px solid',
                            borderColor: (uploadForm.type === 'MSQ' ? uploadForm.correct_answer.split(';').includes(opt) : uploadForm.correct_answer === opt) ? '#10b981' : '#cbd5e1',
                            background: (uploadForm.type === 'MSQ' ? uploadForm.correct_answer.split(';').includes(opt) : uploadForm.correct_answer === opt) ? '#d1fae5' : 'white',
                            color: (uploadForm.type === 'MSQ' ? uploadForm.correct_answer.split(';').includes(opt) : uploadForm.correct_answer === opt) ? '#065f46' : '#475569',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'all 0.15s'
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                      {uploadForm.type === 'MSQ' ? 'Select all correct options' : 'Select one correct option'}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: '1.5rem', maxWidth: '300px' }}>
                  <label style={labelStyle}>Correct Numerical Answer</label>
                  <input
                    type="text"
                    value={uploadForm.correct_answer}
                    onChange={e => setUploadForm(p => ({ ...p, correct_answer: e.target.value }))}
                    required
                    placeholder="e.g. 5.25 or 10 to 11.2"
                    style={inputStyle}
                  />
                </div>
              )}

              <button
                type="submit"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.875rem 2rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}
              >
                {previewIndex === -1 ? `Save & Next (Upload Question #${uploadQuestionNumber})` : `Update Question #${uploadQuestionNumber}`}
              </button>
            </form>
          </div>
        )}

        {/* ===== TAB 2.5: View Uploaded Questions ===== */}
        {activeTab === 'questions' && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Uploaded Custom Questions</h2>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  Manage the custom questions you've added to the test pool.
                </p>
              </div>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.8rem', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: '20px' }}>
                Total: {customQuestions.length} Questions
              </span>
            </div>

            {customQuestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>📭</span>
                <h3 style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 700, marginBottom: '0.25rem' }}>No custom questions uploaded yet</h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.5rem 0' }}>
                  Click the Upload Question tab to start adding custom questions to the exam.
                </p>
                <button
                  onClick={() => setActiveTab('upload')}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.25rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ➕ Upload First Question
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {customQuestions.map((q, idx) => {
                  return (
                    <div key={q.id} style={{ display: 'flex', gap: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                      {/* Image Thumbnail */}
                      {q.question_image && (
                        <div style={{ width: '150px', minWidth: '150px', height: '110px', overflow: 'hidden', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={q.question_image} alt={`Q${q.original_num}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        </div>
                      )}

                      {/* Question Details */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                              Question #{q.original_num}
                            </span>
                            <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                              {q.type}
                            </span>
                            <span style={{ background: '#f0fdf4', color: '#15803d', fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                              {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                            </span>
                            <span style={{ background: '#fef3c7', color: '#d97706', fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                              Level: {q.level || 'L1'}
                            </span>
                            {q.negative_marks > 0 && (
                              <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                                -{q.negative_marks} Neg Marks
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem' }}>
                            <strong>Subject/Topic:</strong> {q.section}
                          </div>

                          {q.question_text && (
                            <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 500, marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
                              {q.question_text}
                            </div>
                          )}

                          {q.type !== 'NAT' && q.custom_options && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', fontSize: '0.8rem', color: '#475569' }}>
                              {['A', 'B', 'C', 'D'].map((lbl, i) => {
                                const val = q.custom_options[i] || '';
                                const isImg = val.startsWith('data:image') || val.startsWith('http') || val.startsWith('blob:');
                                return (
                                  <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <strong>{lbl}:</strong>
                                    {isImg ? (
                                      <img src={val} alt={`Opt ${lbl}`} style={{ maxHeight: '45px', maxWidth: '100px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                                    ) : (
                                      <span>{val}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                            <strong>Correct Answer:</strong> <span style={{ color: '#16a34a', fontWeight: 700 }}>{q.correct_answer}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                          <button
                            onClick={() => {
                              loadQuestionForPreview(idx);
                              setActiveTab('upload');
                            }}
                            style={{
                              padding: '0.4rem 1rem',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            ✏️ Edit Question
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            style={{
                              padding: '0.4rem 1rem',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️ Delete Question
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== TAB 3: Student Logs ===== */}
        {activeTab === 'logs' && (() => {
          const filteredLogsByDate = studentLogs.filter(log => {
            if (!log.date) return false;
            try {
              const logLocalDate = new Date(log.date);
              const offset = logLocalDate.getTimezoneOffset();
              const adjusted = new Date(logLocalDate.getTime() - (offset * 60 * 1000));
              const logDateStr = adjusted.toISOString().split('T')[0];
              return logDateStr === selectedLogDate;
            } catch (e) {
              return log.date.startsWith(selectedLogDate);
            }
          });

          const students3rd = studentsData["3rd Year"] || [];
          const attended3rd = students3rd.filter(student => 
            filteredLogsByDate.some(log => 
              (log.registerNumber && log.registerNumber.toString().trim() === student.regNo.toString().trim()) ||
              (log.studentName && log.studentName.toLowerCase().trim() === student.name.toLowerCase().trim())
            )
          );
          const notAttended3rd = students3rd.filter(student => 
            !filteredLogsByDate.some(log => 
              (log.registerNumber && log.registerNumber.toString().trim() === student.regNo.toString().trim()) ||
              (log.studentName && log.studentName.toLowerCase().trim() === student.name.toLowerCase().trim())
            )
          );

          const students4th = studentsData["4th Year"] || [];
          const attended4th = students4th.filter(student => 
            filteredLogsByDate.some(log => 
              (log.registerNumber && log.registerNumber.toString().trim() === student.regNo.toString().trim()) ||
              (log.studentName && log.studentName.toLowerCase().trim() === student.name.toLowerCase().trim())
            )
          );
          const notAttended4th = students4th.filter(student => 
            !filteredLogsByDate.some(log => 
              (log.registerNumber && log.registerNumber.toString().trim() === student.regNo.toString().trim()) ||
              (log.studentName && log.studentName.toLowerCase().trim() === student.name.toLowerCase().trim())
            )
          );

          const getLatestAttempt = (student) => {
            return filteredLogsByDate.find(log => 
              (log.registerNumber && log.registerNumber.toString().trim() === student.regNo.toString().trim()) ||
              (log.studentName && log.studentName.toLowerCase().trim() === student.name.toLowerCase().trim())
            );
          };

          return (
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.25rem', margin: 0 }}>Student Exam Records</h2>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
                    Detailed attempt logs showing accuracy, score, attendance, and duration for every exam session.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Select Date:</span>
                    <input
                      type="date"
                      value={selectedLogDate}
                      onChange={e => setSelectedLogDate(e.target.value)}
                      style={{
                        padding: '0.55rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        outline: 'none',
                        background: 'white',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Filter View:</span>
                    <select
                      value={logsFilter}
                      onChange={e => setLogsFilter(e.target.value)}
                      style={{
                        padding: '0.6rem 1.25rem',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        outline: 'none',
                        background: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="all">📝 All Attempt Logs ({filteredLogsByDate.length})</option>
                      <option value="3rd_attended">👥 3rd Year - Attended ({attended3rd.length} / {students3rd.length})</option>
                      <option value="3rd_not_attended">❌ 3rd Year - Not Attended ({notAttended3rd.length} / {students3rd.length})</option>
                      <option value="4th_attended">👥 Final Year - Attended ({attended4th.length} / {students4th.length})</option>
                      <option value="4th_not_attended">❌ Final Year - Not Attended ({notAttended4th.length} / {students4th.length})</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                {logsFilter === 'all' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        {['Register Number', 'Student Name', 'Dept / Year', 'Subject', 'Attended', 'Correct', 'Score', 'Accuracy', 'Time Spent', 'Date'].map(h => (
                          <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogsByDate.length === 0 ? (
                        <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>No attempts recorded on this date.</td></tr>
                      ) : filteredLogsByDate.map((log, i) => {
                        const d = new Date(log.date);
                        const mins = Math.floor(log.timeSpent / 60);
                        const secs = log.timeSpent % 60;
                        return (
                          <tr key={log.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.875rem 1rem', fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>
                              {log.registerNumber || 'N/A'}
                            </td>
                            <td style={{ padding: '0.875rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                {log.studentPhoto
                                  ? <img src={log.studentPhoto} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                                  : <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${log.avatarSeed || log.studentName}`} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#e2e8f0' }} />
                                }
                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{log.studentName}</div>
                              </div>
                            </td>
                            <td style={{ padding: '0.875rem 1rem', fontSize: '0.825rem', color: '#475569', fontWeight: 500 }}>
                              <div>{log.department || 'N/A'}</div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{log.year || 'N/A'}</div>
                            </td>
                            <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#475569' }}>{log.topic}</td>
                            <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem' }}>{(log.totalQuestions - (log.unattemptedCount || 0))}/{log.totalQuestions}</td>
                            <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: '#10b981' }}>{log.correctCount}</td>
                            <td style={{ padding: '0.875rem 1rem', fontSize: '0.9rem', fontWeight: 700 }}>{log.score}</td>
                            <td style={{ padding: '0.875rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '50px', height: '5px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${log.accuracy}%`, background: log.accuracy >= 70 ? '#10b981' : log.accuracy >= 40 ? '#f59e0b' : '#ef4444' }} />
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{log.accuracy}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>{mins}m {secs}s</td>
                            <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>{d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {(logsFilter === '3rd_attended' || logsFilter === '4th_attended') && (() => {
                  const list = logsFilter === '3rd_attended' ? attended3rd : attended4th;
                  return (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          {['Register Number', 'Student Name', 'Status', 'Latest Topic', 'Score', 'Accuracy', 'Time Spent', 'Attempted Date'].map(h => (
                            <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {list.length === 0 ? (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>No students in this list.</td></tr>
                        ) : list.map((student, i) => {
                          const latestLog = getLatestAttempt(student);
                          const d = latestLog ? new Date(latestLog.date) : null;
                          return (
                            <tr key={student.regNo || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.875rem 1rem', fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{student.regNo}</td>
                              <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>{student.name}</td>
                              <td style={{ padding: '0.875rem 1rem' }}>
                                <span style={{ padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#d1fae5', color: '#065f46' }}>Attended</span>
                              </td>
                              <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#475569' }}>{latestLog?.topic || 'N/A'}</td>
                              <td style={{ padding: '0.875rem 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#2563eb' }}>{latestLog ? latestLog.score : 'N/A'}</td>
                              <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}>{latestLog ? `${latestLog.accuracy}%` : 'N/A'}</td>
                              <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>
                                {latestLog ? `${Math.floor(latestLog.timeSpent / 60)}m ${latestLog.timeSpent % 60}s` : 'N/A'}
                              </td>
                              <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#64748b' }}>
                                {d ? `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}

                {(logsFilter === '3rd_not_attended' || logsFilter === '4th_not_attended') && (() => {
                  const list = logsFilter === '3rd_not_attended' ? notAttended3rd : notAttended4th;
                  return (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          {['Register Number', 'Student Name', 'Status'].map(h => (
                            <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {list.length === 0 ? (
                          <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>All students have attended!</td></tr>
                        ) : list.map((student, i) => (
                          <tr key={student.regNo || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.875rem 1rem', fontWeight: 600, fontSize: '0.875rem', color: '#475569' }}>{student.regNo}</td>
                            <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#334155' }}>{student.name}</td>
                            <td style={{ padding: '0.875rem 1rem' }}>
                              <span style={{ padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#fee2e2', color: '#991b1b' }}>Not Attended</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
