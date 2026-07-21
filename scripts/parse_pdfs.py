import pypdf
import os
import re
import json

# Define the directory where PDFs are located
pdf_dir = r"d:\gate test site\public\EE"
output_file = r"d:\gate test site\public\questions_db.json"

# Comprehensive keyword lists with weights for accurate topic classification
# Each topic has: 
#   "strong" keywords (unique to the topic, weight=5)
#   "regular" keywords (common, weight=1)
syllabus_keywords_weighted = {
    "Engineering Mathematics": {
        "strong": [
            "eigenvalue", "eigenvector", "eigen value", "eigen vector", "determinant of",
            "rank of the matrix", "mean value theorem", "differential equation",
            "taylor series", "laurent series", "residue theorem", "residue of",
            "poisson distribution", "normal distribution", "binomial distribution",
            "divergence theorem", "stokes theorem", "green's theorem", "green theorem",
            "line integral", "surface integral", "volume integral",
            "analytic function", "cauchy-riemann", "cauchy integral",
            "rolle's theorem", "lagrange's mean", "directional derivative",
            "partial derivative", "numerical method", "trapezoidal rule",
            "simpson's rule", "newton-raphson method", "gauss elimination",
            "probability density", "cumulative distribution", "expected value",
            "variance of", "standard deviation", "random variable",
            "characteristic equation", "rank of a matrix", "inverse of a matrix",
            "system of linear equations", "linear algebra", "homogeneous equation",
            "singular matrix", "orthogonal matrix", "unitary matrix",
            "gradient of", "curl of", "laplacian", "maxima and minima",
            "double integral", "triple integral", "complex variable",
            "contour integral", "bilinear transformation"
        ],
        "regular": [
            "matrix", "calculus", "probability", "statistics", "median",
            "eigenvalues", "eigenvectors", "integration", "differentiation",
            "limit", "convergent", "divergent", "series", "polynomial"
        ]
    },
    "Electric circuits": {
        "strong": [
            "thevenin", "norton", "superposition theorem", "maximum power transfer",
            "kirchhoff", "kcl", "kvl", "mesh analysis", "nodal analysis",
            "star-delta", "delta-star", "two port network", "two-port",
            "z-parameter", "y-parameter", "h-parameter", "abcd parameter",
            "transmission parameter", "sinusoidal steady",
            "series resonance", "parallel resonance", "quality factor",
            "time constant", "step response of", "rc circuit", "rl circuit", "rlc circuit",
            "network graph", "loop analysis", "node analysis",
            "reciprocity theorem", "millman", "compensation theorem",
            "balanced three phase", "three phase circuit", "star connected",
            "delta connected"
        ],
        "regular": [
            "impedance", "admittance", "power factor", "network", "transient",
            "resistor", "capacitor", "inductor", "voltage source", "current source",
            "phasor", "ac circuit", "dc circuit", "mutual inductance"
        ]
    },
    "Electromagnetic Fields": {
        "strong": [
            "coulomb's law", "gauss's law", "gauss law", "biot-savart",
            "ampere's law", "ampere circuital", "faraday's law of electromagnetic",
            "lorentz force", "maxwell's equation", "maxwell equation",
            "displacement current", "poynting vector", "boundary condition",
            "magnetic flux density", "magnetic field intensity",
            "electric flux density", "electric field intensity",
            "charge distribution", "charge density", "surface charge",
            "dielectric constant", "permittivity", "permeability",
            "reluctance", "magnetic circuit", "self inductance",
            "skin effect", "wave equation", "electromagnetic wave",
            "reflection coefficient", "standing wave"
        ],
        "regular": [
            "electric field", "magnetic field", "capacitance", "dielectric",
            "coulomb", "maxwell", "electromagnetic"
        ]
    },
    "Signals and Systems": {
        "strong": [
            "fourier series", "fourier transform", "laplace transform",
            "z-transform", "z transform", "inverse z-transform",
            "lti system", "linear time invariant", "impulse response",
            "sampling theorem", "nyquist rate", "nyquist frequency",
            "convolution integral", "convolution sum",
            "region of convergence", "roc", "causal system",
            "stable system", "bibo stable", "periodic signal",
            "discrete time signal", "continuous time signal",
            "unit step function", "unit impulse", "ramp function",
            "transfer function h(s)", "transfer function h(z)",
            "frequency response", "magnitude response", "phase response",
            "parseval", "energy signal", "power signal",
            "autocorrelation", "cross-correlation", "hilbert transform",
            "dtft", "dft", "fft", "idft"
        ],
        "regular": [
            "signal", "system", "discrete time", "continuous time",
            "rms value", "average value", "spectrum"
        ]
    },
    "Electrical Machines": {
        "strong": [
            "transformer", "auto-transformer", "autotransformer",
            "induction motor", "induction generator", "induction machine",
            "synchronous motor", "synchronous generator", "synchronous machine", "synchronous speed",
            "dc motor", "dc generator", "dc machine", "dc shunt motor", "dc series motor",
            "separately excited", "self excited",
            "stator", "rotor", "armature winding", "field winding",
            "slip ring", "commutator", "brushes",
            "torque-speed characteristic", "torque speed",
            "no-load test", "blocked rotor test", "blocked-rotor",
            "open circuit test", "short circuit test",
            "equivalent circuit of", "per unit impedance",
            "electromechanical energy", "energy conversion",
            "starting torque", "pull-out torque", "breakdown torque",
            "back emf", "counter emf", "emf equation",
            "voltage regulation of", "efficiency of the transformer",
            "turns ratio", "transformation ratio", "winding",
            "three phase transformer", "single phase transformer",
            "lap winding", "wave winding",
            "speed control", "flux weakening",
            "core loss", "copper loss", "iron loss",
            "hysteresis loss", "eddy current loss",
            "alternator", "prime mover"
        ],
        "regular": [
            "slip", "poles", "armature", "excitation",
            "magnetizing", "leakage reactance"
        ]
    },
    "Power Systems": {
        "strong": [
            "transmission line", "surge impedance", "ferranti effect",
            "load flow", "power flow", "bus admittance matrix", "ybus",
            "newton-raphson load flow", "gauss-seidel load flow",
            "fault analysis", "symmetrical fault", "unsymmetrical fault",
            "symmetrical component", "sequence component", "positive sequence",
            "negative sequence", "zero sequence",
            "circuit breaker", "relay", "overcurrent relay", "distance relay",
            "differential protection", "bus protection",
            "power system stability", "transient stability", "steady state stability",
            "equal area criterion", "swing equation",
            "economic load dispatch", "economic dispatch",
            "load frequency control", "automatic generation control",
            "insulator", "corona", "sag", "string insulator",
            "per unit system", "per unit value", "base value",
            "power generation", "hydro", "thermal",
            "shunt compensation", "series compensation", "svc", "statcom",
            "voltage stability", "power angle", "sending end", "receiving end",
            "short line", "medium line", "long line",
            "abcd constants of", "underground cable",
            "skin effect", "proximity effect",
            "slack bus", "pv bus", "pq bus", "swing bus",
            "three phase fault", "single line to ground",
            "line to line fault", "double line to ground"
        ],
        "regular": [
            "bus", "substation", "grid", "interconnected",
            "load", "generation", "demand"
        ]
    },
    "Control Systems": {
        "strong": [
            "transfer function", "bode plot", "bode diagram",
            "nyquist plot", "nyquist criterion", "nyquist contour",
            "routh-hurwitz", "routh hurwitz", "routh criterion", "routh array",
            "root locus", "root loci",
            "compensator", "lead compensator", "lag compensator", "lead-lag",
            "pid controller", "pi controller", "pd controller",
            "proportional-integral", "proportional integral",
            "unity feedback", "unity negative feedback",
            "open-loop transfer function", "closed-loop transfer function",
            "open loop gain", "closed loop gain",
            "state space", "state variable", "state equation",
            "state transition matrix", "controllability", "observability",
            "signal flow graph", "mason's gain", "mason gain",
            "block diagram reduction", "block diagram",
            "gain margin", "phase margin", "gain crossover", "phase crossover",
            "marginally stable", "characteristic equation",
            "type of the system", "type 0", "type 1", "type 2",
            "steady state error", "error constant",
            "dominant poles", "second order system",
            "damping ratio", "natural frequency", "underdamped",
            "overdamped", "critically damped",
            "feedback system", "feedback configuration",
            "polar plot", "nichols chart",
            "breakaway point", "angle of departure",
            "centroid", "asymptote"
        ],
        "regular": [
            "stability", "feedback", "controller", "closed-loop", "open-loop",
            "gain", "overshoot", "settling time", "rise time", "peak time"
        ]
    },
    "Electrical and Electronic Measurements": {
        "strong": [
            "wheatstone bridge", "kelvin bridge", "maxwell bridge",
            "hay bridge", "schering bridge", "wien bridge", "anderson bridge",
            "heaviside campbell", "desauty bridge",
            "potentiometer", "crompton potentiometer",
            "pmmc", "moving iron", "moving coil",
            "dynamometer", "electrodynamometer",
            "wattmeter", "energy meter", "power measurement",
            "two wattmeter method", "three wattmeter",
            "instrument transformer", "current transformer", "ct ratio",
            "potential transformer", "pt ratio",
            "digital voltmeter", "analog voltmeter",
            "oscilloscope", "cro", "cathode ray",
            "error in measurement", "accuracy", "precision",
            "sensitivity of", "deflection", "galvanometer",
            "megger", "q-meter", "frequency measurement"
        ],
        "regular": [
            "measurement", "meter", "voltmeter", "ammeter", "bridge",
            "instrument", "calibration"
        ]
    },
    "Analog and Digital Electronics": {
        "strong": [
            "op-amp", "operational amplifier", "ideal op-amp",
            "inverting amplifier", "non-inverting amplifier",
            "summing amplifier", "difference amplifier",
            "bjt", "bipolar junction", "npn transistor", "pnp transistor",
            "mosfet", "jfet", "fet", "cmos",
            "common emitter", "common base", "common collector",
            "common source", "common drain", "common gate",
            "biasing circuit", "q-point", "operating point of transistor",
            "small signal model", "hybrid model", "h-parameter of transistor",
            "active filter", "passive filter", "butterworth", "chebyshev",
            "logic gate", "and gate", "or gate", "nand gate", "nor gate",
            "xor gate", "boolean algebra", "karnaugh map", "k-map",
            "multiplexer", "demultiplexer", "encoder", "decoder",
            "flip-flop", "jk flip", "d flip", "sr flip", "t flip",
            "counter", "synchronous counter", "asynchronous counter",
            "shift register", "ring counter",
            "adc", "dac", "analog to digital", "digital to analog",
            "schmitt trigger", "555 timer", "astable", "monostable",
            "clipper", "clamper", "clipping circuit", "clamping circuit",
            "rectifier", "half wave rectifier", "full wave rectifier",
            "voltage regulator", "zener diode", "zener",
            "combinational circuit", "sequential circuit",
            "number system", "binary", "hexadecimal",
            "truth table", "state diagram"
        ],
        "regular": [
            "diode", "transistor", "amplifier", "digital", "logic",
            "register", "gate"
        ]
    },
    "Power Electronics": {
        "strong": [
            "thyristor", "scr", "silicon controlled",
            "igbt", "power mosfet", "gto",
            "buck converter", "boost converter", "buck-boost converter",
            "step-down converter", "step-up converter", "step-down chopper", "step-up chopper",
            "dc-dc converter", "dc to dc",
            "single phase inverter", "three phase inverter",
            "voltage source inverter", "current source inverter",
            "full bridge inverter", "half bridge inverter",
            "chopper", "dc chopper", "type-a chopper",
            "firing angle", "firing circuit", "gate pulse",
            "commutation", "natural commutation", "forced commutation",
            "total harmonic distortion", "thd", "distortion factor",
            "pulse width modulation", "pwm", "sinusoidal pwm",
            "triac", "diac", "power diode",
            "ac voltage controller", "phase controlled",
            "controlled rectifier", "uncontrolled rectifier",
            "single phase converter", "three phase converter",
            "dual converter", "cycloconverter",
            "snubber circuit", "freewheeling diode",
            "ripple factor", "form factor",
            "continuous conduction", "discontinuous conduction",
            "input power factor of converter"
        ],
        "regular": [
            "converter", "inverter", "rectifier", "switching",
            "duty cycle", "conduction angle"
        ]
    }
}

