# CodeCollab 🚀

A modern, AI-powered collaborative coding interview platform built with SvelteKit and Svelte 5.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=flat&logo=svelte&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=flat&logo=Prisma&logoColor=white)

## 🌟 Overview

CodeCollab is a comprehensive collaborative coding interview platform designed to streamline technical interviews with advanced features including real-time collaboration, AI-powered assistance, eye tracking, and intelligent monitoring capabilities.

## ✨ Key Features

### 🗓️ Interview Scheduling
- **Smart Scheduling**: Interviewers can easily schedule interviews with automated conflict detection
- **AI Agent Integration**: Intelligent scheduling assistant for managing interview slots
- **Calendar Integration**: Seamless integration with existing calendar systems
- **Conflict Management**: Automatic detection and resolution of scheduling conflicts

### 👨‍💻 Rich Collaborative Editor
- **Multi-Language Support**: Support for multiple programming languages (Python, JavaScript, TypeScript, Java, C++, and more)
- **Syntax Highlighting**: Advanced syntax highlighting for better code readability
- **Real-Time Collaboration**: Live collaborative editing with instant synchronization
- **Code History**: Complete version control and code history tracking
- **Advanced Monitoring**: 
  - **Copy-Paste Detection**: Real-time detection of copy-paste activities
  - **Tab Switching Detection**: Monitor when candidates switch between tabs or applications
  - **System Alerts**: Instant notifications to interviewers about suspicious activities

### 🎥 Video & Communication
- **HD Video Calls**: High-quality video communication between interviewer and candidate
- **Live Subtitles**: Real-time subtitle generation for accessibility
- **Transcription**: Automatic interview transcription for review and analysis
- **Feedback System**: Integrated feedback collection and management

### 👁️ Eye Tracking & Anti-Cheat
- **MediaPipe Integration**: Advanced eye tracking using Google MediaPipe
- **Cheat Detection**: Real-time monitoring of candidate eye movements
- **Suspicious Activity Alerts**: Automatic detection of unusual behavior patterns
- **Privacy-Compliant**: Secure and privacy-focused implementation

### 📊 Intelligent Scoring System
- **Problem-Based Scoring**: Individual scoring for each coding problem
- **Percentage-Based Metrics**: Accurate scoring based on test case success rates
- **Maximum Score Tracking**: Always maintains the highest score achieved
- **Interview-Level Analytics**: Comprehensive interview performance analysis
- **Real-Time Updates**: Live score updates during the interview

### 🤖 AI Agent Capabilities
- **Schedule Management**: AI-powered interview scheduling and management
- **Conflict Resolution**: Intelligent handling of scheduling conflicts
- **Interview Listing**: Smart organization and filtering of interviews
- **Time Complexity Analysis**: Automated analysis of code complexity
- **Performance Insights**: AI-driven insights and recommendations

## 🛠️ Technology Stack

### Frontend
- **SvelteKit**: Modern full-stack framework
- **Svelte 5**: Latest version with enhanced reactivity
- **TypeScript**: Type-safe development
- **Shadcn/UI**: Beautiful and accessible UI components
- **TailwindCSS**: Utility-first CSS framework

### Backend
- **SvelteKit API Routes**: Server-side API endpoints
- **Prisma ORM**: Type-safe database operations
- **WebSocket**: Real-time communication
- **Server-Sent Events (SSE)**: Live updates and notifications

### Database
- **PostgreSQL**: Robust relational database
- **Prisma Schema**: Type-safe database modeling

### Real-Time Features
- **WebRTC**: Peer-to-peer video communication
- **Socket.IO**: Real-time collaborative editing
- **Server-Sent Events**: Live notifications and updates

### AI & ML
- **MediaPipe**: Eye tracking and facial analysis
- **OpenAI Integration**: AI-powered scheduling and analysis
- **Machine Learning**: Behavioral pattern recognition

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-username/code-tantra.git
cd code-tantra
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/codecollab"
AUTH_SECRET="your-auth-secret"
OPENAI_API_KEY="your-openai-key"
AGORA_APP_ID="your-agora-app-id"
AGORA_APP_CERTIFICATE="your-agora-certificate"
```

4. **Set up the database**
```bash
npx prisma migrate dev
npx prisma generate
```

5. **Start the development server**
```bash
npm run dev
```

## 🔐 Security Features

- **Anti-Cheat Monitoring**: Advanced detection of cheating attempts
- **Eye Tracking**: MediaPipe-powered eye movement analysis
- **Activity Monitoring**: Tab switching and copy-paste detection
- **Secure Code Execution**: Sandboxed code execution environment
- **Data Privacy**: GDPR-compliant data handling

## 🎯 Key Workflows

### Interview Flow
1. **Scheduling**: Interviewer schedules interview with AI assistance
2. **Preparation**: System sets up virtual interview room
3. **Conducting**: Real-time collaboration with monitoring
4. **Evaluation**: Automated scoring and manual feedback
5. **Analysis**: Post-interview analytics and insights

### Code Execution
1. **Problem Assignment**: Interviewer adds coding problems
2. **Real-Time Coding**: Candidate writes code with live collaboration
3. **Test Execution**: Automated testing against test cases
4. **Scoring**: Percentage-based scoring with maximum tracking
5. **Feedback**: Instant results and performance metrics

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **SvelteKit Team**: For the amazing framework
- **Shadcn**: For the beautiful UI components
- **MediaPipe**: For eye tracking capabilities
- **Prisma**: For the excellent ORM
- **Agora**: For video communication infrastructure

---

