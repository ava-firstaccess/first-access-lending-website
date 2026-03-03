'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface Project {
  id: string;
  name: string;
  category: 'Automation' | 'Data/Analytics' | 'Infrastructure' | 'Business Systems' | 'Security';
  status: 'Backlog' | 'In Progress' | 'Complete';
  description: string;
  completedDate?: string;
}

const projects: Project[] = [
  // Complete Projects
  {
    id: 'payroll-v3',
    name: 'Payroll Automation v3',
    category: 'Automation',
    status: 'Complete',
    description: 'Biweekly LO commission processing with draw logic, processor bonus, YTD tracking, automated PDF generation and email delivery.',
    completedDate: 'Feb 2026'
  },
  {
    id: 'receipt-tracking',
    name: 'Receipt & Invoice Tracking System',
    category: 'Automation',
    status: 'Complete',
    description: 'Auto-detect receipts/invoices from email, categorize expenses, upload to Drive with YYYY/MM folders, log to Financial Tracking sheet.',
    completedDate: 'Feb 2026'
  },
  {
    id: 'ghl-encompass-api',
    name: 'GHL → Encompass Loan Creation API',
    category: 'Business Systems',
    status: 'Complete',
    description: 'n8n mapping engine with filter-based array paths, phone normalization, boolean handling, custom field mapping for 1003 intake.',
    completedDate: 'Jan 2026'
  },
  {
    id: 'meeting-reminders',
    name: 'Meeting Reminders Automation',
    category: 'Automation',
    status: 'Complete',
    description: 'Auto-schedule cron jobs 2 minutes before each calendar meeting, sends Telegram notification with meeting details.',
    completedDate: 'Feb 2026'
  },
  {
    id: 'email-workflow',
    name: 'Email Workflow Setup',
    category: 'Infrastructure',
    status: 'Complete',
    description: 'Himalaya + gog CLI configuration, forwarding from zbosson@firstaccesslending.com and zachbosson@gmail.com, BCC oversight on all outbound.',
    completedDate: 'Feb 2026'
  },
  {
    id: 'property-pl-2025',
    name: 'Property P&L Reporting (2025)',
    category: 'Data/Analytics',
    status: 'Complete',
    description: '6-property rental portfolio analysis with personal use proration, 1098 integration, escrow reconciliation, branded Excel with charts.',
    completedDate: 'Feb 2026'
  },
  {
    id: 'weekly-lo-stats',
    name: 'Weekly LO Stats Emails',
    category: 'Automation',
    status: 'Complete',
    description: 'Automated weekly performance emails for loan officers with stats from Combined Analytics data, delivered every weekday morning.',
    completedDate: 'Jan 2026'
  },
  {
    id: 'cron-inventory',
    name: 'Cron Job Inventory System',
    category: 'Infrastructure',
    status: 'Complete',
    description: 'Master spreadsheet tracking 17 cron jobs with nightly health check, auto-updates Excel when crons change, commits to git.',
    completedDate: 'Feb 2026'
  },
  {
    id: 'files-to-index',
    name: 'Files To Index Automation',
    category: 'Automation',
    status: 'Complete',
    description: 'Nightly processing of Drive folder to auto-organize property docs, tax forms, receipts, rental photos using address-based routing.',
    completedDate: 'Feb 2026'
  },
  {
    id: 'monthly-expenses',
    name: 'Monthly Expense Processing',
    category: 'Automation',
    status: 'Complete',
    description: 'First-of-month automation for TriNet expense submission: Monarch CSV export, receipt aggregation, formatted email delivery.',
    completedDate: 'Feb 2026'
  },
  {
    id: 'processor-bonus',
    name: 'Processor Bonus Calculation',
    category: 'Automation',
    status: 'Complete',
    description: 'Monthly processor bonus system for Jake Cindario: $150/loan after 10 loans closed, integrated with payroll run.',
    completedDate: 'Feb 2026'
  },
  {
    id: 'emergency-kill-switch',
    name: 'Emergency Kill Switch',
    category: 'Infrastructure',
    status: 'Complete',
    description: 'Security incident response system to revoke all access (Google, email, GitHub) with single command.',
    completedDate: 'Feb 2026'
  },
  {
    id: 'identity-refresh-cron',
    name: 'Identity Refresh Cron',
    category: 'Infrastructure',
    status: 'Complete',
    description: 'Every 30 min during business hours: re-read SOUL.md, AGENTS.md, MEMORY.md to maintain AI grounding after compaction.',
    completedDate: 'Feb 2026'
  },
  {
    id: 'morning-briefing',
    name: 'Morning Briefing System',
    category: 'Automation',
    status: 'Complete',
    description: 'Daily midnight summary email: calendar events, receipts detected, action items, follow-ups.',
    completedDate: 'Feb 2026'
  },
  
  // In Progress Projects
  {
    id: 'payroll-draw-only',
    name: 'Payroll Draw-Only Periods',
    category: 'Automation',
    status: 'In Progress',
    description: 'Retroactive processing of draw-only pay periods (0 loans, $1,200 draw) when next commission period fires.'
  },
  {
    id: 'n8n-api-deployment',
    name: 'n8n API Deployment Workflow',
    category: 'Infrastructure',
    status: 'In Progress',
    description: 'Direct workflow deployment via n8n API instead of manual UI imports. API key configured, deployment scripts in progress.'
  },
  {
    id: 'power-bi-automation',
    name: 'Power BI Data Export Automation',
    category: 'Data/Analytics',
    status: 'In Progress',
    description: 'Azure Power BI API integration to automate Merged Data export (currently manual DAX Studio process). Waiting on API access.'
  },
  
  // Backlog Projects
  {
    id: 'github-push-automation',
    name: 'Automated Git Push on Script Creation',
    category: 'Infrastructure',
    status: 'Backlog',
    description: 'Auto-commit to git immediately after creating/modifying production scripts (.py, .sh, .m, .sql, .json workflows).'
  },
  {
    id: 'workspace-cleanup-scheduler',
    name: 'Workspace Cleanup Scheduler',
    category: 'Infrastructure',
    status: 'Backlog',
    description: 'Scheduled cleanup of workspace files after Drive upload confirmation, distinguish between simple uploads and multi-step projects.'
  },
  {
    id: 'property-expense-extraction',
    name: 'Complete Property Expense Extraction',
    category: 'Data/Analytics',
    status: 'Backlog',
    description: 'Extract all categorized property expenses from transactions (legal, insurance, supplies, utilities) into P&L reports.'
  },
  {
    id: 'ytd-verification-tool',
    name: 'YTD Math Verification Tool',
    category: 'Data/Analytics',
    status: 'Backlog',
    description: 'Automated verification script to catch math errors in payroll YTD files after manual edits.'
  },
  {
    id: 'drive-duplicate-detector',
    name: 'Drive Duplicate Detection',
    category: 'Infrastructure',
    status: 'Backlog',
    description: 'Automated detection and cleanup of duplicate files in Google Drive based on filename/size/content hash.'
  },
  {
    id: 'tax-doc-organizer',
    name: 'Tax Document Auto-Organizer',
    category: 'Automation',
    status: 'Backlog',
    description: 'Auto-detect and organize tax documents (1098s, 1099s, W-2s) into Tax Docs/YYYY/category/ folder structure.'
  },
  {
    id: 'encompass-data-sync',
    name: 'Encompass Data Sync (Daily Incremental)',
    category: 'Business Systems',
    status: 'Backlog',
    description: 'Daily incremental update of Encompass loan data via n8n workflow (existing workflows: full sweep + test mode).'
  },
  {
    id: 'combined-analytics-refresh',
    name: 'Combined Analytics Auto-Refresh',
    category: 'Data/Analytics',
    status: 'Backlog',
    description: 'Automate refresh of Combined Analytics V2 dataset used by LO stats emails and payroll calculations.'
  },
  {
    id: 'flood-insurance-app',
    name: 'Add Flood Insurance to App',
    category: 'Business Systems',
    status: 'Backlog',
    description: 'Integrate flood insurance functionality into application workflow.'
  },
  {
    id: 'power-dialer-ghl',
    name: 'Build Power Dialer to GHL',
    category: 'Automation',
    status: 'Backlog',
    description: 'Build automated power dialer integration with GoHighLevel CRM for outbound calling campaigns.'
  },
  {
    id: 'ghl-dashboard',
    name: 'Build GHL Dashboard',
    category: 'Data/Analytics',
    status: 'Backlog',
    description: 'Create comprehensive dashboard for GoHighLevel metrics, lead flow, conversion tracking, and campaign performance.'
  },
  {
    id: 'calendly-cancel-handler',
    name: 'Build Handler for Canceled Calendly Events',
    category: 'Automation',
    status: 'Backlog',
    description: 'Automated workflow to handle canceled Calendly appointments with notifications and CRM updates.'
  },
  {
    id: 'new-lead-workflow-split',
    name: 'Split Laggy New Lead Text Workflow',
    category: 'Automation',
    status: 'Backlog',
    description: 'Split laggy new lead text workflow into 5 separate workflows and build out comprehensive notification methodology note.'
  },
  {
    id: 'pl-powerbi-rebuild',
    name: 'Rebuild P&L and Power BI',
    category: 'Data/Analytics',
    status: 'Backlog',
    description: 'Rebuild rental property P&L reporting and Power BI integration.'
  },
  {
    id: 'lulu-firewall',
    name: 'Download and Configure Lulu Firewall',
    category: 'Infrastructure',
    status: 'Backlog',
    description: 'Install Lulu (free open-source macOS firewall) to monitor and control outbound network connections. Prevents unauthorized data exfiltration by alerting/blocking when processes try to connect to unknown servers.'
  },
  {
    id: 'filevault-encryption',
    name: 'Enable FileVault Full Disk Encryption',
    category: 'Security',
    status: 'Backlog',
    description: 'Enable FileVault on the MacBook for full disk encryption. Protects all data (client records, API credentials, email, property documents) from physical theft.'
  },
  {
    id: 'bonus-pacing',
    name: 'Bonus Pacing',
    category: 'Data/Analytics',
    status: 'Backlog',
    description: 'Build loan officer bonus pacing tracker to show progress toward monthly thresholds and commission tiers.'
  }
];

