import React, { useState, useEffect, useRef } from 'react';

export default function Calculator({ onClose }) {
  const [expr, setExpr] = useState('');
  const [val, setVal] = useState('0');
  const [memory, setMemory] = useState(0);
  const [pos, setPos] = useState({ x: window.innerWidth - 360, y: 120 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const wrapperRef = useRef(null);

  // Dragging logic
  const handleMouseDown = (e) => {
    if (e.target.className.includes('calc-header') || e.target.parentElement.className.includes('calc-header')) {
      setDragging(true);
      dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragging) {
        const newX = Math.max(0, Math.min(window.innerWidth - 330, e.clientX - dragStart.current.x));
        const newY = Math.max(0, Math.min(window.innerHeight - 350, e.clientY - dragStart.current.y));
        setPos({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  const handleBtnClick = (label) => {
    // Scientific and basic button logic
    if (label === 'C') {
      setExpr('');
      setVal('0');
    } else if (label === 'Backspace') {
      if (val.length > 1) {
        setVal(val.slice(0, -1));
      } else {
        setVal('0');
      }
    } else if (label === '=') {
      try {
        // Safe evaluation
        let expression = expr + val;
        // Replace visual symbols with javascript equivalents
        expression = expression.replace(/×/g, '*').replace(/÷/g, '/');
        // Replace functions like sin(x), cos(x), log(x), ln(x), sqrt(x)
        // Here we evaluate using a basic math evaluator or standard eval (safely cleaned)
        // For a high fidelity mock, we can support clean evaluations
        // Let's implement helper replacements for eval
        let evalStr = expression
          .replace(/sin\(/gi, 'Math.sin(')
          .replace(/cos\(/gi, 'Math.cos(')
          .replace(/tan\(/gi, 'Math.tan(')
          .replace(/ln\(/gi, 'Math.log(')
          .replace(/log\(/gi, 'Math.log10(')
          .replace(/sqrt\(/gi, 'Math.sqrt(')
          .replace(/π/g, 'Math.PI')
          .replace(/e/g, 'Math.E');

        // Check if brackets are balanced, if not add closing brackets
        const openBrackets = (evalStr.match(/\(/g) || []).length;
        const closeBrackets = (evalStr.match(/\)/g) || []).length;
        if (openBrackets > closeBrackets) {
          evalStr += ')'.repeat(openBrackets - closeBrackets);
        }

        const result = Function('"use strict";return (' + evalStr + ')')();
        setExpr(expr + val + ' =');
        setVal(Number(result.toFixed(8)).toString());
      } catch (err) {
        setVal('Error');
      }
    } else if (['+', '-', '×', '÷'].includes(label)) {
      setExpr(val + ' ' + label + ' ');
      setVal('0');
    } else if (['sin', 'cos', 'tan', 'sqrt', 'log', 'ln'].includes(label)) {
      // Functional operation
      setExpr(label + '(');
      setVal('0');
    } else if (label === 'π') {
      setVal(Math.PI.toString());
    } else if (label === 'e') {
      setVal(Math.E.toString());
    } else if (label === 'x^y') {
      setExpr(val + ' ** ');
      setVal('0');
    } else if (label === '(' || label === ')') {
      if (val === '0') {
        setVal(label);
      } else {
        setVal(val + label);
      }
    } else if (['MC', 'MR', 'MS', 'M+', 'M-'].includes(label)) {
      const floatVal = parseFloat(val) || 0;
      if (label === 'MC') {
        setMemory(0);
      } else if (label === 'MR') {
        setVal(memory.toString());
      } else if (label === 'MS') {
        setMemory(floatVal);
      } else if (label === 'M+') {
        setMemory(memory + floatVal);
      } else if (label === 'M-') {
        setMemory(memory - floatVal);
      }
    } else if (label === '.') {
      if (!val.includes('.')) {
        setVal(val + '.');
      }
    } else {
      // Digit
      if (val === '0' || val === 'Error') {
        setVal(label);
      } else {
        setVal(val + label);
      }
    }
  };

  return (
    <div
      className="calc-wrapper"
      ref={wrapperRef}
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      onMouseDown={handleMouseDown}
    >
      <div className="calc-header">
        <span>Scientific Calculator</span>
        <button className="calc-close-btn" onClick={onClose}>&times;</button>
      </div>
      
      <div className="calc-screen">
        <div className="calc-expr">{expr}</div>
        <div className="calc-val">{val}</div>
      </div>
      
      <div className="calc-grid">
        {/* Row 1 */}
        <button className="calc-btn op-btn" onClick={() => handleBtnClick('MC')}>MC</button>
        <button className="calc-btn op-btn" onClick={() => handleBtnClick('MR')}>MR</button>
        <button className="calc-btn op-btn" onClick={() => handleBtnClick('MS')}>MS</button>
        <button className="calc-btn op-btn" onClick={() => handleBtnClick('M+')}>M+</button>
        <button className="calc-btn op-btn" onClick={() => handleBtnClick('M-')}>M-</button>

        {/* Row 2 */}
        <button className="calc-btn" onClick={() => handleBtnClick('sin')}>sin</button>
        <button className="calc-btn" onClick={() => handleBtnClick('cos')}>cos</button>
        <button className="calc-btn" onClick={() => handleBtnClick('tan')}>tan</button>
        <button className="calc-btn" onClick={() => handleBtnClick('x^y')}>x^y</button>
        <button className="calc-btn clear-btn" onClick={() => handleBtnClick('C')}>C</button>

        {/* Row 3 */}
        <button className="calc-btn" onClick={() => handleBtnClick('ln')}>ln</button>
        <button className="calc-btn" onClick={() => handleBtnClick('log')}>log</button>
        <button className="calc-btn" onClick={() => handleBtnClick('sqrt')}>sqrt</button>
        <button className="calc-btn" onClick={() => handleBtnClick('(')}>(</button>
        <button className="calc-btn" onClick={() => handleBtnClick(')')}>)</button>

        {/* Row 4 */}
        <button className="calc-btn" onClick={() => handleBtnClick('π')}>π</button>
        <button className="calc-btn" onClick={() => handleBtnClick('7')}>7</button>
        <button className="calc-btn" onClick={() => handleBtnClick('8')}>8</button>
        <button className="calc-btn" onClick={() => handleBtnClick('9')}>9</button>
        <button className="calc-btn op-btn" onClick={() => handleBtnClick('÷')}>÷</button>

        {/* Row 5 */}
        <button className="calc-btn" onClick={() => handleBtnClick('e')}>e</button>
        <button className="calc-btn" onClick={() => handleBtnClick('4')}>4</button>
        <button className="calc-btn" onClick={() => handleBtnClick('5')}>5</button>
        <button className="calc-btn" onClick={() => handleBtnClick('6')}>6</button>
        <button className="calc-btn op-btn" onClick={() => handleBtnClick('×')}>×</button>

        {/* Row 6 */}
        <button className="calc-btn op-btn" onClick={() => handleBtnClick('Backspace')}>⌫</button>
        <button className="calc-btn" onClick={() => handleBtnClick('1')}>1</button>
        <button className="calc-btn" onClick={() => handleBtnClick('2')}>2</button>
        <button className="calc-btn" onClick={() => handleBtnClick('3')}>3</button>
        <button className="calc-btn op-btn" onClick={() => handleBtnClick('-')}>-</button>

        {/* Row 7 */}
        <button className="calc-btn" onClick={() => handleBtnClick('0')}>0</button>
        <button className="calc-btn" onClick={() => handleBtnClick('.')}>.</button>
        <button className="calc-btn equal-btn" onClick={() => handleBtnClick('=')}>=</button>
        <button className="calc-btn op-btn" onClick={() => handleBtnClick('+')}>+</button>
      </div>
    </div>
  );
}
