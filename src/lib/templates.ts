export type PromptCategory =
  | "general"
  | "frontend"
  | "backend"
  | "fullstack"
  | "devops"
  | "data"
  | "ml-ai"
  | "security"
  | "testing"
  | "api"
  | "automation"
  | "docs";

export interface PromptTemplate {
  id: string;
  name: string;
  category: PromptCategory;
  description: string;
  starterPrompt: string;
  role: string;
  task: string;
  context: string;
  format: string[];
  lengthPreference: string;
  tone: string;
  complexity: string;
  constraints: string[];
  examples: string;
}

export interface PromptCategorySkin {
  card: string;
  iconWrap: string;
  badge: string;
  action: string;
}

export const templates: PromptTemplate[] = [
  {
    id: "blog-post",
    name: "Blog Post Writer",
    category: "docs",
    description: "Create engaging blog posts on any topic with SEO optimization",
    starterPrompt: "Write a 1,200-word blog post about edge AI for small businesses.",
    role: "Expert Copywriter & SEO Specialist",
    task: "Write a comprehensive, engaging blog post",
    context: "The blog targets a general audience interested in learning new topics. Content should be informative yet accessible.",
    format: ["Markdown"],
    lengthPreference: "detailed",
    tone: "Professional",
    complexity: "Moderate",
    constraints: ["Include citations", "Think step-by-step"],
    examples: "",
  },
  {
    id: "social-media",
    name: "Social Media Post",
    category: "general",
    description: "Craft attention-grabbing social media content",
    starterPrompt: "Create 3 LinkedIn posts announcing our spring product launch.",
    role: "Social Media Marketing Expert",
    task: "Create engaging social media posts that drive engagement",
    context: "Posts should be platform-optimized and include relevant hashtags. Focus on shareability.",
    format: ["Bullet points"],
    lengthPreference: "brief",
    tone: "Casual",
    complexity: "Simple",
    constraints: ["Be conversational"],
    examples: "",
  },
  {
    id: "email-campaign",
    name: "Email Campaign",
    category: "general",
    description: "Write persuasive email sequences",
    starterPrompt: "Draft a 4-email onboarding sequence for new trial users.",
    role: "Email Marketing Strategist",
    task: "Write a compelling email that converts readers",
    context: "Professional email targeting potential customers. Should follow email marketing best practices.",
    format: ["Paragraph form"],
    lengthPreference: "standard",
    tone: "Professional",
    complexity: "Moderate",
    constraints: ["Use formal tone"],
    examples: "",
  },
  {
    id: "data-analysis",
    name: "Data Analysis Report",
    category: "data",
    description: "Analyze datasets and provide actionable insights",
    starterPrompt: "Analyze this churn dataset and summarize the top 5 retention risks.",
    role: "Senior Data Analyst",
    task: "Analyze the provided data and generate a comprehensive report with insights",
    context: "Data-driven analysis targeting business decision makers who need actionable recommendations.",
    format: ["Table", "Bullet points"],
    lengthPreference: "detailed",
    tone: "Technical",
    complexity: "Advanced",
    constraints: ["Include citations", "Think step-by-step", "Avoid jargon"],
    examples: "",
  },
  {
    id: "code-review",
    name: "Code Review",
    category: "testing",
    description: "Thorough code review with improvement suggestions",
    starterPrompt: "Review this TypeScript API handler for bugs, security, and performance.",
    role: "Senior Software Engineer",
    task: "Review the provided code for bugs, performance issues, and best practices",
    context: "Code review for a production application. Focus on security, maintainability, and performance.",
    format: ["Code block", "Bullet points"],
    lengthPreference: "detailed",
    tone: "Technical",
    complexity: "Advanced",
    constraints: ["Think step-by-step"],
    examples: "",
  },
  {
    id: "brainstorm",
    name: "Brainstorming Session",
    category: "general",
    description: "Generate creative ideas and explore possibilities",
    starterPrompt: "Brainstorm 20 campaign ideas for a zero-budget local fitness app launch.",
    role: "Creative Director & Innovation Consultant",
    task: "Generate diverse, creative ideas and explore possibilities",
    context: "Open-ended creative brainstorming session. Push boundaries and think outside the box.",
    format: ["Numbered list"],
    lengthPreference: "detailed",
    tone: "Creative",
    complexity: "Moderate",
    constraints: ["Be conversational"],
    examples: "",
  },
  {
    id: "story-writing",
    name: "Story Writing",
    category: "general",
    description: "Craft compelling narratives and stories",
    starterPrompt: "Write a short sci-fi story about a city powered by memories.",
    role: "Published Fiction Author",
    task: "Write a compelling story with vivid characters and engaging plot",
    context: "Creative fiction writing. Focus on character development, dialogue, and narrative tension.",
    format: ["Paragraph form"],
    lengthPreference: "detailed",
    tone: "Creative",
    complexity: "Advanced",
    constraints: [],
    examples: "",
  },
  {
    id: "business-proposal",
    name: "Business Proposal",
    category: "general",
    description: "Create professional business proposals",
    starterPrompt: "Draft a proposal to redesign a retailer's ecommerce checkout flow.",
    role: "Business Development Consultant",
    task: "Draft a professional business proposal",
    context: "Formal business document targeting potential clients or stakeholders. Should demonstrate value proposition clearly.",
    format: ["Markdown", "Bullet points"],
    lengthPreference: "detailed",
    tone: "Professional",
    complexity: "Advanced",
    constraints: ["Use formal tone", "Include citations"],
    examples: "",
  },
  {
    id: "lesson-plan",
    name: "Lesson Plan",
    category: "docs",
    description: "Design structured educational lesson plans",
    starterPrompt: "Create a 45-minute lesson plan to teach photosynthesis to 8th graders.",
    role: "Experienced Educator & Curriculum Designer",
    task: "Create a structured, engaging lesson plan",
    context: "Educational content designed for effective learning outcomes. Include activities, assessments, and clear objectives.",
    format: ["Numbered list", "Bullet points"],
    lengthPreference: "detailed",
    tone: "Professional",
    complexity: "Moderate",
    constraints: ["Avoid jargon", "Think step-by-step"],
    examples: "",
  },
  {
    id: "explainer",
    name: "Concept Explainer",
    category: "docs",
    description: "Explain complex topics in simple terms",
    starterPrompt: "Explain how neural networks work using simple everyday analogies.",
    role: "Expert Teacher & Science Communicator",
    task: "Explain a complex concept in simple, easy-to-understand terms",
    context: "Educational explanation for beginners. Use analogies and real-world examples.",
    format: ["Paragraph form", "Bullet points"],
    lengthPreference: "standard",
    tone: "Casual",
    complexity: "Simple",
    constraints: ["Avoid jargon", "Be conversational"],
    examples: "",
  },
];

