import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get, child, set, push, onValue } from 'firebase/database';
import { auth, db, signOut, ADMIN_EMAIL, handleRedirectResult } from './firebase';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import CBTConsole from './components/CBTConsole';
import Summary from './components/Summary';
import AdminConsole from './components/AdminConsole';

const getLocalDateStr = (d = new Date()) => {
  const offset = d.getTimezoneOffset();
  const adjusted = new Date(d.getTime() - (offset * 60 * 1000));
  return adjusted.toISOString().split('T')[0];
};

const getYesterdayDateStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateStr(d);
};

export default function App() {
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = not logged in
  const [userRole, setUserRole] = useState(null); // 'ADMIN' | 'STUDENT'
  const [currentScreen, setCurrentScreen] = useState('DASHBOARD');
  const [questionsList, setQuestionsList] = useState(() => {
    try {
      const saved = localStorage.getItem('gate_cbt_custom_questions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [answersDb, setAnswersDb] = useState(() => {
    try {
      const saved = localStorage.getItem('gate_cbt_custom_answers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return {};
  });
  const [testConfig, setTestConfig] = useState({
    selectedTopic: 'Full Syllabus',
    numQuestions: 20,
    timeLimit: 30,
    testType: 'TODAY',
    targetDate: getLocalDateStr()
  });
  const [studentDetails, setStudentDetails] = useState({
    name: '',
    department: '',
    year: '',
    registerNumber: ''
  });
  const [testResult, setTestResult] = useState(null);
  const [dbLoading, setDbLoading] = useState(() => {
    try {
      const saved = localStorage.getItem('gate_cbt_custom_questions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch (e) {}
    return true;
  });
  const [dbError, setDbError] = useState(null);
  const [adminConfig, setAdminConfig] = useState(null);

  // Auto-clean custom questions older than yesterday (2-day retention lifecycle)
  useEffect(() => {
    const cleanExpiredQuestions = async () => {
      const yesterdayStr = getYesterdayDateStr();
      const expiredQuestions = questionsList.filter(q => {
        if (!q.id || !q.id.startsWith('custom_')) return false;
        if (q.target_date) {
          return q.target_date < yesterdayStr;
        }
        const tsStr = q.id.split('_')[1];
        const ts = parseInt(tsStr, 10);
        if (!isNaN(ts)) {
          const qDate = getLocalDateStr(new Date(ts));
          return qDate < yesterdayStr;
        }
        return false;
      });

      if (expiredQuestions.length > 0) {
        console.log("Automatically purging expired custom questions (older than yesterday):", expiredQuestions.map(q => q.id));
        try {
          for (const q of expiredQuestions) {
            await set(ref(db, `custom_questions/${q.id}`), null);
            await set(ref(db, `custom_answers/${q.id}`), null);
          }
          // Clear locally
          const savedQ = localStorage.getItem('gate_cbt_custom_questions');
          if (savedQ) {
            const allQ = JSON.parse(savedQ).filter(q => !expiredQuestions.some(eq => eq.id === q.id));
            localStorage.setItem('gate_cbt_custom_questions', JSON.stringify(allQ));
          }
          const savedA = localStorage.getItem('gate_cbt_custom_answers');
          if (savedA) {
            const allA = JSON.parse(savedA);
            expiredQuestions.forEach(q => delete allA[q.id]);
            localStorage.setItem('gate_cbt_custom_answers', JSON.stringify(allA));
          }
          setQuestionsList(prev => prev.filter(q => !expiredQuestions.some(eq => eq.id === q.id)));
        } catch (err) {
          console.warn("Failed to auto-clean expired questions:", err);
        }
      }
    };
    if (questionsList.length > 0) {
      cleanExpiredQuestions();
    }
  }, [questionsList]);

  // Handle Google redirect result (fallback when popup was blocked)
  useEffect(() => {
    handleRedirectResult().catch(console.error);
  }, []);

  // --- Auth Listener: Always use real Firebase auth (remove old fake local sessions) ---
  useEffect(() => {
    // Auto-clear any OLD fake local user (uid starts with 'local_') — they can't write to Firebase
    const localUserJson = localStorage.getItem('gate_cbt_local_user');
    if (localUserJson) {
      try {
        const user = JSON.parse(localUserJson);
        if (!user.uid || user.uid.startsWith('local_') || user.uid.startsWith('local_std_')) {
          // Fake user — remove it and force real Firebase login
          localStorage.removeItem('gate_cbt_local_user');
          localStorage.removeItem('gate_cbt_student_logs');
          localStorage.removeItem('gate_cbt_active_uid');
          console.log('Cleared old fake local user session, requiring real Firebase login');
        }
      } catch (e) {
        localStorage.removeItem('gate_cbt_local_user');
      }
    }

    // Always use Firebase onAuthStateChanged as the single source of truth
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Clear old session logs if the user changed
        const prevUid = localStorage.getItem('gate_cbt_active_uid');
        if (prevUid && prevUid !== user.uid) {
          localStorage.removeItem('gate_cbt_student_logs');
        }
        localStorage.setItem('gate_cbt_active_uid', user.uid);
        const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        setUserRole(isAdmin ? 'ADMIN' : 'STUDENT');
      } else {
        setUserRole(null);
      }
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  // --- Load exam databases in real-time (non-blocking instant cache + background sync) ---
  useEffect(() => {
    // Quick safety timer (max 800ms) to ensure dbLoading is cleared
    const safetyTimer = setTimeout(() => {
      setDbLoading(false);
    }, 800);
    let customMap = {};
    let dailyMap = {};
    let qbMap = {};

    const combineAndSetQuestions = () => {
      const combinedMap = new Map();

      const addQuestion = (q, dateOverride) => {
        if (!q) return;
        const targetDate = q.target_date || dateOverride || '';
        const idKey = q.id || `q_${Date.now()}`;
        const mapKey = targetDate ? `${idKey}_${targetDate}` : idKey;

        const existing = combinedMap.get(mapKey) || {};
        combinedMap.set(mapKey, {
          ...existing,
          ...q,
          target_date: targetDate || existing.target_date || ''
        });
      };

      // 1. Add questions from custom_questions
      Object.values(customMap).forEach(q => {
        if (q) addQuestion(q, q.target_date);
      });

      // 2. Add questions from daily_questions (grouped by date)
      Object.entries(dailyMap).forEach(([dateStr, dateGroup]) => {
        if (dateGroup && typeof dateGroup === 'object') {
          Object.values(dateGroup).forEach(q => {
            if (q) addQuestion(q, dateStr);
          });
        }
      });

      // 3. Add questions from question_bank (grouped by section)
      Object.entries(qbMap).forEach(([sectionStr, secGroup]) => {
        if (secGroup && typeof secGroup === 'object') {
          Object.values(secGroup).forEach(q => {
            if (q) addQuestion(q, q.target_date);
          });
        }
      });

      const finalQuestions = Array.from(combinedMap.values());
      if (finalQuestions.length > 0) {
        try {
          localStorage.setItem('gate_cbt_custom_questions', JSON.stringify(finalQuestions));
        } catch (e) {}
        setQuestionsList(finalQuestions);
      } else {
        const customQJson = localStorage.getItem('gate_cbt_custom_questions');
        if (customQJson) setQuestionsList(JSON.parse(customQJson));
      }
      setDbLoading(false);
    };

    const qRef = ref(db, 'custom_questions');
    const dqRef = ref(db, 'daily_questions');
    const qbRef = ref(db, 'question_bank');
    const aRef = ref(db, 'custom_answers');

    const unsubQ = onValue(qRef, (snapshot) => {
      const val = snapshot.val();
      customMap = (val && typeof val === 'object') ? val : {};
      combineAndSetQuestions();
    }, (err) => {
      console.warn("Realtime DB questions subscription failed, loading from local:", err);
      combineAndSetQuestions();
    });

    const unsubDQ = onValue(dqRef, (snapshot) => {
      const val = snapshot.val();
      dailyMap = (val && typeof val === 'object') ? val : {};
      combineAndSetQuestions();
    }, (err) => {
      console.warn("Realtime DB daily_questions subscription failed:", err);
    });

    const unsubQB = onValue(qbRef, (snapshot) => {
      const val = snapshot.val();
      qbMap = (val && typeof val === 'object') ? val : {};
      combineAndSetQuestions();
    }, (err) => {
      console.warn("Realtime DB question_bank subscription failed:", err);
    });

    const unsubA = onValue(aRef, (snapshot) => {
      let answers = {};
      const val = snapshot.val();
      if (val) {
        answers = val;
      } else {
        const customAJson = localStorage.getItem('gate_cbt_custom_answers');
        if (customAJson) answers = JSON.parse(customAJson);
      }
      setAnswersDb(answers);
    }, (err) => {
      console.warn("Realtime DB answers subscription failed, loading from local:", err);
      const customAJson = localStorage.getItem('gate_cbt_custom_answers');
      if (customAJson) setAnswersDb(JSON.parse(customAJson));
    });

    return () => {
      unsubQ();
      unsubDQ();
      unsubQB();
      unsubA();
      clearTimeout(safetyTimer);
    };
  }, []);

  // --- Sync admin config in real-time (with local fallback) ---
  useEffect(() => {
    const configRef = ref(db, 'exam_config');
    const unsubscribe = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAdminConfig(data);
      } else {
        const saved = localStorage.getItem('gate_cbt_admin_exam_config');
        if (saved) setAdminConfig(JSON.parse(saved));
      }
    }, (error) => {
      console.warn("Firebase config subscription failed, loading from local:", error);
      const saved = localStorage.getItem('gate_cbt_admin_exam_config');
      if (saved) setAdminConfig(JSON.parse(saved));
    });
    return () => unsubscribe();
  }, []);

  // Sync student details/profile in real-time
  useEffect(() => {
    if (authUser?.uid) {
      const profileRef = ref(db, `student_profiles/${authUser.uid}`);
      const unsubscribe = onValue(profileRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          setStudentDetails(val);
        }
      });
      return () => unsubscribe();
    }
  }, [authUser]);

  const handleStartTest = (topic, count, time, details, testType = 'TODAY', targetDate = getLocalDateStr()) => {
    setTestConfig({ selectedTopic: topic, numQuestions: count, timeLimit: time, testType, targetDate });
    if (details) {
      setStudentDetails(details);
      if (authUser?.uid) {
        try {
          set(ref(db, `student_profiles/${authUser.uid}`), details);
        } catch (err) {
          console.error("Failed to save student profile details:", err);
        }
      }
    }
    setCurrentScreen('TEST');
  };

  const handleSaveProfile = (details) => {
    if (details) {
      setStudentDetails(details);
      if (authUser?.uid) {
        try {
          set(ref(db, `student_profiles/${authUser.uid}`), details);
        } catch (err) {
          console.error("Failed to save student profile details:", err);
        }
      }
    }
  };

  const handleFinishTest = (results) => {
    try {
      setTestResult(results);

      const sDetails = studentDetails || {};
      const tConfig = testConfig || {};
      const savedLogs = localStorage.getItem('gate_cbt_student_logs');
      const logs = savedLogs ? JSON.parse(savedLogs) : [];
      const displayName = sDetails.name || authUser?.displayName || authUser?.email || 'Student';

      // Compile stats per Bloom's Level
      const levelStats = (results && results.reviewDetails) ? results.reviewDetails.reduce((acc, q) => {
        let lvl = q.level || q.blooms_level || 'L1';
        if (typeof lvl === 'string') {
          if (lvl.startsWith('L1') || lvl.toLowerCase().includes('remember')) lvl = 'L1';
          else if (lvl.startsWith('L2') || lvl.toLowerCase().includes('understand')) lvl = 'L2';
          else if (lvl.startsWith('L3') || lvl.toLowerCase().includes('apply')) lvl = 'L3';
          else if (lvl.startsWith('L4') || lvl.toLowerCase().includes('analyze')) lvl = 'L4';
          else if (lvl.startsWith('L5') || lvl.toLowerCase().includes('evaluate')) lvl = 'L5';
          else if (lvl.startsWith('L6') || lvl.toLowerCase().includes('create')) lvl = 'L6';
          else lvl = 'L3';
        } else {
          lvl = 'L3';
        }

        if (!acc[lvl]) {
          acc[lvl] = { correct: 0, incorrect: 0, unattempted: 0, total: 0 };
        }
        acc[lvl].total++;
        if (q.isCorrect === 'correct' || q.isCorrect === true) {
          acc[lvl].correct++;
        } else if (q.isCorrect === 'incorrect' || q.isCorrect === false) {
          acc[lvl].incorrect++;
        } else {
          acc[lvl].unattempted++;
        }
        return acc;
      }, {}) : {};

      const calcTotalMarks = (results && results.totalMarks) || (results && results.reviewDetails ? results.reviewDetails.reduce((sum, q) => sum + (parseInt(q.marks) || 1), 0) : (results ? results.totalQuestions : 1));

      const currentUid = authUser?.uid || auth.currentUser?.uid || null;

      const newLog = {
        id: `log_${Date.now()}`,
        uid: currentUid,
        studentName: displayName,
        department: sDetails.department || 'General',
        year: sDetails.year || 'N/A',
        registerNumber: sDetails.registerNumber || 'N-A',
        avatarSeed: String(displayName).split(' ')[0],
        studentPhoto: authUser?.photoURL || null,
        date: new Date().toISOString(),
        testType: tConfig.testType || 'TODAY',
        testDate: tConfig.targetDate || getLocalDateStr(),
        topic: tConfig.selectedTopic || 'GATE Practice',
        score: results ? results.score : 0,
        totalMarks: calcTotalMarks,
        totalQuestions: results ? results.totalQuestions : 0,
        correctCount: results ? results.correctCount : 0,
        incorrectCount: results ? results.incorrectCount : 0,
        unattemptedCount: results ? results.unattemptedCount : 0,
        accuracy: Math.round(((results ? results.correctCount : 0) / Math.max(results ? results.totalQuestions : 1, 1)) * 100),
        timeSpent: results ? results.timeSpent : 0,
        levelStats: levelStats,
        reviewDetails: results ? results.reviewDetails : []
      };

      const filteredLogs = logs.filter(l => l && l.id !== newLog.id);
      filteredLogs.unshift(newLog);
      // Store logs keyed per-user in localStorage
      localStorage.setItem('gate_cbt_student_logs', JSON.stringify(filteredLogs));

      // Notify Dashboard instantly
      window.dispatchEvent(new CustomEvent('gate_cbt_log_updated', { detail: newLog }));

      // Save attempt to Firebase Realtime DB
      try {
        if (db && currentUid) {
          const dateObj = new Date(newLog.date);
          const offset = dateObj.getTimezoneOffset();
          const adjusted = new Date(dateObj.getTime() - (offset * 60 * 1000));
          const dateStr = adjusted.toISOString().split('T')[0];

          // Sanitize payload: strip any undefined fields (Firebase set rejects objects with undefined properties)
          const firebasePayload = JSON.parse(JSON.stringify(newLog));

          // Determine exact student year from sDetails, studentDetails, or students.json fallback
          let year = sDetails.year || studentDetails?.year;
          if (!year || year === 'N/A') {
            const regNoOrName = sDetails.registerNumber || sDetails.name;
            if (regNoOrName) {
              const matchedStudent = Object.values(studentsData).flat().find(s => 
                (s.regNo && String(s.regNo) === String(regNoOrName)) ||
                (s.name && String(s.name).toLowerCase() === String(regNoOrName).toLowerCase())
              );
              if (matchedStudent && matchedStudent.year) {
                year = matchedStudent.year;
              }
            }
          }
          if (!year || year === 'N/A') year = '3rd Year';

          const sanitizedYear = String(year).trim().replace(/[.#$[\]/]/g, '_');

          // PRIMARY: Save under user_logs/${sanitizedYear}/${uid}/${logId} — year-wise per-user isolated path
          const userLogRef = ref(db, `user_logs/${sanitizedYear}/${currentUid}/${newLog.id}`);
          set(userLogRef, firebasePayload).catch(err => console.warn("Firebase user_logs set failed:", err));

          // SECONDARY: Save to admin view path for admin dashboard
          const rawRegNo = sDetails.registerNumber || sDetails.name || 'N-A';
          const regNo = String(rawRegNo).replace(/[.#$[\]/]/g, '_');
          const adminLogRef = ref(db, `student_logs/${year}/${dateStr}/${regNo}`);
          set(adminLogRef, firebasePayload).catch(err => console.warn("Firebase admin log failed:", err));
        }
      } catch (firebaseErr) {
        console.error("Failed to save student attempt log to Firebase:", firebaseErr);
      }

      // Update stats
      try {
        const savedStats = localStorage.getItem('gate_cbt_stats');
        const stats = savedStats ? JSON.parse(savedStats) : { streak: 1, totalSolved: 0, accuracy: 0, coverage: 0 };
        const updatedStats = {
          streak: (stats.streak || 1) + 1,
          totalSolved: (stats.totalSolved || 0) + (results ? results.correctCount : 0),
          accuracy: (stats.totalSolved || 0) > 0
            ? Math.round(((stats.accuracy || 0) * 3 + newLog.accuracy) / 4)
            : newLog.accuracy,
          coverage: Math.min(100, (stats.coverage || 0) + Math.round(((results ? results.totalQuestions : 0) / Math.max(questionsList.length, 1)) * 100))
        };
        localStorage.setItem('gate_cbt_stats', JSON.stringify(updatedStats));
      } catch (statsErr) {
        console.warn("Stats update failed:", statsErr);
      }
    } catch (err) {
      console.error("Error in handleFinishTest:", err);
    } finally {
      setCurrentScreen('SUMMARY');
    }
  };

  const handleBackToDashboard = () => {
    setTestResult(null);
    setCurrentScreen('DASHBOARD');
  };

  const handleLogout = async () => {
    await signOut();
    localStorage.removeItem('gate_cbt_local_user');
    setAuthUser(null);
    setUserRole(null);
    setCurrentScreen('DASHBOARD');
  };

  // === LOADING STATES ===
  if (authUser === undefined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen onLoginSuccess={(user, role) => {
      setAuthUser(user);
      setUserRole(role);
    }} />;
  }

  if (dbLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '1rem' }} />
        <p style={{ color: '#94a3b8' }}>Loading GATE EE question database...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (dbError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#0f172a', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ color: '#ef4444' }}>⚠️ Configuration Error</h1>
        <p style={{ color: '#475569' }}>{dbError}</p>
        <button onClick={handleLogout} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Logout</button>
      </div>
    );
  }

  const handleClearAllQuestions = async () => {
    const confirmClear = window.confirm("Are you sure you want to delete all uploaded questions? This will wipe the pool for students!");
    if (!confirmClear) return;
    try {
      // Clear in Firebase Realtime DB
      await set(ref(db, 'custom_questions'), null);
      await set(ref(db, 'custom_answers'), null);
      // Clear locally
      localStorage.removeItem('gate_cbt_custom_questions');
      localStorage.removeItem('gate_cbt_custom_answers');
      // Reset state
      setQuestionsList([]);
      setAnswersDb({});
      alert("All uploaded custom questions and answers have been successfully cleared!");
    } catch (err) {
      console.error("Failed to clear questions:", err);
      alert("Failed to clear questions from Firebase. Check your database rules/permissions.");
    }
  };

  // === ADMIN CONSOLE ===
  if (userRole === 'ADMIN') {
    return (
      <AdminConsole
        questionsList={questionsList}
        onLogout={handleLogout}
        authUser={authUser}
        onClearAllQuestions={handleClearAllQuestions}
      />
    );
  }

  // === STUDENT SCREENS ===
  return (
    <>
      {/* Dashboard is always mounted so its Firebase listener stays live and data appears instantly */}
      <div style={{ display: currentScreen === 'DASHBOARD' ? 'block' : 'none' }}>
        <Dashboard
          questionsList={questionsList}
          onStartTest={handleStartTest}
          adminConfig={adminConfig}
          authUser={authUser}
          onLogout={handleLogout}
          studentDetails={studentDetails}
          onSaveProfile={handleSaveProfile}
        />
      </div>
      {currentScreen === 'TEST' && (
        <CBTConsole
          selectedTopic={testConfig.selectedTopic}
          numQuestions={testConfig.numQuestions}
          timeLimit={testConfig.timeLimit}
          testType={testConfig.testType}
          targetDate={testConfig.targetDate}
          studentYear={studentDetails.year || '3rd Year'}
          questionsList={questionsList}
          answersDb={answersDb}
          onFinish={handleFinishTest}
        />
      )}
      {currentScreen === 'SUMMARY' && (
        <Summary
          result={testResult}
          onBackToDashboard={handleBackToDashboard}
        />
      )}
    </>
  );
}
