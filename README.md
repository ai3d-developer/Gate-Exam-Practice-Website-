# 📝 GATE Exam Practice Website

A premium Computer-Based Test (CBT) platform tailored for GATE EE (Electrical Engineering) aspirants. This application simulates realistic GATE exam conditions, provides deep cognitive analytics based on Bloom's Taxonomy, and allows administrators to assign tasks and track student progress in real-time.

---

## 🚀 Key Features

### 👨‍🎓 Student Dashboard
* **Dynamic Analytics**: Real-time tracking of solved questions, overall accuracy, syllabus coverage, and daily streaks.
* **Bloom's Cognitive Level Analytics**: Interactive bar chart displaying student performance across different levels of Bloom's Taxonomy (L1 – Remember to L6 – Create).
* **GATE Syllabus Access**: Easy syllabus breakdown and quick PDF download for focused prep.

### ⏱️ Realistic CBT Test Interface
* **Practice Window**: Active daily from **9:00 AM to 7:00 PM** to build a structured routine.
* **One-Attempt Daily Limit**: Enforces discipline by allowing only one attempt per day on assigned exams.
* **Virtual GATE Calculator**: A built-in scientific calculator matching the official GATE online interface to practice actual calculator-based calculations.
* **Topic-wise & Full Syllabus Exams**: Practice specific sections like Electric Circuits, Power Systems, Control Systems, etc., or take full mock tests.

### 🛡️ Admin Console
* **Exam Management**: Assign specific subjects, adjust question counts, and set customized time limits for daily practices.
* **Student Log Tracker**: Monitor details such as scores, timestamps, duration spent, accuracy, and detailed breakdowns of cognitive level performance.
* **Question Database Management**: Upload custom GATE questions directly from the console.

---

## 🛠️ Technology Stack

* **Frontend Framework**: [React](https://react.dev/) + [Vite](https://vite.dev/)
* **Database & Auth**: [Firebase](https://firebase.google.com/) (Realtime Database & Authentication)
* **Styling**: Vanilla CSS (Rich gradients, glassmorphism, responsive grids)
* **Charts**: Custom SVG-based progress bars and interactive charts for cross-platform efficiency.

---

## 🏃‍♂️ Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/ai3d-developer/Gate-Exam-Practice-Website-.git
   cd Gate-Exam-Practice-Website-
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
To launch the development server:
```bash
npm run dev
```

### Production Build
To build and optimize the project for production deployment:
```bash
npm run build
```

---

## 📂 Project Structure

* `src/components/`
  * `Dashboard.jsx`: Student landing page, stats, daily test entry, and Bloom's analytics.
  * `CBTConsole.jsx`: Realistic mock exam interface with timer, color-coded status panel, and navigation.
  * `AdminConsole.jsx`: Panel for educators/administrators to assign exams and audit student submissions.
  * `Calculator.jsx`: Virtual GATE scientific calculator implementation.
  * `LoginScreen.jsx`: Firebase-backed authentication page.
  * `Summary.jsx`: Detailed exam results with Bloom's level breakdown and correct answer keys.
* `src/App.jsx`: Main router and Firebase state controller.
* `public/`: Questions database, answers database, and syllabus documents.
