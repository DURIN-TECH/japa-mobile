# Japa - Visa Application Assistant

## Project Overview
Japa is a mobile application designed to simplify the visa application process by providing guided assistance for both self-service applications and agent-assisted applications. The app helps users manage document requirements, schedule consultations, and track application progress.

## Core Features

### 1. Visa Application Flows
- **Self-Service Path**
  - ✅ Document requirement checklist
  - ✅ Document upload functionality
  - ✅ Progress tracking
  - 🚧 Schedule management
  - 🚧 Timeline view
  - ⏳ Document validation

- **Agent-Assisted Path**
  - ✅ Agent listing and profiles
  - ✅ Consultation booking
  - ✅ Agent ratings and reviews
  - 🚧 Direct messaging
  - ⏳ Video consultation integration

### 2. Navigation Structure
```typescript
/(tabs)
├── index.tsx // Home screen
├── apply/
│ ├── index.tsx // Visa types listing
│ ├── visa-details/[id] // Visa type details
│ ├── agents/ // Agent listing
│ │ ├── [id] // Agent profile
│ │ ├── book-consultation
│ │ └── visa-service/[type]
│ └── self-service/[id] // Self-service application
```

## Data Models

### Visa Types
```typescript
interface VisaType {
  id: string;
  name: string;
  description: string;
  country: string;
  requirements: Requirement[];
  agents: string[];
  processingTime: string;
  price: number;
}
```

### Applications
```typescript
interface VisaApplication {
  id: string;
  visaTypeId: string;
  userId: string;
  mode: "self" | "agent";
  status: "pending" | "in_progress" | "completed" | "rejected";
  progress: number;
  schedule: Schedule[];
  documents: Document[];
}
```

## Current Status

### Completed
1. Basic navigation structure
2. Visa type listing with country flags
3. Agent profiles and listing
4. Document upload functionality
5. Progress tracking for self-service applications
6. Consultation booking flow

### In Progress
1. Document validation and verification
2. Schedule management for requirements
3. Timeline view for application progress
4. Agent messaging system

### Planned Features
1. Video consultation integration
2. Document OCR verification
3. Payment integration
4. Push notifications
5. Application status updates
6. Multi-language support

## Design Guidelines
- Use consistent spacing (px-4 py-4 for sections)
- Maintain consistent card styling (rounded-xl with border-gray-200)
- Use blue-600 (#2563eb) as primary color
- Consistent typography scale
- Proper error handling and loading states

## Technical Stack
- React Native with Expo
- TypeScript for type safety
- TailwindCSS for styling
- Expo Router for navigation
- Lucide icons
- React Native Safe Area Context

## Known Issues
1. Layout spacing in apply route needs adjustment
2. Document picker needs proper error handling
3. Navigation type definitions need updating
4. Loading states needed for async operations

## Next Steps
1. Implement document validation
2. Add schedule management
3. Create timeline view
4. Set up agent messaging
5. Add loading states
6. Implement search and filtering

## Testing Requirements
- Document upload size limits
- Supported file types
- Navigation flow testing
- Form validation
- Error handling
- Loading states
- Offline support

## Security Considerations
- Secure document storage
- User authentication
- Data encryption
- Session management
- Permission handling

This context will be continuously updated as the project evolves.

## Application Flow
### Japa - Visa Application Assistant

```mermaid
graph TD
    A[Home Screen] --> B[Visa Types List]
    B --> C[Visa Details]
    
    C --> D{Choose Path}
    D -->|Self Service| E[Self Service Flow]
    D -->|Agent Assisted| F[Agents List]
    
    E --> E1[Document Requirements]
    E1 --> E2[Upload Documents]
    E2 --> E3[Track Progress]
    E3 --> E4[Schedule Management]
    E4 --> E5[Submit Application]
    
    F --> F1[Agent Profile]
    F1 --> F2{Choose Service}
    F2 -->|Consultation| F3[Book Consultation]
    F2 -->|Full Service| F4[Visa Service]
    
    F3 --> F5[Select Date/Time]
    F5 --> F6[Payment]
    F6 --> F7[Confirmation]
    
    F4 --> F8[Document Collection]
    F8 --> F9[Agent Review]
    F9 --> F10[Application Submit]
    
    subgraph "Document Management"
        E2 --> G[Validation]
        G --> H[Storage]
        H --> I[Status Update]
    end
    
    subgraph "Application Tracking"
        E5 --> J[Status Updates]
        F10 --> J
        J --> K[Timeline View]
        K --> L[Notifications]
    end
    
    subgraph "Communication"
        F1 --> M[Direct Messages]
        F3 --> N[Video Call]
        M --> O[Chat History]
    end

    style A fill:#d4e8ff,stroke:#2563eb
    style B fill:#d4e8ff,stroke:#2563eb
    style C fill:#d4e8ff,stroke:#2563eb
    style D fill:#ffd4d4,stroke:#dc2626
    style E fill:#d4ffd4,stroke:#16a34a
    style F fill:#d4ffd4,stroke:#16a34a
    
    classDef completed fill:#d4ffd4,stroke:#16a34a;
    classDef inProgress fill:#fff4d4,stroke:#ca8a04;
    classDef planned fill:#ffd4d4,stroke:#dc2626;
    
    class E1,E2,E3,F1,F3,F5,F6,F7 completed;
    class E4,F8,F9,G,H,I inProgress;
    class M,N,O,L planned;
```

## Screen States

```mermaid
stateDiagram-v2
    [*] --> Home
    Home --> VisaList
    VisaList --> VisaDetails
    
    state VisaDetails {
        [*] --> ViewingDetails
        ViewingDetails --> ChoosingPath
        ChoosingPath --> SelfService
        ChoosingPath --> AgentAssisted
    }
    
    state SelfService {
        [*] --> DocumentUpload
        DocumentUpload --> Progress
        Progress --> Schedule
        Schedule --> Submit
    }
    
    state AgentAssisted {
        [*] --> AgentList
        AgentList --> AgentProfile
        AgentProfile --> Consultation
        AgentProfile --> VisaService
        Consultation --> Payment
        Payment --> Confirmation
    }
```