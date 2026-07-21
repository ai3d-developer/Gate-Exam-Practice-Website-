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
  const isOutsidePracticeHours = currentHour < 9 || currentHour >= 19;

  useEffect(() => {
    const regNo = studentDetails?.registerNumber || '';
    
    // If no register number is set (profile incomplete), show empty history by default
    if (!regNo) {
      setStudentLogs([]);
      setLoadingLogs(false);
      return;
    }

    const logsRef = ref(db, 'student_logs');
    setLoadingLogs(true);
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      let filteredLogs = [];
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

        filteredLogs = allLogs.filter(log => {
          return log.registerNumber && log.registerNumber.toString().trim() === regNo.toString().trim();
        });
      } else {
        const raw = localStorage.getItem('gate_cbt_student_logs');
        if (raw) {
          const localLogs = JSON.parse(raw);
          filteredLogs = localLogs.filter(log => {
            return log.registerNumber && log.registerNumber.toString().trim() === regNo.toString().trim();
          });
        }
      }
      filteredLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setStudentLogs(filteredLogs);
      setLoadingLogs(false);
    }, (error) => {
      console.warn("Firebase student logs fetch failed, loading from local:", error);
      const raw = localStorage.getItem('gate_cbt_student_logs');
      let filteredLogs = [];
      if (raw) {
        const localLogs = JSON.parse(raw);
        filteredLogs = localLogs.filter(log => {
          return log.registerNumber && log.registerNumber.toString().trim() === regNo.toString().trim();
        });
        filteredLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
      }
      setStudentLogs(filteredLogs);
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
    if (log.levelStats) {
      Object.keys(log.levelStats).forEach(lvl => {
        if (levelAggregates[lvl]) {
          levelAggregates[lvl].correct += log.levelStats[lvl].correct || 0;
          levelAggregates[lvl].incorrect += log.levelStats[lvl].incorrect || 0;
          levelAggregates[lvl].total += log.levelStats[lvl].total || 0;
        }
      });
    } else {
      // Fallback: estimate/distribute counts across levels based on typical GATE EE distribution
      let rc = log.correctCount || 0;
      let ric = log.incorrectCount || 0;
      
      const distribute = (count, key) => {
        let temp = count;
        // L3 (45%)
        const l3Amt = Math.min(temp, Math.round(count * 0.45));
        levelAggregates.L3[key] += l3Amt;
        temp -= l3Amt;

        // L2 (20%)
        const l2Amt = Math.min(temp, Math.round(count * 0.20));
        levelAggregates.L2[key] += l2Amt;
        temp -= l2Amt;

        // L1 (15%)
        const l1Amt = Math.min(temp, Math.round(count * 0.15));
        levelAggregates.L1[key] += l1Amt;
        temp -= l1Amt;

        // L4 (15%)
        const l4Amt = Math.min(temp, Math.round(count * 0.15));
        levelAggregates.L4[key] += l4Amt;
        temp -= l4Amt;

        // L5 (5%)
        const l5Amt = Math.min(temp, Math.round(count * 0.05));
        levelAggregates.L5[key] += l5Amt;
        temp -= l5Amt;

        // Leftovers to L3
        if (temp > 0) {
          levelAggregates.L3[key] += temp;
        }
      };

      distribute(rc, 'correct');
      distribute(ric, 'incorrect');
      
      // Compute totals
      Object.keys(levelAggregates).forEach(lvl => {
        levelAggregates[lvl].total = levelAggregates[lvl].correct + levelAggregates[lvl].incorrect;
      });
    }
  });

  // Default exam config if no admin config set
  const effectiveConfig = adminConfig || { selectedTopic: 'Full Syllabus', numQuestions: 20, timeLimit: 30 };

  // Check if student already attended this exam TODAY
  const studentName = authUser?.displayName || authUser?.email || 'Student';
  const activeTopic = effectiveConfig.selectedTopic;
  const hasAttended = studentLogs.some(log => {
    if (log.topic !== activeTopic) return false;
    try {
      const logDate = new Date(log.date).toDateString();
      const todayDate = new Date().toDateString();
      return logDate === todayDate;
    } catch (e) {
      return false;
    }
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

      {/* Daily Test Panel */}
      <div className="panel-card" style={{
        background: adminConfig ? 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)' : '#ffffff',
        border: adminConfig ? '2px solid #3b82f6' : '1px solid #e2e8f0',
        borderRadius: '24px',
        padding: '2rem',
        marginBottom: '2.5rem',
        boxShadow: adminConfig ? '0 8px 30px rgba(59,130,246,0.1)' : 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <span style={{
            background: adminConfig ? '#3b82f6' : '#94a3b8',
            color: 'white',
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}>
            {adminConfig ? '📌 Admin Assigned Test' : '📝 Default Practice'}
          </span>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: '0.75rem', marginBottom: '0.4rem' }}>
            {effectiveConfig.selectedTopic}
          </h2>
          <div style={{ display: 'flex', gap: '1.5rem', color: '#475569', fontSize: '0.9rem', fontWeight: 500 }}>
            <span>📋 <strong>{effectiveConfig.numQuestions}</strong> Questions</span>
            <span>⏱️ <strong>{effectiveConfig.timeLimit}</strong> Minutes</span>
          </div>
          {!adminConfig && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              No exam assigned by admin yet. Using default settings.
            </p>
          )}
          {hasAttended && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>
              ⚠️ You have already completed this test (1 attempt limit).
            </p>
          )}
          {isOutsidePracticeHours && !hasAttended && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#f59e0b', fontWeight: 600 }}>
              🕒 Daily practice exam is closed. Active hours are 9:00 AM to 7:00 PM.
            </p>
          )}
        </div>
        <button
          id="start-exam-btn"
          disabled={hasAttended || isOutsidePracticeHours}
          onClick={() => setShowDetailsModal(true)}
          style={{
            background: (hasAttended || isOutsidePracticeHours) ? '#cbd5e1' : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
            color: (hasAttended || isOutsidePracticeHours) ? '#64748b' : 'white',
            border: 'none',
            borderRadius: '14px',
            padding: '1rem 2.25rem',
            fontWeight: 700,
            fontSize: '1.05rem',
            cursor: (hasAttended || isOutsidePracticeHours) ? 'not-allowed' : 'pointer',
            boxShadow: (hasAttended || isOutsidePracticeHours) ? 'none' : '0 4px 20px rgba(59,130,246,0.35)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => { if (!hasAttended && !isOutsidePracticeHours) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(59,130,246,0.45)'; } }}
          onMouseOut={(e) => { if (!hasAttended && !isOutsidePracticeHours) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.35)'; } }}
        >
          {hasAttended ? '🔒 Already Attended' : isOutsidePracticeHours ? '🕒 Exam Closed' : '🚀 Start Daily Practice'}
        </button>
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
                </tr>
              </thead>
              <tbody>
                {studentLogs.map((log) => {
                  const isHighAcc = log.accuracy >= 75;
                  const isMedAcc = log.accuracy >= 45 && log.accuracy < 75;
                  const accBadgeColor = isHighAcc ? '#d1fae5' : isMedAcc ? '#fef3c7' : '#fee2e2';
                  const accTextColor = isHighAcc ? '#065f46' : isMedAcc ? '#92400e' : '#991b1b';
                  
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
              setShowDetailsModal(false);
              onStartTest(effectiveConfig.selectedTopic, effectiveConfig.numQuestions, effectiveConfig.timeLimit, detailsForm);
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
    </div>
  );
}
