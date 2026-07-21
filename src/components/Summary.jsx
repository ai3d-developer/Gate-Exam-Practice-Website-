import React, { useState, useEffect, useRef } from 'react';

export default function Summary({ result, onBackToDashboard }) {
  const [modalPdf, setModalPdf] = useState(null); // { pdfName, pageNum }
  const pdfScale = 1.35; // Fixed scale, no zoom controls
  const [pdfLoading, setPdfLoading] = useState(false);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Compute metrics
  const totalQuestions = result.totalQuestions;
  const attemptedCount = result.correctCount + result.incorrectCount;
  const scoreMax = totalQuestions * 2; // approximation or max marks
  const scorePercentage = Math.round((result.correctCount / totalQuestions) * 100) || 0;

  // Persist stats updates to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gate_cbt_stats');
    if (saved) {
      const stats = JSON.parse(saved);
      const newTotalSolved = stats.totalSolved + attemptedCount;
      const newAccuracy = Math.round(((stats.accuracy * stats.totalSolved) + (scorePercentage * attemptedCount)) / (newTotalSolved || 1)) || scorePercentage;
      const newStreak = stats.streak + 1; // Increment streak
      // Map solved questions to coverage percentage (max out at 100)
      const newCoverage = Math.min(100, Math.round((newTotalSolved / 500) * 100));

      const updated = {
        streak: newStreak,
        totalSolved: newTotalSolved,
        accuracy: newAccuracy,
        coverage: newCoverage
      };
      localStorage.setItem('gate_cbt_stats', JSON.stringify(updated));
    }
  }, []);

  // Modal PDF rendering logic
  useEffect(() => {
    if (!modalPdf) return;

    let isMounted = true;
    setPdfLoading(true);

    const renderPdf = async () => {
      try {
        if (!window.pdfjsLib) {
          throw new Error("PDF.js library not loaded yet.");
        }

        const pdfUrl = `/EE/${modalPdf.pdfName}`;
        const pageNumber = modalPdf.pageNum;

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
            const qNum = modalPdf.qNum;
            
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
            
            // Search for active question's y-coordinate
            let targetY = null;
            const regex = new RegExp(`(?:^|\\s)Q\\s*\\.\\s*${qNum}\\b|(?:^|\\s)Question\\s+Number\\s*:\\s*${qNum}\\b`, 'i');
            for (const line of lines) {
              if (regex.test(line.text)) {
                targetY = line.y;
                break;
              }
            }
            
            // Search for next question on the same page to calculate height
            let nextTargetY = null;
            const nextQNum = qNum + 1;
            const nextRegex = new RegExp(`(?:^|\\s)Q\\s*\\.\\s*${nextQNum}\\b|(?:^|\\s)Question\\s+Number\\s*:\\s*${nextQNum}\\b`, 'i');
            for (const line of lines) {
              if (nextRegex.test(line.text)) {
                nextTargetY = line.y;
                break;
              }
            }
            
            if (targetY !== null && canvasRef.current) {
              const canvas = canvasRef.current;
              const clipper = canvas.parentElement;
              const wrapper = clipper.parentElement;
              
              const viewBoxHeight = page.view[3];
              const yFromTop = (viewBoxHeight - targetY) * pdfScale;
              
              // Calculate height of the question area
              let qHeight = 350; // default height in pixels
              if (nextTargetY !== null && targetY > nextTargetY) {
                qHeight = (targetY - nextTargetY) * pdfScale;
              } else {
                qHeight = (targetY - 15) * pdfScale;
              }
              
              // Align top of crop 10px above the question text
              const topOffset = Math.max(0, yFromTop - 10);
              
              // Set crop height capped at 320px to prevent showing next question
              const finalHeight = Math.min(320, Math.max(120, qHeight - 15));
              
              // Configure visible canvas to contain ONLY the cropped image pixels
              canvas.width = hiddenCanvas.width;
              canvas.height = finalHeight;
              
              const ctx = canvas.getContext('2d');
              // Draw the cropped region from the offscreen canvas to the visible canvas
              ctx.drawImage(
                hiddenCanvas,
                0, topOffset, hiddenCanvas.width, finalHeight, // source region
                0, 0, hiddenCanvas.width, finalHeight // destination region
              );
              
              // Reset all styling hacks since the canvas itself is now exactly the cropped size
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
              
              // Draw full page as fallback
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
              
              wrapper.style.height = "480px";
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
  }, [modalPdf]);

  const handleOpenPdf = (q) => {
    const pdfName = q.id.split('_')[0] + '.pdf';
    setModalPdf({ pdfName, pageNum: q.page_num, qNum: q.original_num });
  };

  const handleClosePdf = () => {
    setModalPdf(null);
  };

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}m ${s}s`;
  };

  return (
    <div className="summary-container">
      <div className="summary-header">
        <div>
          <h1>Exam Submission Summary</h1>
          <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.25rem' }}>Here is the detailed scorecard of your practice session</p>
        </div>
        <button className="btn-secondary" onClick={onBackToDashboard}>Back to Dashboard</button>
      </div>

      <div className="review-grid">
        {/* Left pane: Scores Card */}
        <div className="score-details-card">
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem' }}>Your Scorecard</h2>
          
          <div className="score-circle-wrapper">
            <div className="score-circle">
              <span className="score-num">{result.score}</span>
              <span className="score-total">Marks Scored</span>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: 600, marginTop: '0.75rem' }}>
              Accuracy: {scorePercentage}%
            </span>
          </div>

          <div className="score-metric-row">
            <span className="score-metric-label">Total Questions</span>
            <span className="score-metric-val">{totalQuestions}</span>
          </div>
          <div className="score-metric-row">
            <span className="score-metric-label">Correct Answers</span>
            <span className="score-metric-val correct">+{result.correctCount}</span>
          </div>
          <div className="score-metric-row">
            <span className="score-metric-label">Incorrect Answers</span>
            <span className="score-metric-val incorrect">-{result.incorrectCount}</span>
          </div>
          <div className="score-metric-row">
            <span className="score-metric-label">Unattempted</span>
            <span className="score-metric-val">{result.unattemptedCount}</span>
          </div>
          <div className="score-metric-row" style={{ borderBottom: 'none' }}>
            <span className="score-metric-label">Time Taken</span>
            <span className="score-metric-val">{formatDuration(result.timeSpent)}</span>
          </div>
        </div>

        {/* Right pane: Review list */}
        <div className="review-list-card">
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
            Question-by-Question Review
          </h2>
          
          {result.reviewDetails.map((q, idx) => {
            const isUnattempted = q.isCorrect === 'unattempted';
            const isCorrect = q.isCorrect === 'correct';
            
            return (
              <div key={q.id} className="review-question-item">
                <div className="review-q-header">
                  <div className="review-q-title">
                    <span style={{ color: '#60a5fa' }}>Q{idx + 1}.</span>
                    <span>{q.section}</span>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>({q.marks} Mark)</span>
                  </div>
                  <span className={`badge ${q.isCorrect}`}>
                    {isUnattempted ? 'Unattempted' : isCorrect ? 'Correct' : 'Incorrect'}
                  </span>
                </div>

                {q.question_text && (
                  <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: '0.5rem' }}>
                    {q.question_text.replace(/Session - \d+/gi, '').trim()}
                  </div>
                )}
                {q.question_image && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <img src={q.question_image} alt={`Q${idx + 1}`} style={{ maxHeight: '180px', maxWidth: '100%', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                  </div>
                )}

                <div className="review-answers-row">
                  <div>
                    Your Answer:{' '}
                    <span className={`review-ans-span ${isCorrect ? 'user-correct' : 'user-incorrect'}`}>
                      {q.userAnswer ? q.userAnswer : 'None'}
                    </span>
                  </div>
                  <div>
                    Correct Key:{' '}
                    <span className="review-ans-span correct-val">{q.correctAnswer}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review PDF page modal overlay */}
      {modalPdf && (
        <div className="review-pdf-viewer-modal" onClick={handleClosePdf}>
          <div className="review-pdf-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="review-pdf-modal-header">
              <span>Original Exam Paper Sheet — Page {modalPdf.pageNum}</span>
              <button 
                style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', fontWeight: 'bold' }} 
                onClick={handleClosePdf}
              >
                &times;
              </button>
            </div>
            
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem', background: '#f5f5f5', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

              {pdfLoading && (
                <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', border: '4px solid #ddd', borderTopColor: '#007bff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>Loading original question page...</p>
                </div>
              )}

              <div className="pdf-canvas-wrapper" style={{ display: pdfLoading ? 'none' : 'block', position: 'relative' }}>
                <div className="pdf-canvas-clipper" style={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
                  <canvas ref={canvasRef} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
