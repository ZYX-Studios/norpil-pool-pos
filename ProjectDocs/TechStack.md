# Technology Stack

This project is built using a modern web development stack, prioritizing performance, scalability, and ease of deployment.

## Core Framework
- **[Next.js 15+](https://nextjs.org/)**: The React framework for the web. Used for both frontend UI and backend API routes.
  - **App Router**: Utilizes the modern file-system based routing.
  - **Server Components**: Leverages React Server Components for improved performance.

## Language
- **[TypeScript](https://www.typescriptlang.org/)**: Strongly typed JavaScript for better code quality and developer experience.

## Database & Backend
- **[Supabase](https://supabase.com/)**: An open-source Firebase alternative.
  - **PostgreSQL**: The underlying relational database.
  - **Auth**: Authentication and user management.
  - **Realtime**: Real-time subscriptions for live updates (e.g., active orders).
  - **Storage**: (If used) File storage for images.

## Styling
- **[Tailwind CSS](https://tailwindcss.com/)**: A utility-first CSS framework for rapid UI development.
- **[Lucide React](https://lucide.dev/)**: Icon library.
- **[shadcn/ui](https://ui.shadcn.com/)** (Likely used based on components): Reusable components built with Radix UI and Tailwind.

## Libraries & Tools
- **@supabase/ssr**: Supabase client for Next.js 14+ Server Side Rendering.
- **Puppeteer**: Used for generating PDFs or handling print jobs.
- **Recharts**: For data visualization in admin reports.
- **Date-fns**: For date and time manipulation.
- **React Hook Form** / **Zod** (Inferred): For form handling and validation.

## Deployment
- **Vercel** (Typical for Next.js): Optimized hosting platform.