export const categoryLabels: Record<PromptCategory, string> = {
  general: "General",
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Fullstack",
  devops: "DevOps",
  data: "Data",
  "ml-ai": "ML / AI",
  security: "Security",
  testing: "Testing",
  api: "API",
  automation: "Automation",
  docs: "Docs",
};

export const promptCategorySkins: Record<PromptCategory, PromptCategorySkin> = {
  general: {
    card:
      "border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card hover:border-primary/45",
    iconWrap: "bg-primary/15 text-primary",
    badge: "border-transparent bg-primary/15 text-primary",
    action: "border-primary/30 bg-primary/10 text-primary",
  },
  frontend: {
    card:
      "border-utility-blue-light-200 bg-gradient-to-br from-utility-blue-light-50 via-card to-card hover:border-utility-blue-light-300",
    iconWrap: "bg-utility-blue-light-50 text-utility-blue-light-700",
    badge: "border-transparent bg-utility-blue-light-50 text-utility-blue-light-700",
    action: "border-utility-blue-light-200 bg-utility-blue-light-50 text-utility-blue-light-700",
  },
  backend: {
    card:
      "border-utility-success-200 bg-gradient-to-br from-utility-success-50 via-card to-card hover:border-utility-success-300",
    iconWrap: "bg-utility-success-50 text-utility-success-700",
    badge: "border-transparent bg-utility-success-50 text-utility-success-700",
    action: "border-utility-success-200 bg-utility-success-50 text-utility-success-700",
  },
  fullstack: {
    card:
      "border-utility-purple-200 bg-gradient-to-br from-utility-purple-50 via-card to-card hover:border-utility-purple-300",
    iconWrap: "bg-utility-purple-50 text-utility-purple-700",
    badge: "border-transparent bg-utility-purple-50 text-utility-purple-700",
    action: "border-utility-purple-200 bg-utility-purple-50 text-utility-purple-700",
  },
  devops: {
    card:
      "border-utility-gray-blue-200 bg-gradient-to-br from-utility-gray-blue-50 via-card to-card hover:border-utility-gray-blue-300",
    iconWrap: "bg-utility-gray-blue-50 text-utility-gray-blue-700",
    badge: "border-transparent bg-utility-gray-blue-50 text-utility-gray-blue-700",
    action: "border-utility-gray-blue-200 bg-utility-gray-blue-50 text-utility-gray-blue-700",
  },
  data: {
    card:
      "border-utility-warning-200 bg-gradient-to-br from-utility-warning-50 via-card to-card hover:border-utility-warning-300",
    iconWrap: "bg-utility-warning-50 text-utility-warning-700",
    badge: "border-transparent bg-utility-warning-50 text-utility-warning-700",
    action: "border-utility-warning-200 bg-utility-warning-50 text-utility-warning-700",
  },
  "ml-ai": {
    card:
      "border-utility-pink-200 bg-gradient-to-br from-utility-pink-50 via-card to-card hover:border-utility-pink-300",
    iconWrap: "bg-utility-pink-50 text-utility-pink-700",
    badge: "border-transparent bg-utility-pink-50 text-utility-pink-700",
    action: "border-utility-pink-200 bg-utility-pink-50 text-utility-pink-700",
  },
  security: {
    card:
      "border-utility-error-200 bg-gradient-to-br from-utility-error-50 via-card to-card hover:border-utility-error-300",
    iconWrap: "bg-utility-error-50 text-utility-error-700",
    badge: "border-transparent bg-utility-error-50 text-utility-error-700",
    action: "border-utility-error-200 bg-utility-error-50 text-utility-error-700",
  },
  testing: {
    card:
      "border-utility-blue-200 bg-gradient-to-br from-utility-blue-50 via-card to-card hover:border-utility-blue-300",
    iconWrap: "bg-utility-blue-50 text-utility-blue-700",
    badge: "border-transparent bg-utility-blue-50 text-utility-blue-700",
    action: "border-utility-blue-200 bg-utility-blue-50 text-utility-blue-700",
  },
  api: {
    card:
      "border-utility-indigo-200 bg-gradient-to-br from-utility-indigo-50 via-card to-card hover:border-utility-indigo-300",
    iconWrap: "bg-utility-indigo-50 text-utility-indigo-700",
    badge: "border-transparent bg-utility-indigo-50 text-utility-indigo-700",
    action: "border-utility-indigo-200 bg-utility-indigo-50 text-utility-indigo-700",
  },
  automation: {
    card:
      "border-utility-gray-200 bg-gradient-to-br from-utility-gray-50 via-card to-card hover:border-utility-gray-300",
    iconWrap: "bg-utility-gray-50 text-utility-gray-700",
    badge: "border-transparent bg-utility-gray-50 text-utility-gray-700",
    action: "border-utility-gray-200 bg-utility-gray-50 text-utility-gray-700",
  },
  docs: {
    card:
      "border-utility-orange-200 bg-gradient-to-br from-utility-orange-50 via-card to-card hover:border-utility-orange-300",
    iconWrap: "bg-utility-orange-50 text-utility-orange-700",
    badge: "border-transparent bg-utility-orange-50 text-utility-orange-700",
    action: "border-utility-orange-200 bg-utility-orange-50 text-utility-orange-700",
  },
};

export const categoryColors: Record<PromptCategory, string> = {
  general: promptCategorySkins.general.badge,
  frontend: promptCategorySkins.frontend.badge,
  backend: promptCategorySkins.backend.badge,
  fullstack: promptCategorySkins.fullstack.badge,
  devops: promptCategorySkins.devops.badge,
  data: promptCategorySkins.data.badge,
  "ml-ai": promptCategorySkins["ml-ai"].badge,
  security: promptCategorySkins.security.badge,
  testing: promptCategorySkins.testing.badge,
  api: promptCategorySkins.api.badge,
  automation: promptCategorySkins.automation.badge,
  docs: promptCategorySkins.docs.badge,
};