# Set of already processed clean question texts to prevent repetition
seen_texts = set()

fallback_subjects = [
    "Electric circuits",
    "Electromagnetic Fields",
    "Signals and Systems",
    "Electrical Machines",
    "Power Systems",
    "Control Systems",
    "Electrical and Electronic Measurements",
    "Analog and Digital Electronics",
    "Power Electronics"
]

def classify_topic(text, q_num, year=""):
    if q_num <= 10:
        return "General Aptitude"
    
    text_lower = text.lower()
    
    # Detect General Aptitude by content patterns
    # GA questions typically contain English grammar, sentence completion, quantitative reasoning
    ga_strong_keywords = [
        "complete the sentence", "fill in the blank", "closest in meaning",
        "grammatically correct", "appropriate word", "choose the correct",
        "reading comprehension", "passage", "which of the following statement",
        "freedom movement", "colonial india", "population of", 
        "pie chart", "bar graph", "data interpretation",
        "percentage of", "ratio of", "proportion",
        "sequence", "pattern", "analogy", "odd one out",
        "if all cats", "if some", "then which",
        "venn diagram", "logical reasoning", "verbal ability",
        "dare ", "complete the", "sentence:",
        "antonym", "synonym", "meaning of",
        "english", "grammar", "comprehension",
        "carry one mark each", "carry two marks each",
        "the total number of students", "the number of people",
        "how many", "if a person", "a worker", "a shopkeeper",
        "probability of getting", "average of", "discount of",
        "profit and loss", "simple interest", "compound interest"
    ]
    
    ga_matches = sum(1 for kw in ga_strong_keywords if kw in text_lower)
    if ga_matches >= 2:
        return "General Aptitude"
    
    # For questions numbered >= 56 (old format GA section), check if they look like GA
    if q_num >= 56 and ga_matches >= 1:
        return "General Aptitude"
    
    scores = {}
    
    for topic, kw_dict in syllabus_keywords_weighted.items():
        strong_kws = kw_dict.get("strong", [])
        regular_kws = kw_dict.get("regular", [])
        
        strong_matches = sum(1 for kw in strong_kws if kw in text_lower)
        regular_matches = sum(1 for kw in regular_kws if kw in text_lower)
        
        # Strong keywords get weight 5, regular get weight 1
        score = strong_matches * 5 + regular_matches
        
        if score > 0:
            scores[topic] = score
    
    if not scores:
        # Smart fallback distribution based on question number structure
        if q_num in [11, 12, 13, 14, 15, 36, 37, 38, 39, 40]:
            return "Engineering Mathematics"
        else:
            # Map technical questions to the 9 core technical subjects round-robin
            # We add a hash based on the year to mix the subjects up for different years
            import hashlib
            year_val = int(hashlib.md5(str(year).encode()).hexdigest(), 16) if year else 0
            idx = (q_num + year_val) % 9
            return fallback_subjects[idx]
    
    # Return the topic with highest score
    best_topic = max(scores, key=scores.get)
    return best_topic

