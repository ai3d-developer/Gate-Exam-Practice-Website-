import React, { useState, useEffect, useRef } from 'react';
import Calculator from './Calculator';

export default function CBTConsole({
  selectedTopic,
  numQuestions,
  timeLimit,
  testType = 'TODAY',
  targetDate,
  studentYear = '3rd Year',
  questionsList,
  answersDb,
  onFinish
}) {
  const [testQuestions, setTestQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [questionStatuses, setQuestionStatuses] = useState({});
  const [timeLeft, setTimeLeft] = useState(timeLimit * 60);
  const [showCalc, setShowCalc] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [pdfScale, setPdfScale] = useState(1.35);
  const [isCropped, setIsCropped] = useState(true);

  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Initialize test questions
  useEffect(() => {
    const todayDateStr = (() => {
      const local = new Date();
      const offset = local.getTimezoneOffset();
      const adjusted = new Date(local.getTime() - (offset * 60 * 1000));
      return adjusted.toISOString().split('T')[0];
    })();

    const effectiveTargetDate = targetDate || todayDateStr;

    // 1. Check if custom questions exist specifically allotted for the target date and student year
    const targetQuestions = questionsList.filter(q => {
      if (q.target_date && q.target_date !== effectiveTargetDate) return false;
      if (q.target_date === effectiveTargetDate) {
        if (!q.target_years || !Array.isArray(q.target_years) || q.target_years.length === 0) {
          return true; // All years
        }
        return q.target_years.includes(studentYear);
      }
      return false;
    });

    let selected = [];
    if (targetQuestions.length > 0) {
      selected = [...targetQuestions].sort((a, b) => (a.original_num || 0) - (b.original_num || 0));
    } else {
      // Fallback: Filter by selected topic
      let filtered = [];
      if (selectedTopic === 'Full Syllabus') {
        filtered = [...questionsList];
      } else {
        filtered = questionsList.filter(q => q.section === selectedTopic);
      }

      // Deduplicate: normalize question text and keep only unique questions
      const seenTexts = new Set();
      const deduped = [];
      for (const q of filtered) {
        const normText = (q.question_text || '').replace(/\s+/g, '').toLowerCase();
        if (normText.length < 10) continue; // skip very short/empty entries
        if (seenTexts.has(normText)) continue;
        seenTexts.add(normText);
        deduped.push(q);
      }

      // Shuffle and pick requested number of questions
      const shuffled = [...deduped].sort(() => 0.5 - Math.random());
      selected = shuffled.slice(0, Math.min(numQuestions, shuffled.length));

      // If we have fewer questions than requested, fallback to any EE questions to fill the gap
      if (selected.length < numQuestions) {
        const selectedIds = new Set(selected.map(s => s.id));
        const selectedTexts = new Set(selected.map(s => (s.question_text || '').replace(/\s+/g, '').toLowerCase()));
        const extraNeeded = numQuestions - selected.length;
        const extraQuestions = questionsList
          .filter(q => !selectedIds.has(q.id) && !selectedTexts.has((q.question_text || '').replace(/\s+/g, '').toLowerCase()))
          .sort(() => 0.5 - Math.random())
          .slice(0, extraNeeded);
        selected.push(...extraQuestions);
      }
    }

    setTestQuestions(selected);

    // Initialize statuses: first question is "not-answered" (visited), others are "not-visited"
    const initialStatuses = {};
    selected.forEach((q, idx) => {
      initialStatuses[q.id] = idx === 0 ? 'not-answered' : 'not-visited';
    });
    setQuestionStatuses(initialStatuses);
  }, [selectedTopic, numQuestions, targetDate, questionsList]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const isSubmittedRef = useRef(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const submitRef = useRef();
  submitRef.current = handleSubmit;

  // Enforce fullscreen on start, auto-submit on exit or ESC key
  useEffect(() => {
    const enterFs = async () => {
      try {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn("Fullscreen request rejected:", err);
      }
    };
    enterFs();

    const handleFsChange = () => {
      if (!document.fullscreenElement && !isSubmittedRef.current) {
        if (submitRef.current) {
          submitRef.current(true, "Full screen mode exited! Your practice test has been automatically submitted successfully.");
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmittedRef.current) {
        if (submitRef.current) {
          submitRef.current(true, "ESC key pressed! Your practice test has been automatically submitted successfully.");
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Render PDF page whenever question index or scale changes
  const activeQuestion = testQuestions[currentIndex];

  useEffect(() => {
    if (!activeQuestion) return;

    let isMounted = true;
    
    if (activeQuestion.question_image) {
      setPdfLoading(false);
      setPdfError(null);
      return;
    }

    setPdfLoading(true);
    setPdfError(null);

    const renderPdf = async () => {
      try {
        if (!window.pdfjsLib) {
          throw new Error("PDF.js library not loaded yet.");
        }

        // Determine PDF path
        const pdfName = activeQuestion.id.split('_')[0] + '.pdf';
        const pdfUrl = `/EE/${pdfName}`;
        const pageNumber = activeQuestion.page_num;

        // Cancel previous render task if active
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNumber);

        if (!isMounted) return;

        const viewport = page.getViewport({ scale: pdfScale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Render PDF page to a temporary offscreen canvas first
        const hiddenCanvas = document.createElement('canvas');
        hiddenCanvas.width = viewport.width;
        hiddenCanvas.height = viewport.height;
        const hiddenCtx = hiddenCanvas.getContext('2d');

        const renderContext = {
          canvasContext: hiddenCtx,
          viewport: viewport
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;

        if (isMounted) {
          setPdfLoading(false);
          
          try {
            const textContent = await page.getTextContent();
            const qNum = activeQuestion.original_num;
            
            // Reconstruct text lines by grouping items with similar y-coordinates (tolerance of 4pt)
            // and sorting items in each line by x-coordinate
            const lines = [];
            for (const item of textContent.items) {
              const text = item.str || '';
              if (!text.trim()) continue;
              const y = item.transform[5];
              const x = item.transform[4];
              
              let foundLine = lines.find(l => Math.abs(l.y - y) < 4);
              if (foundLine) {
                foundLine.items.push({ text, x });
              } else {
                lines.push({ y, items: [{ text, x }] });
              }
            }
            
            for (const line of lines) {
              line.items.sort((a, b) => a.x - b.x);
              line.text = line.items.map(it => it.text).join(' ');
            }
            
            // Search for active question's y-coordinate (supporting Q., Question Number, and Q.No.)
            let targetY = null;
            const regex = new RegExp(`(?:^|\\s)Q\\s*\\.\\s*${qNum}\\b|(?:^|\\s)Question\\s+Number\\s*:\\s*${qNum}\\b|(?:^|\\s)Q\\s*\\.\\s*No\\s*\\.\\s*${qNum}\\b`, 'i');
            for (const line of lines) {
              if (regex.test(line.text)) {
                targetY = line.y;
                break;
              }
            }
            
            // Find all other question y-coordinates on the same page
            const otherQuestions = [];
            const anyQRegex = /(?:^|\s)Q\s*\.\s*([0-9]+)\b|(?:^|\s)Question\s+Number\s*:\s*([0-9]+)\b|(?:^|\s)Q\s*\.\s*No\s*\.\s*([0-9]+)\b/i;
            for (const line of lines) {
              const match = line.text.match(anyQRegex);
              if (match) {
                const num = parseInt(match[1] || match[2] || match[3], 10);
                if (num !== qNum) {
                  otherQuestions.push({ num, y: line.y });
                }
              }
            }
            
            // The next question physically below the active question on the page
            // will have the highest y-coordinate that is less than targetY (since y=0 is bottom of page)
            let nextTargetY = null;
            if (targetY !== null) {
              const belowQs = otherQuestions.filter(q => q.y < targetY);
              if (belowQs.length > 0) {
                const closestBelow = belowQs.reduce((prev, curr) => (curr.y > prev.y ? curr : prev), belowQs[0]);
                nextTargetY = closestBelow.y;
              }
            }
            
            if (isCropped && targetY !== null && canvasRef.current) {
              const canvas = canvasRef.current;
              const clipper = canvas.parentElement;
              const wrapper = clipper.parentElement;
              
              const viewBoxHeight = page.view[3];
              const yFromTop = (viewBoxHeight - targetY) * pdfScale;
              
              // Calculate height of the question area
              let qHeight = 350; // default height in pixels
              if (nextTargetY !== null) {
                qHeight = (targetY - nextTargetY) * pdfScale + 15;
              } else {
                qHeight = (targetY - 20) * pdfScale;
              }
              
              // Align top of crop 15px above the question text
              const topOffset = Math.max(0, yFromTop - 15);
              
              // Set crop height (without strict 320px cap, allowing up to 750px for the last question)
              const finalHeight = nextTargetY !== null
                ? Math.max(120, qHeight)
                : Math.min(750, Math.max(120, qHeight));
              
              // Configure visible canvas to contain ONLY the cropped image pixels
              canvas.width = hiddenCanvas.width;
              canvas.height = finalHeight;
              
              const ctx = canvas.getContext('2d');
              ctx.drawImage(
                hiddenCanvas,
                0, topOffset, hiddenCanvas.width, finalHeight, // source region
                0, 0, hiddenCanvas.width, finalHeight // destination region
              );
              
              canvas.style.position = 'relative';
              canvas.style.left = '0px';
              canvas.style.transform = 'none';
              canvas.style.top = '0px';
              
              clipper.style.height = 'auto';
              clipper.style.overflow = 'visible';
              
              wrapper.style.height = 'auto';
              wrapper.style.overflowY = 'visible';
            } else if (canvasRef.current) {
              const canvas = canvasRef.current;
              const clipper = canvas.parentElement;
              const wrapper = clipper.parentElement;
              
              // Draw full page
              canvas.width = hiddenCanvas.width;
              canvas.height = hiddenCanvas.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(hiddenCanvas, 0, 0);
              
              canvas.style.position = 'relative';
              canvas.style.left = '0px';
              canvas.style.transform = 'none';
              canvas.style.top = '0px';
              
              clipper.style.height = 'auto';
              clipper.style.overflow = 'visible';
              
              wrapper.style.height = "550px";
              wrapper.style.overflowY = "auto";
            }
          } catch (scrollErr) {
            console.error("Auto-scroll error:", scrollErr);
          }
        }
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("PDF render error:", err);
          if (isMounted) {
            setPdfError("Failed to load PDF diagram page. Please refresh or try another question.");
            setPdfLoading(false);
          }
        }
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [activeQuestion, currentIndex, pdfScale, isCropped]);

  if (testQuestions.length === 0 || !activeQuestion) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#0f172a' }}>
        <h2>Loading exam questions...</h2>
      </div>
    );
  }

  // Timer formatted
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Option selection
  const handleOptionSelect = (option) => {
    const q_id = activeQuestion.id;
    if (activeQuestion.type === 'MCQ') {
      setUserAnswers(prev => ({ ...prev, [q_id]: option }));
    } else if (activeQuestion.type === 'MSQ') {
      const currentAns = userAnswers[q_id] || '';
      const ansArr = currentAns ? currentAns.split(';') : [];
      let newAns;
      if (ansArr.includes(option)) {
        newAns = ansArr.filter(o => o !== option).join(';');
      } else {
        ansArr.push(option);
        newAns = ansArr.sort().join(';');
      }
      setUserAnswers(prev => ({ ...prev, [q_id]: newAns }));
    }
  };

  // Virtual Keypad for NAT
  const handleKeypadPress = (val) => {
    const q_id = activeQuestion.id;
    const current = userAnswers[q_id] || '';
    if (val === 'Backspace') {
      setUserAnswers(prev => ({ ...prev, [q_id]: current.slice(0, -1) }));
    } else if (val === 'Clear') {
      setUserAnswers(prev => ({ ...prev, [q_id]: '' }));
    } else {
      setUserAnswers(prev => ({ ...prev, [q_id]: current + val }));
    }
  };

  // Action: Save & Next
  const handleSaveNext = () => {
    const q_id = activeQuestion.id;
    const answered = !!userAnswers[q_id];

    // Determine status
    let newStatus = 'not-answered';
    if (answered) {
      newStatus = questionStatuses[q_id] === 'marked' || questionStatuses[q_id] === 'marked-answered' ? 'marked-answered' : 'answered';
    } else {
      newStatus = questionStatuses[q_id] === 'marked' ? 'marked' : 'not-answered';
    }

    setQuestionStatuses(prev => ({ ...prev, [q_id]: newStatus }));

    // Move to next index
    if (currentIndex < testQuestions.length - 1) {
      navigateToQuestion(currentIndex + 1);
    }
  };

  // Action: Clear Response
  const handleClearResponse = () => {
    const q_id = activeQuestion.id;
    setUserAnswers(prev => ({ ...prev, [q_id]: '' }));
    
    // Status should be set to not-answered if it is not marked
    let newStatus = 'not-answered';
    if (questionStatuses[q_id] === 'marked' || questionStatuses[q_id] === 'marked-answered') {
      newStatus = 'marked';
    }
    setQuestionStatuses(prev => ({ ...prev, [q_id]: newStatus }));
  };

  // Action: Mark for Review & Next
  const handleMarkReviewNext = () => {
    const q_id = activeQuestion.id;
    const answered = !!userAnswers[q_id];
    const newStatus = answered ? 'marked-answered' : 'marked';

    setQuestionStatuses(prev => ({ ...prev, [q_id]: newStatus }));

    if (currentIndex < testQuestions.length - 1) {
      navigateToQuestion(currentIndex + 1);
    }
  };

  // Navigation
  const navigateToQuestion = (idx) => {
    // Set current question status to "not-answered" if it was "not-visited"
    const nextQ = testQuestions[idx];
    if (questionStatuses[nextQ.id] === 'not-visited') {
      setQuestionStatuses(prev => ({ ...prev, [nextQ.id]: 'not-answered' }));
    }
    setCurrentIndex(idx);
  };

  // Submit test safely
  function handleSubmit(isAutoSubmit = false, reason = '') {
    if (isSubmittedRef.current) return;
    isSubmittedRef.current = true;

    // Exit fullscreen cleanly if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    if (isAutoSubmit && reason) {
      alert(reason);
    } else {
      alert("Exam Submitted Successfully! 🎉");
    }

    // Calculate final scores safely
    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    const reviewDetails = testQuestions.map(q => {
      const uAns = userAnswers[q.id] ? String(userAnswers[q.id]).trim() : '';
      const correctAns = (answersDb && answersDb[q.id]) 
        ? String(answersDb[q.id]).trim() 
        : (q.correct_answer ? String(q.correct_answer).trim() : '');
      let isCorrect = false;

      // Scoring logic matching GATE
      if (uAns === '') {
        unattemptedCount++;
      } else {
        // Evaluate based on type
        if (q.type === 'MCQ') {
          isCorrect = uAns.toUpperCase() === correctAns.toUpperCase();
          if (isCorrect) {
            correctCount++;
            score += (parseInt(q.marks) || 1);
          } else {
            incorrectCount++;
            score -= (q.negative_marks !== undefined ? parseFloat(q.negative_marks) : ((parseInt(q.marks) || 1) / 3.0));
          }
        } else if (q.type === 'MSQ') {
          isCorrect = uAns.toUpperCase() === correctAns.toUpperCase();
          if (isCorrect) {
            correctCount++;
            score += (parseInt(q.marks) || 1);
          } else {
            incorrectCount++;
          }
        } else { // NAT
          const userNum = parseFloat(uAns);
          if (!isNaN(userNum) && correctAns) {
            if (correctAns.includes('to')) {
              const parts = correctAns.split('to');
              const low = parseFloat(parts[0]);
              const high = parseFloat(parts[1]);
              isCorrect = userNum >= low && userNum <= high;
            } else {
              const correctNum = parseFloat(correctAns);
              if (!isNaN(correctNum)) {
                isCorrect = Math.abs(userNum - correctNum) < 0.05;
              }
            }
          }
          if (isCorrect) {
            correctCount++;
            score += (parseInt(q.marks) || 1);
          } else {
            incorrectCount++;
          }
        }
      }

      return {
        ...q,
        userAnswer: uAns,
        correctAnswer: correctAns,
        isCorrect: uAns === '' ? 'unattempted' : isCorrect ? 'correct' : 'incorrect'
      };
    });

    const totalMarks = testQuestions.reduce((sum, q) => sum + (parseInt(q.marks) || 1), 0);

    onFinish({
      score: Number(score.toFixed(2)),
      totalMarks,
      totalQuestions: testQuestions.length,
      correctCount,
      incorrectCount,
      unattemptedCount,
      timeSpent: (timeLimit * 60) - timeLeft,
      reviewDetails
    });
  }

  // Status summaries counting
  const statuses = Object.values(questionStatuses);
  const countAnswered = statuses.filter(s => s === 'answered').length;
  const countNotAnswered = statuses.filter(s => s === 'not-answered').length;
  const countMarked = statuses.filter(s => s === 'marked').length;
  const countMarkedAnswered = statuses.filter(s => s === 'marked-answered').length;
  const countNotVisited = statuses.filter(s => s === 'not-visited').length;

  return (
    <div className="cbt-container">
      {/* Header bar */}
      <div className="cbt-header">
        <div className="cbt-header-title">
          <span style={{ background: '#eea236', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>EE</span>
          <span>GATE Practice Portal — {testType === 'YESTERDAY' ? "Yesterday's Test" : "Today's Test"} {targetDate ? `(${targetDate})` : ''} — {selectedTopic}</span>
        </div>
        <div className="cbt-header-controls">
          <button className="cbt-btn-calc" onClick={() => setShowCalc(!showCalc)}>Scientific Calculator</button>
        </div>
      </div>

      {/* Main split layout */}
      <div className="cbt-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Pane: Question Image (Fixed, no zoom, fully visible, no scrollbar) */}
        <div className="cbt-image-pane" style={{ flex: '1.2', borderRight: '1px solid #cbd5e1', background: 'white', padding: '1.25rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ background: '#3b82f6', color: 'white', padding: '0.4rem 1rem', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}>
            {activeQuestion?.original_num <= 10 ? 'General Aptitude' : 'Electrical Engineering'}
          </div>
          <div style={{ padding: '0.5rem 1rem', background: '#fafafa', borderBottom: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
            Type: {activeQuestion?.type} | Marks: {activeQuestion?.marks} (+{activeQuestion?.marks}, -{activeQuestion?.negative_marks !== undefined ? activeQuestion.negative_marks : (activeQuestion?.type === 'MCQ' ? (activeQuestion.marks / 3).toFixed(2) : '0')})
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px', border: '1px solid #e2e8f0', borderTop: 'none', padding: '1.25rem', overflow: 'auto', minHeight: 0 }}>
            {activeQuestion && activeQuestion.question_text && (
              <div style={{ fontSize: '1.05rem', lineHeight: '1.6', color: '#1e293b', fontWeight: 500, marginBottom: activeQuestion.question_image ? '1rem' : 0, width: '100%', whiteSpace: 'pre-wrap' }}>
                {activeQuestion.question_text.replace(/Session - \d+/gi, '').replace(/^Q\.\s*\d+\s*/i, '').trim()}
              </div>
            )}
            {activeQuestion && activeQuestion.question_image && (
              <img
                src={activeQuestion.question_image}
                alt="Question Diagram"
                style={{
                  maxWidth: '100%',
                  maxHeight: activeQuestion.question_text ? '280px' : '100%',
                  objectFit: 'contain',
                  borderRadius: '8px'
                }}
              />
            )}
            {!activeQuestion?.question_image && !activeQuestion?.question_text && (
              <div className="pdf-canvas-clipper" style={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
                <canvas ref={canvasRef} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }} />
              </div>
            )}
          </div>
        </div>

        {/* Middle Pane: Options and Control Buttons */}
        <div className="cbt-options-pane" style={{ flex: '1', display: 'flex', flexDirection: 'column', borderRight: '1px solid #cbd5e1', background: '#f8fafc', padding: '1.25rem', overflowY: 'auto' }}>
          
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              Select Your Answer:
            </h3>

            {/* Options Selection */}
            {activeQuestion && (
              activeQuestion.type !== 'NAT' ? (
                (activeQuestion.question_image || activeQuestion.question_text) && activeQuestion.custom_options?.length > 0 ? (
                  // Custom image/text question - Option buttons with labels/images
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {activeQuestion.options.map(option => {
                      const q_id = activeQuestion.id;
                      const currentAns = userAnswers[q_id] || '';
                      const isSelected = activeQuestion.type === 'MCQ'
                        ? currentAns === option
                        : currentAns.split(';').includes(option);
                      const optText = activeQuestion.custom_options[option.charCodeAt(0) - 65] || '';
                      const isOptImg = optText.startsWith('data:image') || optText.startsWith('http') || optText.startsWith('blob:');
                      return (
                        <button
                          key={option}
                          onClick={() => handleOptionSelect(option)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.875rem',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            border: `2px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                            background: isSelected ? 'rgba(59,130,246,0.08)' : 'white',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s',
                            fontSize: '0.9rem',
                            fontWeight: isSelected ? 600 : 400,
                            color: isSelected ? '#1d4ed8' : '#1e293b',
                            boxShadow: isSelected ? '0 0 0 3px rgba(59,130,246,0.15)' : '0 1px 4px rgba(0,0,0,0.04)'
                          }}
                        >
                          <span style={{
                            minWidth: '32px', height: '32px',
                            borderRadius: '50%',
                            background: isSelected ? '#3b82f6' : '#e2e8f0',
                            color: isSelected ? 'white' : '#475569',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.85rem', flexShrink: 0
                          }}>
                            {option}
                          </span>
                          {isOptImg ? (
                            <img src={optText} alt={`Option ${option}`} style={{ maxHeight: '180px', minHeight: '100px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', padding: '0.25rem' }} />
                          ) : (
                            <span>{optText}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  // Default options list
                  <div className="cbt-options-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {activeQuestion.options.map(option => {
                      const q_id = activeQuestion.id;
                      const currentAns = userAnswers[q_id] || '';
                      const isSelected = activeQuestion.type === 'MCQ'
                        ? currentAns === option
                        : currentAns.split(';').includes(option);
                      const customOptVal = activeQuestion.custom_options?.[option.charCodeAt(0) - 65] || '';
                      const isCustomOptImg = customOptVal.startsWith('data:image') || customOptVal.startsWith('http') || customOptVal.startsWith('blob:');

                      return (
                        <div
                          key={option}
                          className={`cbt-option-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleOptionSelect(option)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            background: isSelected ? '#eff6ff' : 'white',
                            border: `1px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <input
                            type={activeQuestion.type === 'MCQ' ? 'radio' : 'checkbox'}
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: 600, color: '#334155' }}>({option})</span>
                          {customOptVal && (
                            isCustomOptImg ? (
                              <img src={customOptVal} alt={`Option ${option}`} style={{ maxHeight: '160px', minHeight: '90px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px' }} />
                            ) : (
                              <span style={{ fontSize: '0.9rem', color: '#1e293b' }}>{customOptVal}</span>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                // NAT keyboard input
                <div className="cbt-nat-container">
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#555' }}>
                    Enter Numerical Value (Use virtual keypad):
                  </label>
                  <input
                    type="text"
                    className="cbt-nat-input"
                    value={userAnswers[activeQuestion.id] || ''}
                    readOnly
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: '700',
                      textAlign: 'center',
                      background: 'white',
                      marginBottom: '1rem'
                    }}
                  />
                  <div className="cbt-keypad">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', '-'].map(k => (
                      <button key={k} className="cbt-keypad-btn" onClick={() => handleKeypadPress(k)}>{k}</button>
                    ))}
                    <button className="cbt-keypad-btn action-btn" style={{ gridColumn: 'span 2' }} onClick={() => handleKeypadPress('Backspace')}>Backspace</button>
                    <button className="cbt-keypad-btn action-btn" style={{ gridColumn: 'span 2' }} onClick={() => handleKeypadPress('Clear')}>Clear</button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Action buttons (Footer inside Middle Pane for better UX) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleMarkReviewNext}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Mark for Review & Next
              </button>
              <button
                onClick={handleClearResponse}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Clear Response
              </button>
            </div>
            <button
              onClick={handleSaveNext}
              style={{
                width: '100%',
                padding: '0.85rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(16,185,129,0.2)'
              }}
            >
              Save & Next
            </button>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                disabled={currentIndex === 0}
                onClick={() => navigateToQuestion(currentIndex - 1)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: currentIndex === 0 ? '#cbd5e1' : '#3b82f6',
                  color: currentIndex === 0 ? '#64748b' : 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                ⬅️ Previous
              </button>
              <button
                disabled={currentIndex === testQuestions.length - 1}
                onClick={() => navigateToQuestion(currentIndex + 1)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: currentIndex === testQuestions.length - 1 ? '#cbd5e1' : '#3b82f6',
                  color: currentIndex === testQuestions.length - 1 ? '#64748b' : 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: currentIndex === testQuestions.length - 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Next ➡️
              </button>
            </div>
          </div>

        </div>

        {/* Right Side Panel */}
        <div className="cbt-right-pane">
          {/* Student profile */}
          <div className="cbt-user-profile">
            <div className="cbt-user-avatar">
              <img src="https://api.dicebear.com/7.x/bottts/svg?seed=GATE_EE" alt="avatar" />
            </div>
            <div>
              <div className="cbt-user-name">GATE Aspirant</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>EE Branch Practice</div>
            </div>
          </div>

          {/* Countdown timer */}
          <div className="cbt-timer-container">
            <span>Time Left:</span>
            <span className="cbt-timer-val">{formatTime(timeLeft)}</span>
          </div>

          {/* Status summary counts */}
          <div className="cbt-status-summary">
            <div className="cbt-status-badge">
              <div className="cbt-status-num answered">{countAnswered}</div>
              <span>Answered</span>
            </div>
            <div className="cbt-status-badge">
              <div className="cbt-status-num not-answered">{countNotAnswered}</div>
              <span>Not Answered</span>
            </div>
            <div className="cbt-status-badge">
              <div className="cbt-status-num marked">{countMarked}</div>
              <span>Marked for Review</span>
            </div>
            <div className="cbt-status-badge">
              <div className="cbt-status-num marked-answered">{countMarkedAnswered}</div>
              <span>Answered & Marked</span>
            </div>
            <div className="cbt-status-badge" style={{ gridColumn: 'span 2', marginTop: '0.25rem' }}>
              <div className="cbt-status-num not-visited">{countNotVisited}</div>
              <span>Not Visited</span>
            </div>
          </div>

          {/* Question Palette Grid */}
          <div className="cbt-palette-title">Question Palette</div>
          <div className="cbt-palette-grid">
            {testQuestions.map((q, idx) => {
              const status = questionStatuses[q.id] || 'not-visited';
              const isActive = idx === currentIndex;
              
              return (
                <button
                  key={q.id}
                  className={`cbt-palette-btn ${status} ${isActive ? 'active' : ''}`}
                  onClick={() => navigateToQuestion(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Submit test button */}
          <div style={{ padding: '1rem', borderTop: '1px solid var(--ion-border)' }}>
            <button className="cbt-btn cbt-btn-submit" style={{ width: '100%', padding: '0.6rem' }} onClick={() => setShowSubmitModal(true)}>
              Submit Exam
            </button>
          </div>
        </div>
      </div>

      {/* Floating Scientific Calculator */}
      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
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
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            maxWidth: '480px',
            width: '100%',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎯</div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
              Submit Practice Test?
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Are you sure you want to finish and submit your exam?
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', textAlign: 'left', fontSize: '0.85rem' }}>
              <div>Total Questions: <strong>{testQuestions.length}</strong></div>
              <div>Answered: <strong style={{ color: '#16a34a' }}>{countAnswered + countMarkedAnswered}</strong></div>
              <div>Marked for Review: <strong style={{ color: '#8b5cf6' }}>{countMarked}</strong></div>
              <div>Unattempted: <strong style={{ color: '#dc2626' }}>{countNotAnswered + countNotVisited}</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => setShowSubmitModal(false)}
                style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', padding: '0.75rem 1.25rem', fontWeight: 600, cursor: 'pointer', flex: 1 }}
              >
                Return to Test
              </button>
              <button
                onClick={() => {
                  setShowSubmitModal(false);
                  handleSubmit(false);
                }}
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.75rem 1.25rem', fontWeight: 700, cursor: 'pointer', flex: 1, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
              >
                Confirm Submit 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
