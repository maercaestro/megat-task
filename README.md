# 💼 Megat-Task

**Megat-Task** is a sleek, AI-powered task manager that blends productivity with intelligence. Built with React, Tailwind CSS, and OpenAI integration, it helps you capture, organize, and execute tasks — with the help of an AI assistant.

![Logo](./src/assets/logo2.png)

---

## ✨ Features

### ✅ Task Management
- Create, edit, delete, and complete tasks
- Classify by priority, section, and due date
- Tasks persist via localStorage

### 🤖 AI-Powered Execution
- AI analyzes tasks for metadata and executability
- Execute AI-compatible tasks with real-time streaming
- Conversations and markdown responses per task
- See AI-cited search results as sources

### 🧠 Smart Views
- **Inbox** – All tasks
- **Today** – Tasks due today
- **AI Tasks** – Tasks the AI can help with
- **Settings** – App metadata and export options

### 💬 Chat Interface
- Streamed chat responses from the AI
- Per-task conversation threads
- Markdown rendering with copy-to-clipboard support

### 👤 Authentication
- Auth integration with `useAuth` hook
- Personalized user profile and avatar in UI

---

## ⚙️ Tech Stack

- **Frontend**: React, Tailwind CSS
- **Icons**: Heroicons
- **Markdown**: react-markdown
- **Authentication**: Custom `useAuth` (e.g., Auth0)
- **AI Backend**:
  - `POST /api/analyze-task`
  - `POST /api/execute-task` (streams chunks)

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/megat-task.git
cd megat-task
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the development server

```bash
npm run dev
```

> Make sure the backend server for AI routes is running at `http://localhost:3000`.

---

## 📁 Folder Structure

```
src/
├── App.js                      # Main application logic
├── assets/                    # Static files (e.g., logo)
├── components/
│   ├── LandingPage.js
│   └── Auth/
│       ├── useAuth.js
│       ├── LoginButton.js
│       └── UserProfile.js
```

---

## 🧪 AI Task Format

When a task is prompted using the "✨ Prompt" button, it is analyzed into:

```json
{
  "text": "Research latest hydrogen trends",
  "section": "Work",
  "priority": "High",
  "dueDate": "2025-04-10",
  "aiExecutable": true,
  "analysis": "User likely wants curated insights on hydrogen developments"
}
```

---

## 📌 Roadmap

- [ ] Dark mode toggle  
- [ ] Cloud sync and multi-device support  
- [ ] Reminder system  
- [ ] AI agent configuration (e.g., GPT-4 vs Claude)

---

## 🧑‍💻 Author

Created with ❤️ by **Abu Huzaifah Bidin**  
📫 [Connect on LinkedIn](https://www.linkedin.com/in/abu-huzaifah-bidin)  
🧪 Version: `1.0.0`

---

## 📜 License

This project is licensed under the MIT License.