def parse_pdf(file_path, file_name):
    print(f"Parsing {file_name}...")
    reader = pypdf.PdfReader(file_path)
    questions = []
    
    # Update regex to support Q.No. <num> as group 4
    q_re = re.compile(r'(?:^|\n|[\s])(Q\s*\.\s*([0-9]+)|Question\s+Number\s*:\s*([0-9]+)|Q\s*\.\s*No\s*\.\s*([0-9]+))\b', re.IGNORECASE)
    range_re = re.compile(r'carry\s+(?:one|two)\s+marks?\s+each|carry\s+marks?\b', re.IGNORECASE)
    
    raw_matches = []
    for page_idx, page in enumerate(reader.pages):
        text = page.extract_text()
        if not text:
            continue
            
        for match in q_re.finditer(text):
            q_num_str = match.group(2) or match.group(3) or match.group(4)
            q_num = int(q_num_str)
            
            # Check if this match is part of a range header (e.g. Q. 1 - Q. 5)
            after_text = text[match.end():match.end() + 30]
            range_indicator_re = re.compile(r'^\s*(?:-|–|to)\s*(?:Q\s*\.?\s*(?:No\s*\.?)?\s*)?[0-9]+', re.IGNORECASE)
            if range_indicator_re.match(after_text):
                continue
                
            raw_matches.append({
                "q_num": q_num,
                "page_idx": page_idx,
                "pos": match.start(),
                "text": text
            })
            
    raw_matches = sorted(raw_matches, key=lambda x: (x["page_idx"], x["pos"]))
    
    current_set = 1
    last_q_num = 0
    unique_matches = []
    
    for m in raw_matches:
        q_num = m["q_num"]
        
        # Reset detected if question number drops significantly and is Q.1 or Q.2
        if q_num < last_q_num and q_num <= 2:
            current_set += 1
            
        last_q_num = q_num
        m["set_idx"] = current_set
        unique_matches.append(m)
        
    seen = {}
    filtered_matches = []
    for m in unique_matches:
        key = (m["set_idx"], m["q_num"])
        if key not in seen:
            seen[key] = m
            filtered_matches.append(m)
            
    max_set_idx = max([m["set_idx"] for m in filtered_matches]) if filtered_matches else 1
    
    # Group filtered_matches by page_idx to extract text slices in physical order
    from collections import defaultdict
    matches_by_page = defaultdict(list)
    for m in filtered_matches:
        matches_by_page[m["page_idx"]].append(m)
        
    for page_idx in sorted(matches_by_page.keys()):
        page_matches = matches_by_page[page_idx]
        page_text = page_matches[0]["text"]
        
        matches_with_pos = []
        for m in page_matches:
            q_num = m["q_num"]
            # Search for actual start position of question header on the page
            pos = -1
            for prefix in [f"q.no. {q_num}", f"q.no.{q_num}", f"q. {q_num}", f"q.{q_num}", f"question number : {q_num}", f"question number:{q_num}"]:
                pos = page_text.lower().find(prefix)
                if pos != -1:
                    break
            if pos == -1:
                # Try fallback regex match on this page for this specific question
                q_regex = re.compile(rf'(?:^|\n|[\s])(Q\s*\.\s*{q_num}|Question\s+Number\s*:\s*{q_num}|Q\s*\.\s*No\s*\.\s*{q_num})\b', re.IGNORECASE)
                m_match = q_regex.search(page_text)
                if m_match:
                    pos = m_match.start()
                else:
                    pos = 0
            matches_with_pos.append((pos, m))
            
        # Sort page matches by their physical start position `pos` in page_text
        matches_with_pos.sort(key=lambda x: x[0])
        
        for i, (pos, m) in enumerate(matches_with_pos):
            q_num = m["q_num"]
            set_idx = m["set_idx"]
            
            if max_set_idx > 1:
                q_label_id = f"{file_name[:-4]}_S{set_idx}_Q{q_num}"
            else:
                q_label_id = f"{file_name[:-4]}_Q{q_num}"
                
            # Determine end position of text slice for this question
            if i < len(matches_with_pos) - 1:
                next_pos = matches_with_pos[i+1][0]
            else:
                next_pos = len(page_text)
                
            q_text = page_text[pos:next_pos].strip()
            
            # Deduplication check
            clean_txt = re.sub(r'\s+', '', q_text.lower())
            
            if len(clean_txt) < 5:
                continue
                
            # Global duplicate checking only for real/long question content, not for sparse metadata headers
            if len(clean_txt) > 80:
                if clean_txt in seen_texts:
                    continue
                seen_texts.add(clean_txt)
                
            if q_num <= 5:
                marks = 1
            elif q_num <= 10:
                marks = 2
            elif q_num <= 35:
                marks = 1
            else:
                marks = 2
                
            q_type = "MCQ"
            if "numerical" in q_text.lower() or "round off" in q_text.lower() or "rounded off" in q_text.lower() or "is ___" in q_text or "is ____" in q_text:
                q_type = "NAT"
            elif "(A)" in q_text and "(B)" in q_text and "(C)" in q_text and "(D)" in q_text:
                q_type = "MCQ"
            elif "options" in q_text.lower() and "Question Type : MCQ" in q_text:
                q_type = "MCQ"
            elif "Question Type : NAT" in q_text:
                q_type = "NAT"
            elif "Question Type : MSQ" in q_text:
                q_type = "MSQ"
                
            options = ["A", "B", "C", "D"] if q_type in ["MCQ", "MSQ"] else []
            
            # Classify topic, passing the year for better round-robin distribution
            topic = classify_topic(q_text, q_num, year=file_name[:-4].replace("EE", ""))
            
            correct_answer = ""
            ans_match = re.search(r'(?:Correct Answer\s*:\s*|Correct Answer\s*)\b([A-D]|[0-9\.\-]+)\b', q_text, re.IGNORECASE)
            if ans_match:
                correct_answer = ans_match.group(1).strip()
                
            questions.append({
                "id": q_label_id,
                "year": file_name[:-4].replace("EE", ""),
                "original_num": q_num,
                "page_num": page_idx + 1,
                "section": topic,
                "marks": marks,
                "type": q_type,
                "options": options,
                "question_text": q_text,
                "correct_answer": correct_answer,
                "set": set_idx
            })
            
    print(f"Extracted {len(questions)} unique questions (Sets total={max_set_idx}) from {file_name}")
    return questions

def main():
    all_questions = []
    
    for f in sorted(os.listdir(pdf_dir)):
        if not f.endswith(".pdf"):
            continue
            
        if any(x in f for x in ["EE2007", "EE2008", "EE2009", "EE2010", "EE2011", "EE2019", "EE2021"]):
            print(f"Skipping scanned PDF: {f}")
            continue
            
        pdf_path = os.path.join(pdf_dir, f)
        try:
            questions = parse_pdf(pdf_path, f)
            all_questions.extend(questions)
        except Exception as e:
            print(f"Error parsing {f}: {e}")
        
    print(f"Total unique questions extracted: {len(all_questions)}")
    
    with open(output_file, "w", encoding="utf-8") as out:
        json.dump(all_questions, out, indent=2, ensure_ascii=False)
    print(f"Database saved to {output_file}")

if __name__ == "__main__":
    main()
