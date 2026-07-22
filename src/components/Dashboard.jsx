import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import studentsData from './students.json';

const BLOOMS_LEVELS = [
  { key: 'L1', name: 'L1 – Remember', color: '#3b82f6', desc: 'Formula, Definition, Facts', weight: '10-15%' },
  { key: 'L2', name: 'L2 – Understand', color: '#8b5cf6', desc: 'Explain concept, Interpret', weight: '15-20%' },
  { key: 'L3', name: 'L3 – Apply', color: '#10b981', desc: 'Apply formulas, Numerical solving', weight: '40-50%' },
  { key: 'L4', name: 'L4 – Analyze', color: '#f59e0b', desc: 'Multi-concept analysis', weight: '25-35%' },
  { key: 'L5', name: 'L5 – Evaluate', color: '#ec4899', desc: 'Compare methods, Choose best answer', weight: '5-10%' },
  { key: 'L6', name: 'L6 – Create', color: '#64748b', desc: 'Design, Develop new solution', weight: 'Rarely' }
];

export default function Dashboard({ questionsList, onStartTest, adminConfig, authUser, onLogout, studentDetails, onSaveProfile }) {
  // User stats from localStorage
  const [stats, setStats] = useState({ streak: 1, totalSolved: 0, accuracy: 0, coverage: 0 });
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    name: '',
    registerNumber: '',
    department: 'Electrical and Electronics Engineering',
    year: '3rd Year'
  });

  useEffect(() => {
    if (studentDetails && studentDetails.registerNumber) {
      setDetailsForm(studentDetails);
      setIsManualEntry(false);
    }
  }, [studentDetails]);
  const [studentLogs, setStudentLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const currentHour = new Date().getHours();
  const isOutsidePracticeHours = currentHour < 9 || currentHour >= 23;

  useEffect(() => {
    const regNo = studentDetails?.registerNumber ? String(studentDetails.registerNumber).trim() : '';
    const studentName = studentDetails?.name || authUser?.displayName || authUser?.email?.split('@')[0] || '';
    setLoadingLogs(true);

    const logsRef = ref(db, 'student_logs');
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      let allFetchedLogs = [];

      if (data) {
        const recurse = (node) => {
          if (!node || typeof node !== 'object') return;
          if (node.studentName || node.date) {
            allFetchedLogs.push(node);
            return;
          }
          Object.values(node).forEach(child => recurse(child));
        };
        recurse(data);
      }

      // Merge with localStorage logs to ensure zero missing attempts
      const rawLocal = localStorage.getItem('gate_cbt_student_logs');
      if (rawLocal) {
        try {
          const localLogs = JSON.parse(rawLocal);
          localLogs.forEach(loc => {
            if (!allFetchedLogs.some(f => f.id === loc.id || (f.date === loc.date && f.studentName === loc.studentName))) {
              allFetchedLogs.push(loc);
            }
          });
        } catch (e) {}
      }

      // Filter by registerNumber or studentName
      let finalLogs = allFetchedLogs;
      if (regNo || studentName) {
        finalLogs = allFetchedLogs.filter(log => {
          if (!log) return false;
          const matchReg = regNo && log.registerNumber && String(log.registerNumber).trim() === regNo;
          const matchName = studentName && log.studentName && String(log.studentName).trim().toLowerCase() === studentName.toLowerCase();
          return matchReg || matchName;
        });
      }

      finalLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setStudentLogs(finalLogs);
      setLoadingLogs(false);
    }, (error) => {
      console.warn("Firebase student logs fetch failed, loading from local:", error);
      const rawLocal = localStorage.getItem('gate_cbt_student_logs');
      let finalLogs = [];
      if (rawLocal) {
        try {
          const localLogs = JSON.parse(rawLocal);
          if (regNo || studentName) {
            finalLogs = localLogs.filter(log => {
              if (!log) return false;
              const matchReg = regNo && log.registerNumber && String(log.registerNumber).trim() === regNo;
              const matchName = studentName && log.studentName && String(log.studentName).trim().toLowerCase() === studentName.toLowerCase();
              return matchReg || matchName;
            });
          } else {
            finalLogs = localLogs;
          }
          finalLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (e) {}
      }
      setStudentLogs(finalLogs);
      setLoadingLogs(false);
    });

    return () => unsubscribe();
  }, [authUser, studentDetails]);

  const topics = [
    { name: 'Full Syllabus', icon: '📝', desc: 'Random questions across all syllabus topics' },
    { name: 'Engineering Mathematics', icon: '🧮', desc: 'Linear Algebra, Calculus, Differential Equations, Probability' },
    { name: 'Electric circuits', icon: '⚡', desc: 'KCL/KVL, Network Theorems, Transients, AC Circuits' },
    { name: 'Electromagnetic Fields', icon: '🧲', desc: "Gauss's Law, Biot-Savart, Faraday, Inductance" },
    { name: 'Signals and Systems', icon: '📊', desc: 'LTI Systems, Fourier, Laplace, Z-Transform' },
    { name: 'Electrical Machines', icon: '⚙️', desc: 'Transformers, Induction & DC Machines, Synchronous motors' },
    { name: 'Power Systems', icon: '🏭', desc: 'Transmission Lines, Load Flow, Faults, Stability' },
    { name: 'Control Systems', icon: '🕹️', desc: 'Transfer Functions, Bode Plots, Root Loci, State Space' },
    { name: 'Electrical and Electronic Measurements', icon: '📏', desc: 'Bridges, Meters, Oscilloscopes, Error analysis' },
    { name: 'Analog and Digital Electronics', icon: '📟', desc: 'Diodes, Op-Amps, Logic Gates, Counters, ADC/DAC' },
    { name: 'Power Electronics', icon: '🔌', desc: 'Thyristors, Converters, Inverters, Choppers, PWM' },
    { name: 'General Aptitude', icon: '🧩', desc: 'English Grammar, Quantitative Aptitude, Logic' }
  ];

  // Calculate real-time stats dynamically from student's actual Firebase history logs
  useEffect(() => {
    if (studentLogs.length === 0) {
      setStats({ streak: 0, totalSolved: 0, accuracy: 0, coverage: 0 });
      return;
    }

    // 1. Solved Questions (Total correct answers)
    const totalSolved = studentLogs.reduce((sum, log) => sum + (log.correctCount || 0), 0);

    // 2. Overall Accuracy
    const totalAttempted = studentLogs.reduce((sum, log) => sum + (log.totalQuestions || 0), 0);
    const accuracy = totalAttempted > 0 ? Math.round((totalSolved / totalAttempted) * 100) : 0;

    // 3. Daily Streak
    const uniqueDates = [...new Set(studentLogs.map(log => {
      try {
        return new Date(log.date).toDateString();
      } catch (e) {
        return null;
      }
    }).filter(Boolean))];

    const sortedDates = uniqueDates.map(d => new Date(d)).sort((a, b) => b - a);
    
    let streak = 0;
    if (sortedDates.length > 0) {
      const todayStr = new Date().toDateString();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      
      const mostRecentStr = sortedDates[0].toDateString();
      if (mostRecentStr === todayStr || mostRecentStr === yesterdayStr) {
        streak = 1;
        let currentRef = sortedDates[0];
        for (let i = 1; i < sortedDates.length; i++) {
          const prevDay = new Date(currentRef);
          prevDay.setDate(prevDay.getDate() - 1);
          if (sortedDates[i].toDateString() === prevDay.toDateString()) {
            streak++;
            currentRef = sortedDates[i];
          } else {
            break;
          }
        }
      }
    }

    // 4. Syllabus Coverage (based on unique topics attempted relative to total topics available)
    const attemptedTopics = new Set(
      studentLogs
        .map(log => log.topic)
        .filter(topic => topic && topic !== 'Full Syllabus')
    );
    const totalTopicsAvailable = topics.filter(t => t.name !== 'Full Syllabus').length;
    const coverage = totalTopicsAvailable > 0 ? Math.round((attemptedTopics.size / totalTopicsAvailable) * 100) : 0;

    setStats({
      streak,
      totalSolved,
      accuracy,
      coverage
    });
  }, [studentLogs, questionsList]);

  // Count questions per topic
  const topicCounts = { 'Full Syllabus': questionsList.length };
  questionsList.forEach(q => {
    topicCounts[q.section] = (topicCounts[q.section] || 0) + 1;
  });

  // Aggregate logs per Bloom's Level
  const levelAggregates = {
    L1: { correct: 0, incorrect: 0, total: 0 },
    L2: { correct: 0, incorrect: 0, total: 0 },
    L3: { correct: 0, incorrect: 0, total: 0 },
    L4: { correct: 0, incorrect: 0, total: 0 },
    L5: { correct: 0, incorrect: 0, total: 0 },
    L6: { correct: 0, incorrect: 0, total: 0 }
  };

  studentLogs.forEach(log => {
    let hasAddedData = false;
    if (log.levelStats && typeof log.levelStats === 'object') {
      Object.keys(log.levelStats).forEach(lvl => {
        let targetKey = lvl;
        if (lvl === 'Remember') targetKey = 'L1';
        if (lvl === 'Understand') targetKey = 'L2';
        if (lvl === 'Apply') targetKey = 'L3';
        if (lvl === 'Analyze') targetKey = 'L4';
        if (lvl === 'Evaluate') targetKey = 'L5';
        if (lvl === 'Create') targetKey = 'L6';

        if (levelAggregates[targetKey]) {
          const item = log.levelStats[lvl];
          const c = typeof item === 'number' ? item : (item?.correct || 0);
          const ic = typeof item === 'number' ? 0 : (item?.incorrect || 0);
          const t = typeof item === 'number' ? item : (item?.total || (c + ic + (item?.unattempted || 0)));

          levelAggregates[targetKey].correct += c;
          levelAggregates[targetKey].incorrect += ic;
          levelAggregates[targetKey].total += t;
          if (t > 0 || c > 0 || ic > 0) hasAddedData = true;
        }
      });
    }

    if (!hasAddedData && log.totalQuestions > 0) {
      // Fallback: distribute counts across levels based on typical GATE EE distribution
      let rc = log.correctCount || 0;
      let ric = log.incorrectCount || 0;
      let qTotal = log.totalQuestions || (rc + ric + (log.unattemptedCount || 0));

      // Primary allocation to L3 (Apply) and L2 (Understand)
      const l3Correct = Math.round(rc * 0.5);
      const l3Incorrect = Math.round(ric * 0.5);
      const l3Total = Math.round(qTotal * 0.5);

      levelAggregates.L3.correct += l3Correct;
      levelAggregates.L3.incorrect += l3Incorrect;
      levelAggregates.L3.total += l3Total;

      const l2Correct = rc - l3Correct;
      const l2Incorrect = ric - l3Incorrect;
      const l2Total = qTotal - l3Total;

      levelAggregates.L2.correct += l2Correct;
      levelAggregates.L2.incorrect += l2Incorrect;
      levelAggregates.L2.total += l2Total;
    }
  });

  // Ensure total is at least correct + incorrect
  Object.keys(levelAggregates).forEach(lvl => {
    levelAggregates[lvl].total = Math.max(levelAggregates[lvl].total, levelAggregates[lvl].correct + levelAggregates[lvl].incorrect);
  });

  const effectiveConfig = adminConfig || { selectedTopic: 'Full Syllabus', numQuestions: 20, timeLimit: 30 };

  const todayDateObj = new Date();
  const yesterdayDateObj = new Date();
  yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);

  const todayDateStr = (() => {
    const offset = todayDateObj.getTimezoneOffset();
    const adjusted = new Date(todayDateObj.getTime() - (offset * 60 * 1000));
    return adjusted.toISOString().split('T')[0];
  })();

  const yesterdayDateStr = (() => {
    const offset = yesterdayDateObj.getTimezoneOffset();
    const adjusted = new Date(yesterdayDateObj.getTime() - (offset * 60 * 1000));
    return adjusted.toISOString().split('T')[0];
  })();

  const studentYear = studentDetails?.year || '3rd Year';

  const isQuestionMatchingYear = (q, yr) => {
    if (!q.target_years || !Array.isArray(q.target_years) || q.target_years.length === 0) {
      return yr === '3rd Year' || yr === '4th Year';
    }
    if (yr === '2nd Year' && q.target_years.length >= 3) {
      const hasSpecific2ndYearQ = questionsList.some(item => Array.isArray(item.target_years) && item.target_years.length === 1 && item.target_years[0] === '2nd Year' && item.target_date === q.target_date);
      if (hasSpecific2ndYearQ) return false;
    }
    return q.target_years.includes(yr);
  };

  // Custom questions for Today and Yesterday filtered for student's academic year
  const todayQuestions = questionsList.filter(q => q.target_date === todayDateStr && isQuestionMatchingYear(q, studentYear));
  const yesterdayQuestions = questionsList.filter(q => q.target_date === yesterdayDateStr && isQuestionMatchingYear(q, studentYear));

  const todayTopic = todayQuestions.length > 0 ? (todayQuestions[0].section || effectiveConfig.selectedTopic) : effectiveConfig.selectedTopic;
  const todayCount = todayQuestions.length > 0 ? todayQuestions.length : effectiveConfig.numQuestions;

  const yesterdayTopic = yesterdayQuestions.length > 0 ? (yesterdayQuestions[0].section || effectiveConfig.selectedTopic) : effectiveConfig.selectedTopic;
  const yesterdayCount = yesterdayQuestions.length > 0 ? yesterdayQuestions.length : effectiveConfig.numQuestions;

  const [activeModalTest, setActiveModalTest] = useState({
    testType: 'TODAY',
    targetDate: todayDateStr,
    topic: todayTopic,
    count: todayCount,
    time: effectiveConfig.timeLimit
  });
  const [selectedAnswersLog, setSelectedAnswersLog] = useState(null);

  // Attendance checks - bulletproof matching by testDate, testType, or ISO date string
  const todayDateObjStr = todayDateObj.toDateString();
  const yesterdayDateObjStr = yesterdayDateObj.toDateString();

  const hasAttendedToday = studentLogs.some(log => {
    if (!log) return false;
    if (log.testDate && log.testDate === todayDateStr) return true;
    try {
      const d = new Date(log.date);
      if (d.toISOString().split('T')[0] === todayDateStr || d.toDateString() === todayDateObjStr) {
        return true;
      }
    } catch (e) {}
    return false;
  });

  const hasAttendedYesterday = studentLogs.some(log => {
    if (!log) return false;
    if (log.testDate && log.testDate === yesterdayDateStr) return true;
    if (log.testType === 'YESTERDAY') return true;
    try {
      const d = new Date(log.date);
      if (d.toISOString().split('T')[0] === yesterdayDateStr || d.toDateString() === yesterdayDateObjStr) {
        return true;
      }
    } catch (e) {}
    return false;
  });

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  const formatTimeSpent = (secs) => {
    if (secs === undefined || secs === null) return 'N/A';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>GATE EE Daily Practice</h1>
          <p>Prepare for GATE under realistic exam conditions</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* User info */}
          {authUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt="profile"
                  style={{ width: '38px', height: '38px', borderRadius: '50%', border: '2px solid rgba(15,23,42,0.1)', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                  {(authUser.displayName || authUser.email || 'S')[0].toUpperCase()}
                </div>
              )}
              <span style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.9rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {authUser.displayName || authUser.email}
              </span>
            </div>
          )}

          {/* Syllabus PDF */}
          <div className="syllabus-doc-card" style={{ margin: 0, padding: '0.5rem 0.75rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="syllabus-doc-info" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#ef4444' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.25 }}>GATE Syllabus</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>PDF</div>
              </div>
            </div>
            <a href="/EE_2026_Syllabus.pdf" download className="syllabus-doc-link" style={{ fontSize: '0.75rem', color: '#2563eb', textDecoration: 'none', fontWeight: 600, transition: 'color 0.15s' }}>Download</a>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            id="logout-btn"
            style={{
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '10px',
              padding: '0.5rem 0.9rem',
              color: '#991b1b',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#fecaca'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
          >
            Sign Out
          </button>
        </div>
      </div>



      {/* Stats Ribbon */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-info"><h3>Daily Streak</h3><p>{stats.streak} Days</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎓</div>
          <div className="stat-info"><h3>Solved Questions</h3><p>{stats.totalSolved}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-info"><h3>Overall Accuracy</h3><p>{stats.accuracy}%</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-info"><h3>Syllabus Coverage</h3><p>{stats.coverage}%</p></div>
        </div>
      </div>

      {/* Daily Test Panels (Today Test vs Yesterday Test) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Card 1: Today's Test */}
        <div className="panel-card" style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
          border: '2px solid #3b82f6',
          borderRadius: '24px',
          padding: '1.75rem',
          boxShadow: '0 8px 30px rgba(59,130,246,0.1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1.25rem'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{
                background: '#3b82f6',
                color: 'white',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                📅 Today Test ({todayDateStr})
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2563eb' }}>
                {todayQuestions.length > 0 ? 'Assigned' : 'Default'}
              </span>
            </div>

            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              {todayTopic}
            </h2>

            <div style={{ display: 'flex', gap: '1.25rem', color: '#475569', fontSize: '0.88rem', fontWeight: 500, marginBottom: '0.75rem' }}>
              <span>📋 <strong>{todayCount}</strong> Questions</span>
              <span>⏱️ <strong>{effectiveConfig.timeLimit}</strong> Minutes</span>
            </div>

            {hasAttendedToday && (
              <p style={{ fontSize: '0.825rem', color: '#ef4444', fontWeight: 600, margin: '0.25rem 0' }}>
                ⚠️ You have already completed Today's Test.
              </p>
            )}
            {isOutsidePracticeHours && !hasAttendedToday && (
              <p style={{ fontSize: '0.825rem', color: '#f59e0b', fontWeight: 600, margin: '0.25rem 0' }}>
                🕒 Daily practice is open from 9:00 AM to 11:00 PM.
              </p>
            )}
            {todayQuestions.length === 0 && !hasAttendedToday && !isOutsidePracticeHours && (
              <p style={{ fontSize: '0.825rem', color: '#94a3b8', fontWeight: 500, margin: '0.25rem 0' }}>
                Questions not assigned for today test yet.
              </p>
            )}
          </div>

          <button
            id="start-today-exam-btn"
            disabled={hasAttendedToday || isOutsidePracticeHours || todayQuestions.length === 0}
            onClick={() => {
              setActiveModalTest({
                testType: 'TODAY',
                targetDate: todayDateStr,
                topic: todayTopic,
                count: todayCount,
                time: effectiveConfig.timeLimit
              });
              setShowDetailsModal(true);
            }}
            style={{
              width: '100%',
              background: (hasAttendedToday || isOutsidePracticeHours || todayQuestions.length === 0) ? '#cbd5e1' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: (hasAttendedToday || isOutsidePracticeHours || todayQuestions.length === 0) ? '#64748b' : 'white',
              border: 'none',
              borderRadius: '14px',
              padding: '0.85rem 1.5rem',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: (hasAttendedToday || isOutsidePracticeHours || todayQuestions.length === 0) ? 'not-allowed' : 'pointer',
              boxShadow: (hasAttendedToday || isOutsidePracticeHours || todayQuestions.length === 0) ? 'none' : '0 4px 15px rgba(59,130,246,0.3)',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            {hasAttendedToday ? '🔒 Already Attended' : isOutsidePracticeHours ? '🕒 Exam Closed' : todayQuestions.length === 0 ? '⚠️ Questions Not Assigned' : '🚀 Start Today Test'}
          </button>
        </div>

        {/* Card 2: Yesterday's Test */}
        <div className="panel-card" style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #fef3c7 100%)',
          border: '2px solid #f59e0b',
          borderRadius: '24px',
          padding: '1.75rem',
          boxShadow: '0 8px 30px rgba(245,158,11,0.1)',
          display: 'flex',
          flexDirection: 'column',
          justify: 'space-between',
          gap: '1.25rem'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{
                background: '#f59e0b',
                color: 'white',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                ⏪ Yesterday Test ({yesterdayDateStr})
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d97706' }}>
                {yesterdayQuestions.length > 0 ? 'Assigned' : 'Not Assigned'}
              </span>
            </div>

            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              {yesterdayTopic}
            </h2>

            <div style={{ display: 'flex', gap: '1.25rem', color: '#475569', fontSize: '0.88rem', fontWeight: 500, marginBottom: '0.75rem' }}>
              <span>📋 <strong>{yesterdayCount}</strong> Questions</span>
              <span>⏱️ <strong>{effectiveConfig.timeLimit}</strong> Minutes</span>
            </div>

            {hasAttendedYesterday && (
              <p style={{ fontSize: '0.825rem', color: '#ef4444', fontWeight: 600, margin: '0.25rem 0' }}>
                ⚠️ You have already completed Yesterday's Test.
              </p>
            )}
            {isOutsidePracticeHours && !hasAttendedYesterday && (
              <p style={{ fontSize: '0.825rem', color: '#f59e0b', fontWeight: 600, margin: '0.25rem 0' }}>
                🕒 Daily practice is open from 9:00 AM to 11:00 PM.
              </p>
            )}
            {yesterdayQuestions.length === 0 && !hasAttendedYesterday && !isOutsidePracticeHours && (
              <p style={{ fontSize: '0.825rem', color: '#94a3b8', fontWeight: 500, margin: '0.25rem 0' }}>
                Questions not assigned for yesterday test.
              </p>
            )}
          </div>

          <button
            id="start-yesterday-exam-btn"
            disabled={hasAttendedYesterday || isOutsidePracticeHours || yesterdayQuestions.length === 0}
            onClick={() => {
              setActiveModalTest({
                testType: 'YESTERDAY',
                targetDate: yesterdayDateStr,
                topic: yesterdayTopic,
                count: yesterdayCount,
                time: effectiveConfig.timeLimit
              });
              setShowDetailsModal(true);
            }}
            style={{
              width: '100%',
              background: (hasAttendedYesterday || isOutsidePracticeHours || yesterdayQuestions.length === 0) ? '#cbd5e1' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: (hasAttendedYesterday || isOutsidePracticeHours || yesterdayQuestions.length === 0) ? '#64748b' : 'white',
              border: 'none',
              borderRadius: '14px',
              padding: '0.85rem 1.5rem',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: (hasAttendedYesterday || isOutsidePracticeHours || yesterdayQuestions.length === 0) ? 'not-allowed' : 'pointer',
              boxShadow: (hasAttendedYesterday || isOutsidePracticeHours || yesterdayQuestions.length === 0) ? 'none' : '0 4px 15px rgba(245,158,11,0.3)',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            {hasAttendedYesterday ? '🔒 Already Attended' : isOutsidePracticeHours ? '🕒 Exam Closed' : yesterdayQuestions.length === 0 ? '⚠️ Questions Not Assigned' : '🚀 Start Yesterday Test'}
          </button>
        </div>
      </div>

      {/* Bloom's Cognitive Level Analytics Bar Chart Card */}
      <div className="panel-card" style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-dark)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            📊 Bloom's Level Performance Analytics
          </span>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
            Cognitive Strength & Weakness Chart
          </span>
        </h2>

        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          This bar chart displays your question correctness across Bloom's Taxonomy Levels. Compare correct (<span style={{ color: '#10b981', fontWeight: 600 }}>green</span>) and incorrect (<span style={{ color: '#ef4444', fontWeight: 600 }}>red</span>) attempts to identify focus areas.
        </p>

        {studentLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
            Take practice tests or complete your profile to view your cognitive analytics bar chart.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'center' }}>
            {/* Left: SVG Bar Chart */}
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              {(() => {
                const maxCount = Math.max(
                  ...Object.values(levelAggregates).map(lvl => lvl.correct + lvl.incorrect),
                  5
                );
                const width = 500;
                const height = 240;
                const paddingLeft = 40;
                const paddingRight = 20;
                const paddingTop = 20;
                const paddingBottom = 45;
                
                const chartWidth = width - paddingLeft - paddingRight;
                const chartHeight = height - paddingTop - paddingBottom;
                const groupWidth = chartWidth / 6;
                const barWidth = 14;

                const getBarHeight = (count) => (count / maxCount) * chartHeight;
                const getBarY = (count) => (paddingTop + chartHeight) - getBarHeight(count);

                return (
                  <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    {/* Y-Axis Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                      const countVal = Math.round(ratio * maxCount);
                      const y = (paddingTop + chartHeight) - (ratio * chartHeight);
                      return (
                        <g key={idx}>
                          <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
                          <text x={paddingLeft - 8} y={y + 4} textAnchor="end" style={{ fontSize: '10px', fill: '#64748b', fontWeight: 600 }}>
                            {countVal}
                          </text>
                        </g>
                      );
                    })}

                    {/* Bars and X Labels */}
                    {BLOOMS_LEVELS.map((lvl, idx) => {
                      const stats = levelAggregates[lvl.key];
                      const groupX = paddingLeft + (idx * groupWidth);
                      const centerX = groupX + (groupWidth / 2);
                      
                      const correctHeight = getBarHeight(stats.correct);
                      const correctY = getBarY(stats.correct);
                      
                      const incorrectHeight = getBarHeight(stats.incorrect);
                      const incorrectY = getBarY(stats.incorrect);

                      return (
                        <g key={lvl.key}>
                          {/* Correct Bar (Green) */}
                          {stats.correct > 0 && (
                            <rect
                              x={centerX - barWidth - 2}
                              y={correctY}
                              width={barWidth}
                              height={correctHeight}
                              fill="#10b981"
                              rx="3"
                              style={{ transition: 'all 0.3s ease' }}
                            />
                          )}
                          {/* Correct Count Text */}
                          {stats.correct > 0 && (
                            <text x={centerX - (barWidth / 2) - 2} y={correctY - 5} textAnchor="middle" style={{ fontSize: '9px', fill: '#065f46', fontWeight: 700 }}>
                              {stats.correct}
                            </text>
                          )}

                          {/* Incorrect Bar (Red) */}
                          {stats.incorrect > 0 && (
                            <rect
                              x={centerX + 2}
                              y={incorrectY}
                              width={barWidth}
                              height={incorrectHeight}
                              fill="#ef4444"
                              rx="3"
                              style={{ transition: 'all 0.3s ease' }}
                            />
                          )}
                          {/* Incorrect Count Text */}
                          {stats.incorrect > 0 && (
                            <text x={centerX + (barWidth / 2) + 2} y={incorrectY - 5} textAnchor="middle" style={{ fontSize: '9px', fill: '#991b1b', fontWeight: 700 }}>
                              {stats.incorrect}
                            </text>
                          )}

                          {/* X-Axis Label */}
                          <text x={centerX} y={height - 25} textAnchor="middle" style={{ fontSize: '10px', fill: '#0f172a', fontWeight: 700 }}>
                            {lvl.key}
                          </text>
                          {/* Small Description */}
                          <text x={centerX} y={height - 12} textAnchor="middle" style={{ fontSize: '8px', fill: '#64748b', fontWeight: 600 }}>
                            {lvl.name.split(' – ')[1]}
                          </text>
                        </g>
                      );
                    })}

                    {/* Chart baseline */}
                    <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke="#cbd5e1" strokeWidth="1.5" />
                  </svg>
                );
              })()}

              {/* Legend */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#065f46' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981', display: 'inline-block' }} /> Correct
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#991b1b' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444', display: 'inline-block' }} /> Incorrect
                </span>
              </div>
            </div>

            {/* Right: Legend, Info & Summary details list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.2rem' }}>Cognitive Level Summary</h3>
              {BLOOMS_LEVELS.map(lvl => {
                const stats = levelAggregates[lvl.key];
                const total = stats.correct + stats.incorrect;
                const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
                
                let badgeBg = '#f1f5f9';
                let badgeColor = '#64748b';
                let label = 'No Data';

                if (total > 0) {
                  if (accuracy >= 70) {
                    badgeBg = '#dcfce7';
                    badgeColor = '#15803d';
                    label = 'Strong';
                  } else if (accuracy >= 45) {
                    badgeBg = '#fef3c7';
                    badgeColor = '#b45309';
                    label = 'Moderate';
                  } else {
                    badgeBg = '#fee2e2';
                    badgeColor = '#b91c1c';
                    label = 'Weak';
                  }
                }

                return (
                  <div key={lvl.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.5rem 0.85rem' }}>
                    <div>
                      <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>{lvl.name}</strong>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{lvl.desc}</div>
                    </div>
                    {total > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                          {stats.correct}/{total}
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, background: badgeBg, color: badgeColor, padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                          {label}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>No Attempts</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Student's Practice History Section */}
      <div className="panel-card" style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-dark)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            📊 My Practice History
          </span>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
            {studentLogs.length} {studentLogs.length === 1 ? 'Exam' : 'Exams'} Completed
          </span>
        </h2>

        {loadingLogs ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', color: '#64748b' }}>
            <div style={{ width: '24px', height: '24px', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '0.75rem' }} />
            <span>Loading history...</span>
          </div>
        ) : studentLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>📭</span>
            <h3 style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 700, marginBottom: '0.25rem' }}>No exams attended yet</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: '320px', margin: '0 auto' }}>
              Your completed practice tests and marks will appear here once you take your first exam.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date & Time</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mark / Score</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accuracy</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status (Qns)</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Spent</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Answer Key</th>
                </tr>
              </thead>
              <tbody>
                {studentLogs.map((log) => {
                  const isHighAcc = log.accuracy >= 75;
                  const isMedAcc = log.accuracy >= 45 && log.accuracy < 75;
                  const accBadgeColor = isHighAcc ? '#d1fae5' : isMedAcc ? '#fef3c7' : '#fee2e2';
                  const accTextColor = isHighAcc ? '#065f46' : isMedAcc ? '#92400e' : '#991b1b';
                  
                  const submitTime = log.date ? new Date(log.date).getTime() : Date.now();
                  const elapsedMs = Date.now() - submitTime;
                  const isUnlocked = elapsedMs >= 3600000; // 1 hour (3,600,000 ms)
                  const remainingMins = Math.max(1, Math.ceil((3600000 - elapsedMs) / 60000));

                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                      <td style={{ padding: '1rem', fontWeight: 600, color: '#0f172a' }}>
                        {log.topic}
                      </td>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {formatDate(log.date)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe'
                        }}>
                          {parseFloat(log.score).toFixed(2)} Marks
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          backgroundColor: accBadgeColor,
                          color: accTextColor
                        }}>
                          🎯 {log.accuracy}%
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#475569' }}>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>C: {log.correctCount}</span>
                        <span style={{ color: '#dc2626', fontWeight: 600, marginLeft: '0.5rem' }}>W: {log.incorrectCount}</span>
                        <span style={{ color: '#475569', fontWeight: 500, marginLeft: '0.5rem' }}>U: {log.unattemptedCount}</span>
                      </td>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        ⏱️ {formatTimeSpent(log.timeSpent)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {!isUnlocked ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#d97706', background: '#fef3c7', padding: '0.35rem 0.75rem', borderRadius: '8px', fontWeight: 600, border: '1px solid #fde68a' }}>
                            🔒 Locked ({remainingMins}m left)
                          </span>
                        ) : (
                          <button
                            onClick={() => setSelectedAnswersLog(log)}
                            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.4rem 0.9rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.25)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            👁️ Show Answer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Topic Reference Grid (informational only) */}
      <div className="panel-card">
        <h2 style={{ marginBottom: '1.25rem' }}>Available Practice Sections</h2>
        <div className="topics-grid">
          {topics.map(t => {
            const count = topicCounts[t.name] || 0;
            return (
              <div key={t.name} className="topic-btn" style={{ cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>{t.icon}</span>
                  <div>
                    <div className="topic-name">{t.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', lineHeight: '1.3' }}>{t.desc}</div>
                  </div>
                </div>
                <div className="topic-meta">
                  <span>{count} Questions</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showDetailsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '2.5rem',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e2e8f0',
            animation: 'fadeInUp 0.3s ease-out'
          }}>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              Student Information
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
              Please enter your details before starting the practice test.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              try {
                if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              } catch (fsErr) {
                console.warn("Fullscreen request error:", fsErr);
              }
              setShowDetailsModal(false);
              onStartTest(activeModalTest.topic, activeModalTest.count, activeModalTest.time, detailsForm, activeModalTest.testType, activeModalTest.targetDate);
            }}>
              {/* Year of Study Selection */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Year of Study</label>
                <select
                  value={detailsForm.year}
                  onChange={e => {
                    const newYear = e.target.value;
                    setDetailsForm(p => ({
                      ...p,
                      year: newYear,
                      name: '',
                      registerNumber: ''
                    }));
                    setIsManualEntry(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.8rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    outline: 'none',
                    background: 'white',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year (Final Year)</option>
                </select>
              </div>

              {/* Student Name / RegNo Dropdown */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Select Your Profile</label>
                <select
                  value={isManualEntry ? 'manual' : detailsForm.registerNumber}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'manual') {
                      setIsManualEntry(true);
                      setDetailsForm(p => ({ ...p, name: '', registerNumber: '' }));
                    } else if (val === '') {
                      setIsManualEntry(false);
                      setDetailsForm(p => ({ ...p, name: '', registerNumber: '' }));
                    } else {
                      setIsManualEntry(false);
                      const studentList = studentsData[detailsForm.year] || [];
                      const match = studentList.find(s => s.regNo === val);
                      if (match) {
                        setDetailsForm(p => ({ ...p, name: match.name, registerNumber: match.regNo }));
                      }
                    }
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '0.8rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    outline: 'none',
                    background: 'white',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">-- Choose Name & Register Number --</option>
                  {(studentsData[detailsForm.year] || []).map(s => (
                    <option key={s.regNo} value={s.regNo}>
                      {s.regNo} - {s.name}
                    </option>
                  ))}
                  <option value="manual">✍️ Enter Details Manually</option>
                </select>
              </div>

              {/* Student Name Display/Input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Student Name</label>
                <input
                  type="text"
                  required
                  readOnly={!isManualEntry}
                  disabled={!isManualEntry}
                  value={detailsForm.name}
                  onChange={e => setDetailsForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={isManualEntry ? "Enter your full name" : "Auto-filled from profile"}
                  style={{
                    width: '100%',
                    padding: '0.8rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: !isManualEntry ? '#f1f5f9' : 'white',
                    color: !isManualEntry ? '#475569' : '#0f172a'
                  }}
                />
              </div>

              {/* Register Number Display/Input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Register Number</label>
                <input
                  type="text"
                  required
                  readOnly={!isManualEntry}
                  disabled={!isManualEntry}
                  value={detailsForm.registerNumber}
                  onChange={e => setDetailsForm(p => ({ ...p, registerNumber: e.target.value }))}
                  placeholder={isManualEntry ? "Enter your 12-digit register number" : "Auto-filled from profile"}
                  style={{
                    width: '100%',
                    padding: '0.8rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: !isManualEntry ? '#f1f5f9' : 'white',
                    color: !isManualEntry ? '#475569' : '#0f172a'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Department</label>
                <input
                  type="text"
                  required
                  value={detailsForm.department}
                  onChange={e => setDetailsForm(p => ({ ...p, department: e.target.value }))}
                  placeholder="e.g. Electrical Engineering"
                  style={{
                    width: '100%',
                    padding: '0.8rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={!detailsForm.name || !detailsForm.registerNumber}
                  onClick={() => {
                    if (onSaveProfile) {
                      onSaveProfile(detailsForm);
                      alert("Profile details saved! Your practice history and charts will now load.");
                    }
                    setShowDetailsModal(false);
                  }}
                  style={{
                    background: (!detailsForm.name || !detailsForm.registerNumber) ? '#f1f5f9' : '#e0f2fe',
                    color: (!detailsForm.name || !detailsForm.registerNumber) ? '#94a3b8' : '#0369a1',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.75rem 1.25rem',
                    fontWeight: 600,
                    cursor: (!detailsForm.name || !detailsForm.registerNumber) ? 'not-allowed' : 'pointer',
                    marginRight: 'auto'
                  }}
                >
                  Save Profile Only 💾
                </button>
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(false)}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.75rem 1.5rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.75rem 1.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.2)'
                  }}
                >
                  Start Exam 🚀
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Show Answer Key Modal */}
      {selectedAnswersLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1.5rem 2rem', background: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', fontWeight: 800 }}>
                  👁️ Answer Key & Solution Review
                </h2>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  {selectedAnswersLog.topic} • Attended on {formatDate(selectedAnswersLog.date)} • Score: {selectedAnswersLog.score} Marks
                </div>
              </div>
              <button
                onClick={() => setSelectedAnswersLog(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: '1.4rem', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', flex: 1 }}>
              {(() => {
                const logReview = selectedAnswersLog.reviewDetails || [];
                const logTargetDate = selectedAnswersLog.testDate || (selectedAnswersLog.date ? new Date(selectedAnswersLog.date).toISOString().split('T')[0] : '');
                
                let displayQuestions = [];
                if (logReview.length > 0) {
                  displayQuestions = logReview;
                } else {
                  displayQuestions = questionsList.filter(q => {
                    if (q.target_date && logTargetDate) return q.target_date === logTargetDate;
                    return q.section === selectedAnswersLog.topic;
                  });
                }

                if (displayQuestions.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      Questions for this test attempt are no longer available in memory.
                    </div>
                  );
                }

                return displayQuestions.map((q, idx) => {
                  const studentAns = q.userAnswer || '';
                  const correctAns = q.correct_answer || q.correctAnswer || '';
                  const isCorrect = q.isCorrect === 'correct' || (studentAns && studentAns === correctAns);
                  const isUnattempted = !studentAns || q.isCorrect === 'unattempted';

                  return (
                    <div key={q.id || idx} style={{ marginBottom: '1.5rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '0.95rem' }}>
                          Question #{idx + 1} ({q.section || 'General'})
                        </span>
                        <span style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          background: isCorrect ? '#dcfce7' : isUnattempted ? '#f1f5f9' : '#fee2e2',
                          color: isCorrect ? '#15803d' : isUnattempted ? '#64748b' : '#b91c1c'
                        }}>
                          {isCorrect ? '✓ Correct' : isUnattempted ? '⚪ Unattempted' : '✗ Incorrect'}
                        </span>
                      </div>

                      {q.question_text && (
                        <div style={{ fontSize: '0.925rem', color: '#0f172a', lineHeight: 1.5, marginBottom: '0.75rem', fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                          {q.question_text}
                        </div>
                      )}

                      {q.question_image && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <img src={q.question_image} alt={`Q${idx + 1}`} style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                        </div>
                      )}

                      {/* Options list if MCQ */}
                      {q.custom_options && q.custom_options.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          {['A', 'B', 'C', 'D'].map((optKey, oIdx) => {
                            const optVal = q.custom_options[oIdx];
                            const isCorrectOpt = correctAns === optKey;
                            const isUserChoice = studentAns === optKey;

                            let bg = '#ffffff';
                            let border = '1px solid #cbd5e1';
                            let textColor = '#334155';

                            if (isCorrectOpt) {
                              bg = '#dcfce7';
                              border = '2px solid #10b981';
                              textColor = '#15803d';
                            } else if (isUserChoice && !isCorrectOpt) {
                              bg = '#fee2e2';
                              border = '2px solid #ef4444';
                              textColor = '#991b1b';
                            }

                            return (
                              <div key={optKey} style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: bg, border: border, fontSize: '0.85rem', fontWeight: (isCorrectOpt || isUserChoice) ? 700 : 500, color: textColor }}>
                                <strong>({optKey})</strong> {optVal && optVal.startsWith('data:image') ? <img src={optVal} alt={optKey} style={{ maxHeight: '40px', verticalAlign: 'middle' }} /> : optVal}
                                {isUserChoice && <span style={{ marginLeft: '0.4rem', color: isCorrectOpt ? '#15803d' : '#991b1b', fontWeight: 800 }}>(✏️ Your Answer)</span>}
                                {isCorrectOpt && !isUserChoice && <span style={{ marginLeft: '0.4rem', color: '#15803d', fontWeight: 800 }}>(✓ Correct Key)</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Answers comparison row */}
                      <div style={{ display: 'flex', gap: '1.25rem', background: '#eff6ff', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div>
                          Your Attended Answer:{' '}
                          <strong style={{
                            color: isCorrect ? '#16a34a' : isUnattempted ? '#64748b' : '#dc2626',
                            background: isCorrect ? '#dcfce7' : isUnattempted ? '#f1f5f9' : '#fee2e2',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px'
                          }}>
                            {studentAns ? studentAns : 'Not Attempted'}
                          </strong>
                        </div>
                        <div>
                          Correct Key:{' '}
                          <strong style={{ color: '#16a34a', background: '#dcfce7', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                            {correctAns ? correctAns : 'N/A'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div style={{ padding: '1rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedAnswersLog(null)}
                style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.5rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