export default function ProjectsPage() {
  const backlogProjects = projects.filter(p => p.status === 'Backlog');
  const inProgressProjects = projects.filter(p => p.status === 'In Progress');
  const completeProjects = projects.filter(p => p.status === 'Complete');

  const getCategoryColor = (category: Project['category']) => {
    switch (category) {
      case 'Automation':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Data/Analytics':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Infrastructure':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Business Systems':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Security':
        return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  const ProjectCard = ({ project }: { project: Project }) => (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-heading text-lg font-bold text-[#003961] flex-1">
          {project.name}
        </h3>
      </div>
      
      <p className="text-sm text-gray-600 mb-3 leading-relaxed">
        {project.description}
      </p>
      
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getCategoryColor(project.category)}`}>
          {project.category}
        </span>
        {project.completedDate && (
          <span className="text-xs text-gray-500 font-medium">
            {project.completedDate}
          </span>
        )}
      </div>
    </div>
  );

  const KanbanColumn = ({ 
    title, 
    projects, 
    colorClass 
  }: { 
    title: string; 
    projects: Project[]; 
    colorClass: string;
  }) => (
    <div className="flex-1 min-w-[320px]">
      <div className={`rounded-lg p-4 mb-4 ${colorClass}`}>
        <h2 className="font-heading text-xl font-bold text-white flex items-center justify-between">
          {title}
          <span className="text-sm font-normal bg-white/20 px-3 py-1 rounded-full">
            {projects.length}
          </span>
        </h2>
      </div>
      <div className="space-y-4">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <Header />

      {/* Page Header */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-heading text-5xl md:text-6xl font-bold text-[#003961] leading-tight mb-4">
            AI Systems{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0283DB] to-[#0EF0F0]">
              Project Board
            </span>
          </h1>
          
          <p className="text-xl text-gray-700 leading-relaxed max-w-2xl mx-auto">
            Track the evolution of First Access Lending's automation infrastructure, built by <strong className="text-[#003961]">Ava</strong>, our AI executive assistant.
          </p>
        </div>
      </section>

      {/* Category Legend */}
      <section className="max-w-7xl mx-auto px-6 pb-6">
        <div className="flex flex-wrap justify-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-sm text-gray-700 font-medium">Automation</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            <span className="text-sm text-gray-700 font-medium">Data/Analytics</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-sm text-gray-700 font-medium">Infrastructure</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            <span className="text-sm text-gray-700 font-medium">Business Systems</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-sm text-gray-700 font-medium">Security</span>
          </div>
        </div>
      </section>

      {/* Kanban Board */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="flex flex-col lg:flex-row gap-6">
          <KanbanColumn 
            title="Backlog" 
            projects={backlogProjects}
            colorClass="bg-gradient-to-r from-gray-600 to-gray-700"
          />
          <KanbanColumn 
            title="In Progress" 
            projects={inProgressProjects}
            colorClass="bg-gradient-to-r from-[#0283DB] to-[#0EF0F0]"
          />
          <KanbanColumn 
            title="Complete" 
            projects={completeProjects}
            colorClass="bg-gradient-to-r from-green-600 to-green-700"
          />
        </div>
      </section>

      {/* Stats Summary */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <h2 className="font-heading text-2xl font-bold text-[#003961] mb-6 text-center">
            Portfolio Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#003961] mb-2">{projects.length}</div>
              <div className="text-sm text-gray-600 font-medium">Total Projects</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">{completeProjects.length}</div>
              <div className="text-sm text-gray-600 font-medium">Complete</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#0EF0F0] mb-2">{inProgressProjects.length}</div>
              <div className="text-sm text-gray-600 font-medium">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-600 mb-2">{backlogProjects.length}</div>
              <div className="text-sm text-gray-600 font-medium">Backlog</div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
