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

export const categoryColors: Record<PromptCategory, string> = {
  general: "bg-primary/10 text-primary",
  frontend: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  backend: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  fullstack: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  devops: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  data: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "ml-ai": "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  security: "bg-red-500/10 text-red-700 dark:text-red-300",
  testing: "bg-lime-500/10 text-lime-700 dark:text-lime-300",
  api: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  automation: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  docs: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
};
