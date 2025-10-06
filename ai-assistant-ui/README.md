# NeuroFlow AI Assistant - Frontend UI

An elegant, minimalist interface for the AI Assistant designed specifically for neurodivergent professionals. This frontend connects to a powerful Next.js backend that provides Gmail integration, Claude AI email classification, and calendar management.

## ✨ Features

### 🧠 Neurodivergent-Friendly Design
- Clean, calming interface with minimal cognitive load
- Consistent navigation patterns and clear visual hierarchy
- Customizable working hours and notification preferences
- High contrast options and reduced motion support

### 🔌 Gmail Integration
- OAuth2 authentication with secure token management
- Real-time email fetching and synchronization
- Connection status indicators and health monitoring
- Multi-account support ready

### 🤖 AI-Powered Email Management
- Claude AI email classification and categorization
- Intelligent priority scoring (1-5 scale)  
- Smart filtering and urgent email detection
- Confidence indicators and user feedback system

### 📊 Dashboard & Analytics
- Priority inbox with color-coded urgency levels
- Working hours visualization and progress tracking
- AI processing status indicators
- Email processing statistics and insights

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ (for development server)
- Python 3.x (for HTTP server)
- Access to the Next.js backend API (running on localhost:3000)

### Installation

1. **Navigate to the UI directory:**
   ```bash
   cd ai-assistant-ui
   ```

2. **Install dependencies (optional for deployment):**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   # or alternatively
   python -m http.server 8080
   ```

4. **Open in browser:**
   ```
   http://localhost:8080
   ```

## 🏗️ Architecture

### Frontend Structure
```
ai-assistant-ui/
├── index.html          # Dashboard page
├── emails.html         # Email management interface  
├── calendar.html       # Calendar integration
├── notifications.html  # Notification center
├── js/
│   ├── api-client.js   # Backend API communication
│   ├── ui-components.js # Dynamic UI updates
│   └── app.js          # Main application controller
├── css/                # Additional stylesheets (if needed)
├── assets/             # Images and static assets
└── package.json        # Build configuration
```

### Key JavaScript Modules

#### ApiClient (`js/api-client.js`)
- Handles all communication with Next.js backend
- Gmail OAuth flow management
- AI classification requests
- Calendar integration calls
- Error handling and retry logic

#### UIComponents (`js/ui-components.js`)
- Dynamic UI state management
- Email list rendering and updates
- Connection status indicators
- Notification system
- Working hours visualization

#### NeuroFlowApp (`js/app.js`)
- Main application orchestrator
- Event handling and user interactions
- Page-specific data loading
- Periodic refresh and real-time updates

## 🎨 Design System

### Color Palette
- **Primary Blue**: `#3b82f6` - Trust and reliability
- **Secondary Green**: `#10b981` - Success and growth  
- **Calm Gray**: `#9ca3af` - Neutral and accessible
- **Light Background**: `#f9fafb` - Calm and spacious

### Email Priority Colors
- **High Priority**: Red border-left (`#ef4444`)
- **Medium Priority**: Yellow border-left (`#f59e0b`)
- **Low Priority**: Green border-left (`#10b981`)

### Category Colors
- **Work**: Blue (`#dbeafe` / `#1d4ed8`)
- **Personal**: Green (`#dcfce7` / `#15803d`)
- **Financial**: Amber (`#fef3c7` / `#d97706`)
- **Opportunities**: Purple (`#ede9fe` / `#7c3aed`)
- **Newsletters**: Sky (`#e0f2fe` / `#0369a1`)
- **Spam**: Red (`#fee2e2` / `#b91c1c`)

## 🔧 Configuration

### Backend API Connection
The frontend is configured to connect to `http://localhost:3000` by default. To change this:

```javascript
// In js/api-client.js
const apiClient = new ApiClient('https://your-backend-url.com');
```

## 🔐 Security & Privacy

- All authentication is handled by the backend
- No sensitive data is stored in localStorage
- CORS is configured for secure API communication
- OAuth tokens are managed server-side only

## 📱 Mobile Support

The interface is fully responsive with:
- Collapsible sidebar navigation
- Touch-friendly interaction targets
- Optimized email list view
- Mobile-first responsive breakpoints

## 🎯 Neurodivergent-Specific Features

### Cognitive Load Reduction
- Clear visual hierarchy with generous whitespace
- Consistent interaction patterns
- Minimal decision fatigue with smart defaults
- Progress indicators for all operations

### Customization Options
- Working hours configuration
- Notification preferences
- Email categorization rules
- Priority thresholds

### Accessibility
- High contrast mode support
- Keyboard navigation
- Screen reader compatibility
- Reduced motion preferences

## 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Build for production (no-op for static files)
npm run build

# Deploy to GitHub Pages
npm run deploy

# Run linting
npm run lint
```

## 🚀 Deployment Status

### Phase 1: Foundation ✅ COMPLETE
- ✅ GitHub repository structure
- ✅ JavaScript modules architecture  
- ✅ Build process for deployment

### Phase 2: Core Integration 🚧 IN PROGRESS
- 🚧 Gmail OAuth integration (frontend)
- ⏳ Email fetching and display
- ⏳ Real-time status updates

### Phase 3: AI Features ⏳ PLANNED
- ⏳ Claude AI email classification
- ⏳ Priority scoring visualization
- ⏳ Category assignment

### Phase 4: Advanced Features ⏳ PLANNED
- ⏳ Calendar integration
- ⏳ Notification system
- ⏳ User preferences

## 🤝 Integration with Backend

This frontend is designed to work seamlessly with the Next.js backend located in the parent directory (`../`). The backend provides:

- Gmail API integration with OAuth2
- Claude AI email classification
- Secure token management
- RESTful API endpoints
- Real-time data synchronization

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ for the neurodivergent community, empowering professionals to manage their digital communication more effectively and with less stress.